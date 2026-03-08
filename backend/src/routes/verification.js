import express from "express";
import { supabase } from "../lib/supabaseClient.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { requireAdmin } from "../middleware/requireAdmin.js";

const router = express.Router();

// Allowed student email domains
const ALLOWED_DOMAINS = ["st.ug.edu.gh", "ug.edu.gh"];

/**
 * Check if email domain is from allowed school domain
 */
function isSchoolEmail(email) {
  if (!email) return false;
  const domain = email.split("@")[1]?.toLowerCase();
  return ALLOWED_DOMAINS.includes(domain);
}

/**
 * GET /verification/status - Get current user's verification status
 */
router.get("/status", requireAuth, async (req, res) => {
  try {
    const { data: user, error: userError } = await supabase
      .from("users")
      .select("id, email, verified, verification_status")
      .eq("id", req.user.id)
      .single();

    if (userError || !user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Check if they have a pending verification
    const { data: verification } = await supabase
      .from("verifications")
      .select("*")
      .eq("user_id", req.user.id)
      .in("status", ["pending", "approved", "rejected"])
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    // Auto-approve if school email (instant verification)
    const isSchool = isSchoolEmail(user.email);
    
    return res.json({
      verified: user.verified || isSchool,
      verification_status: verification?.status || (isSchool ? "approved" : user.verification_status || "none"),
      document_type: verification?.document_type || null,
      created_at: verification?.created_at || null,
      is_school_email: isSchool,
    });
  } catch (error) {
    console.error("Get verification status error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * POST /verification/request - Submit verification request
 */
router.post("/request", requireAuth, async (req, res) => {
  try {
    const { document_type } = req.body;

    // Validate document type
    if (!document_type || !["student_id", "admission_letter"].includes(document_type)) {
      return res.status(400).json({ 
        error: "Invalid document type. Must be 'student_id' or 'admission_letter'" 
      });
    }

    // Check if user already has a pending verification
    const { data: existing } = await supabase
      .from("verifications")
      .select("id, status")
      .eq("user_id", req.user.id)
      .eq("status", "pending")
      .single();

    if (existing) {
      return res.status(400).json({ 
        error: "You already have a pending verification request",
        status: "pending"
      });
    }

    // Check if user is already verified
    const { data: user } = await supabase
      .from("users")
      .select("verified, verification_status, email")
      .eq("id", req.user.id)
      .single();

    if (user?.verified) {
      return res.status(400).json({ error: "You are already verified" });
    }

    // Auto-verify if school email
    if (isSchoolEmail(user?.email)) {
      // Update user record
      await supabase
        .from("users")
        .update({ 
          verified: true, 
          verification_status: "approved" 
        })
        .eq("id", req.user.id);

      return res.json({
        message: "Verification approved instantly (school email verified)",
        status: "approved",
        verified: true,
      });
    }

    // Create pending verification record (for manual review)
    // Note: In production, you'd upload the document to Supabase Storage first
    const { data: verification, error: verError } = await supabase
      .from("verifications")
      .insert({
        user_id: req.user.id,
        document_type,
        status: "pending",
      })
      .select()
      .single();

    if (verError) {
      console.error("Verification creation error:", verError);
      return res.status(400).json({ error: verError.message });
    }

    // Update user verification status
    await supabase
      .from("users")
      .update({ verification_status: "pending" })
      .eq("id", req.user.id);

    return res.json({
      message: "Verification request submitted for review",
      verification_id: verification.id,
      status: "pending",
    });
  } catch (error) {
    console.error("Verification request error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * GET /admin/verifications - Get all pending verifications (admin)
 */
router.get("/admin/verifications", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { status } = req.query;
    
    let query = supabase
      .from("verifications")
      .select(`
        *,
        user:users!inner(id, email, full_name, verification_status)
      `)
      .order("created_at", { ascending: false });

    if (status) {
      query = query.eq("status", status);
    } else {
      query = query.eq("status", "pending");
    }

    const { data: verifications, error } = await query;

    if (error) {
      console.error("Get verifications error:", error);
      return res.status(400).json({ error: error.message });
    }

    return res.json({ verifications: verifications || [] });
  } catch (error) {
    console.error("Admin verifications error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * PATCH /admin/verification/:id/approve - Approve verification (admin)
 */
router.patch("/admin/verification/:id/approve", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    // Get verification record
    const { data: verification, error: verError } = await supabase
      .from("verifications")
      .select("user_id, status")
      .eq("id", id)
      .single();

    if (verError || !verification) {
      return res.status(404).json({ error: "Verification not found" });
    }

    if (verification.status !== "pending") {
      return res.status(400).json({ 
        error: `Verification is already ${verification.status}` 
      });
    }

    // Update verification status
    const { error: updateVerError } = await supabase
      .from("verifications")
      .update({ 
        status: "approved", 
        reviewed_by: req.user.id,
        updated_at: new Date().toISOString()
      })
      .eq("id", id);

    if (updateVerError) {
      return res.status(400).json({ error: updateVerError.message });
    }

    // Update user as verified
    const { error: updateUserError } = await supabase
      .from("users")
      .update({ 
        verified: true, 
        verification_status: "approved" 
      })
      .eq("id", verification.user_id);

    if (updateUserError) {
      console.error("User update error:", updateUserError);
    }

    return res.json({
      message: "Verification approved successfully",
      verification_id: id,
      status: "approved",
    });
  } catch (error) {
    console.error("Approve verification error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * PATCH /admin/verification/:id/reject - Reject verification (admin)
 */
router.patch("/admin/verification/:id/reject", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    // Get verification record
    const { data: verification, error: verError } = await supabase
      .from("verifications")
      .select("user_id, status")
      .eq("id", id)
      .single();

    if (verError || !verification) {
      return res.status(404).json({ error: "Verification not found" });
    }

    if (verification.status !== "pending") {
      return res.status(400).json({ 
        error: `Verification is already ${verification.status}` 
      });
    }

    // Update verification status
    const { error: updateVerError } = await supabase
      .from("verifications")
      .update({ 
        status: "rejected", 
        reviewed_by: req.user.id,
        rejection_reason: reason || null,
        updated_at: new Date().toISOString()
      })
      .eq("id", id);

    if (updateVerError) {
      return res.status(400).json({ error: updateVerError.message });
    }

    // Update user verification status
    const { error: updateUserError } = await supabase
      .from("users")
      .update({ 
        verified: false, 
        verification_status: "rejected" 
      })
      .eq("id", verification.user_id);

    if (updateUserError) {
      console.error("User update error:", updateUserError);
    }

    return res.json({
      message: "Verification rejected",
      verification_id: id,
      status: "rejected",
    });
  } catch (error) {
    console.error("Reject verification error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
