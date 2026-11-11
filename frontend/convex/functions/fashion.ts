import { v } from "convex/values";
import { mutation, query } from "../_generated/server";
import { requireProfile, requireUserId, requireVerifiedStudent } from "../lib/auth";
import { round2 } from "../lib/money";
import { toIso } from "../lib/shapes";
import type { Doc } from "../_generated/dataModel";

function fashionShape(item: Doc<"fashion">) {
  const timestamp = new Date(item.created_at ?? 0).toISOString();
  return {
    id: item._id,
    user_id: item.seller_id,
    title: item.title,
    description: item.description,
    category: item.category,
    gender: item.gender,
    size: item.size,
    color: item.color,
    brand: item.brand,
    material: item.material,
    pattern: item.pattern,
    condition: item.condition,
    price: item.price,
    price_negotiable: item.price_negotiable ?? true,
    original_price: item.original_price,
    location: item.location,
    images: item.images ?? [],
    is_active: item.is_active !== false,
    is_sold: item.is_sold ?? false,
    is_reserved: !!item.reserved_order_id && !item.is_sold,
    view_count: item.view_count ?? 0,
    rating: item.rating ?? 0,
    review_count: item.review_count ?? 0,
    created_at: toIso(item.created_at) ?? timestamp,
    updated_at: toIso(item.updated_at) ?? timestamp,
  };
}

export const list = query({
  args: {
    category: v.optional(v.string()),
    gender: v.optional(v.string()),
    size: v.optional(v.string()),
    color: v.optional(v.string()),
    brand: v.optional(v.string()),
    condition: v.optional(v.string()),
    min_price: v.optional(v.number()),
    max_price: v.optional(v.number()),
    search: v.optional(v.string()),
    limit: v.optional(v.number()),
    offset: v.optional(v.number()),
    sort: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const limit = Math.min(100, Math.max(1, args.limit ?? 20));
    const offset = Math.max(0, args.offset ?? 0);

    const all = (await ctx.db.query("fashion").collect()).filter((item) => {
      if (item.is_active === false || item.is_sold === true) return false;
      if (item.reserved_order_id) return false;
      if (args.category && item.category !== args.category) return false;
      if (args.gender && item.gender !== args.gender) return false;
      if (args.size && item.size !== args.size) return false;
      if (args.condition && item.condition !== args.condition) return false;
      if (args.min_price !== undefined && item.price < args.min_price) return false;
      if (args.max_price !== undefined && item.price > args.max_price) return false;
      if (args.color) {
        const needle = args.color.toLowerCase();
        if (!item.color?.toLowerCase().includes(needle)) return false;
      }
      if (args.brand) {
        const needle = args.brand.toLowerCase();
        if (!item.brand?.toLowerCase().includes(needle)) return false;
      }
      if (args.search) {
        const needle = args.search.toLowerCase();
        const haystack = `${item.title} ${item.brand ?? ""} ${item.description ?? ""}`.toLowerCase();
        if (!haystack.includes(needle)) return false;
      }
      return true;
    });

    const sort = args.sort ?? "newest";
    const sorted = all.sort((a, b) => {
      if (sort === "price_low") return a.price - b.price;
      if (sort === "price_high") return b.price - a.price;
      if (sort === "rating") return (b.rating ?? 0) - (a.rating ?? 0);
      if (sort === "popular") return (b.view_count ?? 0) - (a.view_count ?? 0);
      return (b.created_at ?? 0) - (a.created_at ?? 0);
    });

    const page = sorted.slice(offset, offset + limit);
    const sellerIds = [...new Set(page.map((i) => i.seller_id))];
    const sellers = await Promise.all(sellerIds.map((id) => ctx.db.get(id)));
    const sellerById = new Map(sellers.filter(Boolean).map((s) => [s!._id, s!]));

    return page.map((item) => ({
      id: item._id,
      user_id: item.seller_id,
      seller_id: item.seller_id,
      title: item.title,
      description: item.description,
      category: item.category,
      gender: item.gender,
      size: item.size,
      color: item.color,
      brand: item.brand,
      material: item.material,
      pattern: item.pattern,
      condition: item.condition,
      price: item.price,
      price_negotiable: item.price_negotiable ?? true,
      original_price: item.original_price,
      location: item.location,
      images: item.images ?? [],
      is_active: item.is_active,
      is_sold: item.is_sold,
      is_reserved: !!item.reserved_order_id && !item.is_sold,
      view_count: item.view_count ?? 0,
      rating: item.rating ?? 0,
      review_count: item.review_count ?? 0,
      created_at: toIso(item.created_at),
      seller: sellerById.get(item.seller_id)
        ? {
            id: item.seller_id,
            full_name:
              sellerById.get(item.seller_id)!.full_name ??
              sellerById.get(item.seller_id)!.name ??
              "",
            avatar_url: sellerById.get(item.seller_id)!.avatar_url ?? null,
            campus: sellerById.get(item.seller_id)!.campus ?? null,
            role: sellerById.get(item.seller_id)!.role ?? "user",
          }
        : undefined,
    }));
  },
});

export const byId = mutation({
  args: { id: v.id("fashion") },
  handler: async (ctx, args) => {
    const item = await ctx.db.get(args.id);
    if (!item) throw new Error("Item not found");

    await ctx.db.patch(args.id, { view_count: (item.view_count ?? 0) + 1 });

    const seller = await ctx.db.get(item.seller_id);
    const reviews = await ctx.db
      .query("fashion_reviews")
      .withIndex("by_fashion", (q) => q.eq("fashion_id", args.id))
      .collect();

    const reviewerIds = [...new Set(reviews.map((r) => r.reviewer_id))];
    const reviewers = await Promise.all(reviewerIds.map((id) => ctx.db.get(id)));
    const reviewerById = new Map(reviewers.filter(Boolean).map((r) => [r!._id, r!]));

    return {
      id: item._id,
      user_id: item.seller_id,
      seller_id: item.seller_id,
      title: item.title,
      description: item.description,
      category: item.category,
      gender: item.gender,
      size: item.size,
      color: item.color,
      brand: item.brand,
      material: item.material,
      pattern: item.pattern,
      condition: item.condition,
      price: item.price,
      price_negotiable: item.price_negotiable ?? true,
      original_price: item.original_price,
      location: item.location,
      images: item.images ?? [],
      is_active: item.is_active,
      is_sold: item.is_sold ?? false,
      is_reserved: !!item.reserved_order_id && !item.is_sold,
      view_count: (item.view_count ?? 0) + 1,
      rating: item.rating ?? 0,
      review_count: item.review_count ?? 0,
      created_at: toIso(item.created_at),
      seller: seller
        ? {
            id: seller._id,
            full_name: seller.full_name ?? seller.name ?? "",
            avatar_url: seller.avatar_url ?? seller.image ?? null,
            campus: seller.campus ?? null,
            role: seller.role ?? "user",
          }
        : undefined,
      reviews: reviews.slice(0, 10).map((review) => ({
        id: review._id,
        rating: review.rating,
        comment: review.comment,
        created_at: toIso(review.created_at),
        reviewer: reviewerById.get(review.reviewer_id)
          ? {
              id: review.reviewer_id,
              full_name:
                reviewerById.get(review.reviewer_id)!.full_name ??
                reviewerById.get(review.reviewer_id)!.name ??
                "",
              avatar_url: reviewerById.get(review.reviewer_id)!.avatar_url ?? null,
            }
          : undefined,
      })),
    };
  },
});

export const byUser = query({
  args: { userId: v.id("users"), limit: v.optional(v.number()), offset: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const limit = Math.min(100, Math.max(1, args.limit ?? 20));
    const offset = Math.max(0, args.offset ?? 0);

    const items = (await ctx.db
      .query("fashion")
      .withIndex("by_seller", (q) => q.eq("seller_id", args.userId))
      .collect())
      .filter((item) => item.is_active !== false)
      .sort((a, b) => (b.created_at ?? 0) - (a.created_at ?? 0));

    return items.slice(offset, offset + limit).map((item) => ({
      id: item._id,
      seller_id: item.seller_id,
      title: item.title,
      category: item.category,
      gender: item.gender,
      size: item.size,
      brand: item.brand,
      condition: item.condition,
      price: item.price,
      images: item.images ?? [],
      created_at: toIso(item.created_at),
    }));
  },
});

export const metaCategories = query({
  handler: async (ctx) => {
    const all = await ctx.db.query("fashion").collect();
    return [...new Set(all.map((item) => item.category))].filter(Boolean);
  },
});

export const metaBrands = query({
  handler: async (ctx) => {
    const all = await ctx.db.query("fashion").collect();
    return [...new Set(all.map((item) => item.brand))].filter(
      (brand): brand is string => !!brand
    );
  },
});

/** Every filter value the marketplace can offer, for the filter sheet. */
export const metaFilters = query({
  handler: async (ctx) => {
    const all = await ctx.db.query("fashion").collect();
    const unique = (values: (string | undefined)[]) =>
      [...new Set(values.filter((value): value is string => !!value))].sort();

    return {
      sizes: unique(all.map((item) => item.size)),
      colors: unique(all.map((item) => item.color)),
      conditions: unique(all.map((item) => item.condition)),
      brands: unique(all.map((item) => item.brand)),
      genders: unique(all.map((item) => item.gender)),
    };
  },
});

export const create = mutation({
  args: {
    title: v.string(),
    description: v.optional(v.string()),
    category: v.string(),
    gender: v.string(),
    size: v.optional(v.string()),
    color: v.optional(v.string()),
    brand: v.optional(v.string()),
    material: v.optional(v.string()),
    pattern: v.optional(v.string()),
    condition: v.string(),
    price: v.number(),
    price_negotiable: v.optional(v.boolean()),
    original_price: v.optional(v.number()),
    location: v.optional(v.string()),
    images: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    await requireVerifiedStudent(ctx, userId);

    if (!args.title.trim()) throw new Error("Title is required");
    if (!(args.price > 0)) throw new Error("Price must be greater than 0");

    const now = Date.now();
    const itemId = await ctx.db.insert("fashion", {
      seller_id: userId,
      title: args.title.trim(),
      description: args.description,
      category: args.category,
      gender: args.gender,
      size: args.size,
      color: args.color,
      brand: args.brand,
      material: args.material,
      pattern: args.pattern,
      condition: args.condition,
      price: args.price,
      price_negotiable: args.price_negotiable ?? true,
      original_price: args.original_price,
      location: args.location,
      images: args.images ?? [],
      is_active: true,
      is_sold: false,
      view_count: 0,
      rating: 0,
      review_count: 0,
      created_at: now,
      updated_at: now,
    });

    const item = await ctx.db.get(itemId);
    if (!item) throw new Error("Fashion item could not be created");
    return fashionShape(item);
  },
});

export const update = mutation({
  args: {
    id: v.id("fashion"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    category: v.optional(v.string()),
    gender: v.optional(v.string()),
    size: v.optional(v.string()),
    color: v.optional(v.string()),
    brand: v.optional(v.string()),
    material: v.optional(v.string()),
    condition: v.optional(v.string()),
    price: v.optional(v.number()),
    price_negotiable: v.optional(v.boolean()),
    location: v.optional(v.string()),
    images: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const item = await ctx.db.get(args.id);
    if (!item) throw new Error("Item not found");
    if (item.seller_id !== userId) throw new Error("Not authorized");
    await requireVerifiedStudent(ctx, userId);

    const { id, ...rest } = args;
    const patch: Record<string, unknown> = { updated_at: Date.now() };
    for (const [key, value] of Object.entries(rest)) {
      if (value !== undefined) patch[key] = value;
    }
    await ctx.db.patch(id, patch);

    const updated = await ctx.db.get(id);
    if (!updated) throw new Error("Fashion item could not be updated");
    return fashionShape(updated);
  },
});

export const remove = mutation({
  args: { id: v.id("fashion") },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const item = await ctx.db.get(args.id);
    if (!item) throw new Error("Item not found");
    if (item.seller_id !== userId) throw new Error("Not authorized");
    await requireVerifiedStudent(ctx, userId);
    if (item.reserved_order_id) throw new Error("Cancel the pending checkout before removing this item");
    await ctx.db.patch(args.id, { is_active: false, updated_at: Date.now() });
    return { message: "Item removed" };
  },
});

export const markSold = mutation({
  args: { id: v.id("fashion") },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const item = await ctx.db.get(args.id);
    if (!item) throw new Error("Item not found");
    if (item.seller_id !== userId) throw new Error("Not authorized");
    await requireVerifiedStudent(ctx, userId);
    if (item.reserved_order_id) throw new Error("Cancel the pending checkout before marking this item sold");

    await ctx.db.patch(args.id, { is_sold: true, is_active: false, updated_at: Date.now() });
    const updated = await ctx.db.get(args.id);
    if (!updated) throw new Error("Fashion item could not be updated");
    return fashionShape(updated);
  },
});

export const toggle = mutation({
  args: { id: v.id("fashion") },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const item = await ctx.db.get(args.id);
    if (!item) throw new Error("Item not found");
    if (item.seller_id !== userId) throw new Error("Not authorized");
    if (item.is_active === false) await requireVerifiedStudent(ctx, userId);
    if (item.reserved_order_id && item.is_active !== false) {
      throw new Error("Cancel the pending checkout before deactivating this item");
    }

    await ctx.db.patch(args.id, {
      is_active: item.is_active === false,
      updated_at: Date.now(),
    });
    const updated = await ctx.db.get(args.id);
    if (!updated) throw new Error("Fashion item could not be updated");
    return fashionShape(updated);
  },
});

export const review = mutation({
  args: { id: v.id("fashion"), rating: v.number(), comment: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    await requireProfile(ctx, userId);

    if (args.rating < 1 || args.rating > 5) {
      throw new Error("Rating must be between 1 and 5");
    }

    const item = await ctx.db.get(args.id);
    if (!item) throw new Error("Item not found");

    const now = Date.now();
    const reviewId = await ctx.db.insert("fashion_reviews", {
      fashion_id: args.id,
      reviewer_id: userId,
      seller_id: item.seller_id,
      rating: args.rating,
      comment: args.comment,
      created_at: now,
    });

    const reviews = await ctx.db
      .query("fashion_reviews")
      .withIndex("by_fashion", (q) => q.eq("fashion_id", args.id))
      .collect();
    const rating = round2(
      reviews.reduce((sum, r) => sum + r.rating, 0) / Math.max(1, reviews.length)
    );
    await ctx.db.patch(args.id, { rating, review_count: reviews.length });

    const review = await ctx.db.get(reviewId);
    return review;
  },
});
