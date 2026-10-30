import { v } from "convex/values";
import { mutation, query } from "../_generated/server";
import { requireProfile, requireUserId } from "../lib/auth";
import { dayKey, monthKey, weekKey } from "../lib/ids";
import {
  DEFAULT_PAYOUT_COOLDOWN_HOURS,
  DEFAULT_WITHDRAWAL_PERCENTAGE,
  getNumericSetting,
  MIN_WITHDRAWAL,
  round2,
} from "../lib/money";
import { toIso } from "../lib/shapes";

async function assertAdmin(ctx: any) {
  const userId = await requireUserId(ctx);
  const admin = await requireProfile(ctx, userId);
  if (admin.role !== "admin") throw new Error("Admin access only");
  return admin;
}

export const disputes = query({
  handler: async (ctx) => {
    await assertAdmin(ctx);
    const all = (await ctx.db.query("disputes").collect()).sort(
      (a, b) => (b.created_at ?? b._creationTime) - (a.created_at ?? a._creationTime)
    );
    const orders = await Promise.all(all.map((dispute) => ctx.db.get(dispute.order_id)));
    const userIds = [...new Set(all.flatMap((dispute) => [dispute.raised_by]))];
    const users = await Promise.all(userIds.map((id) => ctx.db.get(id)));
    const productIds = [
      ...new Set(orders.flatMap((order) => order?.product_id ? [order.product_id] : [])),
    ];
    const products = await Promise.all(productIds.map((id) => ctx.db.get(id)));
    const userById = new Map(users.filter(Boolean).map((user) => [user!._id, user!]));
    const productById = new Map(products.filter(Boolean).map((product) => [product!._id, product!]));

    return all.map((dispute, index) => {
      const order = orders[index];
      return {
        id: dispute._id,
        order_id: dispute.order_id,
        status: dispute.status,
        reason: dispute.reason,
        description: dispute.description ?? "",
        resolution: dispute.resolution ?? "",
        created_at: toIso(dispute.created_at ?? dispute._creationTime),
        resolved_at: toIso(dispute.resolved_at),
        raised_by: {
          full_name:
            userById.get(dispute.raised_by)?.full_name ??
            userById.get(dispute.raised_by)?.name ??
            "Unknown",
          email: userById.get(dispute.raised_by)?.email ?? "",
        },
        order: order
          ? {
              amount: order.amount,
              status: order.status,
              buyer_id: order.buyer_id,
              seller_id: order.seller_id,
              product: order.product_id
                ? productById.get(order.product_id)?.title ?? "Unavailable"
                : "Unavailable",
            }
          : null,
      };
    });
  },
});

export const resolveDispute = mutation({
  args: { id: v.id("disputes"), resolution: v.string() },
  handler: async (ctx, args) => {
    const admin = await assertAdmin(ctx);
    const resolution = args.resolution.trim();
    if (!resolution) throw new Error("Enter a resolution note");

    const dispute = await ctx.db.get(args.id);
    if (!dispute) throw new Error("Dispute not found");
    if (dispute.status !== "open") throw new Error("This dispute is already closed");
    const order = await ctx.db.get(dispute.order_id);
    if (!order) throw new Error("Disputed order not found");
    if (order.status !== "disputed") throw new Error("Order is no longer marked disputed");

    const previousStatus =
      dispute.previous_order_status === "completed" || order.completed_at
        ? "completed"
        : "paid";
    const now = Date.now();
    await ctx.db.patch(dispute._id, {
      status: "resolved",
      resolution,
      resolved_by: admin._id,
      resolved_at: now,
      updated_at: now,
    });
    await ctx.db.patch(order._id, { status: previousStatus, updated_at: now });

    for (const participantId of [order.buyer_id, order.seller_id]) {
      await ctx.db.insert("notifications", {
        user_id: participantId,
        type: "dispute_resolved",
        title: "Dispute closed",
        body: resolution,
        data: { dispute_id: dispute._id, order_id: order._id },
        read: false,
        created_at: now,
      });
    }

    return { success: true, message: "Dispute recorded and closed; no money was moved" };
  },
});

export const adminSettings = query({
  handler: async (ctx) => {
    await assertAdmin(ctx);
    return {
      commission_rate: await getNumericSetting(ctx, "commission_rate", 0.1),
      min_withdrawal: await getNumericSetting(ctx, "min_withdrawal", MIN_WITHDRAWAL),
      withdrawal_percentage: await getNumericSetting(
        ctx,
        "withdrawal_percentage",
        DEFAULT_WITHDRAWAL_PERCENTAGE
      ),
      payout_cooldown_hours: await getNumericSetting(
        ctx,
        "payout_cooldown_hours",
        DEFAULT_PAYOUT_COOLDOWN_HOURS
      ),
    };
  },
});

export const updateAdminSettings = mutation({
  args: {
    commission_rate: v.number(),
    min_withdrawal: v.number(),
    withdrawal_percentage: v.number(),
    payout_cooldown_hours: v.number(),
  },
  handler: async (ctx, args) => {
    await assertAdmin(ctx);
    if (!Number.isFinite(args.commission_rate) || args.commission_rate < 0 || args.commission_rate > 1) {
      throw new Error("Commission rate must be between 0% and 100%");
    }
    if (!Number.isFinite(args.min_withdrawal) || args.min_withdrawal <= 0) {
      throw new Error("Minimum withdrawal must be greater than zero");
    }
    if (!Number.isFinite(args.withdrawal_percentage) || args.withdrawal_percentage < 0 || args.withdrawal_percentage > 1) {
      throw new Error("Withdrawal percentage must be between 0% and 100%");
    }
    if (!Number.isFinite(args.payout_cooldown_hours) || args.payout_cooldown_hours < 0 || args.payout_cooldown_hours > 720) {
      throw new Error("Payout cooldown must be between 0 and 720 hours");
    }

    const values = {
      commission_rate: args.commission_rate,
      min_withdrawal: args.min_withdrawal,
      withdrawal_percentage: args.withdrawal_percentage,
      payout_cooldown_hours: args.payout_cooldown_hours,
    };
    for (const [key, value] of Object.entries(values)) {
      const existing = await ctx.db
        .query("system_settings")
        .withIndex("by_key", (q) => q.eq("key", key))
        .unique();
      if (existing) {
        await ctx.db.patch(existing._id, { value: String(value) });
      } else {
        await ctx.db.insert("system_settings", { key, value: String(value) });
      }
    }
    return values;
  },
});

export const stats = query({
  handler: async (ctx) => {
    await assertAdmin(ctx);

    const users = await ctx.db.query("users").collect();
    const products = await ctx.db.query("products").collect();
    const orders = await ctx.db.query("orders").collect();

    const paid = orders.filter((order) => order.status === "paid" || order.status === "completed");
    const totalRevenue = paid.reduce((sum, order) => sum + (order.amount ?? 0), 0);
    const commission = paid.reduce((sum, order) => sum + (order.commission ?? 0), 0);

    return {
      users: users.length,
      products: products.length,
      orders: orders.length,
      totalUsers: users.length,
      totalProducts: products.length,
      totalOrders: orders.length,
      totalRevenue: round2(totalRevenue),
      commission: round2(commission),
    };
  },
});

export const users = query({
  handler: async (ctx) => {
    await assertAdmin(ctx);
    const all = await ctx.db.query("users").collect();
    return all
      .sort((a, b) => (b.created_at ?? b._creationTime) - (a.created_at ?? a._creationTime))
      .map((user) => ({
        id: user._id,
        full_name: user.full_name ?? user.name ?? "",
        email: user.email ?? "",
        role: user.role ?? "user",
        verified: user.verified ?? false,
        created_at: toIso(user.created_at ?? user._creationTime),
      }));
  },
});

export const products = query({
  handler: async (ctx) => {
    await assertAdmin(ctx);

    const all = await ctx.db.query("products").collect();
    const sellerIds = [...new Set(all.map((p) => p.seller_id))];
    const categoryIds = [
      ...new Set(all.map((p) => p.category_id).filter((id): id is NonNullable<typeof id> => !!id)),
    ];

    const sellers = await Promise.all(sellerIds.map((id) => ctx.db.get(id)));
    const categories = await Promise.all(categoryIds.map((id) => ctx.db.get(id)));
    const sellerById = new Map(sellers.filter(Boolean).map((s) => [s!._id, s!]));
    const categoryById = new Map(categories.filter(Boolean).map((c) => [c!._id, c!]));

    return all
      .sort((a, b) => (b.created_at ?? b._creationTime) - (a.created_at ?? a._creationTime))
      .map((product) => ({
        id: product._id,
        seller_id: product.seller_id,
        title: product.title,
        description: product.description,
        price: product.price,
        image_url: product.image_url,
        category_id: product.category_id,
        category: product.category ?? categoryById.get(product.category_id!)?.name ?? null,
        is_active: product.is_active ?? true,
        stock_quantity: product.stock_quantity,
        view_count: product.view_count ?? 0,
        created_at: toIso(product.created_at ?? product._creationTime),
        seller: sellerById.get(product.seller_id)
          ? {
              id: product.seller_id,
              full_name:
                sellerById.get(product.seller_id)!.full_name ??
                sellerById.get(product.seller_id)!.name ??
                "",
              email: sellerById.get(product.seller_id)!.email ?? "",
            }
          : undefined,
      }));
  },
});

export const orders = query({
  handler: async (ctx) => {
    await assertAdmin(ctx);

    const all = await ctx.db.query("orders").collect();
    const productIds = [
      ...new Set(all.map((o) => o.product_id).filter((id): id is NonNullable<typeof id> => !!id)),
    ];
    const products = await Promise.all(productIds.map((id) => ctx.db.get(id)));
    const productById = new Map(products.filter(Boolean).map((p) => [p!._id, p!]));
    const userIds = [...new Set(all.flatMap((order) => [order.buyer_id, order.seller_id]))];
    const users = await Promise.all(userIds.map((id) => ctx.db.get(id)));
    const userById = new Map(users.filter(Boolean).map((user) => [user!._id, user!]));

    return all
      .sort((a, b) => (b.created_at ?? b._creationTime) - (a.created_at ?? a._creationTime))
      .map((order) => ({
        id: order._id,
        product_id: order.product_id,
        buyer_id: order.buyer_id,
        seller_id: order.seller_id,
        amount: order.amount,
        commission: order.commission ?? 0,
        status: order.status,
        created_at: toIso(order.created_at ?? order._creationTime),
        paid_at: toIso(order.paid_at),
        product: order.product_id
          ? {
              title: productById.get(order.product_id)?.title ?? "",
              image_url: productById.get(order.product_id)?.image_url ?? "",
            }
          : undefined,
        buyer: {
          full_name:
            userById.get(order.buyer_id)?.full_name ??
            userById.get(order.buyer_id)?.name ??
            "",
          email: userById.get(order.buyer_id)?.email ?? "",
        },
        seller: {
          full_name:
            userById.get(order.seller_id)?.full_name ??
            userById.get(order.seller_id)?.name ??
            "",
          email: userById.get(order.seller_id)?.email ?? "",
        },
      }));
  },
});

export const dashboardStats = query({
  handler: async (ctx) => {
    await assertAdmin(ctx);

    const now = Date.now();
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const startOfWeek = new Date(startOfToday);
    startOfWeek.setDate(startOfWeek.getDate() - 7);
    const startOfPreviousWeek = new Date(startOfWeek);
    startOfPreviousWeek.setDate(startOfPreviousWeek.getDate() - 7);
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);
    const startOfLastMonth = new Date(startOfMonth);
    startOfLastMonth.setMonth(startOfLastMonth.getMonth() - 1);

    const users = await ctx.db.query("users").collect();
    const orders = await ctx.db.query("orders").collect();
    const products = await ctx.db.query("products").collect();
    const referrals = await ctx.db.query("referrals").collect();

    const paidOrders = orders.filter((o) => o.status === "paid" || o.status === "completed");
    const revenueThisMonth = paidOrders
      .filter((o) => (o.paid_at ?? o.created_at ?? o._creationTime) >= startOfMonth.getTime())
      .reduce((sum, o) => sum + (o.commission ?? 0), 0);
    const revenueLastMonth = paidOrders
      .filter((o) => {
        const at = o.paid_at ?? o.created_at ?? o._creationTime;
        return at >= startOfLastMonth.getTime() && at < startOfMonth.getTime();
      })
      .reduce((sum, o) => sum + (o.commission ?? 0), 0);

    const newToday = users.filter((u) => (u.created_at ?? u._creationTime) >= startOfToday.getTime()).length;
    const newThisWeek = users.filter((u) => (u.created_at ?? u._creationTime) >= startOfWeek.getTime()).length;
    const newLastWeek = users.filter((u) => {
      const createdAt = u.created_at ?? u._creationTime;
      return createdAt >= startOfPreviousWeek.getTime() && createdAt < startOfWeek.getTime();
    }).length;

    const percentChange = (current: number, previous: number) =>
      previous > 0
        ? round2(((current - previous) / previous) * 100)
        : current > 0
          ? 100
          : 0;

    return {
      users: {
        total: users.length,
        active: users.filter((u) => u.role !== "banned").length,
        newToday,
        newThisWeek,
      },
      orders: {
        total: orders.length,
        pending: orders.filter((o) => o.status === "pending").length,
        completed: paidOrders.length,
        cancelled: orders.filter((o) => o.status === "cancelled").length,
        revenue: round2(paidOrders.reduce((sum, o) => sum + (o.commission ?? 0), 0)),
      },
      products: {
        total: products.length,
        active: products.filter((p) => p.is_active !== false).length,
        pending: products.filter((p) => p.is_active === false).length,
      },
      revenue: {
        total: round2(paidOrders.reduce((sum, o) => sum + (o.commission ?? 0), 0)),
        thisMonth: round2(revenueThisMonth),
        lastMonth: round2(revenueLastMonth),
        averageOrder: paidOrders.length
          ? round2(paidOrders.reduce((sum, o) => sum + (o.commission ?? 0), 0) / paidOrders.length)
          : 0,
      },
      referrals: {
        total: referrals.length,
        qualified: referrals.filter((r) => r.status === "qualified").length,
        creditsIssued: round2(
          users.reduce((sum, u) => sum + (u.total_referral_credits ?? 0), 0)
        ),
      },
      growth: {
        userGrowth: percentChange(newThisWeek, newLastWeek),
        orderGrowth: percentChange(
          orders.filter((o) => (o.created_at ?? o._creationTime) >= startOfMonth.getTime()).length,
          orders.filter((o) => {
            const at = o.created_at ?? o._creationTime;
            return at >= startOfLastMonth.getTime() && at < startOfMonth.getTime();
          }).length
        ),
        revenueGrowth: percentChange(revenueThisMonth, revenueLastMonth),
      },
    };
  },
});

export const systemHealth = query({
  handler: async (ctx) => {
    await assertAdmin(ctx);

    const start = Date.now();
    await ctx.db.query("users").take(1);
    const responseTime = Date.now() - start;

    return {
      status: "healthy",
      database: { connected: true, responseTime },
    };
  },
});

export const activity = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    await assertAdmin(ctx);
    const limit = Math.min(100, Math.max(1, args.limit ?? 20));

    const orders = (await ctx.db.query("orders").collect())
      .sort((a, b) => (b.created_at ?? b._creationTime) - (a.created_at ?? a._creationTime))
      .slice(0, limit)
      .map((order) => ({
        id: order._id,
        type: "order",
        text: `Order for GHS ${order.amount} (${order.status})`,
        time: toIso(order.created_at ?? order._creationTime),
        severity: order.status === "cancelled" ? "warning" : "info",
      }));

    const users = (await ctx.db.query("users").collect())
      .sort((a, b) => (b.created_at ?? b._creationTime) - (a.created_at ?? a._creationTime))
      .slice(0, limit)
      .map((user) => ({
        id: user._id,
        type: "user",
        text: `${user.full_name ?? user.name ?? "New user"} joined`,
        time: toIso(user.created_at ?? user._creationTime),
        severity: "info",
      }));

    const products = (await ctx.db.query("products").collect())
      .sort((a, b) => (b.created_at ?? b._creationTime) - (a.created_at ?? a._creationTime))
      .slice(0, limit)
      .map((product) => ({
        id: product._id,
        type: "product",
        text: `${product.title} was listed`,
        time: toIso(product.created_at ?? product._creationTime),
        severity: "info",
      }));

    return [...orders, ...users, ...products]
      .sort((a, b) => (b.time ?? "").localeCompare(a.time ?? ""))
      .slice(0, limit);
  },
});

export const topSellers = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    await assertAdmin(ctx);
    const limit = Math.min(50, Math.max(1, args.limit ?? 10));

    const users = (await ctx.db.query("users").collect())
      .filter((user) => user.role === "seller");
    const orders = await ctx.db.query("orders").collect();
    const products = await ctx.db.query("products").collect();

    return users
      .map((seller) => {
        const sellerOrders = orders.filter(
          (order) =>
            order.seller_id === seller._id &&
            (order.status === "paid" || order.status === "completed")
        );
        return {
          id: seller._id,
          name: seller.seller_display_name ?? seller.full_name ?? seller.name ?? "",
          orders: sellerOrders.length,
          revenue: round2(sellerOrders.reduce((sum, o) => sum + (o.amount ?? 0), 0)),
          products: products.filter((p) => p.seller_id === seller._id).length,
        };
      })
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, limit);
  },
});

export const revenueAnalytics = query({
  args: { period: v.optional(v.string()) },
  handler: async (ctx) => {
    await assertAdmin(ctx);

    const paid = (await ctx.db.query("orders").collect()).filter(
      (order) => order.status === "paid" || order.status === "completed"
    );

    const group = (keyFn: (timestamp: number) => string) => {
      const totals = new Map<string, { revenue: number; gmv: number }>();
      for (const order of paid) {
        const at = order.paid_at ?? order.created_at ?? order._creationTime;
        const key = keyFn(at);
        const total = totals.get(key) ?? { revenue: 0, gmv: 0 };
        total.revenue += order.commission ?? 0;
        total.gmv += order.amount ?? 0;
        totals.set(key, total);
      }
      return [...totals.entries()]
        .map(([period, totals]) => ({
          period,
          revenue: round2(totals.revenue),
          gmv: round2(totals.gmv),
        }))
        .sort((a, b) => a.period.localeCompare(b.period));
    };

    return {
      daily: group(dayKey),
      weekly: group(weekKey),
      monthly: group(monthKey),
    };
  },
});

export const userAnalytics = query({
  handler: async (ctx) => {
    await assertAdmin(ctx);
    const users = await ctx.db.query("users").collect();

    const byMonth = new Map<string, number>();
    const byRole = new Map<string, number>();
    let verified = 0;
    let unverified = 0;

    for (const user of users) {
      const key = monthKey(user.created_at ?? user._creationTime);
      byMonth.set(key, (byMonth.get(key) ?? 0) + 1);
      const role = user.role ?? "user";
      byRole.set(role, (byRole.get(role) ?? 0) + 1);
      if (user.verified) verified += 1;
      else unverified += 1;
    }

    return {
      registrations: [...byMonth.entries()]
        .map(([month, count]) => ({ month, count }))
        .sort((a, b) => a.month.localeCompare(b.month)),
      byRole: [...byRole.entries()].map(([role, count]) => ({ role, count })),
      byVerification: { verified, unverified },
    };
  },
});

export const setUserRole = mutation({
  args: { id: v.id("users"), role: v.string() },
  handler: async (ctx, args) => {
    const admin = await assertAdmin(ctx);
    if (!["user", "seller", "admin", "banned"].includes(args.role)) {
      throw new Error("Invalid role");
    }
    if (args.id === admin._id && args.role !== "admin") {
      throw new Error("You cannot remove your own admin role");
    }
    await ctx.db.patch(args.id, { role: args.role, updated_at: Date.now() });
    return { message: "User role updated" };
  },
});

export const banUser = mutation({
  args: { id: v.id("users") },
  handler: async (ctx, args) => {
    const admin = await assertAdmin(ctx);
    if (args.id === admin._id) throw new Error("You cannot ban yourself");
    await ctx.db.patch(args.id, { role: "banned", updated_at: Date.now() });
    return { message: "User banned" };
  },
});

export const unbanUser = mutation({
  args: { id: v.id("users") },
  handler: async (ctx, args) => {
    await assertAdmin(ctx);
    await ctx.db.patch(args.id, { role: "user", updated_at: Date.now() });
    return { message: "User unbanned" };
  },
});

export const setOrderStatus = mutation({
  args: { id: v.id("orders"), status: v.string() },
  handler: async (ctx, args) => {
    await assertAdmin(ctx);
    if (!["pending", "paid", "cancelled"].includes(args.status)) {
      throw new Error("Invalid order status");
    }
    await ctx.db.patch(args.id, {
      status: args.status,
      paid_at: args.status === "paid" ? Date.now() : undefined,
      updated_at: Date.now(),
    });
    const order = await ctx.db.get(args.id);
    return { message: "Order status updated", order };
  },
});

export const bulkUsers = mutation({
  args: {
    userIds: v.array(v.id("users")),
    action: v.string(),
  },
  handler: async (ctx, args) => {
    const admin = await assertAdmin(ctx);
    if (!["ban", "unban", "verify"].includes(args.action)) {
      throw new Error("Invalid action");
    }

    let updated = 0;
    for (const id of args.userIds) {
      if (id === admin._id) continue;
      if (args.action === "ban") {
        await ctx.db.patch(id, { role: "banned", updated_at: Date.now() });
        updated += 1;
      } else if (args.action === "unban") {
        await ctx.db.patch(id, { role: "user", updated_at: Date.now() });
        updated += 1;
      } else {
        await ctx.db.patch(id, { verified: true, updated_at: Date.now() });
        updated += 1;
      }
    }

    return { message: `Updated ${updated} user(s)`, updated };
  },
});

export const bulkProducts = mutation({
  args: {
    productIds: v.array(v.id("products")),
    action: v.string(),
  },
  handler: async (ctx, args) => {
    await assertAdmin(ctx);
    if (!["approve", "reject", "delete"].includes(args.action)) {
      throw new Error("Invalid action");
    }

    let updated = 0;
    for (const id of args.productIds) {
      if (args.action === "delete") {
        await ctx.db.delete(id);
        updated += 1;
      } else {
        await ctx.db.patch(id, {
          is_active: args.action === "approve",
          updated_at: Date.now(),
        });
        updated += 1;
      }
    }

    return { message: `Updated ${updated} product(s)`, updated };
  },
});

export const freezeWallet = mutation({
  args: {
    id: v.id("users"),
    freeze: v.boolean(),
    fraud_flags: v.optional(v.array(v.string())),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await assertAdmin(ctx);
    await ctx.db.patch(args.id, {
      is_payout_frozen: args.freeze,
      fraud_flags: args.freeze ? (args.fraud_flags ?? []) : [],
      updated_at: Date.now(),
    });
    return {
      success: true,
      message: args.freeze ? "Wallet frozen" : "Wallet unfrozen",
    };
  },
});

/** Exports users, orders, products or revenue as CSV or JSON. */
export const exportData = query({
  args: {
    type: v.optional(v.string()),
    format: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await assertAdmin(ctx);
    const type = args.type ?? "users";
    const format = args.format ?? "csv";

    let rows: Record<string, unknown>[] = [];
    if (type === "users") {
      const users = await ctx.db.query("users").collect();
      rows = users.map((user) => ({
        id: user._id,
        full_name: user.full_name ?? user.name ?? "",
        email: user.email ?? "",
        role: user.role ?? "user",
        verified: user.verified ?? false,
        created_at: toIso(user.created_at ?? user._creationTime),
      }));
    } else if (type === "orders") {
      const orders = await ctx.db.query("orders").collect();
      rows = orders.map((order) => ({
        id: order._id,
        buyer_id: order.buyer_id,
        seller_id: order.seller_id,
        amount: order.amount,
        status: order.status,
        created_at: toIso(order.created_at),
      }));
    } else if (type === "products") {
      const products = await ctx.db.query("products").collect();
      rows = products.map((product) => ({
        id: product._id,
        seller_id: product.seller_id,
        title: product.title,
        price: product.price,
        is_active: product.is_active ?? true,
        created_at: toIso(product.created_at),
      }));
    } else {
      const orders = (await ctx.db.query("orders").collect()).filter(
        (order) => order.status === "paid" || order.status === "completed"
      );
      rows = orders.map((order) => ({
        id: order._id,
        amount: order.amount,
        commission: order.commission ?? 0,
        seller_earning: order.seller_earning ?? 0,
        paid_at: toIso(order.paid_at),
      }));
    }

    if (format === "json") {
      return { data: rows, filename: `white-market-${type}.json` };
    }

    if (rows.length === 0) {
      return { data: "", filename: `white-market-${type}.csv` };
    }

    const headers = Object.keys(rows[0]);
    const escape = (value: unknown) => {
      const text = value === undefined || value === null ? "" : String(value);
      return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
    };
    const csv = [
      headers.join(","),
      ...rows.map((row) => headers.map((header) => escape(row[header])).join(",")),
    ].join("\n");

    return { data: csv, filename: `white-market-${type}.csv` };
  },
});
