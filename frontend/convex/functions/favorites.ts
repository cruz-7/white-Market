import { v } from "convex/values";
import { mutation, query } from "../_generated/server";
import { requireProfile, requireUserId } from "../lib/auth";
import { toIso } from "../lib/shapes";

export const list = query({
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    await requireProfile(ctx, userId);

    const favorites = await ctx.db
      .query("favorites")
      .withIndex("by_user", (q) => q.eq("user_id", userId))
      .collect();

    const sorted = favorites.sort((a, b) => (b.created_at ?? 0) - (a.created_at ?? 0));

    const results = await Promise.all(
      sorted.map(async (favorite) => {
        const product = await ctx.db.get(favorite.product_id);
        if (!product) return null;
        const seller = await ctx.db.get(product.seller_id);
        return {
          id: favorite._id,
          user_id: favorite.user_id,
          product_id: favorite.product_id,
          created_at: toIso(favorite.created_at),
          product: {
            id: product._id,
            title: product.title,
            description: product.description,
            price: product.price,
            image_url: product.image_url,
            seller_id: product.seller_id,
            created_at: toIso(product.created_at),
            users: seller
              ? {
                  full_name: seller.full_name ?? seller.name ?? "",
                  avatar_url: seller.avatar_url ?? seller.image ?? null,
                }
              : undefined,
          },
        };
      })
    );

    return { favorites: results.filter(Boolean) };
  },
});

export const add = mutation({
  args: { product_id: v.id("products") },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    await requireProfile(ctx, userId);

    const product = await ctx.db.get(args.product_id);
    if (!product) throw new Error("Product not found");

    const existing = await ctx.db
      .query("favorites")
      .withIndex("by_user", (q) => q.eq("user_id", userId))
      .collect();
    const found = existing.find((f) => f.product_id === args.product_id);
    if (found) return { favorite: found };

    const favoriteId = await ctx.db.insert("favorites", {
      user_id: userId,
      product_id: args.product_id,
      created_at: Date.now(),
    });

    const favorite = await ctx.db.get(favoriteId);
    return { favorite };
  },
});

export const remove = mutation({
  args: { product_id: v.id("products") },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    await requireProfile(ctx, userId);

    const favorites = await ctx.db
      .query("favorites")
      .withIndex("by_user", (q) => q.eq("user_id", userId))
      .collect();
    const found = favorites.find((f) => f.product_id === args.product_id);
    if (found) await ctx.db.delete(found._id);

    return { message: "Removed from favorites" };
  },
});

export const check = query({
  args: { product_id: v.id("products") },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    await requireProfile(ctx, userId);

    const favorites = await ctx.db
      .query("favorites")
      .withIndex("by_user", (q) => q.eq("user_id", userId))
      .collect();

    return { is_favorited: favorites.some((f) => f.product_id === args.product_id) };
  },
});

export const likeCount = query({
  args: { product_id: v.id("products") },
  handler: async (ctx, args) => {
    const product = await ctx.db.get(args.product_id);
    if (!product) throw new Error("Product not found");
    return { like_count: product.like_count ?? 0 };
  },
});

export const like = mutation({
  args: { product_id: v.id("products") },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    await requireProfile(ctx, userId);

    const product = await ctx.db.get(args.product_id);
    if (!product) throw new Error("Product not found");

    const likes = await ctx.db
      .query("likes")
      .withIndex("by_user", (q) => q.eq("user_id", userId))
      .collect();
    const found = likes.find((l) => l.product_id === args.product_id);
    if (found) {
      return { like: found, like_count: product.like_count ?? 0 };
    }

    const likeId = await ctx.db.insert("likes", {
      user_id: userId,
      product_id: args.product_id,
      created_at: Date.now(),
    });

    const likeCount = (product.like_count ?? 0) + 1;
    await ctx.db.patch(product._id, { like_count: likeCount });

    const like = await ctx.db.get(likeId);
    return { like, like_count: likeCount };
  },
});

export const unlike = mutation({
  args: { product_id: v.id("products") },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    await requireProfile(ctx, userId);

    const product = await ctx.db.get(args.product_id);
    if (!product) throw new Error("Product not found");

    const likes = await ctx.db
      .query("likes")
      .withIndex("by_user", (q) => q.eq("user_id", userId))
      .collect();
    const found = likes.find((l) => l.product_id === args.product_id);
    if (found) await ctx.db.delete(found._id);

    const likeCount = Math.max(0, (product.like_count ?? 0) - 1);
    await ctx.db.patch(product._id, { like_count: likeCount });

    return { message: "Unliked", like_count: likeCount };
  },
});

export const isLiked = query({
  args: { product_id: v.id("products") },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    await requireProfile(ctx, userId);

    const likes = await ctx.db
      .query("likes")
      .withIndex("by_user", (q) => q.eq("user_id", userId))
      .collect();

    return { is_liked: likes.some((l) => l.product_id === args.product_id) };
  },
});
