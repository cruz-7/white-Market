import { Router } from "express";
import { supabase } from "../lib/supabaseClient.js";
import { requireAuth } from "../middleware/requireAuth.js";

const ordersRouter = Router();
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

export default ordersRouter;
