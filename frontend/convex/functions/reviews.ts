import { v } from "convex/values";
import { mutation, query } from "../_generated/server";
import { requireProfile, requireUserId } from "../lib/auth";
import { round2 } from "../lib/money";
import { toIso } from "../lib/shapes";

export const sellerReviews = query({
  args: { sellerId: v.id("users"), page: v.optional(v.number()), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const page = Math.max(1, args.page ?? 1);
    const limit = Math.min(50, Math.max(1, args.limit ?? 10));
    const offset = (page - 1) * limit;

    const all = (await ctx.db
      .query("reviews")
      .withIndex("by_reviewee", (q) => q.eq("reviewee_id", args.sellerId))
      .collect())
      .filter((review) => review.is_seller_review)
      .sort((a, b) => (b.created_at ?? 0) - (a.created_at ?? 0));

    const pageItems = all.slice(offset, offset + limit);
    const reviewerIds = [...new Set(pageItems.map((r) => r.reviewer_id))];
    const reviewers = await Promise.all(reviewerIds.map((id) => ctx.db.get(id)));
    const reviewerById = new Map(reviewers.filter(Boolean).map((r) => [r!._id, r!]));

    const rating = all.length
      ? all.reduce((sum, review) => sum + review.rating, 0) / all.length
      : 0;

    return {
      reviews: pageItems.map((review) => {
        const reviewer = reviewerById.get(review.reviewer_id);
        return {
          id: review._id,
          order_id: review.order_id,
          reviewer_id: review.reviewer_id,
          reviewee_id: review.reviewee_id,
          rating: review.rating,
          comment: review.comment,
          is_seller_review: review.is_seller_review,
          created_at: toIso(review.created_at),
          reviewer: reviewer
            ? {
                id: reviewer._id,
                full_name: reviewer.full_name ?? reviewer.name ?? "",
                avatar_url: reviewer.avatar_url ?? reviewer.image ?? null,
              }
            : undefined,
        };
      }),
      rating: round2(rating),
      review_count: all.length,
      pagination: {
        page,
        limit,
        total: all.length,
        pages: Math.max(1, Math.ceil(all.length / limit)),
      },
    };
  },
});

export const orderReview = query({
  args: { orderId: v.id("orders") },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    await requireProfile(ctx, userId);

    const review = await ctx.db
      .query("reviews")
      .withIndex("by_order", (q) => q.eq("order_id", args.orderId))
      .collect();
    const mine = review.find((r) => r.reviewer_id === userId) ?? null;

    return { review: mine };
  },
});

export const create = mutation({
  args: {
    order_id: v.id("orders"),
    rating: v.number(),
    comment: v.optional(v.string()),
    is_seller_review: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    await requireProfile(ctx, userId);

    if (args.rating < 1 || args.rating > 5) {
      throw new Error("Rating must be between 1 and 5");
    }

    const order = await ctx.db.get(args.order_id);
    if (!order) throw new Error("Order not found");
    if (order.status !== "paid" && order.status !== "completed") {
      throw new Error("Only a paid order can be reviewed");
    }

    const existing = await ctx.db
      .query("reviews")
      .withIndex("by_order", (q) => q.eq("order_id", args.order_id))
      .collect();
    if (existing.some((review) => review.reviewer_id === userId)) {
      throw new Error("You have already reviewed this order");
    }

    // A seller review reviews the buyer; otherwise the buyer reviews the seller.
    const isSellerReview = args.is_seller_review ?? false;
    const revieweeId = isSellerReview ? order.seller_id : order.buyer_id;
    if (isSellerReview && order.buyer_id !== userId) {
      throw new Error("Only the buyer can review the seller");
    }
    if (!isSellerReview && order.seller_id !== userId) {
      throw new Error("Only the seller can review the buyer");
    }

    const now = Date.now();
    const reviewId = await ctx.db.insert("reviews", {
      order_id: args.order_id,
      product_id: order.product_id,
      reviewer_id: userId,
      reviewee_id: revieweeId,
      rating: args.rating,
      comment: args.comment,
      is_seller_review: isSellerReview,
      created_at: now,
      updated_at: now,
    });

    const review = await ctx.db.get(reviewId);
    await ctx.db.insert("notifications", {
      user_id: revieweeId,
      type: "review_received",
      title: "New review",
      body: `You received a ${args.rating}-star review.`,
      data: { review_id: reviewId },
      read: false,
      created_at: now,
    });

    return { review };
  },
});

export const update = mutation({
  args: { id: v.id("reviews"), rating: v.optional(v.number()), comment: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    await requireProfile(ctx, userId);

    const review = await ctx.db.get(args.id);
    if (!review) throw new Error("Review not found");
    if (review.reviewer_id !== userId) {
      throw new Error("You can only edit your own review");
    }
    if (args.rating !== undefined && (args.rating < 1 || args.rating > 5)) {
      throw new Error("Rating must be between 1 and 5");
    }

    const patch: Record<string, unknown> = { updated_at: Date.now() };
    if (args.rating !== undefined) patch.rating = args.rating;
    if (args.comment !== undefined) patch.comment = args.comment;
    await ctx.db.patch(args.id, patch);

    const updated = await ctx.db.get(args.id);
    return { review: updated };
  },
});
