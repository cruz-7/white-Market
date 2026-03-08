import { createHmac, timingSafeEqual } from "crypto";
import { Router } from "express";
import { supabase } from "../lib/supabaseClient.js";
import { requireAuth } from "../middleware/requireAuth.js";

const paymentsRouter = Router();
const PAYSTACK_CURRENCY = "GHS";

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

function amountToMinor(amount) {
  return Math.round(Number(amount) * 100);
}

async function getOrderForPayment(orderId) {
  const { data: order, error } = await supabase
    .from("orders")
    .select("id, buyer_id, amount, status")
    .eq("id", orderId)
    .single();

  if (error || !order) {
    return { ok: false, status: 404, error: "Order not found" };
  }

  return { ok: true, order };
}

function validateTransactionMatchesOrder(transaction, order) {
  const transactionAmountMinor = Number(transaction?.amount);
  const expectedAmountMinor = amountToMinor(order.amount);

  if (!Number.isFinite(transactionAmountMinor) || transactionAmountMinor <= 0) {
    return "Invalid transaction amount from Paystack";
  }

  if (transactionAmountMinor !== expectedAmountMinor) {
    return "Transaction amount does not match order amount";
  }

  const transactionCurrency = String(transaction?.currency || "").toUpperCase();
  if (transactionCurrency && transactionCurrency !== PAYSTACK_CURRENCY) {
    return "Transaction currency does not match order currency";
  }

  const txBuyerId = transaction?.metadata?.buyer_id;
  if (txBuyerId && txBuyerId !== order.buyer_id) {
    return "Transaction buyer does not match order buyer";
  }

  return null;
}

function normalizeRpcPayload(data) {
  if (Array.isArray(data)) {
    return data[0] || null;
  }

  return data || null;
}

function mapRpcError(error) {
  const message = String(error?.message || "Database operation failed");
  const missingRpcFunction =
    error?.code === "PGRST202" ||
    /Could not find the function|function .* does not exist/i.test(message);

  if (missingRpcFunction) {
    return {
      status: 500,
      error: "Required payment migration is missing. Run supabase/migrations/20260308_payment_atomicity.sql",
    };
  }

  return {
    status: 400,
    error: message,
  };
}

async function settleOrderPaymentAtomic(orderId, paymentReference = null) {
  const { data, error } = await supabase.rpc("apply_order_payment", {
    p_order_id: orderId,
    p_payment_reference: paymentReference,
  });

  if (error) {
    const mapped = mapRpcError(error);
    return { ok: false, status: mapped.status, error: mapped.error };
  }

  const payload = normalizeRpcPayload(data);
  if (!payload || typeof payload !== "object") {
    return { ok: false, status: 500, error: "Invalid payment settlement response" };
  }

  if (!payload.ok) {
    return {
      ok: false,
      status: Number(payload.status) || 400,
      error: payload.error || "Payment settlement failed",
    };
  }

  return {
    ok: true,
    alreadyPaid: Boolean(payload.already_paid),
  };
}

async function payOrderWithWalletAtomic(orderId, buyerId, paymentReference) {
  const { data, error } = await supabase.rpc("pay_order_with_wallet", {
    p_order_id: orderId,
    p_buyer_id: buyerId,
    p_payment_reference: paymentReference,
  });

  if (error) {
    const mapped = mapRpcError(error);
    return { ok: false, status: mapped.status, error: mapped.error };
  }

  const payload = normalizeRpcPayload(data);
  if (!payload || typeof payload !== "object") {
    return { ok: false, status: 500, error: "Invalid wallet payment response" };
  }

  if (!payload.ok) {
    return {
      ok: false,
      status: Number(payload.status) || 400,
      error: payload.error || "Wallet payment failed",
    };
  }

  return {
    ok: true,
    alreadyPaid: Boolean(payload.already_paid),
    balance: Number(payload.balance || 0),
    orderId: payload.order_id || orderId,
  };
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

  const orderResult = await getOrderForPayment(order_id);
  if (!orderResult.ok) {
    return res.status(orderResult.status).json({ error: orderResult.error });
  }
  const { order } = orderResult;

  if (order.buyer_id !== req.user.id) {
    return res.status(403).json({ error: "Only the buyer can initialize payment for this order" });
  }

  if (order.status === "paid") {
    return res.status(400).json({ error: "Order is already paid" });
  }

  if (order.status === "cancelled") {
    return res.status(400).json({ error: "Cancelled order cannot be paid" });
  }

  const amountMinor = amountToMinor(order.amount);
  if (!Number.isFinite(amountMinor) || amountMinor <= 0) {
    return res.status(400).json({ error: "Invalid order amount" });
  }

  const explicitCallbackUrl =
    process.env.NODE_ENV === "production"
      ? process.env.PAYSTACK_CALLBACK_URL
      : callback_url || process.env.PAYSTACK_CALLBACK_URL;
  if (!explicitCallbackUrl && process.env.NODE_ENV === "production") {
    return res.status(500).json({ error: "PAYSTACK_CALLBACK_URL is required in production" });
  }
  const fallbackCallbackUrl = process.env.FRONTEND_URL
    ? `${String(process.env.FRONTEND_URL).replace(/\/+$/, "")}/payments/callback`
    : "http://localhost:5173/payments/callback";

  const reference = `order_${order.id}_${Date.now()}`;
  const payload = {
    email: req.user.email,
    amount: amountMinor,
    currency: PAYSTACK_CURRENCY,
    reference,
    callback_url: explicitCallbackUrl || fallbackCallbackUrl,
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

paymentsRouter.post("/wallet-pay", requireAuth, async (req, res) => {
  const { order_id } = req.body || {};
  if (!order_id) {
    return res.status(400).json({ error: "order_id is required" });
  }

  const paid = await payOrderWithWalletAtomic(order_id, req.user.id, `wallet_${Date.now()}`);
  if (!paid.ok) {
    return res.status(paid.status).json({ error: paid.error });
  }

  return res.json({
    message: paid.alreadyPaid ? "Order already paid" : "Order paid with wallet",
    order_id: paid.orderId,
    balance: paid.balance,
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

  const orderResult = await getOrderForPayment(orderId);
  if (!orderResult.ok) {
    return res.status(orderResult.status).json({ error: orderResult.error });
  }
  const { order } = orderResult;

  if (order.buyer_id !== req.user.id) {
    return res.status(403).json({ error: "You are not allowed to verify this order payment" });
  }

  const mismatch = validateTransactionMatchesOrder(result.data, order);
  if (mismatch) {
    return res.status(400).json({ error: mismatch });
  }

  if (result.data?.status !== "success") {
    return res.json({
      message: "Transaction not successful yet",
      paystack_status: result.data?.status,
      order_id: orderId,
    });
  }

  const paid = await settleOrderPaymentAtomic(orderId, reference);
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
  const paystackSecret = process.env.PAYSTACK_SECRET_KEY;
  const signature = req.headers["x-paystack-signature"];
  const rawBody = req.body;

  if (!Buffer.isBuffer(rawBody)) {
    return res.status(400).json({ error: "Webhook expects raw JSON body" });
  }

  if (!paystackSecret) {
    return res.status(500).json({ error: "PAYSTACK_SECRET_KEY is not configured" });
  }

  const computed = createHmac("sha512", paystackSecret).update(rawBody).digest("hex");
  if (!safeEqualHex(signature, computed)) {
    return res.status(401).json({ error: "Invalid webhook signature" });
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

  if (payload?.data?.status !== "success") {
    return res.json({ message: "Ignored non-success transaction status", status: payload?.data?.status || null });
  }

  const orderId = extractOrderId(payload);
  if (!orderId) {
    return res.status(400).json({ error: "Missing order id in webhook metadata/reference" });
  }

  const orderResult = await getOrderForPayment(orderId);
  if (!orderResult.ok) {
    return res.status(orderResult.status).json({ error: orderResult.error });
  }
  const { order } = orderResult;

  const mismatch = validateTransactionMatchesOrder(payload?.data, order);
  if (mismatch) {
    return res.status(400).json({ error: mismatch });
  }

  const paymentReference = payload?.data?.reference || null;
  const paid = await settleOrderPaymentAtomic(orderId, paymentReference);
  if (!paid.ok) {
    return res.status(paid.status).json({ error: paid.error });
  }

  return res.json({
    message: paid.alreadyPaid ? "Order already paid" : "Payment confirmed and order marked paid",
    order_id: orderId,
  });
});

export default paymentsRouter;
