import express from "express"
import { supabase } from "../lib/supabaseClient.js"
import { requireAuth } from "../middleware/requireAuth.js"
import { requireAdmin } from "../middleware/requireAdmin.js"

const router = express.Router()
const ADMIN_ORDER_STATUSES = new Set(["pending", "paid", "cancelled"])

// DASHBOARD STATS
router.get("/stats", requireAuth, requireAdmin, async (req, res) => {
  const { count: users, error: usersError } = await supabase
    .from("users")
    .select("*", { count: "exact", head: true })

  const { count: products, error: productsError } = await supabase
    .from("products")
    .select("*", { count: "exact", head: true })

  const { count: orders, error: ordersError } = await supabase
    .from("orders")
    .select("*", { count: "exact", head: true })

  const { data: revenue, error: revenueError } = await supabase
    .from("orders")
    .select("amount")
    .eq("status", "paid")

  if (usersError || productsError || ordersError || revenueError) {
    return res.status(400).json({
      error:
        usersError?.message ||
        productsError?.message ||
        ordersError?.message ||
        revenueError?.message ||
        "Failed to load admin stats",
    })
  }

  const totalRevenue = revenue?.reduce((sum, o) => sum + Number(o.amount), 0) || 0
  const commission = totalRevenue * 0.1
  const totalUsers = users || 0
  const totalProducts = products || 0
  const totalOrders = orders || 0

  res.json({
    users: totalUsers,
    products: totalProducts,
    orders: totalOrders,
    totalUsers,
    totalProducts,
    totalOrders,
    totalRevenue,
    commission
  })
})

// REMOVE PRODUCT
router.delete("/product/:id", requireAuth, requireAdmin, async (req, res) => {
  const { error } = await supabase.from("products").delete().eq("id", req.params.id)
  
  if (error) {
    return res.status(400).json({ error: error.message })
  }
  
  res.json({ message: "Product removed" })
})

// BAN USER
router.patch("/ban-user/:id", requireAuth, requireAdmin, async (req, res) => {
  if (req.params.id === req.user.id) {
    return res.status(400).json({ error: "You cannot ban your own account" })
  }

  const { error } = await supabase.from("users")
    .update({ role: "banned" })
    .eq("id", req.params.id)

  if (error) {
    return res.status(400).json({ error: error.message })
  }
  
  res.json({ message: "User banned" })
})

// UNBAN USER
router.patch("/unban-user/:id", requireAuth, requireAdmin, async (req, res) => {
  const { error } = await supabase.from("users")
    .update({ role: "user" })
    .eq("id", req.params.id)

  if (error) {
    return res.status(400).json({ error: error.message })
  }
  
  res.json({ message: "User unbanned" })
})

// UPDATE USER ROLE
router.patch("/users/:id/role", requireAuth, requireAdmin, async (req, res) => {
  const { role } = req.body || {}
  const allowedRoles = new Set(["user", "seller", "admin", "banned"])

  if (!allowedRoles.has(role)) {
    return res.status(400).json({ error: "Invalid role" })
  }

  if (req.params.id === req.user.id && role !== "admin") {
    return res.status(400).json({ error: "You cannot remove your own admin role" })
  }

  const { error } = await supabase
    .from("users")
    .update({ role })
    .eq("id", req.params.id)

  if (error) {
    return res.status(400).json({ error: error.message })
  }

  return res.json({ message: "User role updated" })
})

// GET ALL USERS (with role info)
router.get("/users", requireAuth, requireAdmin, async (req, res) => {
  const { data, error } = await supabase
    .from("users")
    .select("id, full_name, email, role, created_at")
    .order("created_at", { ascending: false })

  if (error) {
    return res.status(400).json({ error: error.message })
  }
  
  res.json(data)
})

// GET ALL PRODUCTS
router.get("/products", requireAuth, requireAdmin, async (req, res) => {
  const { data, error } = await supabase
    .from("products")
    .select(
      "id, seller_id, title, price, image_url, category_id, is_active, created_at, seller:users!products_seller_id_fkey(full_name, email), categories!products_category_id_fkey(name, slug)",
    )
    .order("created_at", { ascending: false })

  if (error) {
    return res.status(400).json({ error: error.message })
  }

  // Backward-compatible shape: keep a top-level `category` string for older UIs.
  const normalized = (data || []).map((product) => ({
    ...product,
    category: product?.categories?.name ?? null,
  }))

  res.json(normalized)
})

// GET ALL ORDERS
router.get("/orders", requireAuth, requireAdmin, async (req, res) => {
  const { data, error } = await supabase
    .from("orders")
    .select("id, product_id, buyer_id, seller_id, amount, status, created_at, paid_at, products(title, image_url)")
    .order("created_at", { ascending: false })

  if (error) {
    return res.status(400).json({ error: error.message })
  }
  
  res.json(data)
})

// UPDATE ORDER STATUS (admin moderation control)
router.patch("/orders/:id/status", requireAuth, requireAdmin, async (req, res) => {
  const { status } = req.body || {}

  if (!ADMIN_ORDER_STATUSES.has(status)) {
    return res.status(400).json({ error: "Invalid status. Allowed: pending, paid, cancelled" })
  }

  const updateData = { status }
  if (status === "paid") {
    updateData.paid_at = new Date().toISOString()
  } else {
    updateData.paid_at = null
  }

  const { data, error } = await supabase
    .from("orders")
    .update(updateData)
    .eq("id", req.params.id)
    .select("id, product_id, buyer_id, seller_id, amount, status, created_at, paid_at, products(title, image_url)")
    .single()

  if (error) {
    return res.status(400).json({ error: error.message })
  }

  return res.json({ message: "Order status updated", order: data })
})

export default router
