import { Router } from "express";
import { supabase } from "../lib/supabaseClient.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { upload } from "../middleware/upload.js";

const productsRouter = Router();
const ALLOWED_IMAGE_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

productsRouter.post("/upload-image", requireAuth, upload.single("image"), async (req, res) => {
  const file = req.file;

  if (!file) {
    return res.status(400).json({ error: "No image uploaded" });
  }

  if (!ALLOWED_IMAGE_MIME_TYPES.has(file.mimetype)) {
    return res.status(400).json({ error: "Only JPEG, PNG, WEBP, and GIF images are allowed" });
  }

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

  return res.json({ message: "Product created" });
});

productsRouter.get("/", async (req, res) => {
  const { q, category_id, min_price, max_price, sort, page, limit, seller_id, is_active } = req.query;

  const usePagination = page !== undefined || limit !== undefined;
  const pageNumber = Math.max(1, Number(page || 1));
  const limitNumber = Math.max(1, Number(limit || 20));
  const offset = (pageNumber - 1) * limitNumber;

  let query = supabase
    .from("products")
    .select("*, users(full_name, email), categories!products_category_id_fkey(name, slug)");

  if (q) query = query.ilike("title", `%${q}%`);
  if (category_id) query = query.eq("category_id", category_id);
  if (min_price) query = query.gte("price", Number(min_price));
  if (max_price) query = query.lte("price", Number(max_price));
  if (seller_id) query = query.eq("seller_id", seller_id);

  // Active status filter (default to only active products)
  if (is_active !== undefined) query = query.eq("is_active", is_active === "true");
  else query = query.or("is_active.is.null,is_active.eq.true");

  if (sort === "price_asc") query = query.order("price", { ascending: true });
  else if (sort === "price_desc") query = query.order("price", { ascending: false });
  else if (sort === "oldest") query = query.order("created_at", { ascending: true });
  else query = query.order("created_at", { ascending: false });

  if (usePagination) {
    query = query.range(offset, offset + limitNumber - 1);
  }

  const primary = await query;
  if (!primary.error) {
    return res.json(primary.data || []);
  }

  // Fallback syntax with explicit FK name for environments where relation aliasing differs.
  let fallbackQuery = supabase
    .from("products")
    .select("*, users!products_seller_id_fkey(full_name, email), categories!products_category_id_fkey(name, slug)");

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

  return res.json({ message: "Product deleted" });
});

// PUT /products/:id - Update a product
productsRouter.put("/:id", requireAuth, async (req, res) => {
  const { id } = req.params;
  const { title, description, price, image_url, category_id, is_active } = req.body || {};
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

// GET /products/:id - Get single product with view count
productsRouter.get("/:id", async (req, res) => {
  const { id } = req.params;

  const { data: product, error } = await supabase
    .from("products")
    .select("*, users(full_name, email, verified), categories!products_category_id_fkey(name, slug)")
    .eq("id", id)
    .single();

  if (error || !product) {
    // Try fallback
    const { data: fallbackProduct, fallbackError } = await supabase
      .from("products")
      .select(
        "*, users!products_seller_id_fkey(full_name, email, verified), categories!products_category_id_fkey(name, slug)",
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
