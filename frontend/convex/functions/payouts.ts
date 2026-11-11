import { v } from "convex/values";
import { internal } from "../_generated/api";
import { action, internalMutation, internalQuery, mutation, query } from "../_generated/server";
import type { ActionCtx, MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { requireProfile, requireUserId, requireVerifiedStudent } from "../lib/auth";
import {
  COMMISSION_RATE,
  creditBalance,
  debitBalance,
  ensureWallet,
  isMomoNetwork,
  paystackBankCode,
  round2,
} from "../lib/money";
import { createTransferRecipient, sendTransfer } from "../lib/paystack";
import { toIso } from "../lib/shapes";

/** Seller requests a payout for a completed order whose earnings are available. */
export const request = mutation({
  args: { order_id: v.id("orders") },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    await requireVerifiedStudent(ctx, userId);

    const order = await ctx.db.get(args.order_id);
    if (!order) throw new Error("Order not found");
    if (order.seller_id !== userId) {
      throw new Error("You can only request a payout for your own sales");
    }
    if (order.status !== "completed") {
      throw new Error("Only a completed order can be paid out");
    }

    const existing = await ctx.db
      .query("payouts")
      .withIndex("by_seller", (q) => q.eq("seller_id", userId))
      .collect();
    if (existing.some((p) => p.order_id === args.order_id)) {
      throw new Error("A payout has already been requested for this order");
    }

    const commission = order.commission ?? round2(order.amount * COMMISSION_RATE);
    const sellerEarning = order.seller_earning ?? round2(order.amount - commission);
    await ensureWallet(ctx, userId);
    await debitBalance(ctx, userId, sellerEarning, "Order payout request", {
      id: args.order_id,
      type: "order_payout",
    });
    const payoutId = await ctx.db.insert("payouts", {
      seller_id: userId,
      order_id: args.order_id,
      amount: sellerEarning,
      net_amount: sellerEarning,
      status: "pending",
      funds_reserved: true,
      created_at: Date.now(),
    });

    return {
      message: "Payout requested",
      payout: { id: payoutId, amount: sellerEarning, status: "pending" },
      seller_amount: sellerEarning,
      commission,
    };
  },
});

export const list = query({
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    await requireProfile(ctx, userId);

    const payouts = await ctx.db
      .query("payouts")
      .withIndex("by_seller", (q) => q.eq("seller_id", userId))
      .collect();

    const orderIds = payouts
      .map((p) => p.order_id)
      .filter((id): id is NonNullable<typeof id> => !!id);
    const orders = await Promise.all(orderIds.map((id) => ctx.db.get(id)));
    const orderById = new Map(orders.filter(Boolean).map((o) => [o!._id, o!]));

    return {
      payouts: payouts
        .sort((a, b) => (b.created_at ?? 0) - (a.created_at ?? 0))
        .map((payout) => {
          const order = payout.order_id ? orderById.get(payout.order_id) : null;
          return {
            id: payout._id,
            user_id: payout.seller_id,
            seller_id: payout.seller_id,
            amount: payout.amount,
            fee: 0,
            net_amount: payout.net_amount ?? payout.amount,
            momo_number: payout.momo_number ?? null,
            network: payout.momo_network ?? null,
            status: payout.status,
            failure_reason: payout.failure_reason ?? null,
            created_at: toIso(payout.created_at),
            processed_at: toIso(payout.processed_at),
            order: order
              ? { id: order._id, amount: order.amount, status: order.status }
              : undefined,
          };
        }),
    };
  },
});

export const history = query({
  args: { limit: v.optional(v.number()), offset: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    await requireProfile(ctx, userId);

    const limit = Math.min(100, Math.max(1, args.limit ?? 20));
    const offset = Math.max(0, args.offset ?? 0);

    const payouts = await ctx.db
      .query("payouts")
      .withIndex("by_seller", (q) => q.eq("seller_id", userId))
      .collect();

    const sorted = payouts.sort((a, b) => (b.created_at ?? 0) - (a.created_at ?? 0));
    const page = sorted.slice(offset, offset + limit);

    return {
      payouts: page.map((payout) => ({
        id: payout._id,
        user_id: payout.seller_id,
        seller_id: payout.seller_id,
        amount: payout.amount,
        fee: 0,
        net_amount: payout.net_amount ?? payout.amount,
        momo_number: payout.momo_number ?? null,
        network: payout.momo_network ?? null,
        status: payout.status,
        failure_reason: payout.failure_reason ?? null,
        created_at: toIso(payout.created_at),
        processed_at: toIso(payout.processed_at),
      })),
      has_more: sorted.length > offset + limit,
    };
  },
});

export const adminList = query({
  handler: async (ctx) => {
    const adminId = await requireUserId(ctx);
    const admin = await requireProfile(ctx, adminId);
    if (admin.role !== "admin") throw new Error("Admin access only");

    const payouts = (await ctx.db.query("payouts").collect()).sort(
      (a, b) => (b.created_at ?? b._creationTime) - (a.created_at ?? a._creationTime)
    );
    const sellers = await Promise.all(payouts.map((payout) => ctx.db.get(payout.seller_id)));
    const orders = await Promise.all(
      payouts.map((payout) => payout.order_id ? ctx.db.get(payout.order_id) : null)
    );

    return payouts.map((payout, index) => ({
      id: payout._id,
      amount: payout.amount,
      net_amount: payout.net_amount ?? payout.amount,
      status: payout.status,
      funds_reserved: payout.funds_reserved ?? false,
      momo_number: payout.momo_number ?? sellers[index]?.momo_number ?? null,
      network: payout.momo_network ?? sellers[index]?.momo_provider ?? null,
      failure_reason: payout.failure_reason ?? null,
      transfer_reference: payout.transfer_reference ?? null,
      created_at: toIso(payout.created_at ?? payout._creationTime),
      processed_at: toIso(payout.processed_at),
      seller: {
        id: payout.seller_id,
        full_name: sellers[index]?.full_name ?? sellers[index]?.name ?? "Unknown seller",
        email: sellers[index]?.email ?? "",
      },
      order: orders[index]
        ? { id: orders[index]!._id, amount: orders[index]!.amount, status: orders[index]!.status }
        : null,
    }));
  },
});

export const recipientContext = internalQuery({
  args: { user_id: v.id("users") },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.user_id);
    if (!user || user.role === "banned") throw new Error("User profile not found");
    return {
      name: user.full_name ?? user.name ?? "White Market User",
      momo_number: user.momo_number ?? null,
      momo_provider: user.momo_provider ?? null,
    };
  },
});

export const saveRecipient = internalMutation({
  args: {
    user_id: v.id("users"),
    momo_number: v.string(),
    momo_provider: v.string(),
    recipient_code: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.user_id, {
      momo_number: args.momo_number,
      momo_provider: args.momo_provider,
      paystack_recipient_code: args.recipient_code,
      updated_at: Date.now(),
    });
  },
});

export const transferContext = internalQuery({
  args: { admin_id: v.id("users"), payout_id: v.id("payouts") },
  handler: async (ctx, args) => {
    const admin = await ctx.db.get(args.admin_id);
    if (!admin || admin.role !== "admin") throw new Error("Admin access only");
    const payout = await ctx.db.get(args.payout_id);
    if (!payout) throw new Error("Payout not found");
    if (payout.status !== "pending") throw new Error(`Payout is already ${payout.status}`);
    if (!payout.funds_reserved) throw new Error("Payout funds were not reserved; review it manually before sending");
    const seller = await ctx.db.get(payout.seller_id);
    if (!seller) throw new Error("Seller not found");
    return { payout, seller };
  },
});

export const beginTransfer = internalMutation({
  args: { admin_id: v.id("users"), payout_id: v.id("payouts") },
  handler: async (ctx, args) => {
    const admin = await ctx.db.get(args.admin_id);
    if (!admin || admin.role !== "admin") throw new Error("Admin access only");
    const payout = await ctx.db.get(args.payout_id);
    if (!payout) throw new Error("Payout not found");
    if (payout.status !== "pending") throw new Error(`Payout is already ${payout.status}`);
    if (!payout.funds_reserved) throw new Error("Payout funds were not reserved; review it manually before sending");
    const seller = await ctx.db.get(payout.seller_id);
    if (!seller) throw new Error("Seller not found");
    await ctx.db.patch(payout._id, { status: "processing" });
    return { payout: { ...payout, status: "processing" }, seller };
  },
});

export const saveSellerRecipientCode = internalMutation({
  args: { seller_id: v.id("users"), recipient_code: v.string() },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.seller_id, { paystack_recipient_code: args.recipient_code });
  },
});

export const finishTransfer = internalMutation({
  args: {
    payout_id: v.id("payouts"),
    recipient_code: v.string(),
    transfer_reference: v.string(),
  },
  handler: async (ctx, args) => {
    const payout = await ctx.db.get(args.payout_id);
    if (!payout || payout.status !== "processing") throw new Error("Payout is not processing");
    const now = Date.now();
    await ctx.db.patch(payout._id, {
      status: "processing",
      transfer_reference: args.transfer_reference,
      processed_at: now,
      paystack_recipient_code: args.recipient_code,
    });
    await ctx.db.insert("notifications", {
      user_id: payout.seller_id,
      type: "payout_sent",
      title: "Payout transfer initiated",
      body: `A transfer of GHS ${payout.amount} is processing. You will be notified when it settles.`,
      data: { payout_id: payout._id },
      read: false,
      created_at: now,
    });
  },
});

export const failTransfer = internalMutation({
  args: { payout_id: v.id("payouts"), reason: v.string() },
  handler: async (ctx, args) => {
    const payout = await ctx.db.get(args.payout_id);
    if (!payout || payout.status !== "processing") return;
    await ctx.db.patch(payout._id, {
      status: "needs_review",
      failure_reason: args.reason,
      processed_at: Date.now(),
    });
  },
});

export const applyTransferWebhook = internalMutation({
  args: {
    reference: v.string(),
    event: v.string(),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const payout = await ctx.db
      .query("payouts")
      .withIndex("by_transfer_reference", (q) => q.eq("transfer_reference", args.reference))
      .unique();
    if (!payout) return { ignored: true, reason: "Payout reference not found" };

    const now = Date.now();
    if (args.event === "transfer.success") {
      if (payout.status === "completed") return { ignored: true, reason: "Already settled" };
      if (payout.status !== "processing") return { ignored: true, reason: "Payout is not processing" };
      await ctx.db.patch(payout._id, { status: "completed", processed_at: now });
      await ctx.db.insert("notifications", {
        user_id: payout.seller_id,
        type: "payout_completed",
        title: "Payout completed",
        body: `GHS ${payout.amount} has been transferred to your mobile money.`,
        data: { payout_id: payout._id },
        read: false,
        created_at: now,
      });
      return { applied: true, status: "completed" };
    }

    if (args.event === "transfer.failed" || args.event === "transfer.reversed") {
      const alreadyReturned = payout.status === "failed" || payout.status === "reversed";
      if (alreadyReturned) return { ignored: true, reason: "Payout funds already returned" };
      if (payout.status !== "processing" && payout.status !== "completed") {
        return { ignored: true, reason: "Payout is not in a transferable state" };
      }

      if (payout.funds_reserved) {
        await creditBalance(
          ctx,
          payout.seller_id,
          payout.amount,
          "Paystack payout transfer returned",
          { id: payout._id, type: "payout" }
        );
      }
      const status = args.event === "transfer.reversed" ? "reversed" : "failed";
      await ctx.db.patch(payout._id, {
        status,
        failure_reason: args.reason ?? `Paystack event: ${args.event}`,
        processed_at: now,
      });
      await ctx.db.insert("notifications", {
        user_id: payout.seller_id,
        type: "payout_failed",
        title: status === "reversed" ? "Payout reversed" : "Payout failed",
        body: payout.funds_reserved
          ? `GHS ${payout.amount} was returned to your wallet. ${args.reason ?? ""}`.trim()
          : `The payout needs manual reconciliation. ${args.reason ?? ""}`.trim(),
        data: { payout_id: payout._id },
        read: false,
        created_at: now,
      });
      return { applied: true, status };
    }
    return { ignored: true, reason: "Unsupported Paystack event" };
  },
});

async function executeTransfer(
  ctx: ActionCtx,
  payoutId: Id<"payouts">,
  reason: string
) {
  const adminId = await requireUserId(ctx);
  const { payout, seller } = await ctx.runMutation(
    internal.functions.payouts.beginTransfer,
    { admin_id: adminId, payout_id: payoutId }
  );

  try {
    let recipientCode = payout.paystack_recipient_code ?? seller.paystack_recipient_code;
    if (!recipientCode) {
      if (!seller.momo_number || !seller.momo_provider || !isMomoNetwork(seller.momo_provider)) {
        throw new Error("Seller has no valid mobile money details on file");
      }
      const recipient = await createTransferRecipient({
        type: "mobile_money",
        name: seller.full_name ?? seller.name ?? "White Market Seller",
        accountNumber: seller.momo_number,
        bankCode: paystackBankCode(seller.momo_provider),
      });
      recipientCode = recipient.recipient_code;
      await ctx.runMutation(internal.functions.payouts.saveSellerRecipientCode, {
        seller_id: seller._id,
        recipient_code: recipientCode,
      });
    }

    const transfer = await sendTransfer({
      amount: Math.round((payout.amount ?? 0) * 100),
      recipient: recipientCode,
      reason,
    });
    await ctx.runMutation(internal.functions.payouts.finishTransfer, {
      payout_id: payoutId,
      transfer_reference: transfer.reference,
      recipient_code: recipientCode,
    });
    return transfer.reference;
  } catch (error) {
    await ctx.runMutation(internal.functions.payouts.failTransfer, {
      payout_id: payoutId,
      reason: error instanceof Error ? error.message : "Transfer failed",
    });
    throw error;
  }
}

/** Registers a mobile money number with Paystack and stores the recipient code. */
export const createRecipient = action({
  args: {
    momo_number: v.string(),
    momo_provider: v.string(),
    name: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const profile = await ctx.runQuery(internal.functions.payouts.recipientContext, { user_id: userId });
    const network = args.momo_provider.trim();
    const number = args.momo_number.trim();
    if (!isMomoNetwork(network)) throw new Error("Unsupported mobile money provider");
    if (!number) throw new Error("Mobile money number is required");
    const recipient = await createTransferRecipient({
      type: "mobile_money",
      name: args.name ?? profile.name,
      accountNumber: number,
      bankCode: paystackBankCode(network),
    });
    await ctx.runMutation(internal.functions.payouts.saveRecipient, {
      user_id: userId,
      momo_number: number,
      momo_provider: network,
      recipient_code: recipient.recipient_code,
    });
    return { message: "Mobile money details saved", recipient_code: recipient.recipient_code };
  },
});

/** Admin initiates a pending payout transfer to the seller's mobile money. */
export const send = action({
  args: { payout_id: v.id("payouts") },
  handler: async (ctx, args) => ({
    message: "Payout transfer initiated",
    transfer_id: await executeTransfer(ctx, args.payout_id, "White Market seller payout"),
  }),
});

/** Admin initiates a pending payout transfer to the seller. */
export const approve = action({
  args: { payout_id: v.id("payouts") },
  handler: async (ctx, args) => {
    const transferId = await executeTransfer(
      ctx,
      args.payout_id,
      "White Market payout approval"
    );
    return { success: true, message: "Payout transfer initiated", transfer_id: transferId };
  },
});

/** Admin rejects a pending payout and refunds the seller's balance atomically. */
export const reject = mutation({
  args: { payout_id: v.id("payouts"), reason: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const adminId = await requireUserId(ctx);
    const admin = await requireProfile(ctx, adminId);
    if (admin.role !== "admin") throw new Error("Admin access only");
    const payout = await ctx.db.get(args.payout_id);
    if (!payout) throw new Error("Payout not found");
    if (payout.status !== "pending") throw new Error(`Payout is already ${payout.status}`);

    const wallet = payout.funds_reserved
      ? await ctx.db.query("wallets")
          .withIndex("by_user", (q) => q.eq("user_id", payout.seller_id))
          .unique()
      : null;
    if (payout.funds_reserved && !wallet) {
      throw new Error("Seller wallet is missing; payout was not rejected");
    }
    const now = Date.now();
    if (wallet) {
      const balance = round2((wallet.balance ?? 0) + (payout.amount ?? 0));
      await ctx.db.patch(wallet._id, { balance, updated_at: now });
      await ctx.db.insert("wallet_transactions", {
        user_id: payout.seller_id,
        type: "refund",
        amount: payout.amount,
        description: "Payout rejection refund",
        reference_id: payout._id,
        reference_type: "payout",
        balance_after: balance,
        created_at: now,
      });
    }
    await ctx.db.patch(payout._id, {
      status: "rejected",
      failure_reason: args.reason ?? "Rejected by admin",
      processed_at: now,
    });
    await ctx.db.insert("notifications", {
      user_id: payout.seller_id,
      type: "payout_rejected",
      title: "Payout request rejected",
      body: args.reason?.trim() || "Your payout was returned to your wallet.",
      data: { payout_id: payout._id },
      read: false,
      created_at: now,
    });
    return {
      success: true,
      message: payout.funds_reserved
        ? "Payout rejected and funds returned to the seller wallet"
        : "Unreserved legacy payout rejected without a wallet credit",
    };
  },
});
