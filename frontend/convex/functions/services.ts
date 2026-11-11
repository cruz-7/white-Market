import { v } from "convex/values";
import { mutation, query } from "../_generated/server";
import { requireProfile, requireUserId, requireVerifiedStudent } from "../lib/auth";
import { round2 } from "../lib/money";
import { toIso } from "../lib/shapes";

export const list = query({
  args: {
    service_type: v.optional(v.string()),
    limit: v.optional(v.number()),
    offset: v.optional(v.number()),
    sort: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const limit = Math.min(100, Math.max(1, args.limit ?? 20));
    const offset = Math.max(0, args.offset ?? 0);
    const sort = args.sort ?? "rating";

    const all = (await ctx.db.query("services").collect()).filter(
      (service) =>
        service.is_active !== false &&
        (!args.service_type || service.service_type === args.service_type)
    );

    const sorted = all.sort((a, b) => {
      if (sort === "reviews") return (b.review_count ?? 0) - (a.review_count ?? 0);
      if (sort === "newest") return (b.created_at ?? 0) - (a.created_at ?? 0);
      return (b.rating ?? 0) - (a.rating ?? 0);
    });

    const page = sorted.slice(offset, offset + limit);
    const providerIds = [...new Set(page.map((s) => s.seller_id))];
    const providers = await Promise.all(providerIds.map((id) => ctx.db.get(id)));
    const providerById = new Map(providers.filter(Boolean).map((p) => [p!._id, p!]));

    return page.map((service) => ({
      id: service._id,
      user_id: service.seller_id,
      seller_id: service.seller_id,
      service_type: service.service_type,
      title: service.title,
      description: service.description,
      price: service.price,
      price_type: service.price_type,
      location: service.location,
      availability: service.availability,
      response_time: service.response_time,
      images: service.images ?? [],
      is_active: service.is_active !== false,
      is_verified: service.is_verified,
      rating: service.rating ?? 0,
      review_count: service.review_count ?? 0,
      completed_jobs: service.completed_jobs ?? 0,
      created_at: toIso(service.created_at),
      provider: providerById.get(service.seller_id)
        ? {
            id: service.seller_id,
            full_name:
              providerById.get(service.seller_id)!.full_name ??
              providerById.get(service.seller_id)!.name ??
              "",
            avatar_url: providerById.get(service.seller_id)!.avatar_url ?? null,
            role: providerById.get(service.seller_id)!.role ?? "user",
          }
        : undefined,
    }));
  },
});

export const byId = query({
  args: { id: v.id("services") },
  handler: async (ctx, args) => {
    const service = await ctx.db.get(args.id);
    if (!service) throw new Error("Service not found");

    const provider = await ctx.db.get(service.seller_id);
    const reviews = await ctx.db
      .query("service_reviews")
      .withIndex("by_service", (q) => q.eq("service_id", args.id))
      .collect();

    const reviewerIds = [...new Set(reviews.map((r) => r.reviewer_id))];
    const reviewers = await Promise.all(reviewerIds.map((id) => ctx.db.get(id)));
    const reviewerById = new Map(reviewers.filter(Boolean).map((r) => [r!._id, r!]));

    return {
      id: service._id,
      user_id: service.seller_id,
      seller_id: service.seller_id,
      service_type: service.service_type,
      title: service.title,
      description: service.description,
      price: service.price,
      price_type: service.price_type,
      location: service.location,
      availability: service.availability,
      response_time: service.response_time,
      images: service.images ?? [],
      is_active: service.is_active,
      is_verified: service.is_verified,
      rating: service.rating ?? 0,
      review_count: service.review_count ?? 0,
      completed_jobs: service.completed_jobs ?? 0,
      created_at: toIso(service.created_at),
      provider: provider
        ? {
            id: provider._id,
            full_name: provider.full_name ?? provider.name ?? "",
            avatar_url: provider.avatar_url ?? provider.image ?? null,
            role: provider.role ?? "user",
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

export const metaTypes = query({
  handler: async (ctx) => {
    const all = (await ctx.db.query("services").collect()).filter(
      (service) => service.is_active !== false
    );
    const counts = new Map<string, number>();
    for (const service of all) {
      counts.set(service.service_type, (counts.get(service.service_type) ?? 0) + 1);
    }
    return [...counts.entries()].map(([type, count]) => ({ type, count }));
  },
});

export const mine = query({
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    await requireProfile(ctx, userId);

    const services = await ctx.db
      .query("services")
      .withIndex("by_seller", (q) => q.eq("seller_id", userId))
      .collect();

    return services
      .sort((a, b) => (b.created_at ?? 0) - (a.created_at ?? 0))
      .map((service) => ({
        id: service._id,
        user_id: service.seller_id,
        service_type: service.service_type,
        title: service.title,
        description: service.description,
        price: service.price,
        price_type: service.price_type,
        location: service.location,
        is_active: service.is_active,
        rating: service.rating ?? 0,
        review_count: service.review_count ?? 0,
        completed_jobs: service.completed_jobs ?? 0,
        created_at: toIso(service.created_at),
      }));
  },
});

export const create = mutation({
  args: {
    service_type: v.string(),
    title: v.string(),
    description: v.optional(v.string()),
    price: v.number(),
    price_type: v.optional(v.string()),
    location: v.optional(v.string()),
    availability: v.optional(v.any()),
    response_time: v.optional(v.string()),
    images: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    await requireVerifiedStudent(ctx, userId);

    if (!args.service_type) throw new Error("Service type is required");
    if (!args.title.trim()) throw new Error("Title is required");

    const now = Date.now();
    const serviceId = await ctx.db.insert("services", {
      seller_id: userId,
      service_type: args.service_type,
      title: args.title.trim(),
      description: args.description,
      price: args.price,
      price_type: args.price_type ?? "fixed",
      location: args.location,
      availability: args.availability,
      response_time: args.response_time,
      images: args.images ?? [],
      is_active: true,
      is_verified: false,
      rating: 0,
      review_count: 0,
      completed_jobs: 0,
      created_at: now,
      updated_at: now,
    });

    const service = await ctx.db.get(serviceId);
    return service;
  },
});

export const update = mutation({
  args: {
    id: v.id("services"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    price: v.optional(v.number()),
    price_type: v.optional(v.string()),
    location: v.optional(v.string()),
    availability: v.optional(v.any()),
    response_time: v.optional(v.string()),
    images: v.optional(v.array(v.string())),
    is_active: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const service = await ctx.db.get(args.id);
    if (!service) throw new Error("Service not found");
    if (service.seller_id !== userId) throw new Error("Not authorized");
    await requireVerifiedStudent(ctx, userId);

    const { id, ...rest } = args;
    const patch: Record<string, unknown> = { updated_at: Date.now() };
    for (const [key, value] of Object.entries(rest)) {
      if (value !== undefined) patch[key] = value;
    }
    await ctx.db.patch(id, patch);

    const updated = await ctx.db.get(id);
    return updated;
  },
});

export const remove = mutation({
  args: { id: v.id("services") },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const service = await ctx.db.get(args.id);
    if (!service) throw new Error("Service not found");
    if (service.seller_id !== userId) throw new Error("Not authorized");
    await requireVerifiedStudent(ctx, userId);
    await ctx.db.delete(args.id);
    return { message: "Service deleted" };
  },
});

export const toggle = mutation({
  args: { id: v.id("services") },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const service = await ctx.db.get(args.id);
    if (!service) throw new Error("Service not found");
    if (service.seller_id !== userId) throw new Error("Not authorized");
    if (service.is_active === false) await requireVerifiedStudent(ctx, userId);

    await ctx.db.patch(args.id, {
      is_active: service.is_active === false,
      updated_at: Date.now(),
    });
    const updated = await ctx.db.get(args.id);
    return updated;
  },
});

export const review = mutation({
  args: { id: v.id("services"), rating: v.number(), comment: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    await requireProfile(ctx, userId);

    if (args.rating < 1 || args.rating > 5) {
      throw new Error("Rating must be between 1 and 5");
    }

    const service = await ctx.db.get(args.id);
    if (!service) throw new Error("Service not found");
    if (service.seller_id === userId) {
      throw new Error("You cannot review your own service");
    }

    const now = Date.now();
    const reviewId = await ctx.db.insert("service_reviews", {
      service_id: args.id,
      reviewer_id: userId,
      provider_id: service.seller_id,
      rating: args.rating,
      comment: args.comment,
      created_at: now,
    });

    const reviews = await ctx.db
      .query("service_reviews")
      .withIndex("by_service", (q) => q.eq("service_id", args.id))
      .collect();
    const rating = round2(
      reviews.reduce((sum, r) => sum + r.rating, 0) / Math.max(1, reviews.length)
    );
    await ctx.db.patch(args.id, { rating, review_count: reviews.length });

    const review = await ctx.db.get(reviewId);
    return review;
  },
});

export const book = mutation({
  args: {
    id: v.id("services"),
    scheduled_date: v.string(),
    scheduled_time: v.optional(v.string()),
    notes: v.optional(v.string()),
    price: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    await requireVerifiedStudent(ctx, userId);

    const service = await ctx.db.get(args.id);
    if (!service) throw new Error("Service not found");
    if (service.seller_id === userId) {
      throw new Error("You cannot book your own service");
    }

    const now = Date.now();
    const bookingId = await ctx.db.insert("service_bookings", {
      service_id: args.id,
      customer_id: userId,
      provider_id: service.seller_id,
      status: "pending",
      scheduled_date: args.scheduled_date,
      scheduled_time: args.scheduled_time,
      notes: args.notes,
      price: args.price ?? service.price,
      created_at: now,
      updated_at: now,
    });

    const booking = await ctx.db.get(bookingId);
    return booking;
  },
});

export const myBookings = query({
  args: { role: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    await requireProfile(ctx, userId);

    const role = args.role ?? "customer";
    const bookings =
      role === "provider"
        ? await ctx.db
            .query("service_bookings")
            .withIndex("by_provider", (q) => q.eq("provider_id", userId))
            .collect()
        : await ctx.db
            .query("service_bookings")
            .withIndex("by_customer", (q) => q.eq("customer_id", userId))
            .collect();

    const serviceIds = [...new Set(bookings.map((b) => b.service_id))];
    const services = await Promise.all(serviceIds.map((id) => ctx.db.get(id)));
    const serviceById = new Map(services.filter(Boolean).map((s) => [s!._id, s!]));

    return bookings.map((booking) => ({
      id: booking._id,
      service_id: booking.service_id,
      customer_id: booking.customer_id,
      provider_id: booking.provider_id,
      status: booking.status,
      scheduled_date: booking.scheduled_date,
      scheduled_time: booking.scheduled_time,
      notes: booking.notes,
      price: booking.price,
      created_at: toIso(booking.created_at),
      service: serviceById.get(booking.service_id)
        ? {
            id: booking.service_id,
            title: serviceById.get(booking.service_id)!.title,
            service_type: serviceById.get(booking.service_id)!.service_type,
          }
        : undefined,
    }));
  },
});

export const updateBooking = mutation({
  args: { id: v.id("service_bookings"), status: v.string() },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    await requireProfile(ctx, userId);

    const booking = await ctx.db.get(args.id);
    if (!booking) throw new Error("Booking not found");
    if (booking.customer_id !== userId && booking.provider_id !== userId) {
      throw new Error("Not authorized");
    }
    if (!["confirmed", "in_progress", "completed", "cancelled"].includes(args.status)) {
      throw new Error("Invalid booking status");
    }

    await ctx.db.patch(args.id, { status: args.status, updated_at: Date.now() });

    if (args.status === "completed" && booking.provider_id === userId) {
      const service = await ctx.db.get(booking.service_id);
      if (service) {
        await ctx.db.patch(service._id, {
          completed_jobs: (service.completed_jobs ?? 0) + 1,
          updated_at: Date.now(),
        });
      }
    }

    const updated = await ctx.db.get(args.id);
    return updated;
  },
});
