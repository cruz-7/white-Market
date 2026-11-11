import { v } from "convex/values";
import { internalMutation, mutation, query } from "../_generated/server";
import type { MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { requireProfile, requireUserId, requireVerifiedStudent } from "../lib/auth";
import { orderShape } from "../lib/shapes";
import { computeCommission, round2 } from "../lib/money";
import { processBuyerReferralQualification } from "./referrals";

export const create = mutation({
  args: {
    product_id: v.optional(v.id("products")),
    fashion_id: v.optional(v.id("fashion")),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    await requireVerifiedStudent(ctx, userId);

    if (!!args.product_id === !!args.fashion_id) {
      throw new Error("An order must contain exactly one marketplace listing");
    }

    const product = args.product_id ? await ctx.db.get(args.product_id) : null;
    const fashion = args.fashion_id ? await ctx.db.get(args.fashion_id) : null;
    const listing = product ?? fashion;
    if (!listing) throw new Error("Listing not found");
    if (listing.seller_id === userId) throw new Error("You cannot order your own listing");
    if (listing.is_active === false) throw new Error("This listing is no longer available");
    if (fashion?.is_sold) throw new Error("This fashion item has already been sold");
    if (fashion?.reserved_order_id) {
      const reservedOrder = await ctx.db.get(fashion.reserved_order_id);
      if (reservedOrder && !["cancelled", "paid", "completed"].includes(reservedOrder.status)) {
        throw new Error("This fashion item is already reserved by another pending order");
      }
    }

    const now = Date.now();
    const orderId = await ctx.db.insert("orders", {
      product_id: args.product_id,
      fashion_id: args.fashion_id,
      buyer_id: userId,
      seller_id: listing.seller_id,
      amount: listing.price,
      item_amount: listing.price,
      delivery_fee: 0,
      delivery_method: "campus_pickup",
      delivery_status: "campus_pickup",
      status: "pending",
      created_at: now,
      updated_at: now,
    });

    if (fashion) {
      await ctx.db.patch(fashion._id, { reserved_order_id: orderId, updated_at: now });
    }
    return { message: "Order created", order_id: orderId, amount: listing.price };
  },
});

export const myOrders = query({
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    const orders = await ctx.db
      .query("orders")
      .withIndex("by_buyer", (q) => q.eq("buyer_id", userId))
      .collect();

    const productIds = [...new Set(orders.flatMap((order) => order.product_id ? [order.product_id] : []))];
    const fashionIds = [...new Set(orders.flatMap((order) => order.fashion_id ? [order.fashion_id] : []))];
    const products = await Promise.all(productIds.map((id) => ctx.db.get(id)));
    const fashionItems = await Promise.all(fashionIds.map((id) => ctx.db.get(id)));
    const productById = new Map(products.filter(Boolean).map((item) => [item!._id, item!]));
    const fashionById = new Map(fashionItems.filter(Boolean).map((item) => [item!._id, item!]));

    return orders
      .sort((a, b) => (b.created_at ?? 0) - (a.created_at ?? 0))
      .map((order) =>
        orderShape(
          order,
          order.product_id ? (productById.get(order.product_id) ?? null) : null,
          order.fashion_id ? (fashionById.get(order.fashion_id) ?? null) : null
        )
      );
  },
});

export const sales = query({
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    const orders = await ctx.db
      .query("orders")
      .withIndex("by_seller", (q) => q.eq("seller_id", userId))
      .collect();

    const productIds = [...new Set(orders.flatMap((order) => order.product_id ? [order.product_id] : []))];
    const fashionIds = [...new Set(orders.flatMap((order) => order.fashion_id ? [order.fashion_id] : []))];
    const products = await Promise.all(productIds.map((id) => ctx.db.get(id)));
    const fashionItems = await Promise.all(fashionIds.map((id) => ctx.db.get(id)));
    const productById = new Map(products.filter(Boolean).map((item) => [item!._id, item!]));
    const fashionById = new Map(fashionItems.filter(Boolean).map((item) => [item!._id, item!]));

    return orders
      .sort((a, b) => (b.created_at ?? 0) - (a.created_at ?? 0))
      .map((order) =>
        orderShape(
          order,
          order.product_id ? (productById.get(order.product_id) ?? null) : null,
          order.fashion_id ? (fashionById.get(order.fashion_id) ?? null) : null
        )
      );
  },
});

export const get = query({
  args: { id: v.id("orders") },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const profile = await requireProfile(ctx, userId);

    const order = await ctx.db.get(args.id);
    if (!order) throw new Error("Order not found");
    if (order.buyer_id !== userId && order.seller_id !== userId && profile.role !== "admin") {
      throw new Error("Not authorized to view this order");
    }

    const product = order.product_id ? await ctx.db.get(order.product_id) : null;
    const fashion = order.fashion_id ? await ctx.db.get(order.fashion_id) : null;
    const buyer = await ctx.db.get(order.buyer_id);
    const seller = await ctx.db.get(order.seller_id);

    return {
      ...orderShape(order, product, fashion),
      buyer: { full_name: buyer?.full_name ?? buyer?.name ?? "" },
      seller: { full_name: seller?.full_name ?? seller?.name ?? "" },
    };
  },
});

/** Only "cancelled" can be set by a participant, and only on a live order. */
export const updateStatus = mutation({
  args: { id: v.id("orders"), status: v.string() },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const profile = await requireProfile(ctx, userId);

    if (args.status !== "cancelled") {
      throw new Error("Only cancellation is allowed through this action");
    }

    const order = await ctx.db.get(args.id);
    if (!order) throw new Error("Order not found");
    if (order.buyer_id !== userId && order.seller_id !== userId) {
      throw new Error("Not authorized to update this order");
    }
    if (["cancelled", "paid", "completed", "disputed"].includes(order.status)) {
      throw new Error(`Cannot cancel an order that is already ${order.status}`);
    }

    await ctx.db.patch(args.id, {
      status: "cancelled",
      updated_at: Date.now(),
    });

    const delivery = await ctx.db.query("deliveries").withIndex("by_order", (q) => q.eq("order_id", args.id)).first();
    if (delivery && delivery.status === "awaiting_rider") {
      const now = Date.now();
      await ctx.db.patch(delivery._id, { status: "cancelled", updated_at: now });
      await ctx.db.insert("delivery_events", {
        delivery_id: delivery._id,
        order_id: order._id,
        actor_id: userId,
        actor_role: order.buyer_id === userId ? "buyer" : "seller",
        event: "delivery_cancelled",
        created_at: now,
      });
    }

    const updated = await ctx.db.get(args.id);
    const product = updated?.product_id ? await ctx.db.get(updated.product_id) : null;
    const fashion = updated?.fashion_id ? await ctx.db.get(updated.fashion_id) : null;
    if (fashion?.reserved_order_id === args.id) {
      await ctx.db.patch(fashion._id, { reserved_order_id: undefined, updated_at: Date.now() });
    }
    return { message: "Order cancelled", order: updated ? orderShape(updated, product, fashion) : null };
  },
});

/**
 * Buyer confirms they received the item. This is the point where the seller's
 * pending earnings become withdrawable.
 */
export const complete = mutation({
  args: { id: v.id("orders") },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    await requireProfile(ctx, userId);
    const delivery = await ctx.db.query("deliveries").withIndex("by_order", (q) => q.eq("order_id", args.id)).first();
    if (delivery) throw new Error("Confirm delivery receipt from the delivery tracker");
    return completePaidOrder(ctx, args.id, userId);
  },
});

export async function completePaidOrder(
  ctx: MutationCtx,
  orderId: Id<"orders">,
  buyerId: Id<"users">
) {
  const order = await ctx.db.get(orderId);
  if (!order) throw new Error("Order not found");
  if (order.buyer_id !== buyerId) throw new Error("Only the buyer can complete this order");
  if (order.status !== "paid") throw new Error("Only a paid order can be completed");

  const now = Date.now();
  const commissionBase = order.item_amount ?? Math.max(0, order.amount - (order.delivery_fee ?? 0));
  const defaultCommission = await computeCommission(ctx, commissionBase);
  const commission = order.commission ?? defaultCommission.commission;
  const sellerEarning = order.seller_earning ?? defaultCommission.sellerEarning;
  await ctx.db.patch(orderId, {
    status: "completed", completed_at: now, updated_at: now, commission, seller_earning: sellerEarning,
  });

  const wallet = await ctx.db.query("wallets").withIndex("by_user", (q) => q.eq("user_id", order.seller_id)).unique();
  if (wallet) {
    const balance = (wallet.balance ?? 0) + sellerEarning;
    await ctx.db.patch(wallet._id, { balance, updated_at: now });
    await ctx.db.insert("wallet_transactions", {
      user_id: order.seller_id, type: "credit", amount: sellerEarning,
      description: `Order completed - GHS ${sellerEarning} (${round2((commission / Math.max(commissionBase, 0.01)) * 100)}% commission applied)`,
      reference_id: order._id, reference_type: "order", balance_after: balance, created_at: now,
    });
  }

  const seller = await ctx.db.get(order.seller_id);
  if (seller) {
    await ctx.db.patch(seller._id, {
      total_sales: (seller.total_sales ?? 0) + 1,
      successful_transactions: (seller.successful_transactions ?? 0) + 1,
      last_sale_at: now,
    });
    await ctx.db.insert("notifications", {
      user_id: order.seller_id, type: "order_completed", title: "Order completed",
      body: `Your sale of GHS ${commissionBase} is complete. GHS ${sellerEarning} is now available to withdraw.`,
      data: { order_id: order._id }, read: false, created_at: now,
    });
  }
  const updated = await ctx.db.get(orderId);
  return { message: "Order completed", order: updated ? orderShape(updated) : null, seller_amount: sellerEarning, commission };
}

export const completeForDelivery = internalMutation({
  args: { order_id: v.id("orders"), buyer_id: v.id("users") },
  handler: async (ctx, args) => completePaidOrder(ctx, args.order_id, args.buyer_id),
});

export const createDispute = mutation({
  args: { id: v.id("orders"), reason: v.string(), description: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    await requireProfile(ctx, userId);

    const order = await ctx.db.get(args.id);
    if (!order) throw new Error("Order not found");
    if (order.buyer_id !== userId && order.seller_id !== userId) {
      throw new Error("Not authorized to dispute this order");
    }
    if (order.status !== "paid" && order.status !== "completed") {
      throw new Error("Only a paid order can be disputed");
    }

    const existing = await ctx.db
      .query("disputes")
      .withIndex("by_order", (q) => q.eq("order_id", args.id))
      .first();
    if (existing) throw new Error("A dispute already exists for this order");

    const now = Date.now();
    const disputeId = await ctx.db.insert("disputes", {
      order_id: args.id,
      raised_by: userId,
      reason: args.reason,
      description: args.description,
      status: "open",
      previous_order_status: order.status,
      created_at: now,
      updated_at: now,
    });

    await ctx.db.patch(args.id, { status: "disputed", updated_at: now });
    const delivery = await ctx.db.query("deliveries").withIndex("by_order", (q) => q.eq("order_id", args.id)).first();
    if (delivery && !["completed", "cancelled"].includes(delivery.status)) {
      await ctx.db.patch(delivery._id, { status: "disputed", updated_at: now });
      await ctx.db.insert("delivery_events", {
        delivery_id: delivery._id, order_id: order._id, actor_id: userId,
        actor_role: order.buyer_id === userId ? "buyer" : "seller",
        event: "order_disputed", note: args.reason, created_at: now,
      });
    }

    for (const participant of [order.buyer_id, order.seller_id]) {
      await ctx.db.insert("notifications", {
        user_id: participant,
        type: "dispute_opened",
        title: "Dispute opened",
        body: `A dispute was opened for order ${args.id}.`,
        data: { order_id: args.id, dispute_id: disputeId },
        read: false,
        created_at: now,
      });
    }

    const dispute = await ctx.db.get(disputeId);
    return { message: "Dispute created", dispute };
  },
});

export const getDispute = query({
  args: { id: v.id("orders") },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const profile = await requireProfile(ctx, userId);

    const order = await ctx.db.get(args.id);
    if (!order) throw new Error("Order not found");
    if (order.buyer_id !== userId && order.seller_id !== userId && profile.role !== "admin") {
      throw new Error("Not authorized to view this dispute");
    }

    const dispute = await ctx.db
      .query("disputes")
      .withIndex("by_order", (q) => q.eq("order_id", args.id))
      .first();

    return { dispute: dispute ?? null };
  },
});

/**
 * Marks an order paid and credits the seller. Called by the payment
 * verification action and by the Paystack webhook.
 */
export async function applyOrderPayment(
  ctx: MutationCtx,
  orderId: Id<"orders">,
  paymentReference?: string
) {
  const order = await ctx.db.get(orderId);
  if (!order) throw new Error("Order not found");
  if (order.status === "paid" || order.status === "completed") {
    return { ok: true, already_paid: true, order_id: orderId };
  }
  if (order.status === "cancelled") {
    throw new Error("Cancelled order cannot be marked paid");
  }
  const fashion = order.fashion_id ? await ctx.db.get(order.fashion_id) : null;
  if (order.fashion_id && (
    !fashion ||
    fashion.is_sold ||
    fashion.is_active === false ||
    fashion.reserved_order_id !== order._id
  )) {
    throw new Error("Fashion listing is no longer reserved for this order");
  }

  const now = Date.now();
  const commissionBase = order.item_amount ?? Math.max(0, order.amount - (order.delivery_fee ?? 0));
  const { commission, sellerEarning } = await computeCommission(ctx, commissionBase);

  await ctx.db.patch(orderId, {
    status: "paid",
    paid_at: now,
    updated_at: now,
    commission,
    seller_earning: sellerEarning,
    payment_reference: paymentReference ?? order.payment_reference,
  });

  const wallet = await ctx.db
    .query("wallets")
    .withIndex("by_user", (q) => q.eq("user_id", order.seller_id))
    .unique();

  if (wallet) {
    const pending = (wallet.pending_earnings ?? 0) + sellerEarning;
    await ctx.db.patch(wallet._id, { pending_earnings: pending, updated_at: now });
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

  const delivery = await ctx.db.query("deliveries")
    .withIndex("by_order", (q) => q.eq("order_id", order._id)).first();
  const itemAmount = order.item_amount ?? Math.max(0, order.amount - (order.delivery_fee ?? 0));
  const deliveryFee = order.delivery_fee ?? 0;
  const riderCompensation = delivery?.rider_compensation ?? 0;
  const transportCost = delivery?.transport_cost ?? 0;
  await ctx.db.insert("transactions", {
    order_id: order._id,
    buyer_id: order.buyer_id,
    seller_id: order.seller_id,
    amount: order.amount,
    item_amount: itemAmount,
    delivery_fee: deliveryFee,
    rider_compensation: riderCompensation,
    transport_cost: transportCost,
    delivery_margin: round2(Math.max(0, deliveryFee - riderCompensation - transportCost)),
    commission,
    seller_earning: sellerEarning,
    status: "paid",
    payment_reference: paymentReference ?? order.payment_reference,
    created_at: now,
  });

  const product = order.product_id ? await ctx.db.get(order.product_id) : null;
  if (product) {
    await ctx.db.patch(product._id, {
      purchase_count: (product.purchase_count ?? 0) + 1,
    });
  }
  if (fashion) {
    await ctx.db.patch(fashion._id, {
      is_sold: true,
      is_active: false,
      reserved_order_id: undefined,
      updated_at: now,
    });
  }

  await ctx.db.insert("notifications", {
    user_id: order.buyer_id,
    type: "order_paid",
    title: "Payment successful",
    body: `Your payment of GHS ${order.amount} was received.`,
    data: { order_id: order._id },
    read: false,
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

  // A first purchase qualifies the buyer for referral rewards.
  await processBuyerReferralQualification(ctx, order.buyer_id);

  return { ok: true, already_paid: false, order_id: orderId, commission, seller_earning: sellerEarning };
}

/**
 * Internal entry point for settling a payment. Called by the Paystack webhook
 * HTTP action, which cannot call plain functions directly.
 */
export const applyPaymentInternal = internalMutation({
  args: { orderId: v.id("orders"), paymentReference: v.optional(v.string()) },
  handler: async (ctx, args) => {
    return applyOrderPayment(ctx, args.orderId, args.paymentReference);
  },
});
