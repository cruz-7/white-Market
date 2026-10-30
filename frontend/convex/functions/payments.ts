import { v } from "convex/values";
import { internal } from "../_generated/api";
import { action, internalMutation, internalQuery, mutation } from "../_generated/server";
import { requireProfile, requireUserId } from "../lib/auth";
import { generatePaymentReference } from "../lib/ids";
import { computeCommission, creditBalance, ensureWallet, round2 } from "../lib/money";
import { initializeTransaction, verifyTransaction } from "../lib/paystack";
import { applyOrderPayment } from "./orders";
import type { Id } from "../_generated/dataModel";

type WalletTopupResult = {
  message?: string;
  paystack_status?: string;
  balance?: number;
  already_applied?: boolean;
};

type PaymentVerificationResult = {
  message: string;
  paystack_status?: string;
  order_id?: Id<"orders">;
  reference?: string;
  already_paid?: boolean;
};

/**
 * Starts a card payment with Paystack and returns the hosted checkout URL.
 */
export const orderContext = internalQuery({
  args: { order_id: v.id("orders"), user_id: v.id("users") },
  handler: async (ctx, args) => {
    const order = await ctx.db.get(args.order_id);
    const profile = await ctx.db.get(args.user_id);
    if (!order || !profile) throw new Error("Order or user profile not found");
    if (order.buyer_id !== args.user_id) throw new Error("You can only pay for your own orders");
    return { order, email: profile.email ?? "" };
  },
});

export const orderContextFromMetadata = internalQuery({
  args: { order_id: v.string(), user_id: v.id("users") },
  handler: async (ctx, args) => {
    const orderId = ctx.db.normalizeId("orders", args.order_id);
    if (!orderId) throw new Error("Could not match this transaction to an order");
    const order = await ctx.db.get(orderId);
    if (!order || order.buyer_id !== args.user_id) {
      throw new Error("Payment does not belong to this buyer");
    }
    return { order };
  },
});

export const saveOrderPaymentReference = internalMutation({
  args: { order_id: v.id("orders"), user_id: v.id("users"), reference: v.string() },
  handler: async (ctx, args) => {
    const order = await ctx.db.get(args.order_id);
    if (!order || order.buyer_id !== args.user_id) throw new Error("Order not found");
    if (order.status === "paid" || order.status === "completed") {
      throw new Error("This order has already been paid");
    }
    if (order.status === "cancelled") throw new Error("This order was cancelled");
    await ctx.db.patch(order._id, { payment_reference: args.reference, payment_method: "card", updated_at: Date.now() });
  },
});

export const walletTopupProfile = internalQuery({
  args: { user_id: v.id("users") },
  handler: async (ctx, args) => {
    const profile = await ctx.db.get(args.user_id);
    if (!profile) throw new Error("User profile not found");
    return { email: profile.email ?? "" };
  },
});

export const creditVerifiedWalletTopup = internalMutation({
  args: { user_id: v.id("users"), reference: v.string(), amount: v.number(), currency: v.string() },
  handler: async (ctx, args) => {
    if (args.currency !== "GHS" || !Number.isFinite(args.amount) || args.amount <= 0) throw new Error("Invalid wallet top-up payment");
    const transactions = await ctx.db.query("wallet_transactions").withIndex("by_user", (q) => q.eq("user_id", args.user_id)).collect();
    if (transactions.some((row) => row.reference_type === "paystack_topup" && row.reference_id === args.reference)) {
      return { message: "Wallet top-up already applied", already_applied: true };
    }
    const balance = await creditBalance(ctx, args.user_id, args.amount, "Wallet top-up via Paystack", { id: args.reference, type: "paystack_topup" });
    return { message: "Wallet topped up", balance, already_applied: false };
  },
});

export const applyWebhookPayment = internalMutation({
  args: { reference: v.string(), amount: v.number(), currency: v.string(), order_id: v.optional(v.string()), buyer_id: v.optional(v.string()), kind: v.optional(v.string()) },
  handler: async (ctx, args): Promise<WalletTopupResult & { ok?: boolean; already_paid?: boolean; order_id?: Id<"orders"> }> => {
    if (args.kind === "wallet_topup") {
      const userId = args.buyer_id ? ctx.db.normalizeId("users", args.buyer_id) : null;
      if (!userId) throw new Error("Wallet top-up webhook is missing a valid user");
      return ctx.runMutation(internal.functions.payments.creditVerifiedWalletTopup, {
        user_id: userId,
        reference: args.reference,
        amount: args.amount / 100,
        currency: args.currency,
      });
    }
    const orderId = args.order_id ? ctx.db.normalizeId("orders", args.order_id) : null;
    const buyerId = args.buyer_id ? ctx.db.normalizeId("users", args.buyer_id) : null;
    if (!orderId || !buyerId) throw new Error("Payment webhook is missing valid order metadata");
    const order = await ctx.db.get(orderId);
    if (!order || order.buyer_id !== buyerId) throw new Error("Payment does not match an order");
    if (order.payment_reference !== args.reference) throw new Error("Payment reference does not match the order");
    if (args.currency !== "GHS" || args.amount !== Math.round(order.amount * 100)) throw new Error("Payment amount or currency does not match the order");
    return applyOrderPayment(ctx, order._id, args.reference);
  },
});
export const initialize = action({
  args: { order_id: v.id("orders"), callback_url: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const context = await ctx.runQuery(internal.functions.payments.orderContext, { order_id: args.order_id, user_id: userId });
    if (context.order.status === "paid" || context.order.status === "completed") {
      throw new Error("This order has already been paid");
    }
    if (context.order.status === "cancelled") throw new Error("This order was cancelled");
    if (!(context.order.amount > 0)) throw new Error("Invalid order amount");
    const reference = generatePaymentReference(context.order._id);
    const transaction = await initializeTransaction({
      email: context.email,
      amount: Math.round(context.order.amount * 100),
      currency: "GHS",
      reference,
      callbackUrl: args.callback_url ?? process.env.PAYSTACK_CALLBACK_URL,
      metadata: { kind: "order", order_id: context.order._id, buyer_id: userId },
    });
    await ctx.runMutation(internal.functions.payments.saveOrderPaymentReference, {
      order_id: context.order._id,
      user_id: userId,
      reference: transaction.reference,
    });
    return { message: "Payment initialized", authorization_url: transaction.authorization_url, access_code: transaction.access_code, reference: transaction.reference };
  },
});

export const initializeWalletTopup = action({
  args: { amount: v.number(), callback_url: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    if (!Number.isFinite(args.amount) || args.amount <= 0 || args.amount > 100000) throw new Error("Enter a valid top-up amount (up to GHS 100,000)");
    const profile = await ctx.runQuery(internal.functions.payments.walletTopupProfile, { user_id: userId });
    const reference = `wm_topup_${Date.now()}_${generatePaymentReference(userId).slice(-8)}`;
    const transaction = await initializeTransaction({
      email: profile.email,
      amount: Math.round(args.amount * 100),
      currency: "GHS",
      reference,
      callbackUrl: args.callback_url ?? process.env.PAYSTACK_CALLBACK_URL,
      metadata: { kind: "wallet_topup", buyer_id: userId, amount: args.amount },
    });
    return { message: "Wallet top-up initialized", authorization_url: transaction.authorization_url, access_code: transaction.access_code, reference: transaction.reference };
  },
});

export const verifyWalletTopup = action({
  args: { reference: v.string() },
  handler: async (ctx, args): Promise<WalletTopupResult> => {
    const userId = await requireUserId(ctx);
    const transaction = await verifyTransaction(args.reference);
    if (transaction.reference !== args.reference) throw new Error("Payment reference mismatch");
    if (transaction.status !== "success") return { message: "Transaction not successful yet", paystack_status: transaction.status };
    if (transaction.currency !== "GHS" || transaction.metadata?.kind !== "wallet_topup") throw new Error("Invalid wallet top-up payment");
    if (transaction.metadata?.buyer_id !== userId) throw new Error("Wallet top-up belongs to another user");
    const amount = Number(transaction.metadata?.amount);
    if (!Number.isFinite(amount) || transaction.amount !== Math.round(amount * 100)) throw new Error("Payment amount does not match the requested top-up");
    return ctx.runMutation(internal.functions.payments.creditVerifiedWalletTopup, { user_id: userId, reference: transaction.reference, amount: transaction.amount / 100, currency: transaction.currency });
  },
});
/**
 * Pays for an order from the buyer's wallet balance.
 *
 * The balance check, the debit, the ledger row and the order update all happen
 * inside one Convex mutation, so the whole thing is atomic.
 */
export const walletPay = mutation({
  args: { order_id: v.id("orders") },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    await requireProfile(ctx, userId);

    const order = await ctx.db.get(args.order_id);
    if (!order) throw new Error("Order not found");
    if (order.buyer_id !== userId) {
      throw new Error("You can only pay for your own orders");
    }
    if (order.status === "paid" || order.status === "completed") {
      const wallet = await ensureWallet(ctx, userId);
      return {
        message: "This order has already been paid",
        order_id: order._id,
        balance: wallet.balance ?? 0,
      };
    }
    if (order.status === "cancelled") throw new Error("This order was cancelled");
    if (!(order.amount > 0)) throw new Error("Invalid order amount");
    const fashion = order.fashion_id ? await ctx.db.get(order.fashion_id) : null;
    if (order.fashion_id && (
      !fashion ||
      fashion.is_sold ||
      fashion.is_active === false ||
      fashion.reserved_order_id !== order._id
    )) {
      throw new Error("Fashion listing is no longer reserved for this order");
    }

    const wallet = await ensureWallet(ctx, userId);
    const balance = wallet.balance ?? 0;
    if (balance < order.amount) {
      throw new Error("Insufficient wallet balance");
    }

    const now = Date.now();
    const { commission, sellerEarning } = await computeCommission(ctx, order.amount);
    const nextBalance = round2(balance - order.amount);

    await ctx.db.patch(wallet._id, { balance: nextBalance, updated_at: now });
    await ctx.db.insert("wallet_transactions", {
      user_id: userId,
      type: "debit",
      amount: round2(order.amount),
      description: `Wallet payment for order ${order._id}`,
      reference_id: order._id,
      reference_type: "order",
      balance_after: nextBalance,
      created_at: now,
    });

    await ctx.db.patch(order._id, {
      status: "paid",
      paid_at: now,
      updated_at: now,
      payment_method: "wallet",
      commission,
      seller_earning: sellerEarning,
    });
    if (fashion) {
      await ctx.db.patch(fashion._id, {
        is_sold: true,
        is_active: false,
        reserved_order_id: undefined,
        updated_at: now,
      });
    }

    const sellerWallet = await ctx.db
      .query("wallets")
      .withIndex("by_user", (q) => q.eq("user_id", order.seller_id))
      .unique();
    if (sellerWallet) {
      const pending = round2((sellerWallet.pending_earnings ?? 0) + sellerEarning);
      await ctx.db.patch(sellerWallet._id, { pending_earnings: pending, updated_at: now });
      await ctx.db.insert("wallet_transactions", {
        user_id: order.seller_id,
        type: "pending",
        amount: sellerEarning,
        description: `Order payment - GHS ${order.amount} (${round2((commission / order.amount) * 100)}% commission applied)`,
        reference_id: order._id,
        reference_type: "order",
        balance_after: pending,
        created_at: now,
      });
    }

    await ctx.db.insert("transactions", {
      order_id: order._id,
      buyer_id: order.buyer_id,
      seller_id: order.seller_id,
      amount: order.amount,
      commission,
      seller_earning: sellerEarning,
      status: "paid",
      created_at: now,
    });

    await ctx.db.insert("notifications", {
      user_id: order.seller_id,
      type: "order_paid",
      title: "You made a sale!",
      body: `GHS ${order.amount} was paid for your listing. GHS ${sellerEarning} is pending.`,
      data: { order_id: order._id },
      read: false,
      created_at: now,
    });

    return {
      message: "Payment successful",
      order_id: order._id,
      balance: nextBalance,
    };
  },
});

export const verify = action({
  args: { reference: v.string() },
  handler: async (ctx, args): Promise<PaymentVerificationResult> => {
    const userId = await requireUserId(ctx);
    const transaction = await verifyTransaction(args.reference);
    if (transaction.reference !== args.reference) throw new Error("Payment reference mismatch");
    const orderId = typeof transaction.metadata?.order_id === "string" ? transaction.metadata.order_id : null;
    if (!orderId) throw new Error("Could not match this transaction to an order");
    const context = await ctx.runQuery(internal.functions.payments.orderContextFromMetadata, { order_id: orderId, user_id: userId });
    const order = context.order;
    if (order.payment_reference !== transaction.reference) throw new Error("Payment reference does not match the order");
    if (transaction.metadata?.buyer_id !== userId) throw new Error("Payment does not belong to this buyer");
    if (transaction.amount !== Math.round(order.amount * 100)) throw new Error("Payment amount does not match the order");
    if (transaction.currency !== "GHS") throw new Error("Payment currency does not match the order");
    if (transaction.status !== "success") return { message: "Transaction not successful yet", paystack_status: transaction.status, order_id: order._id };
    const result = await ctx.runMutation(internal.functions.payments.applyWebhookPayment, {
      reference: transaction.reference, order_id: order._id, buyer_id: userId,
      amount: transaction.amount, currency: transaction.currency, kind: "order",
    });
    return { message: "Payment verified", order_id: order._id, reference: transaction.reference, already_paid: result.already_paid };
  },
});