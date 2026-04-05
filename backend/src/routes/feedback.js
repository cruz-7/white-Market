import { Router } from "express";
import { supabase } from "../lib/supabaseClient.js";
import { requireAuth } from "../middleware/requireAuth.js";

const router = Router();

router.post("/", async (req, res) => {
  try {
    const userId = req.user?.id || null;
    const {
      rating,
      feedback_type = "general",
      feedback_text,
      would_recommend,
      improved_features,
      is_satisfied,
      page_url,
      session_duration_seconds,
    } = req.body;

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ error: "Rating must be between 1 and 5" });
    }

    const { data, error } = await supabase
      .from("website_feedback")
      .insert({
        user_id: userId,
        rating,
        feedback_type,
        feedback_text,
        would_recommend,
        improved_features: improved_features || [],
        is_satisfied,
        page_url,
        session_duration_seconds,
      })
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({ message: "Feedback submitted successfully", feedback: data });
  } catch (error) {
    console.error("Error submitting feedback:", error);
    res.status(500).json({ error: "Failed to submit feedback" });
  }
});

router.get("/testimonials", async (req, res) => {
  try {
    const { limit = 3 } = req.query;

    const { data, error } = await supabase.rpc("get_top_testimonials", {
      limit_count: parseInt(limit) || 3,
    });

    if (error) throw error;

    res.json({ testimonials: data || [] });
  } catch (error) {
    console.error("Error fetching testimonials:", error);
    res.status(500).json({ error: "Failed to fetch testimonials" });
  }
});

router.get("/stats", async (req, res) => {
  try {
    const { data, error } = await supabase.rpc("get_feedback_stats");

    if (error) throw error;

    res.json({ stats: data?.[0] || null });
  } catch (error) {
    console.error("Error fetching feedback stats:", error);
    res.status(500).json({ error: "Failed to fetch feedback stats" });
  }
});

router.get("/", requireAuth, async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const { data, error } = await supabase
      .from("website_feedback")
      .select(`
        *,
        user:user_id(id, full_name, email, avatar_url)
      `)
      .order("created_at", { ascending: false })
      .range(offset, offset + parseInt(limit) - 1);

    if (error) throw error;

    const { count, error: countError } = await supabase
      .from("website_feedback")
      .select("*", { count: "exact", head: true });

    if (countError) throw countError;

    res.json({
      feedback: data || [],
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count || 0,
        pages: Math.ceil((count || 0) / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error("Error fetching feedback:", error);
    res.status(500).json({ error: "Failed to fetch feedback" });
  }
});

router.get("/:feedbackId", requireAuth, async (req, res) => {
  try {
    const { feedbackId } = req.params;

    const { data, error } = await supabase
      .from("website_feedback")
      .select(`
        *,
        user:user_id(id, full_name, email, avatar_url)
      `)
      .eq("id", feedbackId)
      .single();

    if (error) throw error;

    res.json({ feedback: data });
  } catch (error) {
    console.error("Error fetching feedback:", error);
    res.status(500).json({ error: "Failed to fetch feedback" });
  }
});

export default router;