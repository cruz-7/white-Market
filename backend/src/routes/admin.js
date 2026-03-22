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

// DASHBOARD STATS - Enhanced
router.get("/dashboard-stats", requireAuth, requireAdmin, async (req, res) => {
  try {
    // User stats
    const { count: totalUsers } = await supabase.from("users").select("*", { count: "exact", head: true })
    
    // Get new users today and this week
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const weekAgo = new Date(today)
    weekAgo.setDate(weekAgo.getDate() - 7)

    const { count: newToday } = await supabase.from("users").select("*", { count: "exact", head: true }).gte("created_at", today.toISOString())
    const { count: newThisWeek } = await supabase.from("users").select("*", { count: "exact", head: true }).gte("created_at", weekAgo.toISOString())
    
    // Order stats
    const { count: totalOrders } = await supabase.from("orders").select("*", { count: "exact", head: true })
    const { count: pendingOrders } = await supabase.from("orders").select("*", { count: "exact", head: true }).eq("status", "pending")
    const { count: completedOrders } = await supabase.from("orders").select("*", { count: "exact", head: true }).eq("status", "paid")
    const { count: cancelledOrders } = await supabase.from("orders").select("*", { count: "exact", head: true }).eq("status", "cancelled")
    
    // Product stats
    const { count: totalProducts } = await supabase.from("products").select("*", { count: "exact", head: true })
    const { count: activeProducts } = await supabase.from("products").select("*", { count: "exact", head: true }).eq("is_active", true)
    const { count: pendingProducts } = await supabase.from("products").select("*", { count: "exact", head: true }).eq("is_active", false)
    
    // Revenue stats
    const { data: revenueData } = await supabase.from("orders").select("amount, created_at").eq("status", "paid")
    const totalRevenue = revenueData?.reduce((sum, o) => sum + Number(o.amount), 0) || 0
    
    // This month revenue
    const monthStart = new Date()
    monthStart.setDate(1)
    monthStart.setHours(0, 0, 0, 0)
    const thisMonthRevenue = revenueData?.filter(o => new Date(o.created_at) >= monthStart).reduce((sum, o) => sum + Number(o.amount), 0) || 0
    
    // Last month revenue
    const lastMonthStart = new Date(monthStart)
    lastMonthStart.setMonth(lastMonthStart.getMonth() - 1)
    const lastMonthRevenue = revenueData?.filter(o => {
      const d = new Date(o.created_at)
      return d >= lastMonthStart && d < monthStart
    }).reduce((sum, o) => sum + Number(o.amount), 0) || 0
    
    // Referral stats
    const { count: totalReferrals } = await supabase.from("referrals").select("*", { count: "exact", head: true })
    const { count: qualifiedReferrals } = await supabase.from("referrals").select("*", { count: "exact", head: true }).eq("status", "qualified")
    const { data: referralRewards } = await supabase.from("referral_rewards").select("reward_value")
    const creditsIssued = referralRewards?.reduce((sum, r) => sum + (parseFloat(r.reward_value) || 0), 0) || 0
    
    // Calculate growth
    const userGrowth = lastMonthStart > 0 ? ((newThisWeek || 0) / Math.max(newThisWeek || 1, 1)) * 100 : 0
    const orderGrowth = lastMonthRevenue > 0 ? ((thisMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100 : 0
    const revenueGrowth = lastMonthRevenue > 0 ? ((thisMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100 : 0
    
    res.json({
      users: { total: totalUsers || 0, active: totalUsers || 0, newToday: newToday || 0, newThisWeek: newThisWeek || 0 },
      orders: { 
        total: totalOrders || 0, 
        pending: pendingOrders || 0, 
        completed: completedOrders || 0, 
        cancelled: cancelledOrders || 0,
        revenue: totalRevenue
      },
      products: { total: totalProducts || 0, active: activeProducts || 0, pending: pendingProducts || 0 },
      revenue: { 
        total: totalRevenue, 
        thisMonth: thisMonthRevenue, 
        lastMonth: lastMonthRevenue,
        averageOrder: totalOrders > 0 ? totalRevenue / totalOrders : 0
      },
      referrals: { total: totalReferrals || 0, qualified: qualifiedReferrals || 0, creditsIssued },
      growth: { userGrowth, orderGrowth, revenueGrowth }
    })
  } catch (error) {
    console.error("Dashboard stats error:", error)
    res.status(500).json({ error: "Failed to load dashboard stats" })
  }
})

// SYSTEM HEALTH
router.get("/system-health", requireAuth, requireAdmin, async (req, res) => {
  try {
    const startTime = Date.now()
    
    // Check database
    const { error: dbError } = await supabase.from("users").select("id").limit(1)
    const dbResponseTime = Date.now() - startTime
    
    // Get storage info (approximate from user count)
    const { count: userCount } = await supabase.from("users").select("*", { count: "exact", head: true })
    
    res.json({
      status: dbError ? "degraded" : "healthy",
      database: {
        connected: !dbError,
        responseTime: dbResponseTime
      },
      api: {
        responseTime: 0,
        uptime: process.uptime()
      },
      storage: {
        used: userCount || 0,
        total: 10000 // Approximate max users
      }
    })
  } catch (error) {
    res.status(500).json({ status: "unhealthy", error: error.message })
  }
})

// RECENT ACTIVITY
router.get("/activity", requireAuth, requireAdmin, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20
    
    // Get recent orders
    const { data: recentOrders } = await supabase
      .from("orders")
      .select("id, status, amount, created_at, products(title)")
      .order("created_at", { ascending: false })
      .limit(limit)
    
    // Get recent users
    const { data: recentUsers } = await supabase
      .from("users")
      .select("id, full_name, email, created_at")
      .order("created_at", { ascending: false })
      .limit(limit)
    
    // Get recent products
    const { data: recentProducts } = await supabase
      .from("products")
      .select("id, title, price, created_at, is_active")
      .order("created_at", { ascending: false })
      .limit(limit)
    
    // Combine and format
    const activities = []
    
    recentOrders?.forEach(order => {
      activities.push({
        id: order.id,
        type: "order",
        text: `New order: GHS ${order.amount} - ${order.status}`,
        time: order.created_at,
        severity: order.status === "pending" ? "warning" : "normal"
      })
    })
    
    recentUsers?.forEach(user => {
      activities.push({
        id: user.id,
        type: "user",
        text: `New user registered: ${user.full_name || user.email}`,
        time: user.created_at,
        severity: "normal"
      })
    })
    
    recentProducts?.forEach(product => {
      activities.push({
        id: product.id,
        type: "product",
        text: `Product ${product.is_active ? "approved" : "pending"}: ${product.title}`,
        time: product.created_at,
        severity: product.is_active ? "normal" : "warning"
      })
    })
    
    // Sort by time and limit
    activities.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
    
    res.json(activities.slice(0, limit))
  } catch (error) {
    res.status(500).json({ error: "Failed to load activity" })
  }
})

// TOP SELLERS
router.get("/top-sellers", requireAuth, requireAdmin, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10
    
    // Get sellers with their order counts and revenue
    const { data: sellers } = await supabase
      .from("users")
      .select("id, full_name, email, avatar_url, created_at")
      .neq("role", "admin")
      .order("created_at", { ascending: false })
      .limit(50)
    
    const sellerStats = await Promise.all(
      (sellers || []).map(async (seller) => {
        const { count: orderCount } = await supabase
          .from("orders")
          .select("*", { count: "exact", head: true })
          .eq("seller_id", seller.id)
          .eq("status", "paid")
        
        const { data: revenue } = await supabase
          .from("orders")
          .select("amount")
          .eq("seller_id", seller.id)
          .eq("status", "paid")
        
        const { count: productCount } = await supabase
          .from("products")
          .select("*", { count: "exact", head: true })
          .eq("user_id", seller.id)
        
        return {
          ...seller,
          orders: orderCount || 0,
          revenue: revenue?.reduce((sum, o) => sum + Number(o.amount), 0) || 0,
          products: productCount || 0
        }
      })
    )
    
    // Sort by revenue and return top
    sellerStats.sort((a, b) => b.revenue - a.revenue)
    
    res.json(sellerStats.slice(0, limit))
  } catch (error) {
    res.status(500).json({ error: "Failed to load top sellers" })
  }
})

// REVENUE ANALYTICS
router.get("/revenue-analytics", requireAuth, requireAdmin, async (req, res) => {
  try {
    const period = req.query.period || "month"
    
    const { data: orders } = await supabase
      .from("orders")
      .select("amount, created_at, status")
      .eq("status", "paid")
      .order("created_at", { ascending: true })
    
    // Group by period
    const daily = {}
    const weekly = {}
    const monthly = {}
    
    orders?.forEach(order => {
      const date = new Date(order.created_at)
      const dayKey = date.toISOString().split("T")[0]
      const weekKey = `${date.getFullYear()}-W${Math.ceil(date.getDate() / 7)}`
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
      
      daily[dayKey] = (daily[dayKey] || 0) + Number(order.amount)
      weekly[weekly] = (weekly[weekKey] || 0) + Number(order.amount)
      monthly[monthKey] = (monthly[monthKey] || 0) + Number(order.amount)
    })
    
    // Format response
    const formatData = (data) => 
      Object.entries(data).map(([key, value]) => ({ period: key, revenue: value }))
    
    res.json({
      daily: formatData(daily),
      weekly: formatData(weekly),
      monthly: formatData(monthly)
    })
  } catch (error) {
    res.status(500).json({ error: "Failed to load revenue analytics" })
  }
})

// USER ANALYTICS
router.get("/user-analytics", requireAuth, requireAdmin, async (req, res) => {
  try {
    // Registration trend
    const { data: users } = await supabase
      .from("users")
      .select("created_at")
      .order("created_at", { ascending: true })
    
    const registrations = {}
    users?.forEach(user => {
      const date = new Date(user.created_at)
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
      registrations[monthKey] = (registrations[monthKey] || 0) + 1
    })
    
    // By role
    const { data: byRole } = await supabase
      .from("users")
      .select("role")
    
    const roleCounts = {}
    byRole?.forEach(u => {
      roleCounts[u.role] = (roleCounts[u.role] || 0) + 1
    })
    
    // By verification
    const { count: verified } = await supabase.from("users").select("*", { count: "exact", head: true }).eq("verified", true)
    const { count: total } = await supabase.from("users").select("*", { count: "exact", head: true })
    
    res.json({
      registrations: Object.entries(registrations).map(([month, count]) => ({ month, count })),
      byRole: Object.entries(roleCounts).map(([role, count]) => ({ role, count })),
      byVerification: { verified: verified || 0, unverified: (total || 0) - (verified || 0) }
    })
  } catch (error) {
    res.status(500).json({ error: "Failed to load user analytics" })
  }
})

// FINANCIAL STATS (Admin only)
router.get("/financial-stats", requireAuth, requireAdmin, async (req, res) => {
  try {
    // Import wallet service
    const walletService = await import("../services/walletService.js");
    
    // Get platform financial stats
    const stats = await walletService.getPlatformFinancialStats();
    
    // Get Paystack balance
    const { getBalanceForCurrency } = await import("../services/paystack.js");
    let paystackBalance = 0;
    try {
      const balanceResult = await getBalanceForCurrency("GHS");
      if (balanceResult.status) {
        paystackBalance = balanceResult.data?.balance / 100 || 0;
      }
    } catch (e) {
      console.log("Could not fetch Paystack balance:", e.message);
    }
    
    // Get transaction stats
    const { data: transactions } = await supabase
      .from("transactions")
      .select("amount, commission, seller_earning, status, created_at")
      .eq("status", "paid");
    
    const totalTransactionVolume = transactions?.reduce((sum, t) => sum + (t.amount || 0), 0) || 0;
    const totalCommission = transactions?.reduce((sum, t) => sum + (t.commission || 0), 0) || 0;
    
    // Get payout stats
    const { data: payouts } = await supabase
      .from("payouts")
      .select("amount, status");
    
    const pendingPayouts = payouts?.filter(p => p.status === "pending").reduce((sum, p) => sum + (p.amount || 0), 0) || 0;
    const completedPayouts = payouts?.filter(p => p.status === "completed").reduce((sum, p) => sum + (p.amount || 0), 0) || 0;
    const failedPayouts = payouts?.filter(p => p.status === "failed").reduce((sum, p) => sum + (p.amount || 0), 0) || 0;
    
    // Get referral stats
    const { data: referralRewards } = await supabase
      .from("referral_rewards")
      .select("value, status");
    
    const totalReferralCredits = referralRewards?.reduce((sum, r) => sum + (r.value || 0), 0) || 0;
    const activeReferralCredits = referralRewards?.filter(r => r.status === "active").reduce((sum, r) => sum + (r.value || 0), 0) || 0;
    
    res.json({
      // Wallet stats
      total_wallet_balance: stats.total_wallet_balance,
      total_platform_credit: stats.total_platform_credit,
      seller_liability: stats.seller_liability,
      
      // Transaction stats
      total_transaction_volume,
      total_commission,
      platform_profit: totalCommission,
      
      // Paystack
      paystack_balance: paystackBalance,
      available_for_withdrawal: paystackBalance - pendingPayouts,
      
      // Payout stats
      pending_payouts: pendingPayouts,
      completed_payouts: completedPayouts,
      failed_payouts: failedPayouts,
      
      // Referral stats
      total_referral_credits: totalReferralCredits,
      active_referral_credits: activeReferralCredits,
      
      // Cash flow
      cash_flow: {
        paystack_balance: paystackBalance,
        seller_liability: stats.seller_liability,
        net_platform_funds: paystackBalance - stats.seller_liability,
      },
      
      // Settings
      settings: {
        commission_rate: 0.10,
        min_withdrawal: 20,
        withdrawal_percentage: 0.50,
        payout_cooldown_hours: 24,
      }
    });
  } catch (error) {
    console.error("Financial stats error:", error);
    res.status(500).json({ error: "Failed to load financial stats" });
  }
})

// MANAGE PAYOUTS (Admin)
router.post("/payouts/:id/approve", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get payout details
    const { data: payout, error } = await supabase
      .from("payouts")
      .select("*, user:users(*)")
      .eq("id", id)
      .single();
    
    if (error || !payout) {
      return res.status(404).json({ error: "Payout not found" });
    }
    
    if (payout.status !== "pending") {
      return res.status(400).json({ error: "Payout is not pending" });
    }
    
    // Send payout via Paystack
    const { sendTransfer } = await import("../services/paystack.js");
    const result = await sendTransfer(payout.amount, payout.recipient_code, "Manual payout approval");
    
    if (result.status) {
      // Update payout status
      await supabase
        .from("payouts")
        .update({ 
          status: "completed", 
          processed_at: new Date().toISOString(),
          paystack_transfer_id: result.data.id
        })
        .eq("id", id);
      
      return res.json({ success: true, message: "Payout approved and sent" });
    } else {
      // Update with failure
      await supabase
        .from("payouts")
        .update({ 
          status: "failed", 
          failure_reason: result.message 
        })
        .eq("id", id);
      
      return res.status(400).json({ error: result.message });
    }
  } catch (error) {
    console.error("Approve payout error:", error);
    res.status(500).json({ error: "Failed to approve payout" });
  }
})

router.post("/payouts/:id/reject", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    
    // Get payout details
    const { data: payout, error } = await supabase
      .from("payouts")
      .select("*, user:users(*)")
      .eq("id", id)
      .single();
    
    if (error || !payout) {
      return res.status(404).json({ error: "Payout not found" });
    }
    
    if (payout.status !== "pending") {
      return res.status(400).json({ error: "Payout is not pending" });
    }
    
    // Refund to wallet
    const walletService = await import("../services/walletService.js");
    await walletService.addToWallet(payout.user_id, payout.amount, "Payout rejection refund");
    
    // Update payout status
    await supabase
      .from("payouts")
      .update({ 
        status: "rejected", 
        failure_reason: reason || "Rejected by admin",
        processed_at: new Date().toISOString()
      })
      .eq("id", id);
    
    return res.json({ success: true, message: "Payout rejected and funds returned" });
  } catch (error) {
    console.error("Reject payout error:", error);
    res.status(500).json({ error: "Failed to reject payout" });
  }
})

// FREEZE/UNFREEZE USER WALLET
router.post("/users/:id/freeze-wallet", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { freeze, reason } = req.body;
    
    const { error } = await supabase
      .from("users")
      .update({ 
        is_payout_frozen: freeze,
        fraud_flags: freeze ? req.body.fraud_flags || [] : []
      })
      .eq("id", id);
    
    if (error) throw error;
    
    return res.json({ 
      success: true, 
      message: freeze ? "Wallet frozen" : "Wallet unfrozen" 
    });
  } catch (error) {
    console.error("Freeze wallet error:", error);
    res.status(500).json({ error: "Failed to update wallet status" });
  }
})

export default router
