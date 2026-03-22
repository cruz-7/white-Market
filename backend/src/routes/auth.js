import { Router } from "express";
import { supabase, supabasePublic } from "../lib/supabaseClient.js";
import { requireAdmin } from "../middleware/requireAdmin.js";
import { requireAuth } from "../middleware/requireAuth.js";

const authRouter = Router();
const allowedEmailDomains = (process.env.ALLOWED_EMAIL_DOMAINS || "")
  .split(",")
  .map((value) => value.trim().toLowerCase())
  .filter(Boolean);

function isAllowedDomain(email) {
  if (allowedEmailDomains.length === 0) {
    return true;
  }

  const [, domain = ""] = String(email).toLowerCase().split("@");
  return allowedEmailDomains.includes(domain);
}

authRouter.post("/signup", async (req, res) => {
  const { email, password, full_name } = req.body || {};

  if (!email || !password) {
    return res.status(400).json({ error: "email and password are required" });
  }

  if (!supabasePublic) {
    return res.status(500).json({ error: "SUPABASE_ANON_KEY is not configured in backend/.env" });
  }

  const normalizedEmail = email.trim().toLowerCase();

  if (!isAllowedDomain(normalizedEmail)) {
    return res.status(400).json({ error: "Email domain is not allowed" });
  }

  const { data, error } = await supabasePublic.auth.signUp({
    email: normalizedEmail,
    password,
    options: {
      data: {
        full_name: full_name || null,
      },
    },
  });

  if (error) return res.status(400).json({ error: error.message });

  const user = data.user;
  if (user) {
    const { error: profileError } = await supabase.from("users").upsert(
      {
        id: user.id,
        email: normalizedEmail,
        full_name: full_name || null,
        role: "user",
      },
      { onConflict: "id" },
    );

    if (profileError) {
      return res.status(400).json({ error: profileError.message });
    }
  }

  return res.status(201).json({
    message: data.session
      ? "User created successfully"
      : "Signup initiated. Please check your email to confirm your account.",
    user,
    access_token: data.session?.access_token,
  });
});

authRouter.post("/login", async (req, res) => {
  const { email, password } = req.body || {};

  if (!email || !password) {
    return res.status(400).json({ error: "email and password are required" });
  }

  if (!supabasePublic) {
    return res.status(500).json({ error: "SUPABASE_ANON_KEY is not configured in backend/.env" });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const { data, error } = await supabasePublic.auth.signInWithPassword({ email: normalizedEmail, password });

  if (error) return res.status(401).json({ error: error.message });

  return res.json({
    access_token: data.session?.access_token,
    user: data.user,
  });
});

// Admin-only endpoint to confirm user email.
authRouter.post("/confirm-email", requireAuth, requireAdmin, async (req, res) => {
  const { user_id, email } = req.body || {};
  let targetUserId = user_id;

  if (!targetUserId && !email) {
    return res.status(400).json({ error: "user_id or email is required" });
  }

  if (!targetUserId) {
    const normalizedEmail = String(email).trim().toLowerCase();
    const { data: profile, error: profileError } = await supabase
      .from("users")
      .select("id")
      .eq("email", normalizedEmail)
      .maybeSingle();

    if (profileError) {
      return res.status(400).json({ error: profileError.message });
    }

    if (!profile) {
      return res.status(404).json({ error: "User not found" });
    }

    targetUserId = profile.id;
  }

  const { error: confirmError } = await supabase.auth.admin.updateUserById(targetUserId, {
    email_confirm: true,
  });

  if (confirmError) {
    return res.status(400).json({ error: confirmError.message });
  }

  return res.json({ message: "Email confirmed successfully", user_id: targetUserId });
});

// POST /auth/forgot-password - Request password reset
// Rate limited to prevent abuse - max 3 requests per hour per IP
const forgotPasswordAttempts = new Map();
const FORGOT_PASSWORD_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const FORGOT_PASSWORD_MAX_ATTEMPTS = 3;

authRouter.post("/forgot-password", async (req, res) => {
  const { email } = req.body || {};

  if (!email) {
    return res.status(400).json({ error: "email is required" });
  }

  if (!supabasePublic) {
    return res.status(500).json({ error: "SUPABASE_ANON_KEY is not configured in backend/.env" });
  }

  // Rate limiting by IP
  const clientIP = req.ip || req.headers['x-forwarded-for'] || 'unknown';
  const now = Date.now();
  const userAttempts = forgotPasswordAttempts.get(clientIP) || { count: 0, resetAt: now };
  
  // Reset if window expired
  if (now >= userAttempts.resetAt) {
    userAttempts.count = 0;
    userAttempts.resetAt = now + FORGOT_PASSWORD_WINDOW_MS;
  }
  
  // Check rate limit
  if (userAttempts.count >= FORGOT_PASSWORD_MAX_ATTEMPTS) {
    return res.status(429).json({ 
      error: "Too many reset requests. Please try again later.",
      retryAfter: Math.ceil((userAttempts.resetAt - now) / 1000)
    });
  }
  
  userAttempts.count++;
  forgotPasswordAttempts.set(clientIP, userAttempts);

  const normalizedEmail = email.trim().toLowerCase();

  // Generate password reset link
  const { error } = await supabasePublic.auth.resetPasswordForEmail(normalizedEmail, {
    redirectTo: `${process.env.FRONTEND_URL || "http://localhost:5173"}/reset-password`,
  });

  // Always return success to prevent email enumeration
  if (error) {
    console.error("Password reset error:", error);
  }

  return res.json({ 
    message: "If an account exists with this email, a password reset link has been sent",
    // In development, include the token for testing
    ...(process.env.NODE_ENV === 'development' && { dev_note: "Check Supabase dashboard for reset emails" })
  });
});

// POST /auth/reset-password - Reset password with token from email
// The token is passed in the URL hash by Supabase, frontend extracts it
authRouter.post("/reset-password", async (req, res) => {
  const { access_token, password } = req.body || {};

  if (!access_token || !password) {
    return res.status(400).json({ error: "access_token and password are required" });
  }

  if (!supabase) {
    return res.status(500).json({ error: "Server configuration error" });
  }

  // Validate password strength
  if (password.length < 8) {
    return res.status(400).json({ error: "Password must be at least 8 characters" });
  }
  
  if (!/[A-Z]/.test(password)) {
    return res.status(400).json({ error: "Password must contain at least one uppercase letter" });
  }
  
  if (!/[a-z]/.test(password)) {
    return res.status(400).json({ error: "Password must contain at least one lowercase letter" });
  }
  
  if (!/[0-9]/.test(password)) {
    return res.status(400).json({ error: "Password must contain at least one number" });
  }

  try {
    // Use the access token from the URL hash to update password
    const { data, error } = await supabase.auth.updateUser(
      { password },
      { 
        headers: {
          Authorization: `Bearer ${access_token}`
        }
      }
    );

    if (error) {
      console.error("Password reset update error:", error);
      return res.status(400).json({ error: "Invalid or expired reset token. Please request a new reset link." });
    }

    return res.json({ 
      message: "Password reset successful. You can now log in with your new password.",
      user: data.user ? { id: data.user.id, email: data.user.email } : null
    });
  } catch (err) {
    console.error("Password reset exception:", err);
    return res.status(500).json({ error: "Failed to reset password. Please try again." });
  }
});

// POST /auth/change-password - Change password for logged-in user
// Requires authentication - verifies current password before allowing change
authRouter.post("/change-password", requireAuth, async (req, res) => {
  const { current_password, new_password } = req.body || {};
  const userId = req.user?.id;

  if (!current_password || !new_password) {
    return res.status(400).json({ error: "current_password and new_password are required" });
  }

  if (!userId) {
    return res.status(401).json({ error: "Authentication required" });
  }

  if (!supabasePublic || !supabase) {
    return res.status(500).json({ error: "Server configuration error" });
  }

  // Get user's email first
  const { data: userData, error: userError } = await supabase.auth.getUser(userId);
  if (userError || !userData?.user) {
    return res.status(404).json({ error: "User not found" });
  }

  const userEmail = userData.user.email;

  // Verify current password by attempting to sign in
  const { error: verifyError } = await supabasePublic.auth.signInWithPassword({
    email: userEmail,
    password: current_password
  });

  if (verifyError) {
    // Don't reveal if it's wrong username or password
    return res.status(401).json({ error: "Current password is incorrect" });
  }

  // Validate new password strength
  if (new_password.length < 8) {
    return res.status(400).json({ error: "New password must be at least 8 characters" });
  }
  
  if (!/[A-Z]/.test(new_password)) {
    return res.status(400).json({ error: "New password must contain at least one uppercase letter" });
  }
  
  if (!/[a-z]/.test(new_password)) {
    return res.status(400).json({ error: "New password must contain at least one lowercase letter" });
  }
  
  if (!/[0-9]/.test(new_password)) {
    return res.status(400).json({ error: "New password must contain at least one number" });
  }

  // Check that new password is different from current
  if (current_password === new_password) {
    return res.status(400).json({ error: "New password must be different from current password" });
  }

  // Use admin client to update password (more secure, bypasses some checks)
  const { data, error } = await supabase.auth.admin.updateUserById(userId, {
    password: new_password
  });

  if (error) {
    console.error("Password change error:", error);
    return res.status(400).json({ error: error.message });
  }

  return res.json({ 
    message: "Password changed successfully",
    user: { id: data.user.id, email: data.user.email }
  });
});

// GET /auth/verify-reset-token - Verify if a reset token is valid (optional endpoint)
authRouter.get("/verify-reset-token", async (req, res) => {
  const { access_token } = req.query;

  if (!access_token) {
    return res.status(400).json({ error: "access_token is required", valid: false });
  }

  if (!supabase) {
    return res.status(500).json({ error: "Server configuration error", valid: false });
  }

  try {
    const { data, error } = await supabase.auth.getUser(access_token);
    
    if (error || !data?.user) {
      return res.json({ valid: false, error: "Invalid or expired token" });
    }

    return res.json({ valid: true, user_id: data.user.id });
  } catch (err) {
    return res.json({ valid: false, error: "Token verification failed" });
  }
});

export default authRouter;
