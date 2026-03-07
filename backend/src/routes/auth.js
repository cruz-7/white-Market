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
export default authRouter;
