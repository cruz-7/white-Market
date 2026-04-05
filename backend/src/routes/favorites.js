import { Router } from "express";
import { supabase } from "../lib/supabaseClient.js";
import { requireAuth } from "../middleware/requireAuth.js";

const favoritesRouter = Router();

// GET /favorites - Get user's favorites
favoritesRouter.get("/", requireAuth, async (req, res) => {
  try {
    const { data: favorites, error } = await supabase
      .from("favorites")
      .select(`
        *,
        product:products(
          id,
          title,
          description,
          price,
          image_url,
          seller_id,
          created_at,
          users:users!products_seller_id_fkey(full_name, avatar_url)
        )
      `)
      .eq("user_id", req.user.id)
      .order("created_at", { ascending: false });

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    return res.json({ favorites: favorites || [] });
  } catch (error) {
    console.error("Get favorites error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// POST /favorites - Add product to favorites
favoritesRouter.post("/", requireAuth, async (req, res) => {
  try {
    const { product_id } = req.body;

    if (!product_id) {
      return res.status(400).json({ error: "product_id is required" });
    }

    // Check if product exists
    const { data: product, error: prodError } = await supabase
      .from("products")
      .select("id")
      .eq("id", product_id)
      .single();

    if (prodError || !product) {
      return res.status(404).json({ error: "Product not found" });
    }

    // Check if already favorited
    const { data: existing } = await supabase
      .from("favorites")
      .select("id")
      .eq("user_id", req.user.id)
      .eq("product_id", product_id)
      .single();

    if (existing) {
      return res.status(400).json({ error: "Product already in favorites" });
    }

    // Add to favorites
    const { data: favorite, error } = await supabase
      .from("favorites")
      .insert({
        user_id: req.user.id,
        product_id,
      })
      .select()
      .single();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    return res.status(201).json({ favorite });
  } catch (error) {
    console.error("Add favorite error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /favorites/:productId - Remove product from favorites
favoritesRouter.delete("/:productId", requireAuth, async (req, res) => {
  try {
    const { productId } = req.params;

    const { error } = await supabase
      .from("favorites")
      .delete()
      .eq("user_id", req.user.id)
      .eq("product_id", productId);

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    return res.json({ message: "Removed from favorites" });
  } catch (error) {
    console.error("Remove favorite error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// GET /favorites/check/:productId - Check if product is favorited
favoritesRouter.get("/check/:productId", requireAuth, async (req, res) => {
  try {
    const { productId } = req.params;

    const { data: favorite, error } = await supabase
      .from("favorites")
      .select("id")
      .eq("user_id", req.user.id)
      .eq("product_id", productId)
      .single();

    if (error && error.code !== "PGRST116") {
      return res.status(400).json({ error: error.message });
    }

    return res.json({ is_favorited: !!favorite });
  } catch (error) {
    console.error("Check favorite error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// GET /likes/product/:productId - Get like count for a product
favoritesRouter.get("/likes/product/:productId", async (req, res) => {
  try {
    const { productId } = req.params;

    const { data: product, error: prodError } = await supabase
      .from("products")
      .select("like_count")
      .eq("id", productId)
      .single();

    if (prodError || !product) {
      return res.status(404).json({ error: "Product not found" });
    }

    return res.json({ like_count: product.like_count || 0 });
  } catch (error) {
    console.error("Get like count error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// POST /likes/product/:productId - Like a product
favoritesRouter.post("/likes/product/:productId", requireAuth, async (req, res) => {
  try {
    const { productId } = req.params;

    // Check if product exists
    const { data: product, error: prodError } = await supabase
      .from("products")
      .select("id")
      .eq("id", productId)
      .single();

    if (prodError || !product) {
      return res.status(404).json({ error: "Product not found" });
    }

    // Check if already liked
    const { data: existing } = await supabase
      .from("product_likes")
      .select("id")
      .eq("user_id", req.user.id)
      .eq("product_id", productId)
      .single();

    if (existing) {
      return res.status(400).json({ error: "Already liked this product" });
    }

    // Add like
    const { data: like, error } = await supabase
      .from("product_likes")
      .insert({
        user_id: req.user.id,
        product_id: productId,
      })
      .select()
      .single();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    // Get updated like count
    const { data: updatedProduct } = await supabase
      .from("products")
      .select("like_count")
      .eq("id", productId)
      .single();

    return res.status(201).json({ like, like_count: updatedProduct?.like_count || 1 });
  } catch (error) {
    console.error("Add like error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /likes/product/:productId - Unlike a product
favoritesRouter.delete("/likes/product/:productId", requireAuth, async (req, res) => {
  try {
    const { productId } = req.params;

    const { error } = await supabase
      .from("product_likes")
      .delete()
      .eq("user_id", req.user.id)
      .eq("product_id", productId);

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    // Get updated like count
    const { data: product } = await supabase
      .from("products")
      .select("like_count")
      .eq("id", productId)
      .single();

    return res.json({ message: "Unliked", like_count: product?.like_count || 0 });
  } catch (error) {
    console.error("Remove like error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// GET /likes/check/:productId - Check if user liked a product
favoritesRouter.get("/likes/check/:productId", requireAuth, async (req, res) => {
  try {
    const { productId } = req.params;

    const { data: like, error } = await supabase
      .from("product_likes")
      .select("id")
      .eq("user_id", req.user.id)
      .eq("product_id", productId)
      .single();

    if (error && error.code !== "PGRST116") {
      return res.status(400).json({ error: error.message });
    }

    return res.json({ is_liked: !!like });
  } catch (error) {
    console.error("Check like error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default favoritesRouter;