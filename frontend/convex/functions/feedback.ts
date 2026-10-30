import { v } from "convex/values";
import { mutation, query } from "../_generated/server";
import { optionalUserId, requireProfile, requireUserId } from "../lib/auth";
import { toIso } from "../lib/shapes";

export const create = mutation({
  args: {
    rating: v.optional(v.number()),
    feedback_type: v.optional(v.string()),
    feedback_text: v.optional(v.string()),
    reporter_email: v.optional(v.string()),
    report_image_urls: v.optional(v.array(v.string())),
    would_recommend: v.optional(v.boolean()),
    improved_features: v.optional(v.array(v.string())),
    is_satisfied: v.optional(v.boolean()),
    page_url: v.optional(v.string()),
    session_duration_seconds: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await optionalUserId(ctx);

    if (args.rating !== undefined && (args.rating < 1 || args.rating > 5)) {
      throw new Error("Rating must be between 1 and 5");
    }
    if (!args.feedback_text?.trim() && args.rating === undefined) {
      throw new Error("Feedback needs a message");
    }

    const feedbackId = await ctx.db.insert("website_feedback", {
      user_id: userId ?? undefined,
      rating: args.rating,
      feedback_type: args.feedback_type ?? "general",
      feedback_text: args.feedback_text,
      reporter_email: args.reporter_email,
      report_image_urls: args.report_image_urls,
      would_recommend: args.would_recommend,
      improved_features: args.improved_features,
      is_satisfied: args.is_satisfied,
      page_url: args.page_url,
      session_duration_seconds: args.session_duration_seconds,
      status: "new",
      created_at: Date.now(),
    });

    const feedback = await ctx.db.get(feedbackId);
    return { message: "Thanks for your feedback!", feedback };
  },
});

export const testimonials = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const limit = Math.min(20, Math.max(1, args.limit ?? 3));

    const all = await ctx.db.query("website_feedback").collect();
    const top = all
      .filter((feedback) => (feedback.rating ?? 0) >= 4 && !!feedback.feedback_text)
      .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
      .slice(0, limit);

    const userIds = top.map((feedback) => feedback.user_id).filter((id): id is NonNullable<typeof id> => !!id);
    const users = await Promise.all(userIds.map((id) => ctx.db.get(id)));
    const userById = new Map(users.filter(Boolean).map((u) => [u!._id, u!]));

    return {
      testimonials: top.map((feedback) => ({
        id: feedback._id,
        rating: feedback.rating,
        feedback_text: feedback.feedback_text,
        feedback_type: feedback.feedback_type,
        created_at: toIso(feedback.created_at),
        user: feedback.user_id
          ? {
              id: feedback.user_id,
              full_name: userById.get(feedback.user_id)?.full_name ?? "",
              avatar_url: userById.get(feedback.user_id)?.avatar_url ?? null,
            }
          : undefined,
      })),
    };
  },
});

export const stats = query({
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    const admin = await requireProfile(ctx, userId);
    if (admin.role !== "admin") throw new Error("Admin access only");

    const all = await ctx.db.query("website_feedback").collect();
    const feedbackEntries = all.filter(
      (feedback) => !feedback.feedback_type?.startsWith("issue_report_")
    );
    const withRating = feedbackEntries.filter((feedback) => typeof feedback.rating === "number");
    const recommendResponses = feedbackEntries.filter(
      (feedback) => typeof feedback.would_recommend === "boolean"
    );
    const satisfactionResponses = feedbackEntries.filter(
      (feedback) => typeof feedback.is_satisfied === "boolean"
    );
    const ratingCounts = withRating.reduce<Record<number, number>>((counts, feedback) => {
      const rating = feedback.rating ?? 0;
      counts[rating] = (counts[rating] ?? 0) + 1;
      return counts;
    }, {});

    return {
      stats: {
        total: feedbackEntries.length,
        average_rating: withRating.length
          ? Math.round(
              (withRating.reduce((sum, f) => sum + (f.rating ?? 0), 0) / withRating.length) * 10
            ) / 10
          : 0,
        satisfied: feedbackEntries.filter((f) => f.is_satisfied === true).length,
        would_recommend: feedbackEntries.filter((f) => f.would_recommend === true).length,
        satisfaction_responses: satisfactionResponses.length,
        recommend_responses: recommendResponses.length,
        rating_counts: ratingCounts,
        by_type: feedbackEntries.reduce<Record<string, number>>((acc, feedback) => {
          const key = feedback.feedback_type ?? "general";
          acc[key] = (acc[key] ?? 0) + 1;
          return acc;
        }, {}),
      },
    };
  },
});

export const byId = query({
  args: { id: v.id("website_feedback") },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const admin = await requireProfile(ctx, userId);
    if (admin.role !== "admin") throw new Error("Admin access only");

    const feedback = await ctx.db.get(args.id);
    if (!feedback) throw new Error("Feedback not found");

    return {
      feedback: {
        id: feedback._id,
        user_id: feedback.user_id,
        rating: feedback.rating,
        feedback_type: feedback.feedback_type,
        feedback_text: feedback.feedback_text,
        reporter_email: feedback.reporter_email,
        report_image_urls: feedback.report_image_urls,
        would_recommend: feedback.would_recommend,
        improved_features: feedback.improved_features,
        is_satisfied: feedback.is_satisfied,
        page_url: feedback.page_url,
        session_duration_seconds: feedback.session_duration_seconds,
        status: feedback.status,
        created_at: toIso(feedback.created_at),
      },
    };
  },
});

export const list = query({
  args: { page: v.optional(v.number()), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const admin = await requireProfile(ctx, userId);
    if (admin.role !== "admin") throw new Error("Admin access only");

    const page = Math.max(1, args.page ?? 1);
    const limit = Math.min(100, Math.max(1, args.limit ?? 20));
    const offset = (page - 1) * limit;

    const all = (await ctx.db.query("website_feedback").collect()).sort(
      (a, b) => (b.created_at ?? 0) - (a.created_at ?? 0)
    );
    const pageItems = all.slice(offset, offset + limit);
    const userIds = [
      ...new Set(
        pageItems
          .map((feedback) => feedback.user_id)
          .filter((id): id is NonNullable<typeof id> => !!id)
      ),
    ];
    const users = await Promise.all(userIds.map((id) => ctx.db.get(id)));
    const userById = new Map(users.filter(Boolean).map((user) => [user!._id, user!]));

    return {
      feedback: pageItems.map((feedback) => ({
        id: feedback._id,
        user_id: feedback.user_id,
        rating: feedback.rating,
        feedback_type: feedback.feedback_type,
        feedback_text: feedback.feedback_text,
        reporter_email: feedback.reporter_email,
        report_image_urls: feedback.report_image_urls,
        would_recommend: feedback.would_recommend,
        is_satisfied: feedback.is_satisfied,
        page_url: feedback.page_url,
        status: feedback.status,
        created_at: toIso(feedback.created_at),
        user: feedback.user_id
          ? {
              full_name:
                userById.get(feedback.user_id)?.full_name ??
                userById.get(feedback.user_id)?.name ??
                "",
              email: userById.get(feedback.user_id)?.email ?? "",
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
