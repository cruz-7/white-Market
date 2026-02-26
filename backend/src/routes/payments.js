import { createHmac, timingSafeEqual } from "crypto";
import { Router } from "express";
import { supabase } from "../lib/supabaseClient.js";
import { requireAuth } from "../middleware/requireAuth.js";

const paymentsRouter = Router();

function safeEqualHex(a, b) {
  if (!a || !b) return false;
  const aBuf = Buffer.from(String(a), "hex");
  const bBuf = Buffer.from(String(b), "hex");
  if (aBuf.length !== bBuf.length) return false;
  return timingSafeEqual(aBuf, bBuf);
}

function extractOrderId(payload) {
  const metadata = payload?.data?.metadata || {};
  if (metadata.order_id) return metadata.order_id;
  if (metadata.orderId) return metadata.orderId;

  const reference = payload?.data?.reference;
  if (typeof reference === "string") {
    if (/^[0-9a-f-]{36}$/i.test(reference)) return reference;
    const prefixed = reference.match(/^order[_:-]([0-9a-f-]{36})$/i);
    if (prefixed) return prefixed[1];
  }

  return null;
}

async function markOrderPaid(orderId, paymentReference = null) {
  const { data: order, error: fetchError } = await supabase
    .from("orders")
    .select("id, status")
    .eq("id", orderId)
    .single();

  if (fetchError || !order) {
    return { ok: false, status: 404, error: "Order not found" };
  }

  if (order.status === "paid") {
    return { ok: true, alreadyPaid: true };
  }

  if (order.status === "cancelled") {
    return { ok: false, status: 400, error: "Cancelled order cannot be marked paid" };
  }

  const updateData = { 
    status: "paid",
    paid_at: new Date().toISOString()
  };
  
  if (paymentReference) {
    updateData.payment_reference = paymentReference;
  }

  const { error: updateError } = await supabase
    .from("orders")
    .update(updateData)
    .eq("id", orderId);

  if (updateError) {
    return { ok: false, status: 400, error: updateError.message };
  }

  return { ok: true, alreadyPaid: false };
}

paymentsRouter.post("/initialize", requireAuth, async (req, res) => {
  const paystackSecret = process.env.PAYSTACK_SECRET_KEY;
  if (!paystackSecret) {
    return res.status(500).json({ error: "PAYSTACK_SECRET_KEY is not configured in backend/.env" });
  }

  const { order_id, callback_url } = req.body || {};
  if (!order_id) {
    return res.status(400).json({ error: "order_id is required" });
  }

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select("id, buyer_id, amount, status")
    .eq("id", order_id)
    .single();

  if (orderError || !order) {
    return res.status(404).json({ error: "Order not found" });
  }

  if (order.buyer_id !== req.user.id) {
    return res.status(403).json({ error: "Only the buyer can initialize payment for this order" });
  }

  if (order.status === "paid") {
    return res.status(400).json({ error: "Order is already paid" });
  }

  if (order.status === "cancelled") {
    return res.status(400).json({ error: "Cancelled order cannot be paid" });
  }

  const amountMinor = Math.round(Number(order.amount) * 100);
  if (!Number.isFinite(amountMinor) || amountMinor <= 0) {
    return res.status(400).json({ error: "Invalid order amount" });
  }

  const reference = `order_${order.id}_${Date.now()}`;
  const payload = {
    email: req.user.email,
    amount: amountMinor,
    currency: "GHS",
    reference,
    callback_url: callback_url || process.env.PAYSTACK_CALLBACK_URL || "http://localhost:5173/payments/callback",
    metadata: {
      order_id: order.id,
      buyer_id: req.user.id,
    },
  };

  const response = await fetch("https://api.paystack.co/transaction/initialize", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${paystackSecret}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const result = await response.json();
  if (!response.ok || !result?.status) {
    return res.status(400).json({
      error: result?.message || "Paystack initialization failed",
      details: result,
    });
  }

  return res.json({
    message: "Payment initialized",
    authorization_url: result.data.authorization_url,
    access_code: result.data.access_code,
    reference: result.data.reference,
  });
});

paymentsRouter.get("/verify/:reference", requireAuth, async (req, res) => {
  const paystackSecret = process.env.PAYSTACK_SECRET_KEY;
  if (!paystackSecret) {
    return res.status(500).json({ error: "PAYSTACK_SECRET_KEY is not configured in backend/.env" });
  }

  const { reference } = req.params;
  const response = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${paystackSecret}`,
      "Content-Type": "application/json",
    },
  });

  const result = await response.json();
  if (!response.ok || !result?.status) {
    return res.status(400).json({
      error: result?.message || "Paystack verification failed",
      details: result,
    });
  }

  const orderId = extractOrderId({ data: result.data });
  if (!orderId) {
    return res.status(400).json({ error: "No order_id found in verified transaction metadata/reference" });
  }

  if (result.data?.status !== "success") {
    return res.json({
      message: "Transaction not successful yet",
      paystack_status: result.data?.status,
      order_id: orderId,
    });
  }

  const paid = await markOrderPaid(orderId, reference);
  if (!paid.ok) {
    return res.status(paid.status).json({ error: paid.error });
  }

  return res.json({
    message: paid.alreadyPaid ? "Order already paid" : "Payment verified and order marked paid",
    order_id: orderId,
    reference,
  });
});

paymentsRouter.post("/webhook", async (req, res) => {
  const secret = process.env.PAYMENT_WEBHOOK_SECRET;
  const signature = req.headers["x-paystack-signature"];
  const rawBody = req.body;

  if (!Buffer.isBuffer(rawBody)) {
    return res.status(400).json({ error: "Webhook expects raw JSON body" });
  }

  if (secret) {
    const computed = createHmac("sha512", secret).update(rawBody).digest("hex");
    if (!safeEqualHex(signature, computed)) {
      return res.status(401).json({ error: "Invalid webhook signature" });
    }
  }

  let payload;
  try {
    payload = JSON.parse(rawBody.toString("utf8"));
  } catch {
    return res.status(400).json({ error: "Invalid JSON payload" });
  }

  // For now only process successful charge events.
  if (payload?.event !== "charge.success") {
    return res.json({ message: "Ignored event", event: payload?.event || null });
  }

  const orderId = extractOrderId(payload);
  if (!orderId) {
    return res.status(400).json({ error: "Missing order id in webhook metadata/reference" });
  }

  const paymentReference = payload?.data?.reference || null;
  const paid = await markOrderPaid(orderId, paymentReference);
  if (!paid.ok) {
    return res.status(paid.status).json({ error: paid.error });
  }

  return res.json({
    message: paid.alreadyPaid ? "Order already paid" : "Payment confirmed and order marked paid",
    order_id: orderId,
  });
});

export default paymentsRouter;
