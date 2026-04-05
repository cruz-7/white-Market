import { Router } from "express";
import { supabase } from "../lib/supabaseClient.js";
import { requireAuth } from "../middleware/requireAuth.js";
import multer from "multer";
import path from "path";
import fs from "fs";

const searchRouter = Router();

// Configure multer for image uploads
const upload = multer({
  dest: 'uploads/temp/',
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'));
    }
  }
});

// Ensure upload directory exists
if (!fs.existsSync('uploads/temp')) {
  fs.mkdirSync('uploads/temp', { recursive: true });
}

// POST /search/history - Save search query
searchRouter.post("/history", requireAuth, async (req, res) => {
  try {
    const { query } = req.body;

    if (!query || query.trim().length === 0) {
      return res.status(400).json({ error: "Search query is required" });
    }

    const trimmedQuery = query.trim();

    // Save to search history
    const { data: history, error } = await supabase
      .from("search_history")
      .insert({
        user_id: req.user.id,
        query: trimmedQuery,
      })
      .select()
      .single();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    return res.status(201).json({ history });
  } catch (error) {
    console.error("Save search history error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// GET /search/history - Get user's search history
searchRouter.get("/history", requireAuth, async (req, res) => {
  try {
    const { limit = 10 } = req.query;

    const { data: history, error } = await supabase
      .from("search_history")
      .select("query, created_at")
      .eq("user_id", req.user.id)
      .order("created_at", { ascending: false })
      .limit(Number(limit));

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    // Get unique queries (most recent first)
    const uniqueQueries = [];
    const seen = new Set();
    for (const item of history || []) {
      if (!seen.has(item.query.toLowerCase())) {
        seen.add(item.query.toLowerCase());
        uniqueQueries.push(item);
      }
    }

    return res.json({ history: uniqueQueries });
  } catch (error) {
    console.error("Get search history error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /search/history - Clear user's search history
searchRouter.delete("/history", requireAuth, async (req, res) => {
  try {
    const { error } = await supabase
      .from("search_history")
      .delete()
      .eq("user_id", req.user.id);

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    return res.json({ message: "Search history cleared" });
  } catch (error) {
    console.error("Clear search history error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// GET /search/suggestions - Get search suggestions based on query
searchRouter.get("/suggestions", async (req, res) => {
  try {
    const { q, limit = 5 } = req.query;

    if (!q || q.trim().length < 2) {
      return res.json({ suggestions: [] });
    }

    // Search products by title
    const { data: products, error } = await supabase
      .from("products")
      .select("id, title, image_url")
      .ilike("title", `%${q.trim()}%`)
      .limit(Number(limit));

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    // Get popular searches from other users (excluding current user's searches)
    const currentUserId = req.user?.id || "00000000-0000-0000-0000-000000000000";
    const { data: popularSearches } = await supabase
      .from("search_history")
      .select("query")
      .neq("user_id", currentUserId)
      .ilike("query", `%${q.trim()}%`)
      .order("created_at", { ascending: false })
      .limit(Number(limit));

    // Count occurrences
    const queryCounts = {};
    for (const search of popularSearches || []) {
      const lowerQuery = search.query.toLowerCase();
      queryCounts[lowerQuery] = (queryCounts[lowerQuery] || 0) + 1;
    }

    // Sort by frequency
    const sortedSuggestions = Object.entries(queryCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, Number(limit))
      .map(([query]) => query);

    return res.json({
      suggestions: products || [],
      popular: sortedSuggestions,
    });
  } catch (error) {
    console.error("Get search suggestions error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// POST /search/image - Search products by image
searchRouter.post("/image", requireAuth, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No image file provided" });
    }

    const imagePath = req.file.path;

    // For now, we'll implement a basic similarity search based on categories and keywords
    // In a production system, this would use image processing libraries like TensorFlow.js
    // or services like Google Vision AI, AWS Rekognition, etc.

    // Extract basic features from the image filename or analyze image metadata
    // This is a placeholder - real implementation would analyze the actual image content
    const imageName = req.file.originalname.toLowerCase();

    // Simple keyword extraction from filename (very basic approach)
    const keywords = imageName.replace(/\.(jpg|jpeg|png|webp)$/i, '').split(/[\s\-_]+/);

    // Search for products that might be visually similar based on categories and titles
    let searchQuery = supabase
      .from("products")
      .select(`
        id,
        title,
        description,
        price,
        image_url,
        category_id,
        categories!inner(name),
        users!inner(full_name)
      `)
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(20);

    // Build search conditions based on extracted keywords
    const searchConditions = [];

    // Check for clothing-related keywords
    if (keywords.some(k => ['shirt', 'tshirt', 'top', 'blouse', 'dress', 'skirt', 'pants', 'jeans', 'jacket', 'coat', 'sweater', 'hoodie'].includes(k))) {
      searchConditions.push("categories.name.ilike.%clothing%");
      searchConditions.push("categories.name.ilike.%fashion%");
    }

    // Check for electronics
    if (keywords.some(k => ['phone', 'laptop', 'computer', 'charger', 'headphones', 'earbuds', 'tablet', 'watch'].includes(k))) {
      searchConditions.push("categories.name.ilike.%electronics%");
    }

    // Check for food
    if (keywords.some(k => ['food', 'meal', 'snack', 'drink', 'juice', 'pizza', 'burger', 'pasta', 'rice', 'chicken'].includes(k))) {
      searchConditions.push("categories.name.ilike.%food%");
    }

    // Check for books/stationery
    if (keywords.some(k => ['book', 'notebook', 'pen', 'pencil', 'paper', 'textbook', 'notes'].includes(k))) {
      searchConditions.push("categories.name.ilike.%stationery%");
      searchConditions.push("categories.name.ilike.%books%");
    }

    // If no specific category matches, search by title similarity
    if (searchConditions.length === 0) {
      // Search in product titles for any of the keywords
      for (const keyword of keywords) {
        searchQuery = searchQuery.or(`title.ilike.%${keyword}%`);
      }
    } else {
      // Search by category - iterate through conditions
      for (const condition of searchConditions) {
        searchQuery = searchQuery.or(condition);
      }
    }

    const { data: products, error } = await searchQuery;

    if (error) {
      console.error("Image search error:", error);
      return res.status(400).json({ error: error.message });
    }

    // Calculate similarity scores (placeholder - in real implementation this would be based on image features)
    const results = (products || []).map(product => {
      let similarity = 0.5; // Base similarity

      // Increase similarity based on keyword matches in title
      const titleWords = product.title.toLowerCase().split(/\s+/);
      const matchingWords = keywords.filter(keyword =>
        titleWords.some(word => word.includes(keyword) || keyword.includes(word))
      );
      similarity += matchingWords.length * 0.1;

      // Cap similarity at 0.95
      similarity = Math.min(similarity, 0.95);

      return {
        id: product.id,
        title: product.title,
        description: product.description,
        price: product.price,
        image_url: product.image_url,
        category: product.categories?.name || 'Uncategorized',
        seller_name: product.users?.full_name || 'Unknown Seller',
        similarity: Math.round(similarity * 100) / 100
      };
    });

    // Sort by similarity score
    results.sort((a, b) => b.similarity - a.similarity);

    // Clean up uploaded file
    try {
      fs.unlinkSync(imagePath);
    } catch (cleanupError) {
      console.warn("Failed to clean up uploaded file:", cleanupError);
    }

    return res.json({
      results: results.slice(0, 12), // Return top 12 results
      total: results.length,
      search_terms: keywords
    });

  } catch (error) {
    console.error("Image search error:", error);

    // Clean up uploaded file on error
    if (req.file?.path) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (cleanupError) {
        console.warn("Failed to clean up uploaded file on error:", cleanupError);
      }
    }

    return res.status(500).json({ error: "Failed to process image search" });
  }
});

export default searchRouter;