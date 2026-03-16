import { Router } from "express";
import { supabase } from "../lib/supabaseClient.js";
import { requireAuth } from "../middleware/requireAuth.js";

const notificationsRouter = Router();

// GET /notifications - Get user's notifications
notificationsRouter.get("/", requireAuth, async (req, res) => {
  try {
    const { page = 1, limit = 20, unread_only } = req.query;
    const offset = (page - 1) * limit;

    let query = supabase
      .from("notifications")
      .select("*")
      .eq("user_id", req.user.id);

    if (unread_only === "true") {
      query = query.eq("is_read", false);
    }

    const { data: notifications, error } = await query
      .range(offset, offset + limit - 1)
      .order("created_at", { ascending: false });

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    const { count, error: countError } = await supabase
      .from("notifications")
      .select("*", { count: "exact", head: true })
      .eq("user_id", req.user.id)
      .eq("is_read", false);

    if (countError) {
      return res.status(400).json({ error: countError.message });
    }

    return res.json({
      notifications: notifications || [],
      unread_count: count || 0,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: count || 0,
      },
    });
  } catch (error) {
    console.error("Get notifications error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// GET /notifications/unread-count - Get unread notification count
notificationsRouter.get("/unread-count", requireAuth, async (req, res) => {
  try {
    const { count, error } = await supabase
      .from("notifications")
      .select("*", { count: "exact", head: true })
      .eq("user_id", req.user.id)
      .eq("is_read", false);

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    return res.json({ unread_count: count || 0 });
  } catch (error) {
    console.error("Get unread count error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// PATCH /notifications/:id/read - Mark single notification as read
notificationsRouter.patch("/:id/read", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;

    const { error } = await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("id", id)
      .eq("user_id", req.user.id);

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    return res.json({ message: "Notification marked as read" });
  } catch (error) {
    console.error("Mark read error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// PATCH /notifications/read-all - Mark all notifications as read
notificationsRouter.patch("/read-all", requireAuth, async (req, res) => {
  try {
    const { error } = await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("user_id", req.user.id)
      .eq("is_read", false);

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    return res.json({ message: "All notifications marked as read" });
  } catch (error) {
    console.error("Mark all read error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /notifications/:id - Delete a notification
notificationsRouter.delete("/:id", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;

    const { error } = await supabase
      .from("notifications")
      .delete()
      .eq("id", id)
      .eq("user_id", req.user.id);

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    return res.json({ message: "Notification deleted" });
  } catch (error) {
    console.error("Delete notification error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /notifications/clear-all - Clear all notifications
notificationsRouter.delete("/clear-all", requireAuth, async (req, res) => {
  try {
    const { error } = await supabase
      .from("notifications")
      .delete()
      .eq("user_id", req.user.id);

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    return res.json({ message: "All notifications cleared" });
  } catch (error) {
    console.error("Clear notifications error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// Admin: POST /notifications - Send notification to user(s)
notificationsRouter.post("/", requireAuth, async (req, res) => {
  try {
    // Check if user is admin
    const { data: user, error: userError } = await supabase
      .from("users")
      .select("role")
      .eq("id", req.user.id)
      .single();

    if (userError || !user || user.role !== "admin") {
      return res.status(403).json({ error: "Admin access required" });
    }

    const { user_id, type, title, body, data, user_ids } = req.body;

    if (!title) {
      return res.status(400).json({ error: "title is required" });
    }

    if (user_id) {
      // Send to single user
      const { error } = await supabase.from("notifications").insert({
        user_id,
        type: type || "announcement",
        title,
        body: body || null,
        data: data || null,
      });

      if (error) {
        return res.status(400).json({ error: error.message });
      }

      return res.json({ message: "Notification sent" });
    } else if (user_ids && Array.isArray(user_ids)) {
      // Send to multiple users
      const notifications = user_ids.map((id) => ({
        user_id: id,
        type: type || "announcement",
        title,
        body: body || null,
        data: data || null,
      }));

      const { error } = await supabase.from("notifications").insert(notifications);

      if (error) {
        return res.status(400).json({ error: error.message });
      }

      return res.json({ message: `Notifications sent to ${user_ids.length} users` });
    } else {
      return res.status(400).json({ error: "user_id or user_ids is required" });
    }
  } catch (error) {
    console.error("Send notification error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default notificationsRouter;