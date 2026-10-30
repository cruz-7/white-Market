import { v } from "convex/values";
import { mutation, query } from "../_generated/server";
import type { MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { optionalUserId, requireProfile, requireUserId, userSummary } from "../lib/auth";
import { generateReferralCode } from "../lib/ids";
import { round2 } from "../lib/money";
import { toIso } from "../lib/shapes";

/**
 * Referral programme rules.
 *
 * - Every 3rd qualified buyer referral  -> GHS 5 platform credit.
 * - Every 2nd qualified seller referral -> 10 sales at 0% commission.
 * - Milestones: 3 -> GHS 5, 10 -> GHS 20, 25 -> 20 discounted sales,
 *   50 -> campus ambassador with a permanent 5% discount.
 */
export const MILESTONES = [
  { level: 1, name: "Starter", required: 3, reward: "GHS 5 platform credit" },
  { level: 2, name: "Growth", required: 10, reward: "GHS 20 platform credit" },
  { level: 3, name: "Champion", required: 25, reward: "0% commission for 20 sales" },
  { level: 4, name: "Campus Ambassador", required: 50, reward: "Permanent 5% discount" },
] as const;

const BUYER_CREDIT_EVERY = 3;
const BUYER_CREDIT_AMOUNT = 5;
const SELLER_DISCOUNT_EVERY = 2;
const SELLER_DISCOUNT_SALES = 10;

async function notify(
  ctx: MutationCtx,
  userId: Id<"users">,
  type: string,
  title: string,
  body: string,
  data?: Record<string, unknown>
) {
  await ctx.db.insert("notifications", {
    user_id: userId,
    type,
    title,
    body,
    data,
    read: false,
    created_at: Date.now(),
  });
}

/** Awards milestone rewards once a user crosses a threshold. */
async function awardMilestones(ctx: MutationCtx, userId: Id<"users">) {
  const user = await ctx.db.get(userId);
  if (!user) return;

  const total = (user.qualified_buyer_referrals ?? 0) + (user.qualified_seller_referrals ?? 0);
  const level = user.referral_level ?? 0;

  if (total >= 3 && level < 1) {
    await ctx.db.patch(userId, { referral_level: 1 });
  }
  if (total >= 10 && level < 2) {
    await ctx.db.patch(userId, {
      referral_level: 2,
      platform_credit: round2((user.platform_credit ?? 0) + 20),
      total_referral_credits: round2((user.total_referral_credits ?? 0) + 20),
    });
    await ctx.db.insert("referral_rewards", {
      user_id: userId,
      reward_type: "milestone_credit",
      reward_value: 20,
      description: "Growth milestone - GHS 20 platform credit",
      created_at: Date.now(),
    });
    await notify(ctx, userId, "referral_reward", "Growth milestone reached!", "You earned GHS 20 in platform credit.");
  }
  if (total >= 25 && level < 3) {
    await ctx.db.patch(userId, {
      referral_level: 3,
      commission_discount_sales_remaining:
        (user.commission_discount_sales_remaining ?? 0) + 20,
    });
    await ctx.db.insert("referral_rewards", {
      user_id: userId,
      reward_type: "commission_discount",
      reward_value: 20,
      description: "Champion milestone - 0% commission for 20 sales",
      created_at: Date.now(),
    });
    await notify(ctx, userId, "referral_reward", "Champion milestone reached!", "You now get 0% commission for 20 sales.");
  }
  if (total >= 50 && level < 4) {
    await ctx.db.patch(userId, {
      referral_level: 4,
      is_campus_ambassador: true,
      referral_ambassador_discount_active: true,
    });
    await ctx.db.insert("referral_rewards", {
      user_id: userId,
      reward_type: "ambassador_permanent_discount",
      reward_value: 5,
      description: "Campus Ambassador - permanent 5% discount",
      created_at: Date.now(),
    });
    await notify(ctx, userId, "referral_reward", "You are a Campus Ambassador!", "You now get a permanent 5% discount.");
  }
}

/** Called when a referred buyer completes their first purchase. */
export async function processBuyerReferralQualification(
  ctx: MutationCtx,
  buyerId: Id<"users">
) {
  const buyer = await ctx.db.get(buyerId);
  if (!buyer?.referred_by) return null;

  const referral = await ctx.db
    .query("referrals")
    .withIndex("by_referred", (q: any) => q.eq("referred_id", buyerId))
    .first();
  if (!referral || referral.status !== "pending") return null;

  const now = Date.now();
  await ctx.db.patch(referral._id, {
    status: "qualified",
    referral_type: "buyer_referral",
    qualified_at: now,
    purchase_completed_at: now,
  });

  const referrer = await ctx.db.get(referral.referrer_id);
  if (!referrer) return null;

  const qualified = (referrer.qualified_buyer_referrals ?? 0) + 1;
  const patch: Record<string, unknown> = { qualified_buyer_referrals: qualified };

  if (qualified > 0 && qualified % BUYER_CREDIT_EVERY === 0) {
    patch.platform_credit = round2((referrer.platform_credit ?? 0) + BUYER_CREDIT_AMOUNT);
    patch.total_referral_credits = round2(
      (referrer.total_referral_credits ?? 0) + BUYER_CREDIT_AMOUNT
    );
    patch.referral_earnings = round2((referrer.referral_earnings ?? 0) + BUYER_CREDIT_AMOUNT);

    await ctx.db.insert("referral_rewards", {
      user_id: referrer._id,
      referral_id: referral._id,
      reward_type: "credit",
      reward_value: BUYER_CREDIT_AMOUNT,
      description: `Buyer referral milestone reward (every ${BUYER_CREDIT_EVERY} buyers)`,
      created_at: now,
    });
    await notify(
      ctx,
      referrer._id,
      "referral_reward",
      "Referral Reward Earned!",
      `You earned GHS ${BUYER_CREDIT_AMOUNT} in platform credit.`
    );
  }

  await ctx.db.patch(referrer._id, patch);
  await awardMilestones(ctx, referrer._id);
  return referral._id;
}

/** Called when a referred seller lists their first product. */
export async function processSellerReferralQualification(
  ctx: MutationCtx,
  sellerId: Id<"users">
) {
  const seller = await ctx.db.get(sellerId);
  if (!seller?.referred_by) return null;

  const referral = await ctx.db
    .query("referrals")
    .withIndex("by_referred", (q: any) => q.eq("referred_id", sellerId))
    .first();
  if (!referral || referral.status !== "pending") return null;

  const now = Date.now();
  await ctx.db.patch(referral._id, {
    status: "qualified",
    referral_type: "seller_referral",
    qualified_at: now,
    seller_listed_at: now,
  });

  const referrer = await ctx.db.get(referral.referrer_id);
  if (!referrer) return null;

  const qualified = (referrer.qualified_seller_referrals ?? 0) + 1;
  const patch: Record<string, unknown> = { qualified_seller_referrals: qualified };

  if (qualified > 0 && qualified % SELLER_DISCOUNT_EVERY === 0) {
    patch.commission_discount_sales_remaining =
      (referrer.commission_discount_sales_remaining ?? 0) + SELLER_DISCOUNT_SALES;

    await ctx.db.insert("referral_rewards", {
      user_id: referrer._id,
      referral_id: referral._id,
      reward_type: "commission_discount",
      reward_value: SELLER_DISCOUNT_SALES,
      description: `Seller referral milestone reward (every ${SELLER_DISCOUNT_EVERY} sellers)`,
      created_at: now,
    });
    await notify(
      ctx,
      referrer._id,
      "referral_reward",
      "Referral Reward Earned!",
      `You earned 0% commission for ${SELLER_DISCOUNT_SALES} sales.`
    );
  }

  await ctx.db.patch(referrer._id, patch);
  await awardMilestones(ctx, referrer._id);
  return referral._id;
}

async function ensureReferralCode(ctx: MutationCtx, userId: Id<"users">) {
  const user = await ctx.db.get(userId);
  if (!user) throw new Error("User not found");
  if (user.referral_code) return user.referral_code;

  const code = generateReferralCode();
  await ctx.db.patch(userId, { referral_code: code });
  return code;
}

export const myCode = query({
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    const user = await requireProfile(ctx, userId);
    const code = user.referral_code ?? "";

    const referrals = await ctx.db
      .query("referrals")
      .withIndex("by_referrer", (q) => q.eq("referrer_id", userId))
      .collect();

    return {
      referral_code: code,
      referral_link: `${(process.env.FRONTEND_URL ?? "").replace(/\/+$/, "")}/auth?tab=signup&role=user&ref=${encodeURIComponent(code)}`,
      total_referrals: referrals.length,
      qualified_buyer_referrals: user.qualified_buyer_referrals ?? 0,
      qualified_seller_referrals: user.qualified_seller_referrals ?? 0,
      referral_level: user.referral_level ?? 0,
      is_campus_ambassador: user.is_campus_ambassador ?? false,
    };
  },
});

export const dashboard = query({
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    const user = await requireProfile(ctx, userId);
    const code = user.referral_code ?? "";

    const referrals = await ctx.db
      .query("referrals")
      .withIndex("by_referrer", (q) => q.eq("referrer_id", userId))
      .collect();

    const qualified = referrals.filter((r) => r.status === "qualified").length;
    const total = (user.qualified_buyer_referrals ?? 0) + (user.qualified_seller_referrals ?? 0);
    const level = user.referral_level ?? 0;
    const next = MILESTONES.find((m) => m.required > total) ?? null;

    return {
      referral_code: code,
      referral_link: `${(process.env.FRONTEND_URL ?? "").replace(/\/+$/, "")}/auth?tab=signup&role=user&ref=${encodeURIComponent(code)}`,
      total_referrals: referrals.length,
      total_qualified: qualified,
      qualified_buyer_referrals: user.qualified_buyer_referrals ?? 0,
      qualified_seller_referrals: user.qualified_seller_referrals ?? 0,
      platform_credit: user.platform_credit ?? 0,
      commission_discount_remaining: user.commission_discount_sales_remaining ?? 0,
      referral_level: level,
      is_campus_ambassador: user.is_campus_ambassador ?? false,
      next_milestone: next ? next.name : null,
      next_reward: next ? next.reward : null,
      progress_to_next: next ? Math.min(100, Math.round((total / next.required) * 100)) : 100,
    };
  },
});

export const milestones = query({
  handler: async () => MILESTONES.map((m) => ({ ...m })),
});

export const leaderboard = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const limit = Math.min(100, Math.max(1, args.limit ?? 10));
    const users = await ctx.db.query("users").collect();

    const ranked = users
      .map((user) => ({
        user,
        qualified:
          (user.qualified_buyer_referrals ?? 0) + (user.qualified_seller_referrals ?? 0),
        total: user.total_referrals ?? 0,
      }))
      .filter((entry) => entry.qualified > 0 || entry.total > 0)
      .sort((a, b) => b.qualified - a.qualified || b.total - a.total)
      .slice(0, limit);

    return ranked.map((entry, index) => ({
      rank: index + 1,
      id: entry.user._id,
      name: entry.user.seller_display_name ?? entry.user.full_name ?? entry.user.name ?? "",
      avatar_url: entry.user.avatar_url ?? entry.user.image ?? null,
      qualified_referrals: entry.qualified,
      total_referrals: entry.total,
      referral_level: entry.user.referral_level ?? 0,
    }));
  },
});

export const verify = query({
  args: { referral_code: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const code = args.referral_code?.trim().toUpperCase();
    if (!code) throw new Error("Referral code is required");

    const referral = await ctx.db
      .query("referrals")
      .withIndex("by_code", (q) => q.eq("referral_code", code))
      .first();
    if (!referral) throw new Error("Invalid referral code");

    const referrer = await ctx.db.get(referral.referrer_id);
    return {
      valid: true,
      referrer: {
        id: referral.referrer_id,
        name: referrer?.seller_display_name ?? referrer?.full_name ?? referrer?.name ?? "",
        avatar_url: referrer?.avatar_url ?? referrer?.image ?? null,
      },
    };
  },
});

export const claim = mutation({
  args: { referral_code: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const user = await requireProfile(ctx, userId);

    if (user.referred_by) {
      throw new Error("You have already used a referral code");
    }

    const code = args.referral_code?.trim().toUpperCase();
    if (!code) throw new Error("Referral code is required");

    const referral = await ctx.db
      .query("referrals")
      .withIndex("by_code", (q) => q.eq("referral_code", code))
      .first();
    if (!referral) throw new Error("Invalid referral code");
    if (referral.referred_id === userId) {
      throw new Error("You cannot use your own referral code");
    }

    const existing = await ctx.db
      .query("referrals")
      .withIndex("by_referred", (q) => q.eq("referred_id", userId))
      .first();
    if (existing) throw new Error("You have already used a referral code");

    await ctx.db.insert("referrals", {
      referrer_id: referral.referrer_id,
      referred_id: userId,
      referral_code: code,
      status: "pending",
      reward_claimed: false,
      created_at: Date.now(),
    });

    await ctx.db.patch(userId, { referred_by: referral.referrer_id });

    const referrer = await ctx.db.get(referral.referrer_id);
    if (referrer) {
      await ctx.db.patch(referrer._id, {
        total_referrals: (referrer.total_referrals ?? 0) + 1,
      });
      await notify(
        ctx,
        referrer._id,
        "referral_signup",
        "New referral!",
        `${user.full_name ?? user.name ?? "A student"} signed up with your code.`
      );
    }

    return { message: "Referral code applied successfully" };
  },
});

export const stats = query({
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    const user = await requireProfile(ctx, userId);

    const referrals = await ctx.db
      .query("referrals")
      .withIndex("by_referrer", (q) => q.eq("referrer_id", userId))
      .collect();
    const rewards = await ctx.db
      .query("referral_rewards")
      .withIndex("by_user", (q) => q.eq("user_id", userId))
      .collect();

    const referredUsers = await Promise.all(
      referrals.map((r) => ctx.db.get(r.referred_id))
    );

    return {
      total_referrals: referrals.length,
      qualified_referrals: referrals.filter((r) => r.status === "qualified").length,
      pending_referrals: referrals.filter((r) => r.status === "pending").length,
      buyer_referrals: referrals.filter((r) => r.referral_type === "buyer_referral").length,
      seller_referrals: referrals.filter((r) => r.referral_type === "seller_referral").length,
      platform_credit: user.platform_credit ?? 0,
      commission_discount_remaining: user.commission_discount_sales_remaining ?? 0,
      referral_level: user.referral_level ?? 0,
      is_campus_ambassador: user.is_campus_ambassador ?? false,
      referrals: referrals.map((r, index) => {
        const referred = referredUsers[index];
        return {
          id: r._id,
          status: r.status,
          referral_type: r.referral_type,
          created_at: toIso(r.created_at),
          qualified_at: toIso(r.qualified_at),
          user: userSummary(referred),
        };
      }),
      rewards: rewards.map((r) => ({
        id: r._id,
        reward_type: r.reward_type,
        reward_value: r.reward_value,
        description: r.description,
        created_at: toIso(r.created_at),
      })),
    };
  },
});

export const adminStats = query({
  handler: async (ctx) => {
    await requireProfile(ctx);
    const userId = await requireUserId(ctx);
    const me = await requireProfile(ctx, userId);
    if (me.role !== "admin") throw new Error("Admin access only");

    const referrals = await ctx.db.query("referrals").collect();
    const rewards = await ctx.db.query("referral_rewards").collect();
    const users = await ctx.db.query("users").collect();
    const referralUsers = await Promise.all(
      [...new Set(referrals.map((referral) => referral.referred_id))].map((id) =>
        ctx.db.get(id)
      )
    );
    const referralUserById = new Map(
      referralUsers.filter(Boolean).map((user) => [user!._id, user!])
    );
    const referralKind = (referral: (typeof referrals)[number]) => {
      if (referral.referral_type?.includes("seller")) return "seller";
      if (referral.referral_type?.includes("buyer")) return "buyer";
      return referralUserById.get(referral.referred_id)?.role === "seller" ? "seller" : "buyer";
    };

    const creditsIssued = rewards
      .filter((r) => r.reward_type === "credit" || r.reward_type === "milestone_credit")
      .reduce((sum, r) => sum + (r.reward_value ?? 0), 0);

    const topReferrers = users
      .map((u) => ({
        id: u._id,
        name: u.seller_display_name ?? u.full_name ?? u.name ?? "",
        qualified:
          (u.qualified_buyer_referrals ?? 0) + (u.qualified_seller_referrals ?? 0),
        total: u.total_referrals ?? 0,
      }))
      .filter((u) => u.qualified > 0)
      .sort((a, b) => b.qualified - a.qualified)
      .slice(0, 10);

    return {
      total_referrals: referrals.length,
      total_qualified_referrals: referrals.filter((r) => r.status === "qualified").length,
      qualified_referrals: referrals.filter((r) => r.status === "qualified").length,
      buyer_referrals: referrals.filter((referral) => referralKind(referral) === "buyer").length,
      seller_referrals: referrals.filter((referral) => referralKind(referral) === "seller").length,
      referrals: referrals
        .sort((a, b) => (b.created_at ?? b._creationTime) - (a.created_at ?? a._creationTime))
        .slice(0, 10)
        .map((referral) => ({
          referred_id: referral.referred_id,
          referred_name:
            referralUserById.get(referral.referred_id)?.full_name ??
            referralUserById.get(referral.referred_id)?.name ??
            "",
          type: referralKind(referral) === "seller" ? "Seller" : "Buyer",
          created_at: toIso(referral.created_at ?? referral._creationTime),
          qualified: referral.status === "qualified",
        })),
      total_platform_credits_issued: round2(creditsIssued),
      total_ambassadors: users.filter((u) => u.is_campus_ambassador).length,
      credits_issued_count: rewards.filter((r) => r.reward_type === "credit").length,
      commission_discounts_issued: rewards.filter(
        (r) => r.reward_type === "commission_discount"
      ).length,
      top_referrers: topReferrers,
    };
  },
});

/** Admin-triggered manual qualification. */
export const processBuyer = mutation({
  args: { buyer_user_id: v.id("users") },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const me = await requireProfile(ctx, userId);
    if (me.role !== "admin") throw new Error("Admin access only");
    return processBuyerReferralQualification(ctx, args.buyer_user_id);
  },
});

export const processSeller = mutation({
  args: { seller_user_id: v.id("users") },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const me = await requireProfile(ctx, userId);
    if (me.role !== "admin") throw new Error("Admin access only");
    return processSellerReferralQualification(ctx, args.seller_user_id);
  },
});

/** Used at signup to attach the ?ref= code to a brand new account. */
export const claimForNewUser = mutation({
  args: { referral_code: v.string() },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const user = await requireProfile(ctx, userId);
    if (user.referred_by) return { message: "Referral already attached" };

    const code = args.referral_code.trim().toUpperCase();
    const referral = await ctx.db
      .query("referrals")
      .withIndex("by_code", (q) => q.eq("referral_code", code))
      .first();
    if (!referral) return { message: "Invalid referral code" };

    await ctx.db.insert("referrals", {
      referrer_id: referral.referrer_id,
      referred_id: userId,
      referral_code: code,
      status: "pending",
      reward_claimed: false,
      created_at: Date.now(),
    });
    await ctx.db.patch(userId, { referred_by: referral.referrer_id });
    return { message: "Referral code applied" };
  },
});

export const currentUserId = query({
  handler: async (ctx) => optionalUserId(ctx),
});
