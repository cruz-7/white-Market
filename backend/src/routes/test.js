import { Router } from "express";
import { supabase } from "../lib/supabaseClient.js";
import { requireAuth } from "../middleware/requireAuth.js";

const testRouter = Router();

// Test 1: Check if user is authenticated
testRouter.get("/me", requireAuth, async (req, res) => {
  return res.json({
    message: "You are logged in!",
    user: {
      id: req.user.id,
      email: req.user.email,
    },
  });
});

// Test 2: Get all products (should work for everyone)
testRouter.get("/products", async (_req, res) => {
  const { data, error } = await supabase
    .from("products")
    .select("id, title, price, seller_id")
    .limit(10);

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  return res.json({ products: data, count: data?.length || 0 });
});

// Test 3: Get my orders (as buyer)
testRouter.get("/my-orders", requireAuth, async (req, res) => {
  const { data, error } = await supabase
    .from("orders")
    .select("*, products(title, price)")
    .eq("buyer_id", req.user.id);

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  return res.json({ orders: data, count: data?.length || 0 });
});

// Test 4: Get my sales (as seller)
testRouter.get("/my-sales", requireAuth, async (req, res) => {
  const { data, error } = await supabase
    .from("orders")
    .select("*, products(title, price)")
    .eq("seller_id", req.user.id);

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  return res.json({ sales: data, count: data?.length || 0 });
});

// Test 5: Get my payouts
testRouter.get("/my-payouts", requireAuth, async (req, res) => {
  const { data, error } = await supabase
    .from("payouts")
    .select("*")
    .eq("seller_id", req.user.id)
    .order("created_at", { ascending: false });

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  return res.json({ payouts: data, count: data?.length || 0 });
});

// Test 6: Try to access another user's order (should fail)
testRouter.get("/other-orders/:userId", requireAuth, async (req, res) => {
  const { userId } = req.params;

  const { data, error } = await supabase
    .from("orders")
    .select("*, products(title, price)")
    .eq("buyer_id", userId);

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  // Check if we're trying to access someone else's data
  if (userId !== req.user.id) {
    return res.json({
      message: "You can see other users' orders (POLICY ISSUE!)",
      orders: data,
      warning: "This should be filtered by RLS policies!",
    });
  }

  return res.json({ orders: data });
});

// Test 7: Create a test order (for testing)
testRouter.post("/create-test-order", requireAuth, async (req, res) => {
  const { product_id } = req.body;

  if (!product_id) {
    return res.status(400).json({ error: "product_id is required" });
  }

  // Get product
  const { data: product, error: productError } = await supabase
    .from("products")
    .select("id, seller_id, price")
    .eq("id", product_id)
    .single();

  if (productError || !product) {
    return res.status(404).json({ error: "Product not found" });
  }

  // Can't buy your own product
  if (product.seller_id === req.user.id) {
    return res.status(400).json({ error: "Cannot buy your own product" });
  }

  // Create order
  const { data: order, error: orderError } = await supabase
    .from("orders")
    .insert({
      product_id: product.id,
      buyer_id: req.user.id,
      seller_id: product.seller_id,
      amount: product.price,
    })
    .select()
    .single();

  if (orderError) {
    return res.status(400).json({ error: orderError.message });
  }

  return res.json({
    message: "Test order created",
    order: {
      id: order.id,
      amount: order.amount,
      status: order.status,
    },
  });
});

// Test Supabase connection
testRouter.get("/test-supabase", async (_req, res) => {
  const { data, error } = await supabase.from("users").select("*").limit(1);

  if (error) {
    return res.status(500).json({
      message: "Supabase query failed",
      error: error.message,
    });
  }

  return res.json(data);
});

export default testRouter;
