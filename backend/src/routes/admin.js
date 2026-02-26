import express from "express"
import { supabase } from "../lib/supabaseClient.js"
import { requireAuth } from "../middleware/requireAuth.js"
import { requireAdmin } from "../middleware/requireAdmin.js"

const router = express.Router()

// DASHBOARD STATS
router.get("/stats", requireAuth, requireAdmin, async (req, res) => {
  const { count: users } = await supabase
    .from("users")
    .select("*", { count: "exact", head: true })

  const { count: products } = await supabase
    .from("products")
    .select("*", { count: "exact", head: true })

  const { count: orders } = await supabase
    .from("orders")
    .select("*", { count: "exact", head: true })

  const { data: revenue } = await supabase
    .from("orders")
    .select("amount")
    .eq("status", "paid")

  const totalRevenue = revenue?.reduce((sum, o) => sum + Number(o.amount), 0) || 0
  const commission = totalRevenue * 0.1

  res.json({
    users,
    products,
    orders,
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

// GET ALL USERS (with role info)
router.get("/users", requireAuth, requireAdmin, async (req, res) => {
  const { data, error } = await supabase
    .from("users")
    .select("id, email, role, created_at")
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
    .select("*, users(email)")
    .order("created_at", { ascending: false })

  if (error) {
    return res.status(400).json({ error: error.message })
  }
  
  res.json(data)
})

// GET ALL ORDERS
router.get("/orders", requireAuth, requireAdmin, async (req, res) => {
  const { data, error } = await supabase
    .from("orders")
    .select("*, products(title), users!orders_buyer_id_fkey(email), users!orders_seller_id_fkey(email)")
    .order("created_at", { ascending: false })

  if (error) {
    return res.status(400).json({ error: error.message })
  }
  
  res.json(data)
})

export default router
