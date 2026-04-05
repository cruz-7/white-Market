import { Router } from "express";
import { supabase } from "../lib/supabaseClient.js";
import { requireAuth } from "../middleware/requireAuth.js";

const router = Router();

// Get seller rating stats
router.get("/seller/:sellerId/stats", async (req, res) => {
  try {
    const { sellerId } = req.params;

    const { data: stats, error } = await supabase
      .from("seller_rating_stats")
      .select("*")
      .eq("seller_id", sellerId)
      .single();

    if (error && error.code !== "PGRST116") {
      throw error;
    }

    // Get badges for this seller
    const { data: badges, error: badgesError } = await supabase
      .from("seller_badges")
      .select("*")
      .eq("seller_id", sellerId)
      .eq("is_active", true)
      .order("earned_at", { ascending: false });

    if (badgesError) throw badgesError;

    res.json({
      stats: stats || {
        total_ratings: 0,
        avg_overall_rating: 0,
        avg_product_quality_rating: 0,
        avg_communication_rating: 0,
        avg_delivery_speed_rating: 0,
        avg_packaging_rating: 0,
        avg_value_for_money_rating: 0,
        five_star_count: 0,
        four_star_count: 0,
        three_star_count: 0,
        two_star_count: 0,
        one_star_count: 0,
      },
      badges: badges || [],
    });
  } catch (error) {
    console.error("Error fetching seller stats:", error);
    res.status(500).json({ error: "Failed to fetch seller stats" });
  }
});

// Get ratings for a seller
router.get("/seller/:sellerId", async (req, res) => {
  try {
    const { sellerId } = req.params;
    const { page = 1, limit = 10, sort = "recent" } = req.query;

    const offset = (page - 1) * limit;

    let query = supabase
      .from("seller_ratings")
      .select(
        `
        *,
        buyer:buyer_id(id, full_name, avatar_url),
        helpful_votes:rating_helpful_votes(count)
      `
      )
      .eq("seller_id", sellerId);

    // Apply sorting
    if (sort === "recent") {
      query = query.order("created_at", { ascending: false });
    } else if (sort === "highest") {
      query = query.order("overall_rating", { ascending: false });
    } else if (sort === "lowest") {
      query = query.order("overall_rating", { ascending: true });
    } else if (sort === "helpful") {
      query = query.order("helpful_count", { ascending: false });
    }

    // Apply pagination
    query = query.range(offset, offset + limit - 1);

    const { data: ratings, error, count } = await query;

    if (error) throw error;

    // Get total count for pagination
    const { count: totalCount, error: countError } = await supabase
      .from("seller_ratings")
      .select("*", { count: "exact", head: true })
      .eq("seller_id", sellerId);

    if (countError) throw countError;

    res.json({
      ratings: ratings || [],
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalCount || 0,
        pages: Math.ceil((totalCount || 0) / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching seller ratings:", error);
    res.status(500).json({ error: "Failed to fetch seller ratings" });
  }
});

// Get rating for a specific order
router.get("/order/:orderId", requireAuth, async (req, res) => {
  try {
    const { orderId } = req.params;
    const userId = req.user.id;

    const { data: rating, error } = await supabase
      .from("seller_ratings")
      .select(
        `
        *,
        buyer:buyer_id(id, full_name, avatar_url),
        seller:seller_id(id, full_name, avatar_url)
      `
      )
      .eq("order_id", orderId)
      .single();

    if (error && error.code !== "PGRST116") {
      throw error;
    }

    res.json({ rating: rating || null });
  } catch (error) {
    console.error("Error fetching order rating:", error);
    res.status(500).json({ error: "Failed to fetch order rating" });
  }
});

// Submit a new rating
router.post("/", requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      order_id,
      seller_id,
      overall_rating,
      product_quality_rating,
      communication_rating,
      delivery_speed_rating,
      packaging_rating,
      value_for_money_rating,
      review_text,
      review_title,
      feedback_tags,
      review_photos,
      is_anonymous,
    } = req.body;

    // Validate required fields
    if (!order_id || !seller_id || !overall_rating) {
      return res.status(400).json({
        error: "Missing required fields: order_id, seller_id, overall_rating",
      });
    }

    // Validate rating values
    const ratingFields = [
      overall_rating,
      product_quality_rating,
      communication_rating,
      delivery_speed_rating,
      packaging_rating,
      value_for_money_rating,
    ];

    for (const rating of ratingFields) {
      if (rating !== undefined && (rating < 1 || rating > 5)) {
        return res.status(400).json({
          error: "Rating values must be between 1 and 5",
        });
      }
    }

    // Check if order exists and belongs to user
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("id, buyer_id, seller_id, status")
      .eq("id", order_id)
      .single();

    if (orderError) throw orderError;

    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    if (order.buyer_id !== userId) {
      return res.status(403).json({
        error: "You can only rate orders you purchased",
      });
    }

    if (order.seller_id !== seller_id) {
      return res.status(400).json({
        error: "Seller ID does not match order seller",
      });
    }

    // Check if order is completed (delivered or received)
    if (order.status !== "delivered" && order.status !== "completed") {
      return res.status(400).json({
        error: "You can only rate completed orders",
      });
    }

    // Check if rating already exists
    const { data: existingRating, error: existingError } = await supabase
      .from("seller_ratings")
      .select("id")
      .eq("order_id", order_id)
      .eq("buyer_id", userId)
      .single();

    if (existingError && existingError.code !== "PGRST116") {
      throw existingError;
    }

    if (existingRating) {
      return res.status(400).json({
        error: "You have already rated this order",
      });
    }

    // Create the rating
    const { data: newRating, error: createError } = await supabase
      .from("seller_ratings")
      .insert({
        order_id,
        buyer_id: userId,
        seller_id,
        overall_rating,
        product_quality_rating,
        communication_rating,
        delivery_speed_rating,
        packaging_rating,
        value_for_money_rating,
        review_text,
        review_title,
        feedback_tags: feedback_tags || [],
        review_photos: review_photos || [],
        is_anonymous: is_anonymous || false,
      })
      .select()
      .single();

    if (createError) throw createError;

    // Update order to mark as rated
    await supabase
      .from("orders")
      .update({ is_rated: true })
      .eq("id", order_id);

    res.status(201).json({
      message: "Rating submitted successfully",
      rating: newRating,
    });
  } catch (error) {
    console.error("Error submitting rating:", error);
    res.status(500).json({ error: "Failed to submit rating" });
  }
});

// Update an existing rating
router.put("/:ratingId", requireAuth, async (req, res) => {
  try {
    const { ratingId } = req.params;
    const userId = req.user.id;
    const {
      overall_rating,
      product_quality_rating,
      communication_rating,
      delivery_speed_rating,
      packaging_rating,
      value_for_money_rating,
      review_text,
      review_title,
      feedback_tags,
      review_photos,
      is_anonymous,
    } = req.body;

    // Check if rating exists and belongs to user
    const { data: existingRating, error: fetchError } = await supabase
      .from("seller_ratings")
      .select("id, buyer_id")
      .eq("id", ratingId)
      .single();

    if (fetchError) throw fetchError;

    if (!existingRating) {
      return res.status(404).json({ error: "Rating not found" });
    }

    if (existingRating.buyer_id !== userId) {
      return res.status(403).json({
        error: "You can only update your own ratings",
      });
    }

    // Validate rating values
    const ratingFields = [
      overall_rating,
      product_quality_rating,
      communication_rating,
      delivery_speed_rating,
      packaging_rating,
      value_for_money_rating,
    ];

    for (const rating of ratingFields) {
      if (rating !== undefined && (rating < 1 || rating > 5)) {
        return res.status(400).json({
          error: "Rating values must be between 1 and 5",
        });
      }
    }

    // Update the rating
    const updateData = {};
    if (overall_rating !== undefined) updateData.overall_rating = overall_rating;
    if (product_quality_rating !== undefined)
      updateData.product_quality_rating = product_quality_rating;
    if (communication_rating !== undefined)
      updateData.communication_rating = communication_rating;
    if (delivery_speed_rating !== undefined)
      updateData.delivery_speed_rating = delivery_speed_rating;
    if (packaging_rating !== undefined)
      updateData.packaging_rating = packaging_rating;
    if (value_for_money_rating !== undefined)
      updateData.value_for_money_rating = value_for_money_rating;
    if (review_text !== undefined) updateData.review_text = review_text;
    if (review_title !== undefined) updateData.review_title = review_title;
    if (feedback_tags !== undefined) updateData.feedback_tags = feedback_tags;
    if (review_photos !== undefined) updateData.review_photos = review_photos;
    if (is_anonymous !== undefined) updateData.is_anonymous = is_anonymous;

    const { data: updatedRating, error: updateError } = await supabase
      .from("seller_ratings")
      .update(updateData)
      .eq("id", ratingId)
      .select()
      .single();

    if (updateError) throw updateError;

    res.json({
      message: "Rating updated successfully",
      rating: updatedRating,
    });
  } catch (error) {
    console.error("Error updating rating:", error);
    res.status(500).json({ error: "Failed to update rating" });
  }
});

// Add seller response to a rating
router.post("/:ratingId/response", requireAuth, async (req, res) => {
  try {
    const { ratingId } = req.params;
    const userId = req.user.id;
    const { response } = req.body;

    if (!response || response.trim() === "") {
      return res.status(400).json({ error: "Response text is required" });
    }

    // Check if rating exists and user is the seller
    const { data: rating, error: fetchError } = await supabase
      .from("seller_ratings")
      .select("id, seller_id")
      .eq("id", ratingId)
      .single();

    if (fetchError) throw fetchError;

    if (!rating) {
      return res.status(404).json({ error: "Rating not found" });
    }

    if (rating.seller_id !== userId) {
      return res.status(403).json({
        error: "You can only respond to ratings for your products",
      });
    }

    // Update the rating with seller response
    const { data: updatedRating, error: updateError } = await supabase
      .from("seller_ratings")
      .update({
        seller_response: response,
        seller_responded_at: new Date().toISOString(),
      })
      .eq("id", ratingId)
      .select()
      .single();

    if (updateError) throw updateError;

    res.json({
      message: "Response added successfully",
      rating: updatedRating,
    });
  } catch (error) {
    console.error("Error adding seller response:", error);
    res.status(500).json({ error: "Failed to add seller response" });
  }
});

// Vote on rating helpfulness
router.post("/:ratingId/helpful", requireAuth, async (req, res) => {
  try {
    const { ratingId } = req.params;
    const userId = req.user.id;
    const { is_helpful } = req.body;

    if (typeof is_helpful !== "boolean") {
      return res.status(400).json({ error: "is_helpful must be a boolean" });
    }

    // Check if rating exists
    const { data: rating, error: fetchError } = await supabase
      .from("seller_ratings")
      .select("id")
      .eq("id", ratingId)
      .single();

    if (fetchError) throw fetchError;

    if (!rating) {
      return res.status(404).json({ error: "Rating not found" });
    }

    // Check if user already voted
    const { data: existingVote, error: voteError } = await supabase
      .from("rating_helpful_votes")
      .select("id, is_helpful")
      .eq("rating_id", ratingId)
      .eq("user_id", userId)
      .single();

    if (voteError && voteError.code !== "PGRST116") {
      throw voteError;
    }

    if (existingVote) {
      // Update existing vote
      const { error: updateError } = await supabase
        .from("rating_helpful_votes")
        .update({ is_helpful })
        .eq("id", existingVote.id);

      if (updateError) throw updateError;
    } else {
      // Create new vote
      const { error: insertError } = await supabase
        .from("rating_helpful_votes")
        .insert({
          rating_id: ratingId,
          user_id: userId,
          is_helpful,
        });

      if (insertError) throw insertError;
    }

    res.json({ message: "Vote recorded successfully" });
  } catch (error) {
    console.error("Error recording helpful vote:", error);
    res.status(500).json({ error: "Failed to record vote" });
  }
});

// Get user's rating history
router.get("/user/history", requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 10 } = req.query;

    const offset = (page - 1) * limit;

    const { data: ratings, error } = await supabase
      .from("seller_ratings")
      .select(
        `
        *,
        seller:seller_id(id, full_name, avatar_url),
        order:order_id(id, status, created_at)
      `
      )
      .eq("buyer_id", userId)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    // Get total count
    const { count: totalCount, error: countError } = await supabase
      .from("seller_ratings")
      .select("*", { count: "exact", head: true })
      .eq("buyer_id", userId);

    if (countError) throw countError;

    res.json({
      ratings: ratings || [],
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalCount || 0,
        pages: Math.ceil((totalCount || 0) / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching user rating history:", error);
    res.status(500).json({ error: "Failed to fetch rating history" });
  }
});

// Get orders eligible for rating
router.get("/eligible-orders", requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;

    const { data: orders, error } = await supabase
      .from("orders")
      .select(`
        *,
        product:product_id(id, title, image_url),
        seller:seller_id(id, full_name, seller_display_name, avatar_url)
      `)
      .eq("buyer_id", userId)
      .in("status", ["delivered", "completed"])
      .order("updated_at", { ascending: false });

    if (error) throw error;

    res.json({ orders: orders || [] });
  } catch (error) {
    console.error("Error fetching eligible orders:", error);
    res.status(500).json({ error: "Failed to fetch eligible orders" });
  }
});

// Get product rating stats
router.get("/product/:productId/stats", async (req, res) => {
  try {
    const { productId } = req.params;

    const { data: product, error: productError } = await supabase
      .from("products")
      .select("average_rating, rating_count")
      .eq("id", productId)
      .single();

    if (productError && productError.code !== "PGRST116") {
      throw productError;
    }

    res.json({
      average_rating: product?.average_rating || 0,
      rating_count: product?.rating_count || 0,
    });
  } catch (error) {
    console.error("Error fetching product rating stats:", error);
    res.status(500).json({ error: "Failed to fetch product rating stats" });
  }
});

// Get ratings for a product
router.get("/product/:productId", async (req, res) => {
  try {
    const { productId } = req.params;
    const { page = 1, limit = 10, sort = "recent" } = req.query;

    const offset = (page - 1) * limit;

    let query = supabase
      .from("product_ratings")
      .select(
        `
        *,
        buyer:buyer_id(id, full_name, avatar_url)
      `
      )
      .eq("product_id", productId);

    if (sort === "recent") {
      query = query.order("created_at", { ascending: false });
    } else if (sort === "highest") {
      query = query.order("rating", { ascending: false });
    } else if (sort === "lowest") {
      query = query.order("rating", { ascending: true });
    }

    query = query.range(offset, offset + limit - 1);

    const { data: ratings, error } = await query;

    if (error) throw error;

    const { count: totalCount, error: countError } = await supabase
      .from("product_ratings")
      .select("*", { count: "exact", head: true })
      .eq("product_id", productId);

    if (countError) throw countError;

    res.json({
      ratings: ratings || [],
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalCount || 0,
        pages: Math.ceil((totalCount || 0) / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching product ratings:", error);
    res.status(500).json({ error: "Failed to fetch product ratings" });
  }
});

// Submit a product rating
router.post("/product", requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { product_id, rating, comment } = req.body;

    if (!product_id || !rating) {
      return res.status(400).json({
        error: "Missing required fields: product_id, rating",
      });
    }

    if (rating < 1 || rating > 5) {
      return res.status(400).json({
        error: "Rating must be between 1 and 5",
      });
    }

    // Check if user has a completed order for this product
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("id, buyer_id, product_id, status")
      .eq("product_id", product_id)
      .eq("buyer_id", userId)
      .in("status", ["delivered", "completed"])
      .single();

    if (orderError && orderError.code !== "PGRST116") {
      throw orderError;
    }

    // Check if rating already exists
    const { data: existingRating, error: existingError } = await supabase
      .from("product_ratings")
      .select("id")
      .eq("product_id", product_id)
      .eq("buyer_id", userId)
      .single();

    if (existingError && existingError.code !== "PGRST116") {
      throw existingError;
    }

    if (existingRating) {
      return res.status(400).json({
        error: "You have already rated this product",
      });
    }

    const { data: newRating, error: createError } = await supabase
      .from("product_ratings")
      .insert({
        product_id,
        buyer_id: userId,
        rating,
        comment,
        is_verified_purchase: !!order,
      })
      .select()
      .single();

    if (createError) throw createError;

    res.json({ rating: newRating });
  } catch (error) {
    console.error("Error creating product rating:", error);
    res.status(500).json({ error: "Failed to create product rating" });
  }
});

export default router;
