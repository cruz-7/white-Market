import { Router } from "express";
import { supabase } from "../lib/supabaseClient.js";
import { requireAuth } from "../middleware/requireAuth.js";

const sellersRouter = Router();

// GET /sellers - Get all sellers
sellersRouter.get("/", async (_req, res) => {
  const { data, error } = await supabase
    .from("users")
    .select("id, full_name, seller_display_name, seller_profile_image_url, momo_provider, created_at")
    .eq("role", "seller")
    .order("created_at", { ascending: false });

  if (error) {
    return res.status(400).json({ error: error.message });
  }

  return res.json({ sellers: data || [] });
});

// GET /sellers/me - Get current seller's profile and stats
sellersRouter.get("/me", requireAuth, async (req, res) => {
  try {
    // Get user profile
    const { data: user, error: userError } = await supabase
      .from("users")
      .select("*")
      .eq("id", req.user.id)
      .single();

    if (userError || !user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Get product count
    const { count: productsCount } = await supabase
      .from("products")
      .select("*", { count: "exact", head: true })
      .eq("seller_id", req.user.id)
      .eq("is_active", true);

    // Get orders count
    const { count: ordersCount } = await supabase
      .from("orders")
      .select("*", { count: "exact", head: true })
      .eq("seller_id", req.user.id);

    // Get completed orders count
    const { count: completedCount } = await supabase
      .from("orders")
      .select("*", { count: "exact", head: true })
      .eq("seller_id", req.user.id)
      .eq("status", "completed");

    // Get total revenue
    const { data: revenueData } = await supabase
      .from("orders")
      .select("amount")
      .eq("seller_id", req.user.id)
      .eq("status", "paid");

    const totalRevenue = revenueData?.reduce((sum, o) => sum + Number(o.amount), 0) || 0;

    // Get wallet info
    const { data: wallet } = await supabase
      .from("wallets")
      .select("*")
      .eq("user_id", req.user.id)
      .single();

    // Get reviews
    const { data: reviews } = await supabase
      .from("reviews")
      .select("rating")
      .eq("reviewee_id", req.user.id)
      .eq("is_seller_review", true);

    const avgRating = reviews?.length 
      ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length 
      : 0;

    // Get recent orders
    const { data: recentOrders } = await supabase
      .from("orders")
      .select("*, products(title, image_url)")
      .eq("seller_id", req.user.id)
      .order("created_at", { ascending: false })
      .limit(5);

    // Get top products by views
    const { data: topProducts } = await supabase
      .from("products")
      .select("id, title, image_url, price, view_count")
      .eq("seller_id", req.user.id)
      .order("view_count", { ascending: false })
      .limit(5);

    return res.json({
      profile: user,
      stats: {
        products: productsCount || 0,
        totalOrders: ordersCount || 0,
        completedOrders: completedCount || 0,
        totalRevenue,
        availableBalance: wallet?.balance || 0,
        pendingEarnings: wallet?.pending_earnings || 0,
        averageRating: avgRating.toFixed(1),
        totalReviews: reviews?.length || 0
      },
      recentOrders: recentOrders || [],
      topProducts: topProducts || []
    });
  } catch (error) {
    console.error("Get seller stats error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// GET /sellers/:id - Get seller public profile
sellersRouter.get("/:id", async (req, res) => {
  const { id } = req.params;

  try {
    // Get user profile
    const { data: user, error: userError } = await supabase
      .from("users")
      .select("id, full_name, seller_display_name, seller_profile_image_url, avatar_url, verified, created_at")
      .eq("id", id)
      .single();

    if (userError || !user) {
      return res.status(404).json({ error: "Seller not found" });
    }

    // Get product count
    const { count: productsCount } = await supabase
      .from("products")
      .select("*", { count: "exact", head: true })
      .eq("seller_id", id)
      .eq("is_active", true);

    // Get reviews
    const { data: reviews } = await supabase
      .from("reviews")
      .select("rating")
      .eq("reviewee_id", id)
      .eq("is_seller_review", true);

    const avgRating = reviews?.length 
      ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length 
      : 0;

    // Get active products
    const { data: products } = await supabase
      .from("products")
      .select("*")
      .eq("seller_id", id)
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(20);

    return res.json({
      seller: user,
      stats: {
        products: productsCount || 0,
        averageRating: avgRating.toFixed(1),
        totalReviews: reviews?.length || 0
      },
      products: products || []
    });
  } catch (error) {
    console.error("Get seller error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default sellersRouter;
