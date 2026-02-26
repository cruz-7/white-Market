import { Router } from "express";
import { supabase } from "../lib/supabaseClient.js";
import { requireAuth } from "../middleware/requireAuth.js";

const profileRouter = Router();

// Get current user profile
profileRouter.get("/profile", requireAuth, async (req, res) => {
  const { data: profile, error } = await supabase
    .from("users")
    .select("*")
    .eq("id", req.user.id)
    .single();

  if (error) {
    return res.status(400).json({ error: error.message });
  }

  return res.json(profile);
});

// Update current user profile
profileRouter.patch("/profile", requireAuth, async (req, res) => {
  const { full_name, avatar_url, momo_number, campus, whatsapp, role } = req.body || {};

  const updateData = {};
  if (full_name !== undefined) updateData.full_name = full_name;
  if (avatar_url !== undefined) updateData.avatar_url = avatar_url;
  if (momo_number !== undefined) updateData.momo_number = momo_number;
  if (campus !== undefined) updateData.campus = campus;
  if (whatsapp !== undefined) updateData.whatsapp = whatsapp;
  if (role !== undefined && req.user.role === "admin") updateData.role = role;

  const { data, error } = await supabase
    .from("users")
    .update(updateData)
    .eq("id", req.user.id)
    .select()
    .single();

  if (error) {
    return res.status(400).json({ error: error.message });
  }

  return res.json({ message: "Profile updated", user: data });
});

// Get user wallet
profileRouter.get("/wallet", requireAuth, async (req, res) => {
  const { data: wallet, error } = await supabase
    .from("wallets")
    .select("*")
    .eq("user_id", req.user.id)
    .single();

  if (error && error.code !== "PGRST116") { // PGRST116 = no rows returned
    return res.status(400).json({ error: error.message });
  }

  // Return default wallet if not found
  if (!wallet) {
    return res.json({
      user_id: req.user.id,
      balance: 0,
      pending_earnings: 0,
      currency: "GHS"
    });
  }

  return res.json(wallet);
});

// Get wallet transactions
profileRouter.get("/wallet/transactions", requireAuth, async (req, res) => {
  const { data: transactions, error } = await supabase
    .from("wallet_transactions")
    .select("*")
    .eq("user_id", req.user.id)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    return res.status(400).json({ error: error.message });
  }

  return res.json(transactions || []);
});

// Top up wallet (simulated for now)
profileRouter.post("/wallet/topup", requireAuth, async (req, res) => {
  const { amount } = req.body || {};

  if (!amount || amount <= 0) {
    return res.status(400).json({ error: "Valid amount is required" });
  }

  // Get or create wallet
  let { data: wallet, error: walletError } = await supabase
    .from("wallets")
    .select("*")
    .eq("user_id", req.user.id)
    .single();

  if (walletError && walletError.code !== "PGRST116") {
    return res.status(400).json({ error: walletError.message });
  }

  const newBalance = (wallet?.balance || 0) + amount;

  if (wallet) {
    const { error: updateError } = await supabase
      .from("wallets")
      .update({ balance: newBalance, updated_at: new Date().toISOString() })
      .eq("user_id", req.user.id);

    if (updateError) {
      return res.status(400).json({ error: updateError.message });
    }
  } else {
    const { error: insertError } = await supabase
      .from("wallets")
      .insert({
        user_id: req.user.id,
        balance: amount,
        pending_earnings: 0,
        currency: "GHS"
      });

    if (insertError) {
      return res.status(400).json({ error: insertError.message });
    }
  }

  // Record transaction
  await supabase.from("wallet_transactions").insert({
    user_id: req.user.id,
    type: "credit",
    amount,
    description: "Wallet top up",
    balance_after: newBalance
  });

  return res.json({ message: "Wallet topped up successfully", balance: newBalance });
});

// Withdraw from wallet
profileRouter.post("/wallet/withdraw", requireAuth, async (req, res) => {
  const { amount, momo_number } = req.body || {};

  if (!amount || amount <= 0) {
    return res.status(400).json({ error: "Valid amount is required" });
  }

  // Get wallet
  const { data: wallet, error: walletError } = await supabase
    .from("wallets")
    .select("*")
    .eq("user_id", req.user.id)
    .single();

  if (walletError || !wallet) {
    return res.status(404).json({ error: "Wallet not found" });
  }

  if (wallet.balance < amount) {
    return res.status(400).json({ error: "Insufficient balance" });
  }

  const newBalance = wallet.balance - amount;

  const { error: updateError } = await supabase
    .from("wallets")
    .update({ balance: newBalance, updated_at: new Date().toISOString() })
    .eq("user_id", req.user.id);

  if (updateError) {
    return res.status(400).json({ error: updateError.message });
  }

  // Record transaction
  await supabase.from("wallet_transactions").insert({
    user_id: req.user.id,
    type: "withdrawal",
    amount,
    description: momo_number ? `Withdrawal to ${momo_number}` : "Withdrawal request",
    balance_after: newBalance
  });

  return res.json({ message: "Withdrawal request submitted", balance: newBalance });
});

export default profileRouter;
