import { Router } from "express";
import { supabase } from "../lib/supabaseClient.js";
import { requireAuth } from "../middleware/requireAuth.js";

const searchRouter = Router();

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

export default searchRouter;