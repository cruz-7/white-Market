import { Router } from "express";
import { supabase } from "../lib/supabaseClient.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { upload } from "../middleware/upload.js";
import { clearCache } from "../services/cacheService.js";

const productsRouter = Router();
const ALLOWED_IMAGE_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

productsRouter.post("/upload-image", requireAuth, upload.single("image"), async (req, res) => {
  const file = req.file;
  console.log("[upload-image] file:", file);

  if (!file) {
    return res.status(400).json({ error: "No image uploaded" });
  }

  let mimeType = file.mimetype || file.type;
  console.log("[upload-image] mimeType from file:", mimeType);
  
  let finalMime = mimeType;

  if (!finalMime || !ALLOWED_IMAGE_MIME_TYPES.has(finalMime)) {
    const ext = (file.originalname || "").split(".").pop()?.toLowerCase();
    console.log("[upload-image] ext:", ext);
    const extToMime = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif" };
    finalMime = extToMime[ext || ""] || mimeType;
  }

  console.log("[upload-image] finalMime before default:", finalMime);

  if (!finalMime || !ALLOWED_IMAGE_MIME_TYPES.has(finalMime)) {
    finalMime = "image/jpeg";
  }

  console.log("[upload-image] finalMime:", finalMime);
  file.mimetype = finalMime;

  const extensionByType = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
  };
  const fileExt = extensionByType[file.mimetype] || "jpg";
  const fileName = `${req.user.id}/${Date.now()}-${Math.round(Math.random() * 1e9)}.${fileExt}`;

  const { error } = await supabase.storage
    .from("product-images")
    .upload(fileName, file.buffer, {
      contentType: file.mimetype,
      upsert: false,
    });

  if (error) {
    return res.status(400).json({ error: error.message });
  }

  const { data } = supabase.storage
    .from("product-images")
    .getPublicUrl(fileName);

  return res.json({ image_url: data.publicUrl });
});

productsRouter.post("/", requireAuth, async (req, res) => {
  const { title, description, price, image_url, category_id } = req.body || {};
  const seller_id = req.user.id;

  if (!title || price === undefined || price === null) {
    return res.status(400).json({ error: "title and price are required" });
  }

  const insertPayload = {
    seller_id,
    title,
    description: description || null,
    price,
    image_url: image_url || null,
  };
  if (category_id) {
    insertPayload.category_id = category_id;
  }

  const { error } = await supabase.from("products").insert(insertPayload);

  if (error) {
    return res.status(400).json({ error: error.message });
  }

  // Invalidate product cache
  clearCache("products:");
  
  return res.json({ message: "Product created" });
});

productsRouter.get("/", async (req, res) => {
  const { q, category_id, min_price, max_price, sort, page, limit, seller_id, is_active, trending } = req.query;

  const usePagination = page !== undefined || limit !== undefined;
  const pageNumber = Math.max(1, Number(page || 1));
  const limitNumber = Math.max(1, Number(limit || 20));
  const offset = (pageNumber - 1) * limitNumber;

  let query = supabase
    .from("products")
    .select("*, users(full_name, email, seller_display_name, seller_profile_image_url, avatar_url), categories!products_category_id_fkey(name, slug), seller_rating_stats!products_seller_id_fkey(avg_overall_rating, total_ratings)");

  if (q) query = query.ilike("title", `%${q}%`);
  if (category_id) query = query.eq("category_id", category_id);
  if (min_price) query = query.gte("price", Number(min_price));
  if (max_price) query = query.lte("price", Number(max_price));
  if (seller_id) query = query.eq("seller_id", seller_id);

  // Active status filter (default to only active products)
  if (is_active !== undefined) query = query.eq("is_active", is_active === "true");
  else query = query.or("is_active.is.null,is_active.eq.true");

  // Handle trending parameter
  if (trending === "true") {
    // Fetch all active products and calculate trending scores in memory
    const { data: trendingProducts } = await supabase
      .from("products")
      .select("*")
      .eq("is_active", true);
    
    if (trendingProducts && trendingProducts.length > 0) {
      const now = new Date();
      const scored = trendingProducts.map(p => {
        let score = (p.view_count || 0) * 1 + (p.click_count || 0) * 2 + (p.purchase_count || 0) * 5;
        if (p.created_at) {
          const days = (now - new Date(p.created_at)) / (1000 * 60 * 60 * 24);
          if (days <= 7) score += (7 - days) * 2;
        }
        return { ...p, trending_score: score };
      }).sort((a, b) => b.trending_score - a.trending_score);
      
      const limitNum = parseInt(limit || 10);
      return res.json(scored.slice(0, limitNum));
    }
    return res.json([]);
  }

  if (sort === "price_asc") query = query.order("price", { ascending: true });
  else if (sort === "price_desc") query = query.order("price", { ascending: false });
  else if (sort === "oldest") query = query.order("created_at", { ascending: true });
  else query = query.order("created_at", { ascending: false });

  if (usePagination) {
    query = query.range(offset, offset + limitNumber - 1);
  }

  const primary = await query;
  console.log("[products.js] primary query result:", primary.data?.[0]?.users);
  if (!primary.error) {
    return res.json(primary.data || []);
  }

  // Fallback syntax with explicit FK name for environments where relation aliasing differs.
  let fallbackQuery = supabase
    .from("products")
    .select("*, users!products_seller_id_fkey(full_name, email, seller_display_name, seller_profile_image_url, avatar_url), categories!products_category_id_fkey(name, slug)");

  if (q) fallbackQuery = fallbackQuery.ilike("title", `%${q}%`);
  if (category_id) fallbackQuery = fallbackQuery.eq("category_id", category_id);
  if (min_price) fallbackQuery = fallbackQuery.gte("price", Number(min_price));
  if (max_price) fallbackQuery = fallbackQuery.lte("price", Number(max_price));
  if (seller_id) fallbackQuery = fallbackQuery.eq("seller_id", seller_id);

  if (is_active !== undefined) fallbackQuery = fallbackQuery.eq("is_active", is_active === "true");
  else fallbackQuery = fallbackQuery.or("is_active.is.null,is_active.eq.true");

  if (sort === "price_asc") fallbackQuery = fallbackQuery.order("price", { ascending: true });
  else if (sort === "price_desc") fallbackQuery = fallbackQuery.order("price", { ascending: false });
  else if (sort === "oldest") fallbackQuery = fallbackQuery.order("created_at", { ascending: true });
  else fallbackQuery = fallbackQuery.order("created_at", { ascending: false });

  if (usePagination) {
    fallbackQuery = fallbackQuery.range(offset, offset + limitNumber - 1);
  }

  const fallback = await fallbackQuery;
  if (fallback.error) {
    return res.status(400).json({ error: fallback.error.message });
  }

  return res.json(fallback.data || []);
});

// GET /products/test-special - Test route
productsRouter.get("/test-special", async (req, res) => {
  console.log(">>> TEST SPECIAL ROUTE HIT <<<");
  return res.json({ message: "Test route works!" });
});

// GET /products/trending-products - Get trending products based on views, clicks, and purchases
productsRouter.get("/trending-products", async (req, res) => {
  console.log(">>> TRENDING-PRODUCTS ROUTE HIT <<<");
  const { limit = 10 } = req.query;
  
  try {
    const { data: products, error } = await supabase
      .from("products")
      .select(`
        *,
        users!products_seller_id_fkey(full_name),
        categories!products_category_id_fkey(name, slug)
      `)
      .eq("is_active", true)
      .order("view_count", { ascending: false })
      .limit(parseInt(limit));

    if (error) {
      console.error("[TRENDING-PRODUCTS] Supabase error:", error);
      throw error;
    }

    console.log("[TRENDING-PRODUCTS] Found products:", products?.length);
    
    if (!products || products.length === 0) {
      return res.json({ products: [], count: 0 });
    }

    const now = new Date();
    const scoredProducts = products.map(product => {
      let score = 0;
      score += (product.view_count || 0) * 1;
      score += (product.click_count || 0) * 2;
      score += (product.purchase_count || 0) * 5;
      
      if (product.created_at) {
        const createdAt = new Date(product.created_at);
        const daysSinceCreation = (now - createdAt) / (1000 * 60 * 60 * 24);
        if (daysSinceCreation <= 7) {
          score += (7 - daysSinceCreation) * 2;
        }
      }
      
      return { ...product, trending_score: score };
    });

    scoredProducts.sort((a, b) => b.trending_score - a.trending_score);

    console.log("[TRENDING-PRODUCTS] Sending response with", scoredProducts.length, "products");
    return res.json({
      products: scoredProducts.slice(0, parseInt(limit)),
      count: scoredProducts.length
    });
  } catch (err) {
    console.error("Trending products error:", err);
    return res.status(500).json({ error: "Failed to fetch trending products" });
  }
});

productsRouter.get("/seller/:sellerId", async (req, res) => {
  const { sellerId } = req.params;

  const { data, error } = await supabase
    .from("products")
    .select("*")
    .eq("seller_id", sellerId);

  if (error) {
    return res.status(400).json({ error: error.message });
  }

  return res.json(data);
});

productsRouter.delete("/:id", requireAuth, async (req, res) => {
  const { id } = req.params;
  const requesterId = req.user.id;

  const { data: product, error: fetchError } = await supabase
    .from("products")
    .select("id, seller_id")
    .eq("id", id)
    .single();

  if (fetchError || !product) {
    return res.status(404).json({ error: "Product not found" });
  }

  if (product.seller_id !== requesterId) {
    return res.status(403).json({ error: "Only the product owner can delete this product" });
  }

  const { error } = await supabase
    .from("products")
    .delete()
    .eq("id", id);

  if (error) {
    return res.status(400).json({ error: error.message });
  }

  // Invalidate product cache
  clearCache("products:");

  return res.json({ message: "Product deleted" });
});

// PUT /products/:id - Update a product
productsRouter.put("/:id", requireAuth, async (req, res) => {
  const { id } = req.params;
  const { title, description, price, image_url, category_id, is_active, stock_quantity } = req.body || {};
  const requesterId = req.user.id;

  const { data: product, error: fetchError } = await supabase
    .from("products")
    .select("id, seller_id")
    .eq("id", id)
    .single();

  if (fetchError || !product) {
    return res.status(404).json({ error: "Product not found" });
  }

  if (product.seller_id !== requesterId) {
    return res.status(403).json({ error: "Only the product owner can update this product" });
  }

  const updateData = {};
  if (title !== undefined) updateData.title = title;
  if (description !== undefined) updateData.description = description;
  if (price !== undefined) updateData.price = price;
  if (image_url !== undefined) updateData.image_url = image_url;
  if (category_id !== undefined) updateData.category_id = category_id;
  if (is_active !== undefined) updateData.is_active = is_active;
  if (stock_quantity !== undefined) updateData.stock_quantity = stock_quantity;

  if (Object.keys(updateData).length === 0) {
    return res.status(400).json({ error: "No valid fields to update" });
  }

  const { data: updated, error } = await supabase
    .from("products")
    .update(updateData)
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    return res.status(400).json({ error: error.message });
  }

  // Invalidate product cache
  clearCache("products:");
  
  return res.json({ message: "Product updated", product: updated });
});

// POST /products/:id/view - Increment product view count
productsRouter.post("/:id/view", async (req, res) => {
  const { id } = req.params;

  const { error } = await supabase.rpc("increment_view_count", { product_id: id });

  if (error) {
    // Fallback: manual increment
    const { data: product } = await supabase
      .from("products")
      .select("view_count")
      .eq("id", id)
      .single();

    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }

    await supabase
      .from("products")
      .update({ view_count: (product.view_count || 0) + 1 })
      .eq("id", id);
  }

  return res.json({ message: "View recorded" });
});

// POST /products/:id/click - Track product click
productsRouter.post("/:id/click", async (req, res) => {
  const { id } = req.params;

  // Try RPC first, fallback to manual
  const { error } = await supabase.rpc("increment_click_count", { product_id: id });
  
  if (error) {
    const { data: product } = await supabase
      .from("products")
      .select("click_count")
      .eq("id", id)
      .single();

    if (product) {
      await supabase
        .from("products")
        .update({ click_count: (product.click_count || 0) + 1 })
        .eq("id", id);
    }
  }

  return res.json({ success: true });
});

// GET /products/test-special - Test route
productsRouter.get("/test-special", async (req, res) => {
  console.log(">>> TEST SPECIAL ROUTE HIT <<<");
  return res.json({ message: "Test route works!" });
});

// GET /products/trending-products - Get trending products based on views, clicks, and purchases
productsRouter.get("/trending-products", async (req, res) => {
  console.log(">>> TRENDING-PRODUCTS ROUTE HIT <<<");
  const { limit = 10 } = req.query;
  
  try {
    const { data: products, error } = await supabase
      .from("products")
      .select(`
        *,
        users!products_seller_id_fkey(full_name),
        categories!products_category_id_fkey(name, slug)
      `)
      .eq("is_active", true)
      .order("view_count", { ascending: false })
      .limit(parseInt(limit));

    if (error) {
      console.error("[TRENDING] Supabase error:", error);
      throw error;
    }

    console.log("[TRENDING] Found products:", products?.length);
    
    if (!products || products.length === 0) {
      return res.json({ products: [], count: 0 });
    }

    const now = new Date();
    const scoredProducts = products.map(product => {
      let score = 0;
      score += (product.view_count || 0) * 1;
      score += (product.click_count || 0) * 2;
      score += (product.purchase_count || 0) * 5;
      
      if (product.created_at) {
        const createdAt = new Date(product.created_at);
        const daysSinceCreation = (now - createdAt) / (1000 * 60 * 60 * 24);
        if (daysSinceCreation <= 7) {
          score += (7 - daysSinceCreation) * 2;
        }
      }
      
      return { ...product, trending_score: score };
    });

    scoredProducts.sort((a, b) => b.trending_score - a.trending_score);

    console.log("[TRENDING] Sending response with", scoredProducts.length, "products");
    return res.json({
      products: scoredProducts.slice(0, parseInt(limit)),
      count: scoredProducts.length
    });
  } catch (err) {
    console.error("Trending products error:", err);
    return res.status(500).json({ error: "Failed to fetch trending products" });
  }
});

// GET /products/trending-products - Get trending products based on views, clicks, and purchases
productsRouter.get("/trending-products", async (req, res) => {
  console.log(">>> TRENDING-PRODUCTS ROUTE HIT <<<");
  const { limit = 10 } = req.query;
  
  try {
    const { data: products, error } = await supabase
      .from("products")
      .select(`
        *,
        users!products_seller_id_fkey(full_name),
        categories!products_category_id_fkey(name, slug)
      `)
      .eq("is_active", true)
      .order("view_count", { ascending: false })
      .limit(parseInt(limit));

    if (error) {
      console.error("[TRENDING] Supabase error:", error);
      throw error;
    }

    console.log("[TRENDING] Found products:", products?.length);
    
    if (!products || products.length === 0) {
      return res.json({ products: [], count: 0 });
    }

    const now = new Date();
    const scoredProducts = products.map(product => {
      let score = 0;
      score += (product.view_count || 0) * 1;
      score += (product.click_count || 0) * 2;
      score += (product.purchase_count || 0) * 5;
      
      if (product.created_at) {
        const createdAt = new Date(product.created_at);
        const daysSinceCreation = (now - createdAt) / (1000 * 60 * 60 * 24);
        if (daysSinceCreation <= 7) {
          score += (7 - daysSinceCreation) * 2;
        }
      }
      
      return { ...product, trending_score: score };
    });

    scoredProducts.sort((a, b) => b.trending_score - a.trending_score);

    console.log("[TRENDING] Sending response with", scoredProducts.length, "products");
    return res.json({
      products: scoredProducts.slice(0, parseInt(limit)),
      count: scoredProducts.length
    });
  } catch (err) {
    console.error("Trending products error:", err);
    return res.status(500).json({ error: "Failed to fetch trending products" });
  }
});

// GET /products/:id - Get single product with view count
productsRouter.get("/:id", async (req, res) => {
  const { id } = req.params;
  
  // Prevent :id from matching our other routes
  if (id === "trending-products" || id === "test-special" || id === "seller" || id === "upload-image") {
    return res.status(404).json({ error: "Product not found" });
  }

  const { data: product, error } = await supabase
    .from("products")
    .select("*, users(full_name, email), categories!products_category_id_fkey(name, slug)")
    .eq("id", id)
    .single();

  if (error || !product) {
    // Try fallback
    const { data: fallbackProduct, fallbackError } = await supabase
      .from("products")
      .select(
        "*, users!products_seller_id_fkey(full_name, email, seller_display_name, seller_profile_image_url), categories!products_category_id_fkey(name, slug)",
      )
      .eq("id", id)
      .single();

    if (fallbackError || !fallbackProduct) {
      return res.status(404).json({ error: "Product not found" });
    }

    return res.json(fallbackProduct);
  }

  return res.json(product);
});

export default productsRouter;
