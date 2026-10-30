import { v } from "convex/values";
import { mutation, query } from "../_generated/server";
import { requireProfile, requireUserId } from "../lib/auth";
import { productShape } from "../lib/shapes";
import { requireAdmin } from "../lib/auth";
import { processSellerReferralQualification } from "./referrals";

type Sort = "price_asc" | "price_desc" | "newest" | "oldest";

function matchesText(haystack: string | undefined, needle: string): boolean {
  if (!haystack) return false;
  return haystack.toLowerCase().includes(needle.toLowerCase());
}

export const list = query({
  args: {
    q: v.optional(v.string()),
    category_id: v.optional(v.id("categories")),
    min_price: v.optional(v.number()),
    max_price: v.optional(v.number()),
    sort: v.optional(v.string()),
    page: v.optional(v.number()),
    limit: v.optional(v.number()),
    seller_id: v.optional(v.id("users")),
    is_active: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const all = await ctx.db.query("products").collect();

    let products = all.filter((product) => {
      if (args.is_active !== undefined) {
        if ((product.is_active ?? true) !== args.is_active) return false;
      } else if (product.is_active === false) {
        return false;
      }
      if (args.category_id && product.category_id !== args.category_id) return false;
      if (args.seller_id && product.seller_id !== args.seller_id) return false;
      if (args.min_price !== undefined && product.price < args.min_price) return false;
      if (args.max_price !== undefined && product.price > args.max_price) return false;
      if (args.q) {
        const q = args.q.trim();
        const hit =
          matchesText(product.title, q) ||
          matchesText(product.description, q) ||
          matchesText(product.category, q) ||
          (product.tags ?? []).some((tag) => matchesText(tag, q));
        if (!hit) return false;
      }
      return true;
    });

    const sort = (args.sort ?? "newest") as Sort;
    products = products.sort((a, b) => {
      switch (sort) {
        case "price_asc":
          return a.price - b.price;
        case "price_desc":
          return b.price - a.price;
        case "oldest":
          return (a.created_at ?? 0) - (b.created_at ?? 0);
        case "newest":
        default:
          return (b.created_at ?? 0) - (a.created_at ?? 0);
      }
    });

    if (args.page !== undefined || args.limit !== undefined) {
      const page = Math.max(1, args.page ?? 1);
      const limit = Math.min(100, Math.max(1, args.limit ?? 20));
      const offset = (page - 1) * limit;
      products = products.slice(offset, offset + limit);
    }

    const sellerIds = [...new Set(products.map((p) => p.seller_id))];
    const categoryIds = [
      ...new Set(products.map((p) => p.category_id).filter((id): id is NonNullable<typeof id> => !!id)),
    ];

    const sellers = await Promise.all(sellerIds.map((id) => ctx.db.get(id)));
    const categories = await Promise.all(categoryIds.map((id) => ctx.db.get(id)));

    const sellerById = new Map(sellers.filter(Boolean).map((s) => [s!._id, s!]));
    const categoryById = new Map(categories.filter(Boolean).map((c) => [c!._id, c!]));

    return products.map((product) =>
      productShape(
        product,
        sellerById.get(product.seller_id) ?? null,
        product.category_id ? (categoryById.get(product.category_id) ?? null) : null
      )
    );
  },
});

/**
 * Trending score: views + 2x clicks + 5x purchases, with a recency bonus for
 * anything listed in the last 7 days.
 */
export const trending = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const limit = Math.min(50, Math.max(1, args.limit ?? 10));
    const now = Date.now();
    const sevenDays = 7 * 24 * 60 * 60 * 1000;

    const products = (await ctx.db.query("products").collect()).filter(
      (product) => product.is_active !== false
    );

    const scored = products
      .map((product) => {
        const age = now - (product.created_at ?? now);
        const recency = age <= sevenDays ? 2 : 0;
        const score =
          (product.view_count ?? 0) * 1 +
          (product.click_count ?? 0) * 2 +
          (product.purchase_count ?? 0) * 5 +
          recency;
        return { product, score };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    const sellerIds = [...new Set(scored.map((s) => s.product.seller_id))];
    const sellers = await Promise.all(sellerIds.map((id) => ctx.db.get(id)));
    const sellerById = new Map(sellers.filter(Boolean).map((s) => [s!._id, s!]));

    return scored.map(({ product }) =>
      productShape(product, sellerById.get(product.seller_id) ?? null, null)
    );
  },
});

export const get = query({
  args: { id: v.id("products") },
  handler: async (ctx, args) => {
    const product = await ctx.db.get(args.id);
    if (!product) throw new Error("Product not found");

    const seller = await ctx.db.get(product.seller_id);
    const category = product.category_id ? await ctx.db.get(product.category_id) : null;
    return productShape(product, seller, category);
  },
});

export const bySeller = query({
  args: { sellerId: v.id("users") },
  handler: async (ctx, args) => {
    const products = await ctx.db
      .query("products")
      .withIndex("by_seller", (q) => q.eq("seller_id", args.sellerId))
      .collect();

    const categoryIds = [
      ...new Set(products.map((p) => p.category_id).filter((id): id is NonNullable<typeof id> => !!id)),
    ];
    const categories = await Promise.all(categoryIds.map((id) => ctx.db.get(id)));
    const categoryById = new Map(categories.filter(Boolean).map((c) => [c!._id, c!]));

    return products.map((product) =>
      productShape(
        product,
        null,
        product.category_id ? (categoryById.get(product.category_id) ?? null) : null
      )
    );
  },
});

export const recordView = mutation({
  args: { id: v.id("products") },
  handler: async (ctx, args) => {
    const product = await ctx.db.get(args.id);
    if (!product) throw new Error("Product not found");
    await ctx.db.patch(args.id, { view_count: (product.view_count ?? 0) + 1 });
    return { message: "View recorded" };
  },
});

export const recordClick = mutation({
  args: { id: v.id("products") },
  handler: async (ctx, args) => {
    const product = await ctx.db.get(args.id);
    if (!product) throw new Error("Product not found");
    await ctx.db.patch(args.id, { click_count: (product.click_count ?? 0) + 1 });
    return { success: true };
  },
});

export const create = mutation({
  args: {
    title: v.string(),
    description: v.optional(v.string()),
    price: v.number(),
    image_url: v.optional(v.string()),
    category_id: v.optional(v.id("categories")),
    condition: v.optional(v.string()),
    campus: v.optional(v.string()),
    stock_quantity: v.optional(v.number()),
    negotiable: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    await requireProfile(ctx, userId);

    if (!args.title.trim()) throw new Error("Title is required");
    if (!(args.price > 0)) throw new Error("Price must be greater than 0");

    const now = Date.now();
    const productId = await ctx.db.insert("products", {
      seller_id: userId,
      title: args.title.trim(),
      description: args.description,
      price: args.price,
      image_url: args.image_url,
      category_id: args.category_id,
      condition: args.condition,
      campus: args.campus,
      stock_quantity: args.stock_quantity,
      negotiable: args.negotiable ?? true,
      is_active: true,
      view_count: 0,
      click_count: 0,
      purchase_count: 0,
      like_count: 0,
      average_rating: 0,
      rating_count: 0,
      created_at: now,
      updated_at: now,
    });

    // Listing a first product qualifies the seller for referral rewards.
    const sellerProducts = await ctx.db
      .query("products")
      .withIndex("by_seller", (q) => q.eq("seller_id", userId))
      .collect();
    if (sellerProducts.length === 1) {
      await processSellerReferralQualification(ctx, userId);
    }

    return { message: "Product created", product_id: productId };
  },
});

export const update = mutation({
  args: {
    id: v.id("products"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    price: v.optional(v.number()),
    image_url: v.optional(v.string()),
    category_id: v.optional(v.id("categories")),
    is_active: v.optional(v.boolean()),
    stock_quantity: v.optional(v.number()),
    condition: v.optional(v.string()),
    negotiable: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const profile = await requireProfile(ctx, userId);

    const product = await ctx.db.get(args.id);
    if (!product) throw new Error("Product not found");
    if (product.seller_id !== userId && profile.role !== "admin") {
      throw new Error("Not authorized to update this product");
    }

    const { id, ...updates } = args;
    const patch: Record<string, unknown> = { updated_at: Date.now() };
    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined) patch[key] = value;
    }
    await ctx.db.patch(id, patch);

    const updated = await ctx.db.get(id);
    return { message: "Product updated", product: updated };
  },
});

export const remove = mutation({
  args: { id: v.id("products") },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const profile = await requireProfile(ctx, userId);

    const product = await ctx.db.get(args.id);
    if (!product) throw new Error("Product not found");
    if (product.seller_id !== userId && profile.role !== "admin") {
      throw new Error("Not authorized to delete this product");
    }

    await ctx.db.delete(args.id);
    return { message: "Product deleted" };
  },
});

/** Admin-only hard delete, kept separate from the seller delete above. */
export const adminRemove = mutation({
  args: { id: v.id("products") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    await ctx.db.delete(args.id);
    return { message: "Product removed" };
  },
});
