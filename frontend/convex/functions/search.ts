import { v } from "convex/values";
import { mutation, query } from "../_generated/server";
import { requireProfile, requireUserId } from "../lib/auth";
import { toIso } from "../lib/shapes";

export const addHistory = mutation({
  args: { query: v.string() },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    await requireProfile(ctx, userId);

    const query = args.query.trim();
    if (!query) throw new Error("Search query is required");

    const historyId = await ctx.db.insert("search_history", {
      user_id: userId,
      query,
      created_at: Date.now(),
    });

    const history = await ctx.db.get(historyId);
    return { history };
  },
});

export const history = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    await requireProfile(ctx, userId);

    const limit = Math.min(50, Math.max(1, args.limit ?? 10));
    const entries = await ctx.db
      .query("search_history")
      .withIndex("by_user", (q) => q.eq("user_id", userId))
      .collect();

    const seen = new Set<string>();
    const deduped: { query: string; created_at?: string }[] = [];

    for (const entry of entries.sort((a, b) => (b.created_at ?? 0) - (a.created_at ?? 0))) {
      const key = entry.query.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      deduped.push({ query: entry.query, created_at: toIso(entry.created_at) });
      if (deduped.length >= limit) break;
    }

    return { history: deduped };
  },
});

export const clearHistory = mutation({
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    await requireProfile(ctx, userId);

    const entries = await ctx.db
      .query("search_history")
      .withIndex("by_user", (q) => q.eq("user_id", userId))
      .collect();
    for (const entry of entries) await ctx.db.delete(entry._id);

    return { message: "Search history cleared" };
  },
});

export const suggestions = query({
  args: { q: v.optional(v.string()), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const limit = Math.min(20, Math.max(1, args.limit ?? 5));
    const q = (args.q ?? "").trim();

    if (q.length < 2) {
      return { suggestions: [], popular: [] as string[] };
    }

    const products = await ctx.db.query("products").collect();
    const needle = q.toLowerCase();

    const suggestions = products
      .filter((product) => product.title.toLowerCase().includes(needle))
      .slice(0, limit)
      .map((product) => ({
        id: product._id,
        title: product.title,
        image_url: product.image_url ?? "",
      }));

    const allHistory = await ctx.db.query("search_history").collect();
    const frequency = new Map<string, number>();
    for (const entry of allHistory) {
      if (entry.user_id === userId) continue;
      if (!entry.query.toLowerCase().includes(needle)) continue;
      frequency.set(entry.query, (frequency.get(entry.query) ?? 0) + 1);
    }

    const popular = [...frequency.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([value]) => value);

    return { suggestions, popular };
  },
});
