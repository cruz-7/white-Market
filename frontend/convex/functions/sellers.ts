import { v } from "convex/values";
import { query } from "../_generated/server";
import { isVerifiedStudent, requireProfile, requireUserId } from "../lib/auth";
import { round2 } from "../lib/money";
import { toIso } from "../lib/shapes";

export const list = query({
  handler: async (ctx) => {
    const sellers = await ctx.db.query("users").collect();
    return {
      sellers: sellers
        .filter((seller) => seller.role === "seller")
        .map((seller) => ({
          id: seller._id,
          full_name: seller.full_name ?? seller.name ?? "",
          seller_display_name: seller.seller_display_name ?? null,
          seller_profile_image_url: seller.seller_profile_image_url ?? null,
          momo_provider: seller.momo_provider ?? null,
          created_at: toIso(seller.created_at),
        })),
    };
  },
});

export const top = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const limit = Math.min(50, Math.max(1, args.limit ?? 6));

    const sellers = (await ctx.db.query("users").collect()).filter(
      (user) => user.role === "seller"
    );
    const products = await ctx.db.query("products").collect();
    const orders = await ctx.db.query("orders").collect();
    const reviews = await ctx.db.query("reviews").collect();

    const rows = sellers.map((seller) => {
      const sellerProducts = products.filter(
        (product) => product.seller_id === seller._id && product.is_active !== false
      );
      const sellerOrders = orders.filter(
        (order) =>
          order.seller_id === seller._id &&
          ["completed", "delivered", "handed_over"].includes(order.status)
      );
      const sellerReviews = reviews.filter(
        (review) => review.reviewee_id === seller._id && review.is_seller_review
      );
      const averageRating = sellerReviews.length
        ? sellerReviews.reduce((sum, review) => sum + review.rating, 0) / sellerReviews.length
        : 0;

      return {
        id: seller._id,
        full_name: seller.full_name ?? seller.name ?? "",
        seller_display_name: seller.seller_display_name ?? null,
        seller_profile_image_url: seller.seller_profile_image_url ?? null,
        avatar_url: seller.avatar_url ?? seller.image ?? null,
        products_count: sellerProducts.length,
        orders_count: sellerOrders.length,
        avg_rating: round2(averageRating),
        total_reviews: sellerReviews.length,
      };
    });

    return {
      sellers: rows
        .filter((seller) => seller.products_count > 0)
        .sort((a, b) => b.orders_count - a.orders_count || b.avg_rating - a.avg_rating)
        .slice(0, limit),
      count: rows.length,
    };
  },
});

export const me = query({
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    const seller = await requireProfile(ctx, userId);

    const products = await ctx.db
      .query("products")
      .withIndex("by_seller", (q) => q.eq("seller_id", userId))
      .collect();
    const orders = await ctx.db
      .query("orders")
      .withIndex("by_seller", (q) => q.eq("seller_id", userId))
      .collect();
    const wallet = await ctx.db
      .query("wallets")
      .withIndex("by_user", (q) => q.eq("user_id", userId))
      .unique();
    const reviews = await ctx.db
      .query("reviews")
      .withIndex("by_reviewee", (q) => q.eq("reviewee_id", userId))
      .collect();

    const paidOrders = orders.filter((order) => order.status === "paid");
    const totalRevenue = paidOrders.reduce((sum, order) => sum + (order.amount ?? 0), 0);
    const averageRating = reviews.length
      ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length
      : 0;

    return {
      profile: {
        id: seller._id,
        full_name: seller.full_name ?? seller.name ?? "",
        seller_display_name: seller.seller_display_name ?? null,
        seller_profile_image_url: seller.seller_profile_image_url ?? null,
        avatar_url: seller.avatar_url ?? seller.image ?? null,
        verified: await isVerifiedStudent(ctx, userId),
        campus: seller.campus ?? null,
        created_at: toIso(seller.created_at),
      },
      stats: {
        products: products.filter((p) => p.is_active !== false).length,
        totalOrders: orders.length,
        completedOrders: orders.filter((o) => o.status === "completed").length,
        totalRevenue: round2(totalRevenue),
        availableBalance: wallet?.balance ?? 0,
        pendingEarnings: wallet?.pending_earnings ?? 0,
        averageRating: averageRating.toFixed(1),
        totalReviews: reviews.length,
      },
      recentOrders: orders
        .sort((a, b) => (b.created_at ?? 0) - (a.created_at ?? 0))
        .slice(0, 5)
        .map((order) => ({
          id: order._id,
          amount: order.amount,
          status: order.status,
          created_at: toIso(order.created_at),
        })),
      topProducts: products
        .slice()
        .sort((a, b) => (b.view_count ?? 0) - (a.view_count ?? 0))
        .slice(0, 5)
        .map((product) => ({
          id: product._id,
          title: product.title,
          price: product.price,
          image_url: product.image_url,
          view_count: product.view_count ?? 0,
        })),
    };
  },
});

export const byId = query({
  args: { id: v.id("users") },
  handler: async (ctx, args) => {
    const seller = await ctx.db.get(args.id);
    if (!seller) throw new Error("Seller not found");

    const products = (await ctx.db
      .query("products")
      .withIndex("by_seller", (q) => q.eq("seller_id", args.id))
      .collect())
      .filter((product) => product.is_active !== false)
      .sort((a, b) => (b.created_at ?? 0) - (a.created_at ?? 0))
      .slice(0, 20);

    const reviews = await ctx.db
      .query("reviews")
      .withIndex("by_reviewee", (q) => q.eq("reviewee_id", args.id))
      .collect();
    const averageRating = reviews.length
      ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length
      : 0;

    return {
      seller: {
        id: seller._id,
        full_name: seller.full_name ?? seller.name ?? "",
        seller_display_name: seller.seller_display_name ?? null,
        seller_profile_image_url: seller.seller_profile_image_url ?? null,
        avatar_url: seller.avatar_url ?? seller.image ?? null,
        verified: await isVerifiedStudent(ctx, args.id),
        created_at: toIso(seller.created_at),
      },
      stats: {
        products: products.length,
        averageRating: round2(averageRating),
        totalReviews: reviews.length,
      },
      products: products.map((product) => ({
        id: product._id,
        seller_id: product.seller_id,
        title: product.title,
        description: product.description,
        price: product.price,
        image_url: product.image_url,
        category_id: product.category_id,
        created_at: toIso(product.created_at),
      })),
    };
  },
});
