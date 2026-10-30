import { v } from "convex/values";
import { mutation, query } from "../_generated/server";
import { requireProfile, requireUserId } from "../lib/auth";
import {
  calculateAccountWeight,
  creditBalance,
  debitBalance,
  ensureWallet,
  getWallet,
  getNumericSetting,
  getSetting,
  MIN_WITHDRAWAL,
  round2,
} from "../lib/money";
import { toIso } from "../lib/shapes";

/**
 * Daily withdrawal limit = balance * account weight * withdrawal percentage,
 * minus whatever has already been withdrawn today.
 */
async function dailyLimit(ctx: any, userId: any) {
  const wallet = await getWallet(ctx, userId);
  const user = await ctx.db.get(userId);
  if (!user) return 0;

  const percentage = await getNumericSetting(ctx, "withdrawal_percentage", 0.5);
  const weight = user.account_weight ?? calculateAccountWeight(user.total_sales, user.successful_transactions);

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const payouts = await ctx.db
    .query("payouts")
    .withIndex("by_seller", (q: any) => q.eq("seller_id", userId))
    .collect();

  const withdrawnToday = payouts
    .filter(
      (p: any) =>
        ["completed", "sent", "processing"].includes(p.status) &&
        (p.created_at ?? 0) >= startOfDay.getTime()
    )
    .reduce((sum: number, p: any) => sum + (p.amount ?? 0), 0);

  const maxLimit = (wallet?.balance ?? 0) * weight * percentage;
  return Math.max(0, round2(maxLimit - withdrawnToday));
}

/** The wallet summary shape the frontend consumes. */
async function walletInfo(ctx: any, userId: any) {
  const wallet = await getWallet(ctx, userId);
  const user = await ctx.db.get(userId);

  return {
    wallet_balance: wallet?.balance ?? 0,
    platform_credit: user?.platform_credit ?? 0,
    account_weight:
      user?.account_weight ??
      calculateAccountWeight(user?.total_sales, user?.successful_transactions),
    total_sales: user?.total_sales ?? 0,
    successful_transactions: user?.successful_transactions ?? 0,
    last_sale_at: user?.last_sale_at ? toIso(user.last_sale_at) : null,
    is_payout_frozen: user?.is_payout_frozen ?? false,
    fraud_flags: user?.fraud_flags ?? [],
    referral_earnings: user?.referral_earnings ?? 0,
    total_referral_credits: user?.total_referral_credits ?? 0,
    daily_limit: await dailyLimit(ctx, userId),
  };
}

export const info = query({
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    await requireProfile(ctx, userId);
    return { wallet: await walletInfo(ctx, userId) };
  },
});

export const summary = query({
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    await requireProfile(ctx, userId);
    const wallet = await getWallet(ctx, userId);
    return {
      balance: wallet?.balance ?? 0,
      pending_earnings: wallet?.pending_earnings ?? 0,
      currency: wallet?.currency ?? "GHS",
    };
  },
});

export const limits = query({
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    const user = await requireProfile(ctx, userId);
    const wallet = await getWallet(ctx, userId);

    const minWithdrawal = await getNumericSetting(ctx, "min_withdrawal", MIN_WITHDRAWAL);
    const percentage = await getNumericSetting(ctx, "withdrawal_percentage", 0.5);
    const cooldown = await getNumericSetting(ctx, "payout_cooldown_hours", 24);

    return {
      wallet_balance: wallet?.balance ?? 0,
      account_weight:
        user.account_weight ??
        calculateAccountWeight(user.total_sales, user.successful_transactions),
      daily_limit: await dailyLimit(ctx, userId),
      min_withdrawal: minWithdrawal,
      withdrawal_percentage: percentage,
      cooldown_hours: cooldown,
      last_sale_at: user.last_sale_at ? toIso(user.last_sale_at) : null,
      is_frozen: user.is_payout_frozen ?? false,
      fraud_flags: user.fraud_flags ?? [],
    };
  },
});

/**
 * Eligibility check for a withdrawal. Mirrors the rules the old Express
 * service enforced, but reads the min amount from settings instead of a
 * hardcoded constant.
 */
export const checkEligibility = query({
  args: { amount: v.number() },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const user = await requireProfile(ctx, userId);

    const wallet = await getWallet(ctx, userId);
    const balance = wallet?.balance ?? 0;
    const limit = await dailyLimit(ctx, userId);
    const minWithdrawal = await getNumericSetting(ctx, "min_withdrawal", MIN_WITHDRAWAL);
    const cooldown = await getNumericSetting(ctx, "payout_cooldown_hours", 24);

    let reason: string | null = null;
    if (user.is_payout_frozen) {
      reason = "Account is frozen";
    } else if ((user.fraud_flags ?? []).length > 0) {
      reason = "Account has fraud flags";
    } else if (user.last_sale_at && Date.now() < user.last_sale_at + cooldown * 60 * 60 * 1000) {
      reason = `Payout cooldown is active until ${new Date(user.last_sale_at + cooldown * 60 * 60 * 1000).toLocaleString()}`;
    } else if (args.amount < minWithdrawal) {
      reason = `Minimum withdrawal is GHS ${minWithdrawal}`;
    } else if (args.amount > balance) {
      reason = "Insufficient balance";
    } else if (args.amount > limit) {
      reason = `Daily limit exceeded. Maximum: GHS ${limit.toFixed(2)}`;
    }

    return {
      eligible: reason === null,
      reason: reason ?? "",
      wallet_balance: balance,
      daily_limit: limit,
    };
  },
});

/**
 * Simulated top-up. Disabled in production unless
 * `ALLOW_SIMULATED_WALLET_TOPUP=true`.
 */
export const topUp = mutation({
  args: { amount: v.number() },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    await requireProfile(ctx, userId);

    if (!(args.amount > 0)) throw new Error("Amount must be greater than 0");
    if (
      process.env.NODE_ENV === "production" &&
      process.env.ALLOW_SIMULATED_WALLET_TOPUP !== "true"
    ) {
      throw new Error("Simulated top-ups are disabled in production");
    }

    const balance = await creditBalance(
      ctx,
      userId,
      args.amount,
      "Wallet top-up (simulated)",
      { type: "topup" }
    );

    return { message: "Wallet topped up", balance };
  },
});

/**
 * Moves money from the available balance to a pending withdrawal request.
 * The actual mobile money transfer happens after this.
 */
export const withdraw = mutation({
  args: {
    amount: v.number(),
    momo_number: v.optional(v.string()),
    network: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const user = await requireProfile(ctx, userId);

    if (!(args.amount > 0)) throw new Error("Amount must be greater than 0");

    const wallet = await ensureWallet(ctx, userId);
    const balance = wallet.balance ?? 0;
    const limit = await dailyLimit(ctx, userId);
    const minWithdrawal = await getNumericSetting(ctx, "min_withdrawal", MIN_WITHDRAWAL);
    const cooldown = await getNumericSetting(ctx, "payout_cooldown_hours", 24);
    const now = Date.now();

    if (user.is_payout_frozen) throw new Error("Account is frozen");
    if ((user.fraud_flags ?? []).length > 0) throw new Error("Account has fraud flags");
    if (user.last_sale_at && now < user.last_sale_at + cooldown * 60 * 60 * 1000) {
      throw new Error(
        `Payout cooldown is active until ${new Date(user.last_sale_at + cooldown * 60 * 60 * 1000).toLocaleString()}`
      );
    }
    if (args.amount < minWithdrawal) {
      throw new Error(`Minimum withdrawal is GHS ${minWithdrawal}`);
    }
    if (args.amount > balance) throw new Error("Insufficient balance");
    if (args.amount > limit) {
      throw new Error(`Daily limit exceeded. Maximum: GHS ${limit.toFixed(2)}`);
    }

    const balanceAfter = await debitBalance(
      ctx,
      userId,
      args.amount,
      "Withdrawal request",
      { type: "withdrawal" }
    );

    const payoutId = await ctx.db.insert("payouts", {
      seller_id: userId,
      amount: round2(args.amount),
      net_amount: round2(args.amount),
      status: "pending",
      funds_reserved: true,
      momo_number: args.momo_number ?? user.momo_number,
      momo_network: args.network ?? user.momo_provider,
      paystack_recipient_code: user.paystack_recipient_code,
      created_at: now,
    });

    return {
      success: true,
      message: "Withdrawal requested",
      wallet: await walletInfo(ctx, userId),
      balance: balanceAfter,
      payout: { id: payoutId, amount: round2(args.amount), momo_number: args.momo_number },
    };
  },
});

export const ledger = query({
  args: { limit: v.optional(v.number()), offset: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    await requireProfile(ctx, userId);

    const limit = Math.min(100, Math.max(1, args.limit ?? 50));
    const offset = Math.max(0, args.offset ?? 0);

    const entries = await ctx.db
      .query("wallet_transactions")
      .withIndex("by_user", (q) => q.eq("user_id", userId))
      .collect();

    const sorted = entries.sort((a, b) => (b.created_at ?? 0) - (a.created_at ?? 0));
    const page = sorted.slice(offset, offset + limit);

    return {
      ledger: page.map((entry) => ({
        id: entry._id,
        user_id: entry.user_id,
        entry_type: entry.type,
        type: entry.type,
        amount: entry.amount,
        description: entry.description,
        reference_id: entry.reference_id,
        reference_type: entry.reference_type,
        balance_after: entry.balance_after,
        created_at: toIso(entry.created_at),
      })),
      has_more: sorted.length > offset + limit,
    };
  },
});

export const recentTransactions = query({
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    await requireProfile(ctx, userId);

    const entries = await ctx.db
      .query("wallet_transactions")
      .withIndex("by_user", (q) => q.eq("user_id", userId))
      .collect();

    return entries
      .sort((a, b) => (b.created_at ?? 0) - (a.created_at ?? 0))
      .slice(0, 50)
      .map((entry) => ({
        id: entry._id,
        user_id: entry.user_id,
        type: entry.type,
        amount: entry.amount,
        description: entry.description,
        reference_id: entry.reference_id,
        balance_after: entry.balance_after,
        created_at: toIso(entry.created_at),
      }));
  },
});

/** Admin view of every seller transaction. */
export const allTransactions = query({
  args: { limit: v.optional(v.number()), offset: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const me = await requireProfile(ctx, userId);
    if (me.role !== "admin") throw new Error("Admin access only");

    const limit = Math.min(100, Math.max(1, args.limit ?? 50));
    const offset = Math.max(0, args.offset ?? 0);

    const all = await ctx.db.query("transactions").collect();
    const sorted = all.sort((a, b) => (b.created_at ?? 0) - (a.created_at ?? 0));
    const page = sorted.slice(offset, offset + limit);

    const userIds = [...new Set(page.flatMap((t) => [t.buyer_id, t.seller_id]))];
    const users = await Promise.all(userIds.map((id) => ctx.db.get(id)));
    const userById = new Map(users.filter(Boolean).map((u) => [u!._id, u!]));

    return {
      transactions: page.map((t) => ({
        id: t._id,
        buyer_id: t.buyer_id,
        seller_id: t.seller_id,
        order_id: t.order_id,
        amount: t.amount,
        commission: t.commission,
        seller_earning: t.seller_earning,
        credit_used: 0,
        status: t.status,
        created_at: toIso(t.created_at),
        buyer: userById.get(t.buyer_id)
          ? { full_name: userById.get(t.buyer_id)!.full_name ?? "", email: userById.get(t.buyer_id)!.email ?? "" }
          : undefined,
        seller: userById.get(t.seller_id)
          ? { full_name: userById.get(t.seller_id)!.full_name ?? "", email: userById.get(t.seller_id)!.email ?? "" }
          : undefined,
      })),
      has_more: sorted.length > offset + limit,
    };
  },
});

export const platformStats = query({
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    const me = await requireProfile(ctx, userId);
    if (me.role !== "admin") throw new Error("Admin access only");

    const wallets = await ctx.db.query("wallets").collect();
    const transactions = await ctx.db.query("transactions").collect();
    const payouts = await ctx.db.query("payouts").collect();
    const users = await ctx.db.query("users").collect();

    const paid = transactions.filter((t) => t.status === "paid");
    const totalWalletBalance = wallets.reduce((sum, w) => sum + (w.balance ?? 0), 0);
    const totalPlatformCredit = users.reduce((sum, u) => sum + (u.platform_credit ?? 0), 0);

    return {
      total_wallet_balance: round2(totalWalletBalance),
      total_platform_credit: round2(totalPlatformCredit),
      seller_liability: round2(totalWalletBalance),
      total_transaction_volume: round2(paid.reduce((sum, t) => sum + (t.amount ?? 0), 0)),
      total_commission: round2(paid.reduce((sum, t) => sum + (t.commission ?? 0), 0)),
      platform_profit: round2(paid.reduce((sum, t) => sum + (t.commission ?? 0), 0)),
      pending_payouts: round2(
        payouts.filter((p) => p.status === "pending").reduce((sum, p) => sum + (p.amount ?? 0), 0)
      ),
      completed_payouts: round2(
        payouts.filter((p) => ["completed", "sent"].includes(p.status)).reduce((sum, p) => sum + (p.amount ?? 0), 0)
      ),
      failed_payouts: payouts.filter((p) => p.status === "failed").length,
      total_referral_credits: round2(
        users.reduce((sum, u) => sum + (u.total_referral_credits ?? 0), 0)
      ),
      active_referral_credits: round2(
        users.reduce((sum, u) => sum + (u.platform_credit ?? 0), 0)
      ),
    };
  },
});

export const settings = query({
  handler: async (ctx) => ({
    commission_rate: Number.parseFloat(await getSetting(ctx, "commission_rate", "0.1")),
    min_withdrawal: await getNumericSetting(ctx, "min_withdrawal", MIN_WITHDRAWAL),
    withdrawal_percentage: await getNumericSetting(ctx, "withdrawal_percentage", 0.5),
    payout_cooldown_hours: await getNumericSetting(ctx, "payout_cooldown_hours", 24),
  }),
});
