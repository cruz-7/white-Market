import { v } from "convex/values";
import { mutation, query } from "../_generated/server";
import { requireProfile, requireUserId } from "../lib/auth";
import { toIso } from "../lib/shapes";

export const list = query({
  args: {
    page: v.optional(v.number()),
    limit: v.optional(v.number()),
    unread_only: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    await requireProfile(ctx, userId);

    const page = Math.max(1, args.page ?? 1);
    const limit = Math.min(100, Math.max(1, args.limit ?? 20));
    const offset = (page - 1) * limit;

    const all = (await ctx.db
      .query("notifications")
      .withIndex("by_user", (q) => q.eq("user_id", userId))
      .collect()).filter((n) => (args.unread_only ? n.read !== true : true));

    const sorted = all.sort((a, b) => (b.created_at ?? 0) - (a.created_at ?? 0));
    const pageItems = sorted.slice(offset, offset + limit);

    return {
      notifications: pageItems.map((notification) => ({
        id: notification._id,
        user_id: notification.user_id,
        type: notification.type,
        title: notification.title,
        body: notification.body,
        data: notification.data,
        is_read: notification.read === true,
        read: notification.read === true,
        created_at: toIso(notification.created_at),
      })),
      unread_count: all.filter((n) => n.read !== true).length,
      pagination: { page, limit, total: all.length },
    };
  },
});

export const unreadCount = query({
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    await requireProfile(ctx, userId);

    const all = await ctx.db
      .query("notifications")
      .withIndex("by_user", (q) => q.eq("user_id", userId))
      .collect();

    return { unread_count: all.filter((n) => n.read !== true).length };
  },
});

export const markRead = mutation({
  args: { id: v.id("notifications") },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const notification = await ctx.db.get(args.id);
    if (!notification || notification.user_id !== userId) {
      throw new Error("Notification not found");
    }
    await ctx.db.patch(args.id, { read: true });
    return { message: "Notification marked as read" };
  },
});

export const readAll = mutation({
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    await requireProfile(ctx, userId);

    const all = await ctx.db
      .query("notifications")
      .withIndex("by_user", (q) => q.eq("user_id", userId))
      .collect();

    for (const notification of all) {
      if (notification.read !== true) {
        await ctx.db.patch(notification._id, { read: true });
      }
    }

    return { message: "All notifications marked as read" };
  },
});

export const remove = mutation({
  args: { id: v.id("notifications") },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const notification = await ctx.db.get(args.id);
    if (!notification || notification.user_id !== userId) {
      throw new Error("Notification not found");
    }
    await ctx.db.delete(args.id);
    return { message: "Notification deleted" };
  },
});

export const clearAll = mutation({
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    await requireProfile(ctx, userId);

    const all = await ctx.db
      .query("notifications")
      .withIndex("by_user", (q) => q.eq("user_id", userId))
      .collect();
    for (const notification of all) await ctx.db.delete(notification._id);

    return { message: "All notifications cleared" };
  },
});

/** Admin broadcast. */
export const create = mutation({
  args: {
    user_id: v.optional(v.id("users")),
    user_ids: v.optional(v.array(v.id("users"))),
    type: v.optional(v.string()),
    title: v.string(),
    body: v.optional(v.string()),
    data: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const admin = await requireProfile(ctx, userId);
    if (admin.role !== "admin") throw new Error("Admin access only");

    const targets = args.user_ids ?? (args.user_id ? [args.user_id] : []);
    if (targets.length === 0) throw new Error("At least one recipient is required");

    for (const target of targets) {
      await ctx.db.insert("notifications", {
        user_id: target,
        type: args.type ?? "announcement",
        title: args.title,
        body: args.body,
        data: args.data,
        read: false,
        created_at: Date.now(),
      });
    }

    return { message: `Notification sent to ${targets.length} user(s)` };
  },
});
