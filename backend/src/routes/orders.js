import { Router } from "express";
import { supabase } from "../lib/supabaseClient.js";
import { requireAuth } from "../middleware/requireAuth.js";

const ordersRouter = Router();
// This endpoint is for buyer/seller cancellation only. Completion/disputes have
// their own dedicated endpoints.
const ORDER_STATUSES = new Set(["cancelled"]);

ordersRouter.post("/", requireAuth, async (req, res) => {
  const { product_id } = req.body || {};
  const buyer_id = req.user.id;

  if (!product_id) {
    return res.status(400).json({ error: "product_id is required" });
  }

  const { data: product, error: productError } = await supabase
    .from("products")
    .select("id, seller_id, price")
    .eq("id", product_id)
    .single();

  if (productError || !product) {
    return res.status(404).json({ error: "Product not found" });
  }

  if (product.seller_id === buyer_id) {
    return res.status(400).json({ error: "You cannot create an order for your own product" });
  }

  const { data: insertedOrder, error: orderError } = await supabase.from("orders").insert({
    product_id: product.id,
    buyer_id,
    seller_id: product.seller_id,
    amount: product.price,
  }).select().single();

  if (orderError) {
    return res.status(400).json({ error: orderError.message });
  }

  return res.json({ 
    message: "Order created (pending payment)",
    order_id: insertedOrder.id,
    amount: insertedOrder.amount
  });
});

ordersRouter.patch("/:id/status", requireAuth, async (req, res) => {
  const { id } = req.params;
  const { status } = req.body || {};

  if (!ORDER_STATUSES.has(status)) {
    return res.status(400).json({ error: "Invalid status. Only cancelled is allowed on this endpoint" });
  }

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select("id, buyer_id, seller_id, status")
    .eq("id", id)
    .single();

  if (orderError || !order) {
    return res.status(404).json({ error: "Order not found" });
  }

  const isBuyer = req.user.id === order.buyer_id;
  const isSeller = req.user.id === order.seller_id;
  if (!isBuyer && !isSeller) {
    return res.status(403).json({ error: "Not allowed to update this order" });
  }

  if (order.status === status) {
    return res.json({ message: "Order status unchanged", order });
  }

  if (order.status === "cancelled") {
    return res.status(400).json({ error: "Cancelled order cannot be updated" });
  }

  if (order.status === "paid") {
    return res.status(400).json({ error: "Paid order cannot be updated on this endpoint" });
  }

  if (order.status === "completed") {
    return res.status(400).json({ error: "Completed order cannot be updated" });
  }

  if (order.status === "disputed") {
    return res.status(400).json({ error: "Disputed order cannot be updated. Contact admin." });
  }

  const { data: updated, error: updateError } = await supabase
    .from("orders")
    .update({ status })
    .eq("id", id)
    .select("*")
    .single();

  if (updateError) {
    return res.status(400).json({ error: updateError.message });
  }

  return res.json({ message: "Order status updated", order: updated });
});

ordersRouter.get("/my-orders", requireAuth, async (req, res) => {
  const { data, error } = await supabase
    .from("orders")
    .select("*, products(title, image_url)")
    .eq("buyer_id", req.user.id);

  if (error) {
    return res.status(400).json({ error: error.message });
  }

  return res.json(data || []);
});

ordersRouter.get("/sales", requireAuth, async (req, res) => {
  const { data, error } = await supabase
    .from("orders")
    .select("*, products(title, image_url)")
    .eq("seller_id", req.user.id);

  if (error) {
    return res.status(400).json({ error: error.message });
  }

  return res.json(data || []);
});

ordersRouter.get("/:id", requireAuth, async (req, res) => {
  const { id } = req.params;

  const { data: order, error } = await supabase
    .from("orders")
    .select("*, products(title, image_url)")
    .eq("id", id)
    .single();

  if (error || !order) {
    return res.status(404).json({ error: "Order not found" });
  }

  const isParticipant = order.buyer_id === req.user.id || order.seller_id === req.user.id || req.user.role === "admin";
  if (!isParticipant) {
    return res.status(403).json({ error: "Not allowed to view this order" });
  }

  return res.json(order);
});

// POST /orders/:id/complete - Buyer confirms order completion
ordersRouter.post("/:id/complete", requireAuth, async (req, res) => {
  const { id } = req.params;

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select("id, buyer_id, seller_id, status, amount")
    .eq("id", id)
    .single();

  if (orderError || !order) {
    return res.status(404).json({ error: "Order not found" });
  }

  // Only buyer can mark as completed
  if (req.user.id !== order.buyer_id) {
    return res.status(403).json({ error: "Only the buyer can confirm order completion" });
  }

  if (order.status !== "paid") {
    return res.status(400).json({ error: "Only paid orders can be marked as completed" });
  }

  // Update order status to completed
  const { data: updated, error: updateError } = await supabase
    .from("orders")
    .update({ status: "completed", completed_at: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .single();

  if (updateError) {
    return res.status(400).json({ error: updateError.message });
  }

  // Calculate seller payout (90% after 10% commission)
  const orderAmount = Number(order.amount || 0);
  const sellerAmount = Math.round(orderAmount * 0.9 * 100) / 100;

  // Add to seller's pending earnings
  const { data: wallet, error: walletError } = await supabase
    .from("wallets")
    .select("pending_earnings")
    .eq("user_id", order.seller_id)
    .single();

  if (!walletError && wallet) {
    const pendingEarnings = Number(wallet.pending_earnings || 0);
    await supabase
      .from("wallets")
      .update({ pending_earnings: pendingEarnings + sellerAmount })
      .eq("user_id", order.seller_id);
  }

  // Notify seller
  await supabase.from("notifications").insert({
    user_id: order.seller_id,
    type: "order_completed",
    title: "Order Completed!",
    body: `Order #${id.slice(0, 8)} has been marked as completed. Your earnings of GHS ${sellerAmount.toFixed(2)} will be added to your wallet.`,
    data: { order_id: id },
  });

  return res.json({ message: "Order marked as completed", order: updated, seller_amount: sellerAmount });
});

// POST /orders/:id/dispute - Create a dispute for an order
ordersRouter.post("/:id/dispute", requireAuth, async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body || {};

  if (!reason) {
    return res.status(400).json({ error: "Dispute reason is required" });
  }

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select("id, buyer_id, seller_id, status")
    .eq("id", id)
    .single();

  if (orderError || !order) {
    return res.status(404).json({ error: "Order not found" });
  }

  // Only buyer or seller can create dispute
  const isBuyer = req.user.id === order.buyer_id;
  const isSeller = req.user.id === order.seller_id;
  
  if (!isBuyer && !isSeller) {
    return res.status(403).json({ error: "Only buyer or seller can create a dispute" });
  }

  if (order.status !== "paid") {
    return res.status(400).json({ error: "Only paid orders can be disputed" });
  }

  // Check if dispute already exists
  const { data: existingDispute } = await supabase
    .from("order_disputes")
    .select("id")
    .eq("order_id", id)
    .single();

  if (existingDispute) {
    return res.status(400).json({ error: "A dispute already exists for this order" });
  }

  // Create dispute
  const { data: dispute, error: disputeError } = await supabase
    .from("order_disputes")
    .insert({
      order_id: id,
      raised_by: req.user.id,
      reason,
      status: "open"
    })
    .select()
    .single();

  if (disputeError) {
    return res.status(400).json({ error: disputeError.message });
  }

  // Update order status to disputed
  await supabase
    .from("orders")
    .update({ status: "disputed" })
    .eq("id", id);

  // Notify both parties
  await supabase.from("notifications").insert([
    {
      user_id: order.buyer_id,
      type: "dispute_opened",
      title: "Dispute Opened",
      body: `A dispute has been opened for order #${id.slice(0, 8)}: ${reason}`,
      data: { order_id: id, dispute_id: dispute.id }
    },
    {
      user_id: order.seller_id,
      type: "dispute_opened",
      title: "Dispute Opened",
      body: `A dispute has been opened for order #${id.slice(0, 8)}: ${reason}`,
      data: { order_id: id, dispute_id: dispute.id }
    }
  ]);

  return res.json({ message: "Dispute created successfully", dispute });
});

// GET /orders/:id/dispute - Get dispute for an order
ordersRouter.get("/:id/dispute", requireAuth, async (req, res) => {
  const { id } = req.params;

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select("id, buyer_id, seller_id")
    .eq("id", id)
    .single();

  if (orderError || !order) {
    return res.status(404).json({ error: "Order not found" });
  }

  // Only participants can view dispute
  if (req.user.id !== order.buyer_id && req.user.id !== order.seller_id && req.user.role !== "admin") {
    return res.status(403).json({ error: "Not allowed to view this dispute" });
  }

  const { data: dispute, error: disputeError } = await supabase
    .from("order_disputes")
    .select("*")
    .eq("order_id", id)
    .single();

  if (disputeError && disputeError.code !== "PGRST116") {
    return res.status(400).json({ error: disputeError.message });
  }

  return res.json({ dispute: dispute || null });
});

export default ordersRouter;
