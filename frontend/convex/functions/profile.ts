import { v } from "convex/values";
import { internalQuery, mutation, query } from "../_generated/server";
import { requireProfile, requireUserId } from "../lib/auth";
import { toIso } from "../lib/shapes";

const NAME_CHANGE_COOLDOWN_DAYS = 30;

export const assertActiveUser = internalQuery({
  args: { user_id: v.id("users") },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.user_id);
    return !!user && !user.account_deleted_at;
  },
});

export const get = query({
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    const user = await requireProfile(ctx, userId);
    return { ...user, id: user._id, created_at: toIso(user.created_at) };
  },
});

export const update = mutation({
  args: {
    full_name: v.optional(v.string()),
    avatar_url: v.optional(v.string()),
    momo_number: v.optional(v.string()),
    momo_provider: v.optional(v.string()),
    campus: v.optional(v.string()),
    whatsapp: v.optional(v.string()),
    seller_bio: v.optional(v.string()),
    seller_response_time: v.optional(v.string()),
    role: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const admin = await requireProfile(ctx, userId);

    const { role, ...rest } = args;
    const patch: Record<string, unknown> = { updated_at: Date.now() };
    for (const [key, value] of Object.entries(rest)) {
      if (value !== undefined) patch[key] = value;
    }
    if (role !== undefined) {
      if (admin.role !== "admin" && role !== "seller") {
        throw new Error("You can only enable seller mode for your own account");
      }
      patch.role = role;
    }

    await ctx.db.patch(userId, patch);
    const user = await ctx.db.get(userId);
    return { message: "Profile updated", user: user ? { ...user, created_at: toIso(user.created_at) } : null };
  },
});

export const deleteMyAccount = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    const user = await requireProfile(ctx, userId);
    if (user.role === "admin") {
      throw new Error("Administrator accounts cannot self-delete. Contact another administrator.");
    }

    const now = Date.now();
    const sessions = await ctx.db
      .query("authSessions")
      .withIndex("userId", (q) => q.eq("userId", userId))
      .collect();
    const sessionIds = new Set(sessions.map((session) => session._id));
    const accounts = await ctx.db
      .query("authAccounts")
      .withIndex("userIdAndProvider", (q) => q.eq("userId", userId))
      .collect();
    for (const account of accounts) {
      const codes = await ctx.db
        .query("authVerificationCodes")
        .withIndex("accountId", (q) => q.eq("accountId", account._id))
        .collect();
      for (const code of codes) await ctx.db.delete(code._id);
      await ctx.db.delete(account._id);
    }
    for (const session of sessions) {
      const refreshTokens = await ctx.db
        .query("authRefreshTokens")
        .withIndex("sessionId", (q) => q.eq("sessionId", session._id))
        .collect();
      for (const token of refreshTokens) await ctx.db.delete(token._id);
      await ctx.db.delete(session._id);
    }

    const verifiers = await ctx.db.query("authVerifiers").collect();
    for (const verifier of verifiers) {
      if (verifier.sessionId && sessionIds.has(verifier.sessionId)) {
        await ctx.db.delete(verifier._id);
      }
    }
    const email = user.email?.trim().toLowerCase();
    if (email) {
      const rateLimits = await ctx.db
        .query("authRateLimits")
        .withIndex("identifier", (q) => q.eq("identifier", email))
        .collect();
      for (const limit of rateLimits) await ctx.db.delete(limit._id);
    }
    const verifications = await ctx.db
      .query("verifications")
      .withIndex("by_user", (q) => q.eq("user_id", userId))
      .collect();
    for (const verification of verifications) await ctx.db.delete(verification._id);
    const favorites = await ctx.db
      .query("favorites")
      .withIndex("by_user", (q) => q.eq("user_id", userId))
      .collect();
    for (const favorite of favorites) await ctx.db.delete(favorite._id);
    const likes = await ctx.db
      .query("likes")
      .withIndex("by_user", (q) => q.eq("user_id", userId))
      .collect();
    for (const like of likes) await ctx.db.delete(like._id);
    const history = await ctx.db
      .query("search_history")
      .withIndex("by_user", (q) => q.eq("user_id", userId))
      .collect();
    for (const entry of history) await ctx.db.delete(entry._id);
    const notifications = await ctx.db
      .query("notifications")
      .withIndex("by_user", (q) => q.eq("user_id", userId))
      .collect();
    for (const notification of notifications) await ctx.db.delete(notification._id);

    const [products, fashionItems, services, books] = await Promise.all([
      ctx.db.query("products").withIndex("by_seller", (q) => q.eq("seller_id", userId)).collect(),
      ctx.db.query("fashion").withIndex("by_seller", (q) => q.eq("seller_id", userId)).collect(),
      ctx.db.query("services").withIndex("by_seller", (q) => q.eq("seller_id", userId)).collect(),
      ctx.db.query("books").withIndex("by_seller", (q) => q.eq("seller_id", userId)).collect(),
    ]);
    for (const product of products) {
      await ctx.db.patch(product._id, { is_active: false, updated_at: now });
    }
    for (const item of fashionItems) {
      await ctx.db.patch(item._id, { is_active: false, updated_at: now });
    }
    for (const service of services) {
      await ctx.db.patch(service._id, { is_active: false, updated_at: now });
    }
    for (const book of books) {
      await ctx.db.patch(book._id, { is_active: false, updated_at: now });
    }

    await ctx.db.patch(userId, {
      name: "Deleted user",
      full_name: "Deleted user",
      email: undefined,
      phone: undefined,
      image: undefined,
      avatar_url: undefined,
      campus: undefined,
      whatsapp: undefined,
      momo_number: undefined,
      momo_provider: undefined,
      paystack_recipient_code: undefined,
      seller_display_name: undefined,
      seller_profile_image_url: undefined,
      seller_bio: undefined,
      seller_response_time: undefined,
      referral_code: undefined,
      payout_pin: undefined,
      verified: false,
      verification_status: "deleted",
      role: "deleted",
      isAnonymous: true,
      account_deleted_at: now,
      updated_at: now,
    });

    return {
      message: "Account deleted and profile anonymized. Financial and audit records were retained.",
    };
  },
});

/** Seller display name and avatar, with a cooldown on renaming. */
export const sellerProfile = query({
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    const user = await requireProfile(ctx, userId);

    const lastChange = user.last_name_change;
    const daysRemaining = lastChange
      ? Math.max(
          0,
          NAME_CHANGE_COOLDOWN_DAYS -
            Math.floor((Date.now() - lastChange) / (24 * 60 * 60 * 1000))
        )
      : 0;

    return {
      id: user._id,
      full_name: user.full_name ?? user.name ?? "",
      seller_display_name: user.seller_display_name ?? null,
      seller_profile_image_url: user.seller_profile_image_url ?? null,
      last_name_change: lastChange ? toIso(lastChange) : null,
      can_change_name: daysRemaining === 0,
      days_remaining: daysRemaining,
    };
  },
});

export const updateSellerProfile = mutation({
  args: {
    seller_display_name: v.optional(v.string()),
    seller_profile_image_url: v.optional(v.string()),
    seller_bio: v.optional(v.string()),
    seller_response_time: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const user = await requireProfile(ctx, userId);

    const now = Date.now();
    const patch: Record<string, unknown> = { updated_at: now };

    if (args.seller_display_name !== undefined) {
      const lastChange = user.last_name_change;
      const daysRemaining = lastChange
        ? Math.max(
            0,
            NAME_CHANGE_COOLDOWN_DAYS -
              Math.floor((now - lastChange) / (24 * 60 * 60 * 1000))
          )
        : 0;

      if (daysRemaining > 0) {
        throw new Error(
          `You can change your display name again in ${daysRemaining} day(s)`
        );
      }
      patch.seller_display_name = args.seller_display_name.trim() || null;
      patch.last_name_change = now;
    }

    if (args.seller_profile_image_url !== undefined) {
      patch.seller_profile_image_url = args.seller_profile_image_url;
    }
    if (args.seller_bio !== undefined) patch.seller_bio = args.seller_bio;
    if (args.seller_response_time !== undefined) {
      patch.seller_response_time = args.seller_response_time;
    }

    await ctx.db.patch(userId, patch);
    const updated = await ctx.db.get(userId);

    return {
      message: "Seller profile updated",
      user: updated,
      last_name_change: patch.last_name_change ? toIso(patch.last_name_change as number) : null,
      days_remaining:
        patch.last_name_change !== undefined
          ? NAME_CHANGE_COOLDOWN_DAYS
          : user.last_name_change
            ? Math.max(
                0,
                NAME_CHANGE_COOLDOWN_DAYS -
                  Math.floor((now - user.last_name_change) / (24 * 60 * 60 * 1000))
              )
            : 0,
    };
  },
});
