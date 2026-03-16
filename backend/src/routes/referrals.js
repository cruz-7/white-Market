import { Router } from "express";
import { supabase } from "../lib/supabaseClient.js";
import { requireAuth } from "../middleware/requireAuth.js";

const referralsRouter = Router();

// GET /referrals/code - Get user's referral code
referralsRouter.get("/code", requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabase.rpc("get_or_create_referral_code", {
      user_id: req.user.id,
    });

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    // Get referral stats
    const { data: referrals, error: refError } = await supabase
      .from("referrals")
      .select("referred_id, created_at")
      .eq("referrer_id", req.user.id)
      .neq("referred_id", req.user.id);

    if (refError) {
      return res.status(400).json({ error: refError.message });
    }

    return res.json({
      referral_code: data,
      total_referrals: (referrals || []).length,
      recent_referrals: referrals?.slice(0, 5) || [],
    });
  } catch (error) {
    console.error("Get referral code error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// POST /referrals/verify - Verify a referral code (used during signup)
referralsRouter.post("/verify", async (req, res) => {
  try {
    const { referral_code, referrer_email } = req.body;

    if (!referral_code && !referrer_email) {
      return res.status(400).json({ error: "referral_code or referrer_email is required" });
    }

    let referrerId = null;

    if (referral_code) {
      // Find referrer by code
      const { data: referral, error } = await supabase
        .from("referrals")
        .select("referrer_id")
        .eq("referral_code", referral_code.toUpperCase())
        .single();

      if (error || !referral) {
        return res.status(404).json({ error: "Invalid referral code" });
      }

      referrerId = referral.referrer_id;
    } else if (referrer_email) {
      // Find user by email
      const { data: user, error } = await supabase
        .from("users")
        .select("id")
        .eq("email", referrer_email.toLowerCase())
        .single();

      if (error || !user) {
        return res.status(404).json({ error: "Referrer not found" });
      }

      referrerId = user.id;
    }

    // Get referrer details
    const { data: referrer, error: refError } = await supabase
      .from("users")
      .select("id, full_name")
      .eq("id", referrerId)
      .single();

    if (refError || !referrer) {
      return res.status(404).json({ error: "Referrer not found" });
    }

    return res.json({
      valid: true,
      referrer: {
        id: referrer.id,
        name: referrer.full_name,
      },
    });
  } catch (error) {
    console.error("Verify referral error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// POST /referrals/claim - Claim referral on signup (called during registration)
referralsRouter.post("/claim", requireAuth, async (req, res) => {
  try {
    const { referral_code, referrer_email } = req.body;

    let referrerId = null;

    if (referral_code) {
      // Find referrer by code
      const { data: referral, error } = await supabase
        .from("referrals")
        .select("referrer_id, referred_id")
        .eq("referral_code", referral_code.toUpperCase())
        .single();

      if (error || !referral) {
        return res.status(404).json({ error: "Invalid referral code" });
      }

      // Check if already referred
      if (referral.referred_id !== referral.referrer_id) {
        return res.status(400).json({ error: "This referral code has already been used" });
      }

      referrerId = referral.referrer_id;
    } else if (referrer_email) {
      // Find user by email
      const { data: user, error } = await supabase
        .from("users")
        .select("id")
        .eq("email", referrer_email.toLowerCase())
        .single();

      if (error || !user) {
        return res.status(404).json({ error: "Referrer not found" });
      }

      referrerId = user.id;
    }

    if (!referrerId) {
      return res.status(400).json({ error: "Referrer not found" });
    }

    if (referrerId === req.user.id) {
      return res.status(400).json({ error: "You cannot refer yourself" });
    }

    // Check if already referred
    const { data: existing } = await supabase
      .from("referrals")
      .select("id")
      .eq("referrer_id", referrerId)
      .eq("referred_id", req.user.id)
      .single();

    if (existing) {
      return res.status(400).json({ error: "You have already been referred" });
    }

    // Update referral with new user
    const { error: updateError } = await supabase
      .from("referrals")
      .update({ referred_id: req.user.id })
      .eq("referrer_id", referrerId)
      .eq("referred_id", referrerId);

    if (updateError) {
      return res.status(400).json({ error: updateError.message });
    }

    // Create notification for referrer
    await supabase.from("notifications").insert({
      user_id: referrerId,
      type: "referral_signup",
      title: "New Referral!",
      body: "Someone used your referral code to sign up!",
      data: { referred_id: req.user.id },
    });

    return res.json({ message: "Referral claimed successfully" });
  } catch (error) {
    console.error("Claim referral error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// GET /referrals/stats - Get user's referral statistics
referralsRouter.get("/stats", requireAuth, async (req, res) => {
  try {
    // Get all referrals
    const { data: allReferrals, error } = await supabase
      .from("referrals")
      .select(`
        id,
        referred_id,
        referral_code,
        reward_claimed,
        created_at,
        users:referred_id(full_name, email)
      `)
      .eq("referrer_id", req.user.id)
      .neq("referred_id", req.user.id);

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    const totalReferrals = (allReferrals || []).length;
    const claimedRewards = (allReferrals || []).filter((r) => r.reward_claimed).length;
    const pendingRewards = totalReferrals - claimedRewards;

    return res.json({
      total_referrals: totalReferrals,
      claimed_rewards: claimedRewards,
      pending_rewards: pendingRewards,
      referrals: allReferrals || [],
    });
  } catch (error) {
    console.error("Get referral stats error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default referralsRouter;