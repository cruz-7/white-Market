import express from "express";
import { supabase } from "../lib/supabaseClient.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { requireAdmin } from "../middleware/requireAdmin.js";
import walletService from "../services/walletService.js";

const router = express.Router();

// Commission rate (10%)
const COMMISSION_RATE = 0.1;

/**
 * Calculate seller amount after commission
 * @param {number} amount - The order amount
 * @returns {number} - Seller's share (90%)
 */
function calculateSellerAmount(amount) {
  return amount * (1 - COMMISSION_RATE);
}

/**
 * Create or get Paystack transfer recipient for a seller
 */
async function getOrCreateRecipient(sellerId, momoNumber, momoProvider, sellerName) {
  // Check if we already have a recipient code stored
  const { data: seller } = await supabase
    .from("users")
    .select("paystack_recipient_code")
    .eq("id", sellerId)
    .single();

  if (seller?.paystack_recipient_code) {
    return seller.paystack_recipient_code;
  }

  // Create new recipient via Paystack API
  const paystackSecret = process.env.PAYSTACK_SECRET_KEY;
  if (!paystackSecret) {
    throw new Error("PAYSTACK_SECRET_KEY is not configured");
  }
  
  const response = await fetch("https://api.paystack.co/transferrecipient", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${paystackSecret}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      type: "mobile_money",
      name: sellerName || "Seller",
      account_number: momoNumber,
      bank_code: getBankCode(momoProvider),
      currency: "GHS",
    }),
  });

  const result = await response.json();
  
  if (!response.ok || !result?.status) {
    throw new Error(result?.message || "Failed to create transfer recipient");
  }

  // Store recipient code for future use
  await supabase
    .from("users")
    .update({ paystack_recipient_code: result.data.recipient_code })
    .eq("id", sellerId);

  return result.data.recipient_code;
}

/**
 * Get bank code for MoMo provider
 */
function getBankCode(provider) {
  const codes = {
    MTN: "MTN",
    Vodafone: "VOD",
    AirtelTigo: "ATL",
  };
  return codes[provider] || "MTN";
}

/**
 * POST /payouts/request - Request payout for a completed order
 */
router.post("/request", requireAuth, async (req, res) => {
  try {
    const { order_id } = req.body;

    if (!order_id) {
      return res.status(400).json({ error: "order_id is required" });
    }

    // Get order details
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("seller_id, amount, status")
      .eq("id", order_id)
      .single();

    if (orderError || !order) {
      return res.status(404).json({ error: "Order not found" });
    }

    // Check if order is paid
    if (order.status !== "paid") {
      return res.status(400).json({ error: "Order is not eligible for payout. Must be paid first." });
    }

    // Verify the seller is requesting their own payout
    if (order.seller_id !== req.user.id) {
      return res.status(403).json({ error: "Only the seller can request payout for this order" });
    }

    // Calculate seller amount (90% of order amount)
    const sellerAmount = calculateSellerAmount(order.amount);

    // Check if payout already exists for this order
    const { data: existingPayout } = await supabase
      .from("payouts")
      .select("id, status")
      .eq("order_id", order_id)
      .single();

    if (existingPayout) {
      return res.status(400).json({ 
        error: "Payout already requested for this order",
        status: existingPayout.status
      });
    }

    // Create payout request
    const { data: payout, error: payoutError } = await supabase
      .from("payouts")
      .insert({
        seller_id: req.user.id,
        order_id,
        amount: sellerAmount,
        status: "pending",
      })
      .select()
      .single();

    if (payoutError) {
      return res.status(400).json({ error: payoutError.message });
    }

    return res.json({
      message: "Payout request submitted successfully",
      payout: {
        id: payout.id,
        amount: payout.amount,
        status: payout.status,
      },
      seller_amount: sellerAmount,
      commission: order.amount * COMMISSION_RATE,
    });
  } catch (error) {
    console.error("Payout request error:", error);
    return res.status(500).json({ error: error.message || "Internal server error" });
  }
});

/**
 * GET /payouts - Get seller's payout history
 */
router.get("/", requireAuth, async (req, res) => {
  try {
    const { data: payouts, error } = await supabase
      .from("payouts")
      .select(`
        *,
        order:orders(
          id,
          amount,
          status
        )
      `)
      .eq("seller_id", req.user.id)
      .order("created_at", { ascending: false });

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    return res.json({ payouts });
  } catch (error) {
    console.error("Get payouts error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * POST /payouts/create-recipient - Create Paystack recipient for seller
 */
router.post("/create-recipient", requireAuth, async (req, res) => {
  try {
    const { momo_number, momo_provider, name } = req.body;

    if (!momo_number || !momo_provider) {
      return res.status(400).json({ error: "momo_number and momo_provider are required" });
    }

    // Validate provider
    const validProviders = ["MTN", "Vodafone", "AirtelTigo"];
    if (!validProviders.includes(momo_provider)) {
      return res.status(400).json({ 
        error: "Invalid provider. Must be one of: MTN, Vodafone, AirtelTigo" 
      });
    }

    // Update user's MoMo details
    const { error: updateError } = await supabase
      .from("users")
      .update({
        momo_number,
        momo_provider,
      })
      .eq("id", req.user.id);

    if (updateError) {
      return res.status(400).json({ error: updateError.message });
    }

    // Create Paystack recipient
    const recipientCode = await getOrCreateRecipient(
      req.user.id,
      momo_number,
      momo_provider,
      name || req.user.email
    );

    return res.json({
      message: "MoMo details saved and recipient created",
      recipient_code: recipientCode,
    });
  } catch (error) {
    console.error("Create recipient error:", error);
    return res.status(500).json({ error: error.message || "Internal server error" });
  }
});

/**
 * POST /payouts/send - Admin endpoint to send payout (requires admin role)
 */
router.post("/send", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { payout_id } = req.body;

    if (!payout_id) {
      return res.status(400).json({ error: "payout_id is required" });
    }

    // Get payout details
    const { data: payout, error: payoutError } = await supabase
      .from("payouts")
      .select(`
        *,
        seller:users!seller_id(id, email, momo_number, momo_provider, paystack_recipient_code)
      `)
      .eq("id", payout_id)
      .single();

    if (payoutError || !payout) {
      return res.status(404).json({ error: "Payout not found" });
    }

    if (payout.status !== "pending") {
      return res.status(400).json({ error: `Payout is already ${payout.status}` });
    }

    // Get recipient code
    let recipientCode = payout.seller?.paystack_recipient_code;
    
    if (!recipientCode) {
      // Create recipient if doesn't exist
      if (!payout.seller?.momo_number || !payout.seller?.momo_provider) {
        return res.status(400).json({ 
          error: "Seller has not set up MoMo details" 
        });
      }
      
      recipientCode = await getOrCreateRecipient(
        payout.seller_id,
        payout.seller.momo_number,
        payout.seller.momo_provider,
        payout.seller.email
      );
    }

    // Initiate transfer via Paystack
    const paystackSecret = process.env.PAYSTACK_SECRET_KEY;
    if (!paystackSecret) {
      return res.status(500).json({ error: "PAYSTACK_SECRET_KEY is not configured" });
    }
    const amountMinor = Math.round(payout.amount * 100); // Convert to kobo

    const response = await fetch("https://api.paystack.co/transfer", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${paystackSecret}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        source: "balance",
        amount: amountMinor,
        recipient: recipientCode,
        reason: `Payout for order ${payout.order_id}`,
      }),
    });

    const result = await response.json();

    if (!response.ok || !result?.status) {
      // Mark as failed
      await supabase
        .from("payouts")
        .update({ status: "failed" })
        .eq("id", payout_id);

      return res.status(400).json({
        error: result?.message || "Transfer failed",
        details: result,
      });
    }

    // Update payout status
    await supabase
      .from("payouts")
      .update({ status: "sent" })
      .eq("id", payout_id);

    return res.json({
      message: "Payout sent successfully",
      transfer_id: result.data.transfer_code,
    });
  } catch (error) {
    console.error("Send payout error:", error);
    return res.status(500).json({ error: error.message || "Internal server error" });
  }
});

// ==================== NEW WALLET-BASED WITHDRAWAL SYSTEM ====================

/**
 * GET /payouts/wallet - Get user's wallet information
 */
router.get("/wallet", requireAuth, async (req, res) => {
  try {
    const wallet = await walletService.getWallet(req.user.id);
    return res.json({ wallet });
  } catch (error) {
    console.error("Get wallet error:", error);
    return res.status(500).json({ error: error.message });
  }
});

/**
 * POST /payouts/withdraw - Withdraw from wallet with limit checking
 */
router.post("/withdraw", requireAuth, async (req, res) => {
  try {
    const { amount, momo_number, network } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: "Valid amount is required" });
    }

    if (!momo_number) {
      return res.status(400).json({ error: "MoMo number is required" });
    }

    // Validate network
    const validNetworks = ["MTN", "Vodafone", "AirtelTigo"];
    const normalizedNetwork = network || "MTN";
    if (!validNetworks.includes(normalizedNetwork)) {
      return res.status(400).json({ error: "Invalid network. Use MTN, Vodafone, or AirtelTigo" });
    }

    // Check withdrawal eligibility
    const { canWithdraw, reason } = await walletService.canWithdraw(req.user.id, amount);
    if (!canWithdraw) {
      return res.status(400).json({ error: reason });
    }

    // Get user info
    const { data: user } = await supabase
      .from("users")
      .select("full_name, paystack_recipient_code")
      .eq("id", req.user.id)
      .single();

    // Create or get recipient
    let recipientCode = user?.paystack_recipient_code;
    
    if (!recipientCode) {
      // Create new recipient via Paystack
      const { createMoMoRecipient } = await import("../services/paystack.js");
      const result = await createMoMoRecipient(
        user?.full_name || "User",
        momo_number
      );

      if (!result.status) {
        return res.status(400).json({ error: result.message || "Failed to create payment recipient" });
      }

      recipientCode = result.data.recipient_code;

      // Store recipient code
      await supabase
        .from("users")
        .update({ paystack_recipient_code: recipientCode })
        .eq("id", req.user.id);
    }

    // Request payout using database function (this handles wallet deduction atomically)
    let payoutResult;
    try {
      payoutResult = await walletService.requestPayout(
        req.user.id,
        amount,
        momo_number,
        normalizedNetwork
      );
    } catch (payoutError) {
      return res.status(400).json({ error: payoutError.message });
    }

    // Try to send the payout via Paystack (async)
    // In production, this would be handled by a background job
    try {
      const { sendTransfer } = await import("../services/paystack.js");
      const paystackResult = await sendTransfer(amount, recipientCode, "Wallet withdrawal");

      // Update payout status based on Paystack response
      if (paystackResult.status) {
        await supabase
          .from("payouts")
          .update({ status: "completed", processed_at: new Date().toISOString() })
          .eq("id", payoutResult.payout_id);
      } else {
        await supabase
          .from("payouts")
          .update({ status: "failed", failure_reason: paystackResult.message })
          .eq("id", payoutResult.payout_id);
      }
    } catch (paystackError) {
      console.log("Paystack transfer will be processed later:", paystackError.message);
      // Payout is queued, will be processed by job
    }

    // Get updated wallet
    const updatedWallet = await walletService.getWallet(req.user.id);

    return res.json({
      success: true,
      message: "Withdrawal request submitted",
      wallet: updatedWallet,
      payout: {
        id: payoutResult.payout_id,
        amount,
        momo_number,
      },
    });
  } catch (error) {
    console.error("Withdraw error:", error);
    return res.status(500).json({ error: error.message || "Withdrawal failed" });
  }
});

/**
 * GET /payouts/limits - Get user's withdrawal limits
 */
router.get("/limits", requireAuth, async (req, res) => {
  try {
    const wallet = await walletService.getWallet(req.user.id);
    
    // Get system settings
    const { data: settings } = await supabase
      .from("system_settings")
      .select("key, value")
      .in("key", ["min_withdrawal", "withdrawal_percentage", "payout_cooldown_hours"]);

    const settingsObj = {};
    settings?.forEach(s => { settingsObj[s.key] = s.value; });

    return res.json({
      wallet_balance: wallet.wallet_balance,
      account_weight: wallet.account_weight,
      daily_limit: wallet.daily_limit,
      min_withdrawal: parseFloat(settingsObj.min_withdrawal) || 20,
      withdrawal_percentage: parseFloat(settingsObj.withdrawal_percentage) || 0.5,
      cooldown_hours: parseFloat(settingsObj.payout_cooldown_hours) || 24,
      last_sale_at: wallet.last_sale_at,
      is_frozen: wallet.is_payout_frozen,
      fraud_flags: wallet.fraud_flags,
    });
  } catch (error) {
    console.error("Get limits error:", error);
    return res.status(500).json({ error: error.message });
  }
});

/**
 * GET /payouts/transactions - Get user's transaction history
 */
router.get("/transactions", requireAuth, async (req, res) => {
  try {
    const { limit = 50, offset = 0, type } = req.query;

    let query = supabase
      .from("transactions")
      .select(`
        *,
        buyer:users!buyer_id(id, full_name, email),
        seller:users!seller_id(id, full_name, email)
      `)
      .eq("seller_id", req.user.id)
      .order("created_at", { ascending: false })
      .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

    if (type) {
      query = query.eq("status", type);
    }

    const { data: transactions, error } = await query;

    if (error) throw error;

    return res.json({
      transactions: transactions || [],
      has_more: transactions?.length === parseInt(limit),
    });
  } catch (error) {
    console.error("Get transactions error:", error);
    return res.status(500).json({ error: error.message });
  }
});

/**
 * GET /payouts/ledger - Get user's wallet ledger/history
 */
router.get("/ledger", requireAuth, async (req, res) => {
  try {
    const { limit = 50, offset = 0 } = req.query;

    const { data: ledger, error } = await supabase
      .from("wallet_ledger")
      .select("*")
      .eq("user_id", req.user.id)
      .order("created_at", { ascending: false })
      .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

    if (error) throw error;

    return res.json({
      ledger: ledger || [],
      has_more: ledger?.length === parseInt(limit),
    });
  } catch (error) {
    console.error("Get ledger error:", error);
    return res.status(500).json({ error: error.message });
  }
});

/**
 * GET /payouts/history - Get user's payout history
 */
router.get("/history", requireAuth, async (req, res) => {
  try {
    const { limit = 20, offset = 0 } = req.query;

    const { data: payouts, error } = await supabase
      .from("payouts")
      .select("*")
      .eq("user_id", req.user.id)
      .order("created_at", { ascending: false })
      .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

    if (error) throw error;

    return res.json({
      payouts: payouts || [],
      has_more: payouts?.length === parseInt(limit),
    });
  } catch (error) {
    console.error("Get payout history error:", error);
    return res.status(500).json({ error: error.message });
  }
});

/**
 * POST /payouts/check-eligibility - Check if user can withdraw
 */
router.post("/check-eligibility", requireAuth, async (req, res) => {
  try {
    const { amount } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: "Valid amount is required" });
    }

    const { canWithdraw, reason } = await walletService.canWithdraw(req.user.id, amount);
    const wallet = await walletService.getWallet(req.user.id);

    return res.json({
      eligible: canWithdraw,
      reason,
      wallet_balance: wallet.wallet_balance,
      daily_limit: wallet.daily_limit,
    });
  } catch (error) {
    console.error("Check eligibility error:", error);
    return res.status(500).json({ error: error.message });
  }
});

export default router;
