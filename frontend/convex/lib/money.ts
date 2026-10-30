import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import type { AnyCtx } from "./auth";

/** Platform commission. Kept in one place so it cannot drift between modules. */
export const COMMISSION_RATE = 0.1;
export const MIN_WITHDRAWAL = 20;
export const DEFAULT_WITHDRAWAL_PERCENTAGE = 0.5;
export const DEFAULT_PAYOUT_COOLDOWN_HOURS = 24;
export const GHS = "GHS";

export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export async function computeCommission(ctx: AnyCtx, amount: number) {
  const rate = await getNumericSetting(ctx, "commission_rate", COMMISSION_RATE);
  const commission = round2(amount * rate);
  return { commission, sellerEarning: round2(amount - commission) };
}

export async function getSetting(
  ctx: AnyCtx,
  key: string,
  fallback: string
): Promise<string> {
  const row = await ctx.db
    .query("system_settings")
    .withIndex("by_key", (q) => q.eq("key", key))
    .unique();
  return row?.value ?? fallback;
}

export async function getNumericSetting(
  ctx: AnyCtx,
  key: string,
  fallback: number
): Promise<number> {
  const raw = await getSetting(ctx, key, String(fallback));
  const parsed = Number.parseFloat(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export async function getWallet(ctx: AnyCtx, userId: Id<"users">) {
  return ctx.db
    .query("wallets")
    .withIndex("by_user", (q) => q.eq("user_id", userId))
    .unique();
}

/** Creates the wallet row if it is missing, then returns it. */
export async function ensureWallet(
  ctx: MutationCtx,
  userId: Id<"users">
): Promise<Doc<"wallets">> {
  const existing = await getWallet(ctx, userId);
  if (existing) return existing;
  const now = Date.now();
  const id = await ctx.db.insert("wallets", {
    user_id: userId,
    balance: 0,
    pending_earnings: 0,
    currency: GHS,
    created_at: now,
    updated_at: now,
  });
  const created = await ctx.db.get(id);
  if (!created) throw new Error("Failed to create wallet");
  return created;
}

type LedgerType = "credit" | "debit" | "withdrawal" | "refund" | "pending";

/**
 * Moves money out of the available balance and records it in the ledger.
 * Throws if the balance is insufficient. The whole call runs inside one
 * Convex mutation, so the read-modify-write is atomic.
 */
export async function debitBalance(
  ctx: MutationCtx,
  userId: Id<"users">,
  amount: number,
  description: string,
  reference?: { id?: string; type?: string }
): Promise<number> {
  const wallet = await ensureWallet(ctx, userId);
  const balance = wallet.balance ?? 0;
  if (balance < amount) {
    throw new Error("Insufficient wallet balance");
  }
  const next = round2(balance - amount);
  await ctx.db.patch(wallet._id, { balance: next, updated_at: Date.now() });
  await ctx.db.insert("wallet_transactions", {
    user_id: userId,
    type: "debit" satisfies LedgerType,
    amount: round2(amount),
    description,
    reference_id: reference?.id,
    reference_type: reference?.type,
    balance_after: next,
    created_at: Date.now(),
  });
  return next;
}

/** Moves money into the available balance and records it in the ledger. */
export async function creditBalance(
  ctx: MutationCtx,
  userId: Id<"users">,
  amount: number,
  description: string,
  reference?: { id?: string; type?: string }
): Promise<number> {
  const wallet = await ensureWallet(ctx, userId);
  const next = round2((wallet.balance ?? 0) + amount);
  await ctx.db.patch(wallet._id, { balance: next, updated_at: Date.now() });
  await ctx.db.insert("wallet_transactions", {
    user_id: userId,
    type: "credit" satisfies LedgerType,
    amount: round2(amount),
    description,
    reference_id: reference?.id,
    reference_type: reference?.type,
    balance_after: next,
    created_at: Date.now(),
  });
  return next;
}

/**
 * Adds to the seller's *pending* earnings. Pending earnings become available
 * balance when the seller requests a payout.
 */
export async function creditPendingEarnings(
  ctx: MutationCtx,
  userId: Id<"users">,
  amount: number,
  description: string,
  reference?: { id?: string; type?: string }
): Promise<number> {
  const wallet = await ensureWallet(ctx, userId);
  const next = round2((wallet.pending_earnings ?? 0) + amount);
  await ctx.db.patch(wallet._id, {
    pending_earnings: next,
    updated_at: Date.now(),
  });
  await ctx.db.insert("wallet_transactions", {
    user_id: userId,
    type: "pending" satisfies LedgerType,
    amount: round2(amount),
    description,
    reference_id: reference?.id,
    reference_type: reference?.type,
    balance_after: next,
    created_at: Date.now(),
  });
  return next;
}

/** Moves money from pending earnings into the available balance. */
export async function releasePendingEarnings(
  ctx: MutationCtx,
  userId: Id<"users">,
  amount: number,
  description: string,
  reference?: { id?: string; type?: string }
): Promise<number> {
  const wallet = await ensureWallet(ctx, userId);
  const pending = wallet.pending_earnings ?? 0;
  if (pending < amount) {
    throw new Error("Insufficient pending earnings");
  }
  const nextPending = round2(pending - amount);
  const nextBalance = round2((wallet.balance ?? 0) + amount);
  await ctx.db.patch(wallet._id, {
    pending_earnings: nextPending,
    balance: nextBalance,
    updated_at: Date.now(),
  });
  await ctx.db.insert("wallet_transactions", {
    user_id: userId,
    type: "credit" satisfies LedgerType,
    amount: round2(amount),
    description,
    reference_id: reference?.id,
    reference_type: reference?.type,
    balance_after: nextBalance,
    created_at: Date.now(),
  });
  return nextBalance;
}

/**
 * Account weight rises with trading history, which raises the daily
 * withdrawal limit.
 */
export function calculateAccountWeight(
  totalSales: number | undefined,
  successfulTransactions: number | undefined
): number {
  const sales = totalSales ?? 0;
  if (sales >= 1000) return 1;
  if (sales >= 200) return 0.6;
  return 0.3;
}

export const MOMO_NETWORKS = ["MTN", "Vodafone", "AirtelTigo"] as const;
export type MomoNetwork = (typeof MOMO_NETWORKS)[number];

export function isMomoNetwork(value: string): value is MomoNetwork {
  return (MOMO_NETWORKS as readonly string[]).includes(value);
}

/** Paystack bank codes for the mobile money networks we support. */
export function paystackBankCode(network: string): string {
  switch (network) {
    case "Vodafone":
      return "VOD";
    case "AirtelTigo":
      return "ATL";
    case "MTN":
    default:
      return "MTN";
  }
}
