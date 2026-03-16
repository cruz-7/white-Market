import { Router } from "express";
import { supabase } from "../lib/supabaseClient.js";
import { requireAuth } from "../middleware/requireAuth.js";

const reviewsRouter = Router();

// GET /reviews/seller/:sellerId - Get reviews for a seller
reviewsRouter.get("/seller/:sellerId", async (req, res) => {
  try {
    const { sellerId } = req.params;
    const { page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;

    const { data: reviews, error } = await supabase
      .from("reviews")
      .select(`
        *,
        reviewer:users!reviews_reviewer_id_fkey(id, full_name, avatar_url)
      `)
      .eq("reviewee_id", sellerId)
      .eq("is_seller_review", true)
      .range(offset, offset + limit - 1)
      .order("created_at", { ascending: false });

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    const { count, error: countError } = await supabase
      .from("reviews")
      .select("*", { count: "exact", head: true })
      .eq("reviewee_id", sellerId)
      .eq("is_seller_review", true);

    if (countError) {
      return res.status(400).json({ error: countError.message });
    }

    // Get average rating
    const { data: stats } = await supabase.rpc("get_seller_rating", {
      seller_id: sellerId,
    });

    const { data: reviewCount } = await supabase.rpc("get_seller_review_count", {
      seller_id: sellerId,
    });

    return res.json({
      reviews: reviews || [],
      rating: stats || 0,
      review_count: reviewCount || 0,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: count || 0,
        pages: Math.ceil((count || 0) / limit),
      },
    });
  } catch (error) {
    console.error("Get seller reviews error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// GET /reviews/order/:orderId - Get review for an order
reviewsRouter.get("/order/:orderId", requireAuth, async (req, res) => {
  try {
    const { orderId } = req.params;

    const { data: review, error } = await supabase
      .from("reviews")
      .select("*")
      .eq("order_id", orderId)
      .eq("reviewer_id", req.user.id)
      .single();

    if (error && error.code !== "PGRST116") {
      return res.status(400).json({ error: error.message });
    }

    return res.json({ review: review || null });
  } catch (error) {
    console.error("Get order review error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// POST /reviews - Create a review
reviewsRouter.post("/", requireAuth, async (req, res) => {
  try {
    const { order_id, rating, comment, is_seller_review } = req.body;

    if (!order_id || !rating) {
      return res.status(400).json({ error: "order_id and rating are required" });
    }

    if (rating < 1 || rating > 5) {
      return res.status(400).json({ error: "Rating must be between 1 and 5" });
    }

    // Get order details
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("id, buyer_id, seller_id, status")
      .eq("id", order_id)
      .single();

    if (orderError || !order) {
      return res.status(404).json({ error: "Order not found" });
    }

    if (order.status !== "paid") {
      return res.status(400).json({ error: "Can only review paid orders" });
    }

    // Determine who is being reviewed
    let reviewee_id;
    if (is_seller_review) {
      // Buyer reviewing seller
      if (req.user.id !== order.buyer_id) {
        return res.status(403).json({ error: "Only the buyer can review the seller" });
      }
      reviewee_id = order.seller_id;
    } else {
      // Seller reviewing buyer
      if (req.user.id !== order.seller_id) {
        return res.status(403).json({ error: "Only the seller can review the buyer" });
      }
      reviewee_id = order.buyer_id;
    }

    // Check if review already exists
    const { data: existing } = await supabase
      .from("reviews")
      .select("id")
      .eq("order_id", order_id)
      .eq("reviewer_id", req.user.id)
      .single();

    if (existing) {
      return res.status(400).json({ error: "You have already reviewed this order" });
    }

    // Create review
    const { data: review, error } = await supabase
      .from("reviews")
      .insert({
        order_id,
        reviewer_id: req.user.id,
        reviewee_id,
        rating,
        comment: comment || null,
        is_seller_review: is_seller_review || false,
      })
      .select()
      .single();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    return res.status(201).json({ review });
  } catch (error) {
    console.error("Create review error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// PATCH /reviews/:id - Update a review
reviewsRouter.patch("/:id", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { rating, comment } = req.body;

    // Check if review exists and user is the reviewer
    const { data: existing, error: fetchError } = await supabase
      .from("reviews")
      .select("reviewer_id")
      .eq("id", id)
      .single();

    if (fetchError || !existing) {
      return res.status(404).json({ error: "Review not found" });
    }

    if (existing.reviewer_id !== req.user.id) {
      return res.status(403).json({ error: "You can only update your own reviews" });
    }

    const updateData = {};
    if (rating !== undefined) {
      if (rating < 1 || rating > 5) {
        return res.status(400).json({ error: "Rating must be between 1 and 5" });
      }
      updateData.rating = rating;
    }
    if (comment !== undefined) {
      updateData.comment = comment;
    }
    updateData.updated_at = new Date().toISOString();

    const { data: review, error } = await supabase
      .from("reviews")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    return res.json({ review });
  } catch (error) {
    console.error("Update review error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default reviewsRouter;