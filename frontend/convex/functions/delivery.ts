import { v } from "convex/values";
import { internal } from "../_generated/api";
import { internalMutation, internalQuery, mutation, query } from "../_generated/server";
import { isVerifiedStudent, requireProfile, requireUserId } from "../lib/auth";
import { ensureWallet, round2 } from "../lib/money";
import { toIso } from "../lib/shapes";
import {
  DELIVERY_LAUNCH_ENABLED,
  isApprovedRider,
  isDeliveryEnabled,
  isOperationalDelivery,
  latestRiderApplication,
} from "../lib/deliveryPolicy";
import { completePaidOrder } from "./orders";

const INITIAL_LOCATIONS = [
  ["Traditional Halls", "Legon Hall"], ["Traditional Halls", "Akuafo Hall"],
  ["Traditional Halls", "Commonwealth Hall"], ["Traditional Halls", "Volta Hall"],
  ["Traditional Halls", "Mensah Sarbah Hall"], ["UGEL / Diaspora Halls", "Dr. Hilla Limann Hall"],
  ["UGEL / Diaspora Halls", "Alexander Adum Kwapong Hall"], ["UGEL / Diaspora Halls", "Elizabeth Frances Sey Hall"],
  ["UGEL / Diaspora Halls", "Jean Nelson Aka Hall"], ["Other University Residences", "Jubilee Hall"],
  ["Other University Residences", "International Students Hostel 1"], ["Other University Residences", "International Students Hostel 2"],
  ["Other University Residences", "Valco Graduate Hostel Phase 1"], ["Other University Residences", "Valco Graduate Hostel Phase 2"],
  ["Other University Residences", "Diamond Jubilee Hall"], ["Annexes", "Legon Hall Annex C"],
  ["Annexes", "Mensah Sarbah Hall Annex C"], ["Annexes", "Mensah Sarbah Hall Annex D"],
  ["Annexes", "Akuafo Hall Annex C"], ["Annexes", "Akuafo Hall Annex D"],
  ["Private Hostels", "Pentagon Hostel / African Union Hall"], ["Private Hostels", "TF Hostel / James Topp Nelson Yankah Hall"],
  ["Private Hostels", "Evandy Hostel / United Nations Hall"], ["Private Hostels", "Bani Hostel"],
  ["Private Hostels", "Vikings Hostel"], ["Other", "Other private hostel"], ["Other", "Other campus location"],
] as const;

const OSM_COORDINATE_CANDIDATES = [
  ["Legon Hall", 5.649542, -0.188025, "427645339", "Legon Hall"],
  ["Akuafo Hall", 5.649716, -0.186009, "421358833", "Akuafo Hall Main"],
  ["Commonwealth Hall", 5.650902, -0.192649, "497853937", "Commonwealth Hall"],
  ["Volta Hall", 5.651862, -0.189519, "320072537", "Volta Hall"],
  ["Mensah Sarbah Hall", 5.645788, -0.186443, "497853938", "Mensah Sarbah Hall"],
  ["International Students Hostel 1", 5.639794, -0.185132, "278303018", "International Students Hostel 1, ISH 1"],
  ["International Students Hostel 2", 5.641573, -0.186081, "278303020", "International Students Hostel 2, ISH 2"],
  ["Legon Hall Annex C", 5.647419, -0.188906, "394125207", "Legon Hall Annex C (Graduate Hostel)"],
  ["Mensah Sarbah Hall Annex C", 5.645389, -0.185275, "278303055", "Mensah Sarbah Annex C"],
  ["Mensah Sarbah Hall Annex D", 5.645440, -0.185698, "278303047", "Mensah Sarbah Annex D"],
  ["Akuafo Hall Annex C", 5.647433, -0.185234, "278303060", "Akuafo Hall Annex C"],
  ["Akuafo Hall Annex D", 5.647430, -0.185922, "278303061", "Akuafo Hall Annex D"],
  ["Bani Hostel", 5.663372, -0.180048, "368856637", "Bani Hostel"],
  ["Valco Graduate Hostel Phase 1", 5.644770, -0.186812, "278303038", "Valco Trust Hostel Phase 1"],
  ["Valco Graduate Hostel Phase 2", 5.644228, -0.186780, "278303034", "Valco Trust Hostel Phase 2"],
  ["Vikings Hostel", 5.644370, -0.185657, "486634897", "Vikings Hostel"],
] as const;

async function requireAdmin(ctx: any) {
  const userId = await requireUserId(ctx);
  const admin = await requireProfile(ctx, userId);
  if (admin.role !== "admin") throw new Error("Admin access only");
  return admin;
}

async function logEvent(
  ctx: any,
  delivery: { _id: any; order_id: any },
  actorId: any,
  actorRole: string,
  event: string,
  note?: string
) {
  const now = Date.now();
  await ctx.db.insert("delivery_events", {
    delivery_id: delivery._id,
    order_id: delivery.order_id,
    actor_id: actorId,
    actor_role: actorRole,
    event,
    note,
    created_at: now,
  });
  await ctx.db.patch(delivery._id, { updated_at: now });
}

async function suspendRiderAndFlagDeliveries(
  ctx: any,
  adminId: any,
  riderId: any,
  reason: string,
  now: number,
) {
  const applications = await ctx.db.query("rider_applications")
    .withIndex("by_user", (q: any) => q.eq("user_id", riderId)).collect();
  for (const application of applications) {
    if (application.status === "approved") {
      await ctx.db.patch(application._id, {
        status: "suspended", rejection_reason: reason,
        reviewed_by: adminId, reviewed_at: now, updated_at: now,
      });
    }
  }
  const deliveries = await ctx.db.query("deliveries")
    .withIndex("by_rider", (q: any) => q.eq("rider_id", riderId)).collect();
  for (const delivery of deliveries) {
    if (!isOperationalDelivery(delivery.status)) continue;
    await ctx.db.patch(delivery._id, {
      admin_intervention_required: true,
      admin_intervention_reason: reason,
      admin_intervention_at: now,
      updated_at: now,
    });
    await logEvent(ctx, delivery, adminId, "admin", "rider_suspended_delivery_flagged", reason);
    for (const recipient of new Set([delivery.buyer_id, delivery.seller_id])) {
      await ctx.db.insert("notifications", {
        user_id: recipient,
        type: "delivery_admin_intervention",
        title: "Delivery needs admin attention",
        body: "Your delivery is paused while an administrator assigns a replacement rider.",
        data: { order_id: delivery.order_id, delivery_id: delivery._id },
        read: false,
        created_at: now,
      });
    }
  }
}

async function isDeliveryCurrentlyEnabled(ctx: any): Promise<boolean> {
  const [settings, zones, locations] = await Promise.all([
    ctx.db.query("delivery_settings").first(),
    ctx.db.query("delivery_zones").collect(),
    ctx.db.query("delivery_locations").collect(),
  ]);
  return isDeliveryEnabled(
    DELIVERY_LAUNCH_ENABLED && settings?.is_enabled === true,
    zones,
    locations,
  );
}

export const ensureDefaults = mutation({
  args: {},
  handler: async (ctx) => {
    const admin = await requireAdmin(ctx);
    const existingLocations = await ctx.db.query("delivery_locations").collect();
    const locationNames = new Set(existingLocations.map((location) => location.name));
    for (const [category, name] of INITIAL_LOCATIONS) {
      if (!locationNames.has(name)) {
        await ctx.db.insert("delivery_locations", {
          category, name, is_active: true, created_at: Date.now(), updated_at: Date.now(),
        });
        locationNames.add(name);
      }
    }
    const seededLocations = await ctx.db.query("delivery_locations").collect();
    for (const [name, latitude, longitude, wayId, osmName] of OSM_COORDINATE_CANDIDATES) {
      const location = seededLocations.find((candidate) => candidate.name === name);
      if (location && (location.latitude === undefined || location.longitude === undefined)) {
        await ctx.db.patch(location._id, {
          latitude,
          longitude,
          coordinate_source: "OpenStreetMap named-way centroid (unverified candidate)",
          coordinate_reference: `https://www.openstreetmap.org/way/${wayId} — ${osmName}`,
          coordinate_review_status: "needs_review",
          updated_at: Date.now(),
        });
      }
    }
    const existingZones = await ctx.db.query("delivery_zones").collect();
    const zoneNames = new Set(existingZones.map((zone) => zone.name));
    for (const name of ["Nearby", "Intermediate", "Farther"]) {
      if (!zoneNames.has(name)) {
        await ctx.db.insert("delivery_zones", {
          name, fee: 0, is_configured: false, is_active: true,
          updated_by: admin._id, updated_at: Date.now(),
        });
        zoneNames.add(name);
      }
    }
    const settings = await ctx.db.query("delivery_settings").first();
    if (!settings) {
      await ctx.db.insert("delivery_settings", {
        is_enabled: false, updated_by: admin._id, updated_at: Date.now(),
      });
    }
    return { message: "Delivery defaults are ready; delivery remains disabled." };
  },
});

export const publicOptions = query({
  args: {},
  handler: async (ctx) => {
    const allLocations = (await ctx.db.query("delivery_locations").collect())
      .filter((location) => location.is_active)
      .sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));
    const zones = (await ctx.db.query("delivery_zones").collect())
      .filter((zone) => zone.is_active)
      .map((zone) => ({ id: zone._id, name: zone.name, fee: zone.fee, configured: zone.is_configured }));
    const availableZones = new Map(zones.filter((zone) => zone.configured && zone.fee > 0).map((zone) => [zone.id, zone]));
    const locations = allLocations.flatMap((location) => {
      const zone = location.zone_id ? availableZones.get(location.zone_id) : undefined;
      return zone ? [{
        id: location._id, name: location.name, category: location.category,
        zone_id: zone.id, zone_name: zone.name, fee: zone.fee,
      }] : [];
    });
    return {
      delivery_enabled: await isDeliveryCurrentlyEnabled(ctx),
      locations,
    };
  },
});

export const adminConfiguration = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const zones = await ctx.db.query("delivery_zones").collect();
    const zonesById = new Map(zones.map((zone) => [zone._id, zone]));
    return {
      locations: (await ctx.db.query("delivery_locations").collect()).map((location) => ({
        ...location,
        zone_name: location.zone_id ? zonesById.get(location.zone_id)?.name : undefined,
      })),
      zones,
      delivery_enabled: false,
    };
  },
});

export const setZoneFee = mutation({
  args: {
    id: v.id("delivery_zones"), fee: v.number(), is_active: v.optional(v.boolean()),
    rider_compensation: v.number(), transport_cost: v.number(), confirmed_tested: v.boolean(),
  },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    if (!args.confirmed_tested) throw new Error("Zone fees must be confirmed from test delivery measurements");
    if (!Number.isFinite(args.fee) || args.fee <= 0 || args.fee > 1000) throw new Error("Enter a valid delivery fee greater than zero");
    if (!Number.isFinite(args.rider_compensation) || args.rider_compensation <= 0 || args.rider_compensation > args.fee) {
      throw new Error("Rider compensation must be greater than zero and no more than the delivery fee");
    }
    if (!Number.isFinite(args.transport_cost) || args.transport_cost < 0 || args.rider_compensation + args.transport_cost > args.fee) {
      throw new Error("Rider compensation and transport cost cannot exceed the delivery fee");
    }
    const zone = await ctx.db.get(args.id);
    if (!zone) throw new Error("Delivery zone not found");
    await ctx.db.patch(zone._id, {
      fee: Math.round(args.fee * 100) / 100,
      rider_compensation: Math.round(args.rider_compensation * 100) / 100,
      transport_cost: Math.round(args.transport_cost * 100) / 100,
      is_configured: true,
      is_active: args.is_active ?? zone.is_active,
      updated_by: admin._id,
      updated_at: Date.now(),
    });
    return { success: true };
  },
});

export const setLocation = mutation({
  args: {
    id: v.optional(v.id("delivery_locations")), name: v.string(), category: v.string(),
    is_active: v.boolean(), zone_id: v.optional(v.id("delivery_zones")),
    clear_zone: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const name = args.name.trim();
    const category = args.category.trim();
    if (!name || !category) throw new Error("Destination name and category are required");
    if (args.zone_id) {
      const zone = await ctx.db.get(args.zone_id);
      if (!zone) throw new Error("Delivery zone not found");
    }
    const zone_id = args.clear_zone ? undefined : args.zone_id;
    if (!args.id && args.is_active && !zone_id) {
      throw new Error("Assign an active delivery zone before adding an active destination");
    }
    const now = Date.now();
    if (args.id) {
      if (!await ctx.db.get(args.id)) throw new Error("Destination not found");
      await ctx.db.patch(args.id, {
        name, category, is_active: args.is_active,
        ...(args.zone_id || args.clear_zone ? { zone_id } : {}),
        updated_at: now,
      });
      return { id: args.id };
    }
    const id = await ctx.db.insert("delivery_locations", {
      name, category, zone_id, is_active: args.is_active, created_at: now, updated_at: now,
    });
    return { id };
  },
});

export const submitApplicationDocument = internalMutation({
  args: {
    user_id: v.id("users"), legal_name: v.string(), phone: v.string(),
    student_id_number: v.string(), storage_id: v.id("_storage"), content_type: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireProfile(ctx, args.user_id);
    if (!await isVerifiedStudent(ctx, user._id)) throw new Error("Student verification is required before applying to become a rider");
    const legalName = args.legal_name.trim();
    const phone = args.phone.trim();
    const studentIdNumber = args.student_id_number.trim();
    if (!legalName || !phone || !studentIdNumber) throw new Error("Legal name, phone, and student ID number are required");
    const applications = await ctx.db.query("rider_applications")
      .withIndex("by_user", (q) => q.eq("user_id", user._id)).collect();
    if (applications.some((application) => ["pending", "approved", "suspended"].includes(application.status))) {
      throw new Error("You already have an active rider application");
    }
    const now = Date.now();
    const id = await ctx.db.insert("rider_applications", {
      user_id: user._id, legal_name: legalName, phone, student_id_number: studentIdNumber,
      document_storage_id: args.storage_id, document_content_type: args.content_type,
      status: "pending", created_at: now, updated_at: now,
    });
    return { id, status: "pending" };
  },
});

export const myRiderApplication = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    const applications = await ctx.db.query("rider_applications")
      .withIndex("by_user", (q) => q.eq("user_id", userId)).collect();
    const latest = applications.sort((a, b) => b.created_at - a.created_at)[0];
    if (!latest) return null;
    return {
      id: latest._id, legal_name: latest.legal_name, phone: latest.phone,
      status: latest.status, rejection_reason: latest.rejection_reason,
      created_at: toIso(latest.created_at), has_document: Boolean(latest.document_storage_id),
    };
  },
});

export const adminRiderApplications = query({
  args: { status: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const applications = await ctx.db.query("rider_applications")
      .withIndex("by_status", (q) => q.eq("status", args.status ?? "pending")).collect();
    return Promise.all(applications.map(async (application) => {
      const user = await ctx.db.get(application.user_id);
      return {
        id: application._id, user_id: application.user_id, email: user?.email ?? "",
        legal_name: application.legal_name, phone: application.phone,
        student_id_number: application.student_id_number, status: application.status,
        rejection_reason: application.rejection_reason, has_document: Boolean(application.document_storage_id),
        created_at: toIso(application.created_at),
      };
    }));
  },
});

export const riderDocumentContext = internalQuery({
  args: { application_id: v.string(), admin_id: v.id("users") },
  handler: async (ctx, args) => {
    const admin = await ctx.db.get(args.admin_id);
    if (admin?.role !== "admin") throw new Error("Admin access only");
    const id = ctx.db.normalizeId("rider_applications", args.application_id);
    const application = id ? await ctx.db.get(id) : null;
    if (!application?.document_storage_id) throw new Error("Rider document not found");
    return { storage_id: application.document_storage_id, content_type: application.document_content_type ?? "application/octet-stream" };
  },
});

export const userIdForSubject = internalQuery({
  args: { subject: v.string() },
  handler: async (ctx, args) => ctx.db.normalizeId("users", args.subject),
});

export const reviewRiderApplication = mutation({
  args: { id: v.id("rider_applications"), action: v.string(), reason: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    if (!["approved", "rejected", "suspended", "deactivated"].includes(args.action)) throw new Error("Invalid rider status");
    const application = await ctx.db.get(args.id);
    if (!application) throw new Error("Rider application not found");
    if (args.action === "approved" && !await isVerifiedStudent(ctx, application.user_id)) {
      throw new Error("Only currently verified students can be approved as riders");
    }
    const reason = args.reason?.trim();
    if (args.action === "suspended" && !reason) throw new Error("A suspension reason is required");
    const now = Date.now();
    await ctx.db.patch(application._id, {
      status: args.action,
      rejection_reason: args.action === "rejected" ? (reason || "Application not approved")
        : args.action === "suspended" ? reason : undefined,
      reviewed_by: admin._id, reviewed_at: now, updated_at: now,
    });
    if (args.action === "suspended") {
      await suspendRiderAndFlagDeliveries(ctx, admin._id, application.user_id, reason!, now);
    }
    return { status: args.action };
  },
});

export const availableJobs = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    const applications = await ctx.db.query("rider_applications")
      .withIndex("by_user", (q) => q.eq("user_id", userId)).collect();
    if (!isApprovedRider(applications) || !await isVerifiedStudent(ctx, userId)) {
      throw new Error("An approved rider application and verified student status are required");
    }
    if (!await isDeliveryCurrentlyEnabled(ctx)) return [];
    const deliveries = (await ctx.db.query("deliveries").withIndex("by_status", (q) => q.eq("status", "awaiting_rider")).collect())
      .filter((delivery) => delivery.rider_id === undefined);
    return Promise.all(deliveries.map(async (delivery) => {
      const order = await ctx.db.get(delivery.order_id);
      if (!order || order.status !== "paid") return null;
      const product = order.product_id ? await ctx.db.get(order.product_id) : null;
      const fashion = order.fashion_id ? await ctx.db.get(order.fashion_id) : null;
      return {
        id: delivery._id, order_id: delivery.order_id, destination_name: delivery.destination_name ?? "",
        zone_name: delivery.zone_name ?? "", meeting_point: delivery.meeting_point ?? "",
        delivery_fee: delivery.delivery_fee, item_name: product?.title ?? fashion?.title ?? "Marketplace order",
      };
    })).then((rows) => rows.filter(Boolean));
  },
});

export const myDeliveries = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    const riderApps = await ctx.db.query("rider_applications").withIndex("by_user", (q) => q.eq("user_id", userId)).collect();
    const [buyerDeliveries, sellerDeliveries, riderDeliveries] = await Promise.all([
      ctx.db.query("deliveries").withIndex("by_buyer", (q) => q.eq("buyer_id", userId)).collect(),
      ctx.db.query("deliveries").withIndex("by_seller", (q) => q.eq("seller_id", userId)).collect(),
      riderApps.some((application) => ["approved", "suspended"].includes(application.status))
        ? ctx.db.query("deliveries").withIndex("by_rider", (q) => q.eq("rider_id", userId)).collect()
        : Promise.resolve([]),
    ]);
    const deliveries = [...buyerDeliveries, ...sellerDeliveries, ...riderDeliveries];
    const unique = [...new Map(deliveries.map((delivery) => [delivery._id, delivery])).values()];
    return Promise.all(unique.map(async (delivery) => {
      if (delivery.buyer_id !== userId && delivery.seller_id !== userId && delivery.rider_id !== userId) {
        throw new Error("Not authorized");
      }
      const order = await ctx.db.get(delivery.order_id);
      const events = await ctx.db.query("delivery_events").withIndex("by_delivery", (q) => q.eq("delivery_id", delivery._id)).collect();
      const product = order?.product_id ? await ctx.db.get(order.product_id) : null;
      const fashion = order?.fashion_id ? await ctx.db.get(order.fashion_id) : null;
      return {
        id: delivery._id, order_id: delivery.order_id, buyer_id: delivery.buyer_id, seller_id: delivery.seller_id,
        rider_id: delivery.rider_id,
        destination_name: delivery.destination_name, zone_name: delivery.zone_name, meeting_point: delivery.meeting_point,
        delivery_fee: delivery.delivery_fee, status: delivery.status,
        admin_intervention_required: delivery.admin_intervention_required ?? false,
        admin_intervention_reason: delivery.admin_intervention_reason,
        product_name: product?.title ?? fashion?.title ?? "Marketplace order",
        events: events.sort((a, b) => a.created_at - b.created_at).map((event) => ({ event: event.event, note: event.note, at: toIso(event.created_at) })),
      };
    }));
  },
});

export const setDeliveryOption = mutation({
  args: {
    order_id: v.id("orders"), method: v.string(), destination_id: v.optional(v.id("delivery_locations")),
    meeting_point: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const order = await ctx.db.get(args.order_id);
    if (!order || order.buyer_id !== userId) throw new Error("Order not found");
    if (order.status !== "pending" || order.paid_at) throw new Error("Delivery choice can only be changed before payment");
    if (!["campus_pickup", "delivery"].includes(args.method)) throw new Error("Choose pickup or delivery");
    let deliveryFee = 0;
    let destination: any = null;
    let zone: any = null;
    if (args.method === "delivery") {
      if (!args.destination_id) throw new Error("Choose a delivery destination");
      destination = await ctx.db.get(args.destination_id);
      if (!destination?.is_active || !destination.zone_id) {
        throw new Error("This destination has not been assigned a delivery zone");
      }
      zone = await ctx.db.get(destination.zone_id);
      if (!await isDeliveryCurrentlyEnabled(ctx) ||
        !zone?.is_active || !zone.is_configured || zone.fee <= 0) {
        throw new Error("Campus delivery is currently disabled");
      }
      deliveryFee = zone.fee;
    }
    const existing = await ctx.db.query("deliveries").withIndex("by_order", (q) => q.eq("order_id", order._id)).first();
    if (existing && existing.status !== "awaiting_rider") throw new Error("This delivery choice can no longer be changed");
    const now = Date.now();
    await ctx.db.patch(order._id, {
      amount: (order.item_amount ?? order.amount - (order.delivery_fee ?? 0)) + deliveryFee,
      item_amount: order.item_amount ?? order.amount - (order.delivery_fee ?? 0),
      delivery_fee: deliveryFee,
      delivery_method: args.method,
      delivery_status: args.method === "delivery" ? "awaiting_payment" : "campus_pickup",
      updated_at: now,
    });
    if (args.method === "campus_pickup") {
      if (existing) await ctx.db.delete(existing._id);
      return { amount: order.item_amount ?? order.amount - (order.delivery_fee ?? 0), delivery_fee: 0, method: args.method };
    }
    const deliveryFields = {
      order_id: order._id, buyer_id: order.buyer_id, seller_id: order.seller_id,
      destination_id: destination._id, destination_name: destination.name, zone_id: zone._id,
      zone_name: zone.name, meeting_point: args.meeting_point?.trim() || undefined,
      delivery_fee: deliveryFee,
      rider_compensation: zone.rider_compensation ?? 0,
      transport_cost: zone.transport_cost ?? 0,
      delivery_margin: round2(deliveryFee - (zone.rider_compensation ?? 0) - (zone.transport_cost ?? 0)),
      status: "awaiting_rider", updated_at: now,
    };
    if (existing) await ctx.db.patch(existing._id, deliveryFields);
    else {
      const deliveryId = await ctx.db.insert("deliveries", { ...deliveryFields, created_at: now });
      await ctx.db.insert("delivery_events", {
        delivery_id: deliveryId, order_id: order._id, actor_id: userId, actor_role: "buyer",
        event: "delivery_requested", created_at: now,
      });
    }
    return { amount: (order.item_amount ?? order.amount - (order.delivery_fee ?? 0)) + deliveryFee, delivery_fee: deliveryFee, method: args.method };
  },
});

export const buyerDeliveryOption = query({
  args: { order_id: v.id("orders") },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const order = await ctx.db.get(args.order_id);
    if (!order || order.buyer_id !== userId) throw new Error("Order not found");
    const delivery = await ctx.db.query("deliveries")
      .withIndex("by_order", (q) => q.eq("order_id", order._id)).first();
    if (!delivery) return null;
    return {
      destination_id: delivery.destination_id,
      zone_id: delivery.zone_id,
      meeting_point: delivery.meeting_point ?? "",
    };
  },
});

export const acceptJob = mutation({
  args: { id: v.id("deliveries") },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const riderApps = await ctx.db.query("rider_applications").withIndex("by_user", (q) => q.eq("user_id", userId)).collect();
    const app = riderApps.sort((a, b) => b.created_at - a.created_at)[0];
    if (!app || !await isVerifiedStudent(ctx, userId)) throw new Error("Approved rider status and verified student status are required");
    if (app.status !== "approved") throw new Error("Rider account is not approved");
    if (!await isDeliveryCurrentlyEnabled(ctx)) throw new Error("Campus delivery is currently disabled");
    const delivery = await ctx.db.get(args.id);
    if (!delivery || delivery.status !== "awaiting_rider" || delivery.rider_id) throw new Error("This delivery is no longer available");
    const order = await ctx.db.get(delivery.order_id);
    if (!order || order.status !== "paid") throw new Error("Only paid delivery requests can be accepted");
    const otherActive = await ctx.db.query("deliveries").withIndex("by_rider", (q) => q.eq("rider_id", userId)).collect();
    if (otherActive.some((item) => isOperationalDelivery(item.status))) {
      throw new Error("Complete your active delivery before accepting another job");
    }
    const profile = await requireProfile(ctx, userId);
    const now = Date.now();
    await ctx.db.patch(delivery._id, {
      rider_id: userId, rider_name_snapshot: app.legal_name, rider_phone_snapshot: app.phone,
      status: "awaiting_pickup", assigned_at: now, updated_at: now,
    });
    await logEvent(ctx, delivery, userId, "rider", "rider_assigned");
    for (const recipient of [delivery.buyer_id, delivery.seller_id]) {
      await ctx.db.insert("notifications", {
        user_id: recipient, type: "delivery_rider_assigned", title: "Rider assigned",
        body: `${app.legal_name} accepted your delivery.`, data: { order_id: order._id },
        read: false, created_at: now,
      });
    }
    return { status: "awaiting_pickup", rider_name: app.legal_name };
  },
});

export const confirmPickup = mutation({
  args: { id: v.id("deliveries") },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const delivery = await ctx.db.get(args.id);
    if (!delivery || delivery.seller_id !== userId) throw new Error("Not authorized to confirm this pickup");
    if (delivery.admin_intervention_required) throw new Error("An administrator must reassign this delivery before handoff");
    if (delivery.status !== "awaiting_pickup") throw new Error("Delivery is not awaiting seller handoff");
    const now = Date.now();
    await ctx.db.patch(delivery._id, { status: "picked_up", picked_up_at: now, updated_at: now });
    await logEvent(ctx, delivery, userId, "seller", "seller_handoff_confirmed");
    return { status: "picked_up" };
  },
});

export const updateJobStatus = mutation({
  args: { id: v.id("deliveries"), status: v.string(), note: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const delivery = await ctx.db.get(args.id);
    if (!delivery || delivery.rider_id !== userId) throw new Error("Only the assigned rider can update this delivery");
    if (delivery.admin_intervention_required) throw new Error("An administrator must reassign this delivery before it can continue");
    const application = await ctx.db.query("rider_applications").withIndex("by_user", (q) => q.eq("user_id", userId)).collect();
    if (!isApprovedRider(application) || !await isVerifiedStudent(ctx, userId)) throw new Error("Rider account is not approved");
    const allowed: Record<string, string[]> = { picked_up: ["in_transit"], in_transit: ["delivered"] };
    if (!allowed[delivery.status]?.includes(args.status)) throw new Error("Invalid delivery status transition");
    if (args.status === "delivered" && !args.note?.trim()) throw new Error("Add a public handoff note (do not include room numbers)");
    const now = Date.now();
    await ctx.db.patch(delivery._id, {
      status: args.status, delivered_at: args.status === "delivered" ? now : delivery.delivered_at, updated_at: now,
    });
    await logEvent(ctx, delivery, userId, "rider", args.status, args.note?.trim());
    await ctx.db.insert("notifications", {
      user_id: delivery.buyer_id, type: "delivery_status", title: "Delivery update",
      body: args.status === "delivered" ? "Your rider reported the item handed over. Confirm receipt in Orders." : "Your order is now in transit.",
      data: { order_id: delivery.order_id, delivery_id: delivery._id }, read: false, created_at: now,
    });
    return { status: args.status };
  },
});

export const confirmReceipt = mutation({
  args: { id: v.id("deliveries") },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const delivery = await ctx.db.get(args.id);
    if (!delivery || delivery.buyer_id !== userId) throw new Error("Only the buyer can confirm receipt");
    if (delivery.admin_intervention_required) throw new Error("An administrator must reassign this delivery before receipt can be confirmed");
    if (delivery.status !== "delivered") throw new Error("The rider must report handoff before receipt can be confirmed");
    const order = await ctx.db.get(delivery.order_id);
    if (!order || order.status !== "paid") throw new Error("This order cannot be completed");
    if (!delivery.rider_id) throw new Error("A rider must be assigned before receipt can be confirmed");
    const riderCompensation = round2(delivery.rider_compensation ?? 0);
    if (riderCompensation <= 0) throw new Error("This delivery does not have configured rider compensation");
    const riderWallet = await ensureWallet(ctx, delivery.rider_id);
    const riderBalance = round2((riderWallet.balance ?? 0) + riderCompensation);
    await ctx.db.patch(riderWallet._id, { balance: riderBalance, updated_at: Date.now() });
    await ctx.db.insert("wallet_transactions", {
      user_id: delivery.rider_id,
      type: "credit",
      amount: riderCompensation,
      description: `Rider compensation for delivery ${delivery._id}`,
      reference_id: delivery._id,
      reference_type: "delivery_rider_compensation",
      balance_after: riderBalance,
      created_at: Date.now(),
    });
    await ctx.db.patch(delivery._id, { status: "completed", completed_at: Date.now(), updated_at: Date.now() });
    const transaction = await ctx.db.query("transactions")
      .withIndex("by_order", (q) => q.eq("order_id", order._id)).first();
    if (transaction) {
      await ctx.db.patch(transaction._id, { rider_compensation_paid_at: Date.now() });
    }
    await logEvent(ctx, delivery, userId, "buyer", "buyer_receipt_confirmed");
    await completePaidOrder(ctx, order._id, userId);
    return { status: "completed" };
  },
});

export const createComplaint = mutation({
  args: { id: v.id("deliveries"), reason: v.string(), details: v.string() },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const delivery = await ctx.db.get(args.id);
    if (!delivery || (delivery.buyer_id !== userId && delivery.seller_id !== userId)) throw new Error("Not authorized to report this delivery");
    const reason = args.reason.trim();
    const details = args.details.trim();
    if (!reason || !details) throw new Error("A complaint reason and details are required");
    if (["completed", "cancelled"].includes(delivery.status)) throw new Error("This delivery is closed");
    const now = Date.now();
    const complaintId = await ctx.db.insert("delivery_complaints", {
      delivery_id: delivery._id, order_id: delivery.order_id, raised_by: userId,
      reason, details, status: "open", created_at: now, updated_at: now,
    });
    await ctx.db.patch(delivery._id, { status: "disputed", updated_at: now });
    await logEvent(ctx, delivery, userId, delivery.buyer_id === userId ? "buyer" : "seller", "complaint_opened", reason);
    await ctx.db.insert("notifications", {
      user_id: delivery.seller_id === userId ? delivery.buyer_id : delivery.seller_id,
      type: "delivery_complaint", title: "Delivery issue reported", body: reason,
      data: { delivery_id: delivery._id, complaint_id: complaintId }, read: false, created_at: now,
    });
    return { id: complaintId, status: "open" };
  },
});

export const adminDeliveries = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const deliveries = await ctx.db.query("deliveries").collect();
    return Promise.all(deliveries.map(async (delivery) => {
      const transaction = await ctx.db.query("transactions")
        .withIndex("by_order", (q) => q.eq("order_id", delivery.order_id)).first();
      return {
        id: delivery._id, order_id: delivery.order_id, status: delivery.status,
        buyer_id: delivery.buyer_id, seller_id: delivery.seller_id, rider_id: delivery.rider_id,
        rider_name: delivery.rider_name_snapshot, rider_phone: delivery.rider_phone_snapshot,
        destination: delivery.destination_name, zone: delivery.zone_name, meeting_point: delivery.meeting_point,
        delivery_fee: delivery.delivery_fee,
        rider_compensation: transaction?.rider_compensation ?? delivery.rider_compensation ?? 0,
        transport_cost: transaction?.transport_cost ?? delivery.transport_cost ?? 0,
        delivery_margin: transaction?.delivery_margin ?? delivery.delivery_margin ?? Math.max(0, delivery.delivery_fee - (delivery.rider_compensation ?? 0) - (delivery.transport_cost ?? 0)),
        item_amount: transaction?.item_amount,
        order_amount: transaction?.amount,
        commission: transaction?.commission,
        seller_earning: transaction?.seller_earning,
        rider_compensation_paid: Boolean(transaction?.rider_compensation_paid_at),
        admin_intervention_required: delivery.admin_intervention_required ?? false,
        admin_intervention_reason: delivery.admin_intervention_reason,
        assigned_at: toIso(delivery.assigned_at),
        picked_up_at: toIso(delivery.picked_up_at), delivered_at: toIso(delivery.delivered_at),
        events: (await ctx.db.query("delivery_events").withIndex("by_delivery", (q) => q.eq("delivery_id", delivery._id)).collect())
          .sort((a, b) => a.created_at - b.created_at).map((event) => ({ event: event.event, actor_id: event.actor_id, note: event.note, at: toIso(event.created_at) })),
      };
    }));
  },
});

export const adminEligibleRiders = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const applications = await ctx.db.query("rider_applications").collect();
    const byUser = new Map<string, typeof applications>();
    for (const application of applications) {
      const current = byUser.get(application.user_id) ?? [];
      current.push(application);
      byUser.set(application.user_id, current);
    }
    const candidates = [];
    for (const userApplications of byUser.values()) {
      const application = latestRiderApplication(userApplications);
      if (!application || application.status !== "approved" || !await isVerifiedStudent(ctx, application.user_id)) continue;
      const assigned = await ctx.db.query("deliveries")
        .withIndex("by_rider", (q) => q.eq("rider_id", application.user_id)).collect();
      if (assigned.some((delivery) => isOperationalDelivery(delivery.status))) continue;
      candidates.push({
        id: application.user_id,
        legal_name: application.legal_name,
        phone: application.phone,
      });
    }
    return candidates.sort((a, b) => a.legal_name.localeCompare(b.legal_name));
  },
});

export const reassignDelivery = mutation({
  args: { id: v.id("deliveries"), rider_id: v.id("users") },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    const delivery = await ctx.db.get(args.id);
    if (!delivery || !delivery.admin_intervention_required) {
      throw new Error("This delivery is not awaiting admin reassignment");
    }
    if (!isOperationalDelivery(delivery.status)) throw new Error("This delivery is no longer active");
    const openComplaints = await ctx.db.query("delivery_complaints")
      .withIndex("by_delivery", (q) => q.eq("delivery_id", delivery._id)).collect();
    if (openComplaints.some((complaint) => complaint.status === "open")) {
      throw new Error("Resolve the open delivery complaint before reassigning this delivery");
    }
    if (delivery.rider_id === args.rider_id) throw new Error("Choose a different replacement rider");
    const applications = await ctx.db.query("rider_applications")
      .withIndex("by_user", (q) => q.eq("user_id", args.rider_id)).collect();
    const application = latestRiderApplication(applications);
    if (!application || application.status !== "approved" || !await isVerifiedStudent(ctx, args.rider_id)) {
      throw new Error("Replacement rider must have an approved application and verified student status");
    }
    const assigned = await ctx.db.query("deliveries")
      .withIndex("by_rider", (q) => q.eq("rider_id", args.rider_id)).collect();
    if (assigned.some((item) => item._id !== delivery._id && isOperationalDelivery(item.status))) {
      throw new Error("Replacement rider must finish their current delivery first");
    }
    const now = Date.now();
    const previousRiderId = delivery.rider_id;
    await ctx.db.patch(delivery._id, {
      rider_id: args.rider_id,
      rider_name_snapshot: application.legal_name,
      rider_phone_snapshot: application.phone,
      status: "awaiting_pickup",
      assigned_at: now,
      picked_up_at: undefined,
      delivered_at: undefined,
      admin_intervention_required: false,
      admin_intervention_reason: undefined,
      admin_intervention_at: undefined,
      updated_at: now,
    });
    await logEvent(
      ctx, delivery, admin._id, "admin", "delivery_rider_reassigned",
      `Previous rider ${previousRiderId ?? "unassigned"} replaced with ${args.rider_id}; seller must confirm handoff.`,
    );
    const recipients = new Set([delivery.buyer_id, delivery.seller_id, args.rider_id]);
    if (previousRiderId) recipients.add(previousRiderId);
    for (const recipient of recipients) {
      await ctx.db.insert("notifications", {
        user_id: recipient,
        type: "delivery_rider_reassigned",
        title: "Delivery rider reassigned",
        body: "An administrator assigned a replacement rider. The seller must confirm the new handoff.",
        data: { order_id: delivery.order_id, delivery_id: delivery._id },
        read: false,
        created_at: now,
      });
    }
    return { status: "awaiting_pickup" };
  },
});

export const adminComplaints = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    return ctx.db.query("delivery_complaints").withIndex("by_status", (q) => q.eq("status", "open")).collect();
  },
});

export const resolveComplaint = mutation({
  args: { id: v.id("delivery_complaints"), resolution: v.string(), suspend_rider: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    const complaint = await ctx.db.get(args.id);
    if (!complaint || complaint.status !== "open") throw new Error("Open complaint not found");
    const delivery = await ctx.db.get(complaint.delivery_id);
    if (!delivery) throw new Error("Delivery not found");
    const resolution = args.resolution.trim();
    if (!resolution) throw new Error("Resolution note is required");
    const now = Date.now();
    await ctx.db.patch(complaint._id, { status: "resolved", resolution, resolved_by: admin._id, updated_at: now });
    if (args.suspend_rider && delivery.rider_id) {
      await suspendRiderAndFlagDeliveries(
        ctx, admin._id, delivery.rider_id, `Suspended after complaint: ${resolution}`, now,
      );
    }
    await logEvent(ctx, delivery, admin._id, "admin", "complaint_resolved", resolution);
    return { status: "resolved" };
  },
});
