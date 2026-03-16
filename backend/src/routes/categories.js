import { Router } from "express";
import { supabase } from "../lib/supabaseClient.js";

const categoriesRouter = Router();

// GET /categories - Get all active categories
categoriesRouter.get("/", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("categories")
      .select("*")
      .eq("is_active", true)
      .order("sort_order", { ascending: true });

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    // Get product count for each category
    const { data: counts, error: countError } = await supabase
      .from("products")
      .select("category_id");

    if (countError) {
      return res.status(400).json({ error: countError.message });
    }

    const countByCategory = {};
    for (const product of counts || []) {
      if (product.category_id) {
        countByCategory[product.category_id] = (countByCategory[product.category_id] || 0) + 1;
      }
    }

    const categoriesWithCount = (data || []).map((cat) => ({
      ...cat,
      product_count: countByCategory[cat.id] || 0,
    }));

    return res.json(categoriesWithCount);
  } catch (error) {
    console.error("Get categories error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// GET /categories/:id - Get single category with products
categoriesRouter.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    const { data: category, error: catError } = await supabase
      .from("categories")
      .select("*")
      .eq("id", id)
      .single();

    if (catError || !category) {
      return res.status(404).json({ error: "Category not found" });
    }

    const { data: products, error: prodError } = await supabase
      .from("products")
      .select("*, users(full_name, avatar_url)")
      .eq("category_id", id)
      .range(offset, offset + limit - 1)
      .order("created_at", { ascending: false });

    if (prodError) {
      return res.status(400).json({ error: prodError.message });
    }

    const { count, error: countError } = await supabase
      .from("products")
      .select("*", { count: "exact", head: true })
      .eq("category_id", id);

    return res.json({
      category,
      products: products || [],
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: count || 0,
        pages: Math.ceil((count || 0) / limit),
      },
    });
  } catch (error) {
    console.error("Get category error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// Admin: POST /categories - Create category
categoriesRouter.post("/", async (req, res) => {
  try {
    // Check if user is admin
    const { data: user, error: userError } = await supabase
      .from("users")
      .select("role")
      .eq("id", req.user?.id)
      .single();

    if (userError || !user || user.role !== "admin") {
      return res.status(403).json({ error: "Admin access required" });
    }

    const { name, description, icon } = req.body;

    if (!name) {
      return res.status(400).json({ error: "Category name is required" });
    }

    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

    const { data, error } = await supabase
      .from("categories")
      .insert({
        name,
        slug,
        description,
        icon,
      })
      .select()
      .single();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    return res.status(201).json({ category: data });
  } catch (error) {
    console.error("Create category error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// Admin: DELETE /categories/:id - Delete category
categoriesRouter.delete("/:id", async (req, res) => {
  try {
    // Check if user is admin
    const { data: user, error: userError } = await supabase
      .from("users")
      .select("role")
      .eq("id", req.user?.id)
      .single();

    if (userError || !user || user.role !== "admin") {
      return res.status(403).json({ error: "Admin access required" });
    }

    const { id } = req.params;

    // Move products to "Other" category
    const { data: otherCategory } = await supabase
      .from("categories")
      .select("id")
      .eq("slug", "other")
      .single();

    if (otherCategory) {
      await supabase
        .from("products")
        .update({ category_id: otherCategory.id })
        .eq("category_id", id);
    }

    const { error } = await supabase
      .from("categories")
      .delete()
      .eq("id", id);

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    return res.json({ message: "Category deleted" });
  } catch (error) {
    console.error("Delete category error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default categoriesRouter;