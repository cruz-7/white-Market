import { Router } from "express";
import { supabase } from "../lib/supabaseClient.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { upload } from "../middleware/upload.js";

const productsRouter = Router();

productsRouter.post("/upload-image", requireAuth, upload.single("image"), async (req, res) => {
  const file = req.file;

  if (!file) {
    return res.status(400).json({ error: "No image uploaded" });
  }

  const originalExt = file.originalname.split(".").pop();
  const fileExt = originalExt && originalExt.length <= 10 ? originalExt : "jpg";
  const fileName = `${Date.now()}-${Math.round(Math.random() * 1e9)}.${fileExt}`;

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
  const { title, description, price, image_url } = req.body || {};
  const seller_id = req.user.id;

  if (!title || price === undefined || price === null) {
    return res.status(400).json({ error: "title and price are required" });
  }

  const { error } = await supabase.from("products").insert({
    seller_id,
    title,
    description: description || null,
    price,
    image_url: image_url || null,
  });

  if (error) {
    return res.status(400).json({ error: error.message });
  }

  return res.json({ message: "Product created" });
});

productsRouter.get("/", async (req, res) => {
  const { q } = req.query;

  let primaryQuery = supabase.from("products").select("*, users(full_name, email)");
  if (q) primaryQuery = primaryQuery.ilike("title", `%${q}%`);
  const primary = await primaryQuery;

  if (!primary.error) {
    return res.json(primary.data);
  }

  // Fallback syntax with explicit FK name for environments where relation aliasing differs.
  let fallbackQuery = supabase.from("products").select("*, users!products_seller_id_fkey(full_name, email)");
  if (q) fallbackQuery = fallbackQuery.ilike("title", `%${q}%`);
  const fallback = await fallbackQuery;

  if (fallback.error) {
    return res.status(400).json({ error: fallback.error.message });
  }

  return res.json(fallback.data);
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

export default productsRouter;
