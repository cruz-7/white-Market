import { v } from "convex/values";
import { mutation, query } from "../_generated/server";
import { requireProfile, requireUserId } from "../lib/auth";
import { round2 } from "../lib/money";
import { toIso } from "../lib/shapes";

const RATEABLE_STATUSES = ["delivered", "completed"];

async function recomputeSellerStats(ctx: any, sellerId: any) {
  const ratings = await ctx.db
    .query("seller_ratings")
    .withIndex("by_seller", (q: any) => q.eq("seller_id", sellerId))
    .collect();
  if (ratings.length === 0) return null;

  const average = (values: number[]) =>
    values.length ? round2(values.reduce((a, b) => a + b, 0) / values.length) : 0;

  return {
    total_ratings: ratings.length,
    avg_overall_rating: average(ratings.map((r: any) => r.overall_rating)),
    avg_product_quality_rating: average(
      ratings.map((r: any) => r.product_quality_rating).filter((v: any) => typeof v === "number")
    ),
    avg_communication_rating: average(
      ratings.map((r: any) => r.communication_rating).filter((v: any) => typeof v === "number")
    ),
    avg_delivery_speed_rating: average(
      ratings.map((r: any) => r.delivery_speed_rating).filter((v: any) => typeof v === "number")
    ),
    avg_packaging_rating: average(
      ratings.map((r: any) => r.packaging_rating).filter((v: any) => typeof v === "number")
    ),
    avg_value_for_money_rating: average(
      ratings.map((r: any) => r.value_for_money_rating).filter((v: any) => typeof v === "number")
    ),
    five_star_count: ratings.filter((r: any) => r.overall_rating === 5).length,
    four_star_count: ratings.filter((r: any) => r.overall_rating === 4).length,
    three_star_count: ratings.filter((r: any) => r.overall_rating === 3).length,
    two_star_count: ratings.filter((r: any) => r.overall_rating === 2).length,
    one_star_count: ratings.filter((r: any) => r.overall_rating === 1).length,
    last_rated_at: toIso(
      Math.max(...ratings.map((r: any) => r.created_at ?? 0))
    ),
  };
}

export const sellerStats = query({
  args: { sellerId: v.id("users") },
  handler: async (ctx, args) => {
    const stats = await recomputeSellerStats(ctx, args.sellerId);
    const badges = await ctx.db
      .query("seller_badges")
      .withIndex("by_seller", (q) => q.eq("seller_id", args.sellerId))
      .collect();

    return {
      stats: stats ?? {
        total_ratings: 0,
        avg_overall_rating: 0,
        avg_product_quality_rating: 0,
        avg_communication_rating: 0,
        avg_delivery_speed_rating: 0,
        avg_packaging_rating: 0,
        avg_value_for_money_rating: 0,
        five_star_count: 0,
        four_star_count: 0,
        three_star_count: 0,
        two_star_count: 0,
        one_star_count: 0,
        last_rated_at: null,
      },
      badges: badges
        .filter((badge) => badge.is_active !== false)
        .map((badge) => ({
          id: badge._id,
          badge_type: badge.badge_type,
          badge_name: badge.badge_name,
          badge_description: badge.badge_description,
          badge_icon: badge.badge_icon,
          earned_at: toIso(badge.earned_at),
        })),
    };
  },
});

export const sellerRatings = query({
  args: {
    sellerId: v.id("users"),
    page: v.optional(v.number()),
    limit: v.optional(v.number()),
    sort: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const page = Math.max(1, args.page ?? 1);
    const limit = Math.min(50, Math.max(1, args.limit ?? 10));
    const offset = (page - 1) * limit;

    const all = await ctx.db
      .query("seller_ratings")
      .withIndex("by_seller", (q) => q.eq("seller_id", args.sellerId))
      .collect();

    const sort = args.sort ?? "recent";
    const sorted = all.sort((a, b) => {
      if (sort === "highest") return b.overall_rating - a.overall_rating;
      if (sort === "lowest") return a.overall_rating - b.overall_rating;
      if (sort === "helpful") return (b.helpful_count ?? 0) - (a.helpful_count ?? 0);
      return (b.created_at ?? 0) - (a.created_at ?? 0);
    });

    const pageItems = sorted.slice(offset, offset + limit);
    const buyerIds = [...new Set(pageItems.map((r) => r.buyer_id))];
    const buyers = await Promise.all(buyerIds.map((id) => ctx.db.get(id)));
    const buyerById = new Map(buyers.filter(Boolean).map((b) => [b!._id, b!]));

    return {
      ratings: pageItems.map((rating) => {
        const buyer = buyerById.get(rating.buyer_id);
        return {
          id: rating._id,
          order_id: rating.order_id,
          buyer_id: rating.buyer_id,
          seller_id: rating.seller_id,
          overall_rating: rating.overall_rating,
          product_quality_rating: rating.product_quality_rating,
          communication_rating: rating.communication_rating,
          delivery_speed_rating: rating.delivery_speed_rating,
          packaging_rating: rating.packaging_rating,
          value_for_money_rating: rating.value_for_money_rating,
          review_text: rating.review_text,
          review_title: rating.review_title,
          feedback_tags: rating.feedback_tags ?? [],
          review_photos: rating.review_photos ?? [],
          seller_response: rating.seller_response,
          is_anonymous: rating.is_anonymous ?? false,
          helpful_count: rating.helpful_count ?? 0,
          created_at: toIso(rating.created_at),
          buyer: buyer
            ? {
                id: buyer._id,
                full_name: buyer.full_name ?? buyer.name ?? "",
                avatar_url: buyer.avatar_url ?? buyer.image ?? null,
              }
            : undefined,
        };
      }),
      pagination: {
        page,
        limit,
        total: all.length,
        pages: Math.max(1, Math.ceil(all.length / limit)),
      },
    };
  },
});

export const orderRating = query({
  args: { orderId: v.id("orders") },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    await requireProfile(ctx, userId);

    const ratings = await ctx.db
      .query("seller_ratings")
      .withIndex("by_order", (q) => q.eq("order_id", args.orderId))
      .collect();
    const mine = ratings.find((r) => r.buyer_id === userId) ?? null;
    return { rating: mine };
  },
});

export const create = mutation({
  args: {
    order_id: v.id("orders"),
    seller_id: v.id("users"),
    overall_rating: v.number(),
    product_quality_rating: v.optional(v.number()),
    communication_rating: v.optional(v.number()),
    delivery_speed_rating: v.optional(v.number()),
    packaging_rating: v.optional(v.number()),
    value_for_money_rating: v.optional(v.number()),
    review_text: v.optional(v.string()),
    review_title: v.optional(v.string()),
    feedback_tags: v.optional(v.array(v.string())),
    review_photos: v.optional(v.array(v.string())),
    is_anonymous: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    await requireProfile(ctx, userId);

    const scores = [
      args.overall_rating,
      args.product_quality_rating,
      args.communication_rating,
      args.delivery_speed_rating,
      args.packaging_rating,
      args.value_for_money_rating,
    ].filter((value): value is number => value !== undefined);
    if (scores.some((value) => value < 1 || value > 5)) {
      throw new Error("All ratings must be between 1 and 5");
    }

    const order = await ctx.db.get(args.order_id);
    if (!order) throw new Error("Order not found");
    if (order.buyer_id !== userId) {
      throw new Error("Only the buyer can rate this order");
    }
    if (order.seller_id !== args.seller_id) {
      throw new Error("This order was not sold by that seller");
    }
    if (!RATEABLE_STATUSES.includes(order.status)) {
      throw new Error("Only delivered or completed orders can be rated");
    }

    const existing = await ctx.db
      .query("seller_ratings")
      .withIndex("by_order", (q) => q.eq("order_id", args.order_id))
      .collect();
    if (existing.some((rating) => rating.buyer_id === userId)) {
      throw new Error("You have already rated this order");
    }

    const now = Date.now();
    const ratingId = await ctx.db.insert("seller_ratings", {
      order_id: args.order_id,
      buyer_id: userId,
      seller_id: args.seller_id,
      overall_rating: args.overall_rating,
      product_quality_rating: args.product_quality_rating,
      communication_rating: args.communication_rating,
      delivery_speed_rating: args.delivery_speed_rating,
      packaging_rating: args.packaging_rating,
      value_for_money_rating: args.value_for_money_rating,
      review_text: args.review_text,
      review_title: args.review_title,
      feedback_tags: args.feedback_tags,
      review_photos: args.review_photos,
      is_verified_purchase: true,
      is_anonymous: args.is_anonymous ?? false,
      helpful_count: 0,
      created_at: now,
      updated_at: now,
    });

    await ctx.db.patch(args.order_id, { is_rated: true });
    await ctx.db.insert("notifications", {
      user_id: args.seller_id,
      type: "review_received",
      title: "New rating",
      body: `You received a ${args.overall_rating}-star rating.`,
      data: { rating_id: ratingId },
      read: false,
      created_at: now,
    });

    const rating = await ctx.db.get(ratingId);
    return { message: "Rating submitted", rating };
  },
});

export const update = mutation({
  args: {
    id: v.id("seller_ratings"),
    overall_rating: v.optional(v.number()),
    review_text: v.optional(v.string()),
    review_title: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    await requireProfile(ctx, userId);

    const rating = await ctx.db.get(args.id);
    if (!rating) throw new Error("Rating not found");
    if (rating.buyer_id !== userId) {
      throw new Error("You can only edit your own rating");
    }
    if (args.overall_rating !== undefined && (args.overall_rating < 1 || args.overall_rating > 5)) {
      throw new Error("Rating must be between 1 and 5");
    }

    const patch: Record<string, unknown> = { updated_at: Date.now() };
    if (args.overall_rating !== undefined) patch.overall_rating = args.overall_rating;
    if (args.review_text !== undefined) patch.review_text = args.review_text;
    if (args.review_title !== undefined) patch.review_title = args.review_title;
    await ctx.db.patch(args.id, patch);

    const updated = await ctx.db.get(args.id);
    return { message: "Rating updated", rating: updated };
  },
});

export const respond = mutation({
  args: { id: v.id("seller_ratings"), response: v.string() },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    await requireProfile(ctx, userId);

    const rating = await ctx.db.get(args.id);
    if (!rating) throw new Error("Rating not found");
    if (rating.seller_id !== userId) {
      throw new Error("Only the seller can respond to this rating");
    }

    await ctx.db.patch(args.id, {
      seller_response: args.response,
      seller_responded_at: Date.now(),
      updated_at: Date.now(),
    });

    const updated = await ctx.db.get(args.id);
    return { message: "Response added", rating: updated };
  },
});

export const markHelpful = mutation({
  args: { id: v.id("seller_ratings"), is_helpful: v.boolean() },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    await requireProfile(ctx, userId);

    const rating = await ctx.db.get(args.id);
    if (!rating) throw new Error("Rating not found");

    const existing = await ctx.db
      .query("rating_helpful_votes")
      .withIndex("by_rating", (q) => q.eq("rating_id", args.id))
      .collect();
    const mine = existing.find((vote) => vote.user_id === userId);

    if (mine) {
      await ctx.db.patch(mine._id, { is_helpful: args.is_helpful });
    } else {
      await ctx.db.insert("rating_helpful_votes", {
        rating_id: args.id,
        user_id: userId,
        is_helpful: args.is_helpful,
        created_at: Date.now(),
      });
    }

    const votes = await ctx.db
      .query("rating_helpful_votes")
      .withIndex("by_rating", (q) => q.eq("rating_id", args.id))
      .collect();
    const helpfulCount = votes.filter((vote) => vote.is_helpful).length;
    await ctx.db.patch(args.id, { helpful_count: helpfulCount });

    return { message: "Thanks for the feedback" };
  },
});

export const userHistory = query({
  args: { page: v.optional(v.number()), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    await requireProfile(ctx, userId);

    const page = Math.max(1, args.page ?? 1);
    const limit = Math.min(50, Math.max(1, args.limit ?? 10));
    const offset = (page - 1) * limit;

    const all = (await ctx.db
      .query("seller_ratings")
      .withIndex("by_buyer", (q) => q.eq("buyer_id", userId))
      .collect()).sort((a, b) => (b.created_at ?? 0) - (a.created_at ?? 0));

    const pageItems = all.slice(offset, offset + limit);
    const sellerIds = [...new Set(pageItems.map((r) => r.seller_id))];
    const sellers = await Promise.all(sellerIds.map((id) => ctx.db.get(id)));
    const sellerById = new Map(sellers.filter(Boolean).map((s) => [s!._id, s!]));

    return {
      ratings: pageItems.map((rating) => ({
        id: rating._id,
        order_id: rating.order_id,
        seller_id: rating.seller_id,
        overall_rating: rating.overall_rating,
        review_text: rating.review_text,
        created_at: toIso(rating.created_at),
        seller: sellerById.get(rating.seller_id)
          ? {
              id: rating.seller_id,
              full_name:
                sellerById.get(rating.seller_id)!.seller_display_name ??
                sellerById.get(rating.seller_id)!.full_name ??
                "",
              avatar_url: sellerById.get(rating.seller_id)!.avatar_url ?? null,
            }
          : undefined,
      })),
      pagination: {
        page,
        limit,
        total: all.length,
        pages: Math.max(1, Math.ceil(all.length / limit)),
      },
    };
  },
});

export const eligibleOrders = query({
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    await requireProfile(ctx, userId);

    const orders = (await ctx.db
      .query("orders")
      .withIndex("by_buyer", (q) => q.eq("buyer_id", userId))
      .collect()).filter((order) => RATEABLE_STATUSES.includes(order.status));

    const productIds = [
      ...new Set(orders.map((o) => o.product_id).filter((id): id is NonNullable<typeof id> => !!id)),
    ];
    const products = await Promise.all(productIds.map((id) => ctx.db.get(id)));
    const productById = new Map(products.filter(Boolean).map((p) => [p!._id, p!]));

    return {
      orders: orders.map((order) => ({
        id: order._id,
        seller_id: order.seller_id,
        amount: order.amount,
        status: order.status,
        created_at: toIso(order.created_at),
        product: order.product_id
          ? {
              id: order.product_id,
              title: productById.get(order.product_id)?.title ?? "",
              image_url: productById.get(order.product_id)?.image_url ?? "",
            }
          : undefined,
      })),
    };
  },
});

export const productStats = query({
  args: { productId: v.id("products") },
  handler: async (ctx, args) => {
    const product = await ctx.db.get(args.productId);
    if (!product) throw new Error("Product not found");
    return {
      average_rating: product.average_rating ?? 0,
      rating_count: product.rating_count ?? 0,
    };
  },
});

export const productRatings = query({
  args: {
    productId: v.id("products"),
    page: v.optional(v.number()),
    limit: v.optional(v.number()),
    sort: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const page = Math.max(1, args.page ?? 1);
    const limit = Math.min(50, Math.max(1, args.limit ?? 10));
    const offset = (page - 1) * limit;

    const all = await ctx.db
      .query("product_ratings")
      .withIndex("by_product", (q) => q.eq("product_id", args.productId))
      .collect();

    const sort = args.sort ?? "recent";
    const sorted = all.sort((a, b) => {
      if (sort === "highest") return b.rating - a.rating;
      if (sort === "lowest") return a.rating - b.rating;
      return (b.created_at ?? 0) - (a.created_at ?? 0);
    });

    const pageItems = sorted.slice(offset, offset + limit);
    const buyerIds = [...new Set(pageItems.map((r) => r.buyer_id))];
    const buyers = await Promise.all(buyerIds.map((id) => ctx.db.get(id)));
    const buyerById = new Map(buyers.filter(Boolean).map((b) => [b!._id, b!]));

    return {
      ratings: pageItems.map((rating) => ({
        id: rating._id,
        product_id: rating.product_id,
        buyer_id: rating.buyer_id,
        rating: rating.rating,
        comment: rating.comment,
        is_verified_purchase: rating.is_verified_purchase ?? false,
        is_anonymous: rating.is_anonymous ?? false,
        helpful_count: rating.helpful_count ?? 0,
        created_at: toIso(rating.created_at),
        buyer: buyerById.get(rating.buyer_id)
          ? {
              id: rating.buyer_id,
              full_name: buyerById.get(rating.buyer_id)!.full_name ?? "",
              avatar_url: buyerById.get(rating.buyer_id)!.avatar_url ?? null,
            }
          : undefined,
      })),
      pagination: {
        page,
        limit,
        total: all.length,
        pages: Math.max(1, Math.ceil(all.length / limit)),
      },
    };
  },
});

export const rateProduct = mutation({
  args: {
    product_id: v.id("products"),
    rating: v.number(),
    comment: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    await requireProfile(ctx, userId);

    if (args.rating < 1 || args.rating > 5) {
      throw new Error("Rating must be between 1 and 5");
    }

    const product = await ctx.db.get(args.product_id);
    if (!product) throw new Error("Product not found");

    const existing = await ctx.db
      .query("product_ratings")
      .withIndex("by_product", (q) => q.eq("product_id", args.product_id))
      .collect();
    if (existing.some((rating) => rating.buyer_id === userId)) {
      throw new Error("You have already rated this product");
    }

    const orders = await ctx.db
      .query("orders")
      .withIndex("by_buyer", (q) => q.eq("buyer_id", userId))
      .collect();
    const verified = orders.some(
      (order) => order.product_id === args.product_id && RATEABLE_STATUSES.includes(order.status)
    );

    const now = Date.now();
    const ratingId = await ctx.db.insert("product_ratings", {
      product_id: args.product_id,
      buyer_id: userId,
      rating: args.rating,
      comment: args.comment,
      is_verified_purchase: verified,
      helpful_count: 0,
      created_at: now,
      updated_at: now,
    });

    const all = await ctx.db
      .query("product_ratings")
      .withIndex("by_product", (q) => q.eq("product_id", args.product_id))
      .collect();
    const average = round2(
      all.reduce((sum, rating) => sum + rating.rating, 0) / Math.max(1, all.length)
    );
    await ctx.db.patch(product._id, { average_rating: average, rating_count: all.length });

    const rating = await ctx.db.get(ratingId);
    return { rating };
  },
});
