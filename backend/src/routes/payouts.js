import express from "express";
import { supabase } from "../lib/supabaseClient.js";
import { requireAuth } from "../middleware/requireAuth.js";

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
router.post("/send", requireAuth, async (req, res) => {
  try {
    // Check if admin (you may need to implement admin check)
    // For now, we'll skip admin check - implement based on your auth system

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

export default router;
