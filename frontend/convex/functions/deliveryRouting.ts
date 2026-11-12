import { v } from "convex/values";
import { internal } from "../_generated/api";
import { action, internalMutation, internalQuery, mutation, query } from "../_generated/server";
import { requireProfile, requireUserId } from "../lib/auth";
import {
  MAX_ROUTING_REQUESTS_PER_UTC_DAY,
  MAX_SNAP_DISTANCE_METERS,
  RoutingProviderError,
  distanceBetweenPointsMeters,
  estimateDeliveryCost,
  fetchRoute,
  validateRoutingConfig,
} from "../lib/deliveryRouting";

const DEFAULT_ROUTING_CONFIG = {
  provider: "graphhopper",
  zone_basis: "distance",
  nearby_max_distance_m: 800,
  intermediate_max_distance_m: 1800,
  nearby_max_time_seconds: 600,
  intermediate_max_time_seconds: 1200,
  bicycle_rental_hourly_cost: 0,
  rider_compensation_base: 0,
  rider_compensation_per_minute: 0,
  delivery_margin_fixed: 0,
  delivery_margin_percent: 0,
  repositioning_minutes: 0,
  parking_allowance: 0,
  pricing_reviewed: false,
};

async function requireAdmin(ctx: any) {
  const userId = await requireUserId(ctx);
  const profile = await requireProfile(ctx, userId);
  if (profile.role !== "admin") throw new Error("Admin access only");
  return profile;
}

export const adminRoutingDashboard = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const [config, locations, routes, usage] = await Promise.all([
      ctx.db.query("delivery_routing_config").first(),
      ctx.db.query("delivery_locations").collect(),
      ctx.db.query("delivery_route_reviews").withIndex("by_created").order("desc").take(50),
      ctx.db.query("delivery_route_usage").withIndex("by_day").order("desc").take(7),
    ]);
    return {
      config: config ?? DEFAULT_ROUTING_CONFIG,
      locations: locations.sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name)),
      routes,
      usage,
      daily_request_limit: MAX_ROUTING_REQUESTS_PER_UTC_DAY,
      graphhopper_key_configured: Boolean(process.env.GRAPHHOPPER_API_KEY),
      graphhopper_no_billing_confirmed: process.env.GRAPHHOPPER_NO_BILLING_ACCOUNT_CONFIRMED === "true",
      routing_pilot_enabled: process.env.ROUTING_PILOT_ENABLED === "true",
      development_deployment: /^(dev|local):/.test(process.env.CONVEX_DEPLOYMENT ?? ""),
      osrm_url_configured: Boolean(process.env.OSRM_ROUTING_URL),
    };
  },
});

export const saveRoutingConfig = mutation({
  args: {
    provider: v.string(),
    zone_basis: v.string(),
    nearby_max_distance_m: v.number(),
    intermediate_max_distance_m: v.number(),
    nearby_max_time_seconds: v.number(),
    intermediate_max_time_seconds: v.number(),
    bicycle_rental_hourly_cost: v.number(),
    rider_compensation_base: v.number(),
    rider_compensation_per_minute: v.number(),
    delivery_margin_fixed: v.number(),
    delivery_margin_percent: v.number(),
    repositioning_minutes: v.number(),
    parking_allowance: v.number(),
  },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    if (!["graphhopper", "osrm"].includes(args.provider)) throw new Error("Unsupported routing provider");
    validateRoutingConfig(args);
    const now = Date.now();
    const existing = await ctx.db.query("delivery_routing_config").first();
    const fields = { ...args, pricing_reviewed: false, updated_by: admin._id, updated_at: now };
    if (existing) await ctx.db.patch(existing._id, fields);
    else await ctx.db.insert("delivery_routing_config", fields);
    return { saved: true, pricing_reviewed: false };
  },
});

export const saveLocationCoordinates = mutation({
  args: {
    id: v.id("delivery_locations"),
    latitude: v.number(),
    longitude: v.number(),
    coordinate_source: v.string(),
    coordinate_reference: v.string(),
    meeting_point_name: v.string(),
    coordinate_review_status: v.string(),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    if (!Number.isFinite(args.latitude) || args.latitude < -90 || args.latitude > 90) {
      throw new Error("Enter a valid latitude");
    }
    if (!Number.isFinite(args.longitude) || args.longitude < -180 || args.longitude > 180) {
      throw new Error("Enter a valid longitude");
    }
    if (!["needs_review", "approved", "restricted"].includes(args.coordinate_review_status)) {
      throw new Error("Invalid coordinate review status");
    }
    const source = args.coordinate_source.trim();
    const reference = args.coordinate_reference.trim();
    const meetingPoint = args.meeting_point_name.trim();
    if (!source || !meetingPoint) throw new Error("Coordinate source and a designated public meeting point are required");
    const location = await ctx.db.get(args.id);
    if (!location) throw new Error("Delivery destination not found");
    await ctx.db.patch(location._id, {
      latitude: args.latitude,
      longitude: args.longitude,
      coordinate_source: source,
      coordinate_reference: reference || undefined,
      meeting_point_name: meetingPoint,
      coordinate_review_status: args.coordinate_review_status,
      updated_at: Date.now(),
    });
    return { saved: true };
  },
});

export const reviewRoute = mutation({
  args: {
    id: v.id("delivery_route_reviews"),
    review_status: v.string(),
    review_note: v.string(),
    override_distance_meters: v.optional(v.number()),
    override_duration_seconds: v.optional(v.number()),
    override_estimated_total: v.optional(v.number()),
    override_note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    if (!["needs_review", "suitable", "unsuitable", "manual_review"].includes(args.review_status)) {
      throw new Error("Choose needs review, suitable, unsuitable, or manual review");
    }
    const note = args.review_note.trim();
    const overrideNote = args.override_note?.trim();
    const hasRouteOverride = args.override_distance_meters !== undefined || args.override_duration_seconds !== undefined;
    const hasPriceOverride = args.override_estimated_total !== undefined;
    const hasOverride = hasRouteOverride || hasPriceOverride;
    if (!note) throw new Error("Record a route review note");
    if (hasRouteOverride && (
      !Number.isFinite(args.override_distance_meters) || (args.override_distance_meters ?? 0) <= 0 ||
      !Number.isFinite(args.override_duration_seconds) || (args.override_duration_seconds ?? 0) <= 0 ||
      !overrideNote
    )) {
      throw new Error("A route override requires positive distance, time, and an explanation");
    }
    if (hasPriceOverride && (
      !Number.isFinite(args.override_estimated_total) || (args.override_estimated_total ?? -1) < 0 ||
      !overrideNote
    )) {
      throw new Error("A price override requires a non-negative estimate and an explanation");
    }
    const route = await ctx.db.get(args.id);
    if (!route) throw new Error("Route review not found");
    if (
      route.routing_status === "route_unavailable" &&
      args.review_status === "suitable" &&
      !hasOverride
    ) {
      throw new Error("A route without provider results needs a documented manual route or price override before approval");
    }
    const config = await ctx.db.query("delivery_routing_config").first();
    if (hasRouteOverride && !config) throw new Error("Routing pricing configuration is required for route overrides");
    const routeEstimate = hasRouteOverride && config
      ? estimateDeliveryCost(args.override_distance_meters!, args.override_duration_seconds!, config)
      : undefined;
    await ctx.db.patch(route._id, {
      review_status: hasOverride ? "manual_override" : args.review_status,
      review_note: note,
      override_distance_meters: args.override_distance_meters,
      override_duration_seconds: args.override_duration_seconds,
      override_estimated_total: args.override_estimated_total,
      override_note: overrideNote,
      ...(routeEstimate ?? {}),
      reviewed_by: admin._id,
      reviewed_at: Date.now(),
      updated_at: Date.now(),
    });
    return { review_status: hasOverride ? "manual_override" : args.review_status };
  },
});

export const routeContext = internalQuery({
  args: {
    admin_id: v.id("users"),
    origin_id: v.id("delivery_locations"),
    destination_id: v.id("delivery_locations"),
  },
  handler: async (ctx, args) => {
    const admin = await ctx.db.get(args.admin_id);
    if (admin?.role !== "admin") throw new Error("Admin access only");
    if (args.origin_id === args.destination_id) throw new Error("Choose two different destinations");
    const [origin, destination, config] = await Promise.all([
      ctx.db.get(args.origin_id),
      ctx.db.get(args.destination_id),
      ctx.db.query("delivery_routing_config").first(),
    ]);
    if (!origin || !destination || !config) throw new Error("Destination or routing configuration not found");
    if (
      !origin.is_active || !destination.is_active ||
      origin.coordinate_review_status === "restricted" ||
      destination.coordinate_review_status === "restricted"
    ) {
      throw new Error("Both destinations must be active and not marked as cycling-restricted");
    }
    if (
      origin.latitude === undefined || origin.longitude === undefined ||
      destination.latitude === undefined || destination.longitude === undefined
    ) {
      throw new Error("Both destinations need coordinates before route testing");
    }
    return { origin, destination, config };
  },
});

export const reserveRequest = internalMutation({
  args: { utc_day: v.string() },
  handler: async (ctx, args) => {
    const existing = await ctx.db.query("delivery_route_usage")
      .withIndex("by_day", (q) => q.eq("utc_day", args.utc_day)).first();
    if ((existing?.requests_reserved ?? 0) >= MAX_ROUTING_REQUESTS_PER_UTC_DAY) {
      throw new Error(`Daily development routing limit of ${MAX_ROUTING_REQUESTS_PER_UTC_DAY} requests reached`);
    }
    const now = Date.now();
    if (existing) {
      await ctx.db.patch(existing._id, { requests_reserved: existing.requests_reserved + 1, updated_at: now });
      return { requests_reserved: existing.requests_reserved + 1 };
    }
    await ctx.db.insert("delivery_route_usage", { utc_day: args.utc_day, requests_reserved: 1, updated_at: now });
    return { requests_reserved: 1 };
  },
});

export const recordRouteResult = internalMutation({
  args: {
    origin_id: v.id("delivery_locations"),
    destination_id: v.id("delivery_locations"),
    origin_name: v.string(),
    destination_name: v.string(),
    origin_latitude: v.number(),
    origin_longitude: v.number(),
    destination_latitude: v.number(),
    destination_longitude: v.number(),
    provider: v.string(),
    attribution: v.optional(v.string()),
    routing_status: v.string(),
    review_status: v.string(),
    distance_meters: v.optional(v.number()),
    duration_seconds: v.optional(v.number()),
    origin_snap_distance_meters: v.optional(v.number()),
    destination_snap_distance_meters: v.optional(v.number()),
    estimated_zone: v.optional(v.string()),
    estimated_bicycle_rental_cost: v.optional(v.number()),
    estimated_rider_compensation: v.optional(v.number()),
    estimated_repositioning_allowance: v.optional(v.number()),
    estimated_parking_allowance: v.optional(v.number()),
    estimated_margin: v.optional(v.number()),
    estimated_total: v.optional(v.number()),
    review_note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const id = await ctx.db.insert("delivery_route_reviews", {
      ...args,
      created_at: Date.now(),
      updated_at: Date.now(),
    });
    return { id };
  },
});

export const testRoute = action({
  args: {
    origin_id: v.id("delivery_locations"),
    destination_id: v.id("delivery_locations"),
  },
  handler: async (ctx, args): Promise<{ id: string; routing_status: string; review_status: string }> => {
    const adminId = await requireUserId(ctx);
    const { origin, destination, config } = await ctx.runQuery(
      internal.functions.deliveryRouting.routeContext,
      { admin_id: adminId, origin_id: args.origin_id, destination_id: args.destination_id },
    );
    if (process.env.ROUTING_PILOT_ENABLED !== "true") {
      throw new Error("Routing pilot is disabled. Enable it only on a development Convex deployment.");
    }
    if (!/^(dev|local):/.test(process.env.CONVEX_DEPLOYMENT ?? "")) {
      throw new Error("Route testing is allowed only on a local or development Convex deployment");
    }
    if (config.provider === "graphhopper") {
      if (!process.env.GRAPHHOPPER_API_KEY) throw new Error("GraphHopper API key is not configured in backend environment variables");
      if (process.env.GRAPHHOPPER_NO_BILLING_ACCOUNT_CONFIRMED !== "true") {
        throw new Error("Confirm this GraphHopper key belongs to a free account with no billing method before testing");
      }
    } else if (config.provider === "osrm" && !process.env.OSRM_ROUTING_URL) {
      throw new Error("Self-hosted OSRM URL is not configured in backend environment variables");
    }
    const utcDay = new Date().toISOString().slice(0, 10);
    await ctx.runMutation(internal.functions.deliveryRouting.reserveRequest, { utc_day: utcDay });
    const environment = {
      provider: config.provider,
      graphhopperApiKey: process.env.GRAPHHOPPER_API_KEY,
      osrmBaseUrl: process.env.OSRM_ROUTING_URL,
    };
    const originPoint = { latitude: origin.latitude!, longitude: origin.longitude! };
    const destinationPoint = { latitude: destination.latitude!, longitude: destination.longitude! };
    const straightLineDistance = distanceBetweenPointsMeters(originPoint, destinationPoint);
    let route;
    try {
      route = await fetchRoute(originPoint, destinationPoint, environment);
    } catch (error) {
      if (!(error instanceof RoutingProviderError)) {
        console.error("[delivery-routing] Unexpected route provider failure", error);
        throw error;
      }
      const message = error.message;
      console.error("[delivery-routing] Route test failed", error);
      const result = await ctx.runMutation(internal.functions.deliveryRouting.recordRouteResult, {
        origin_id: origin._id,
        destination_id: destination._id,
        origin_name: origin.name,
        destination_name: destination.name,
        origin_latitude: originPoint.latitude,
        origin_longitude: originPoint.longitude,
        destination_latitude: destinationPoint.latitude,
        destination_longitude: destinationPoint.longitude,
        provider: config.provider,
        attribution: config.provider === "graphhopper"
          ? "GraphHopper, OpenStreetMap contributors"
          : "OpenStreetMap contributors",
        routing_status: "route_unavailable",
        review_status: "needs_review",
        review_note: message,
      });
      return { id: result.id, routing_status: "route_unavailable", review_status: "needs_review" };
    }
    const pricing = estimateDeliveryCost(route.distance_meters, route.duration_seconds, config);
    const warnings: string[] = [];
    if (
      origin.coordinate_review_status !== "approved" ||
      destination.coordinate_review_status !== "approved" ||
      !origin.meeting_point_name ||
      !destination.meeting_point_name
    ) {
      warnings.push("One or both coordinates or public meeting points are not admin-approved.");
    }
    if (
      (route.origin_snap_distance_meters ?? 0) > MAX_SNAP_DISTANCE_METERS ||
      (route.destination_snap_distance_meters ?? 0) > MAX_SNAP_DISTANCE_METERS
    ) {
      warnings.push("Routing provider snapped a coordinate more than 250m from the selected point.");
    }
    if (route.distance_meters < straightLineDistance * 0.95) {
      warnings.push("Routed distance is unexpectedly close to or shorter than straight-line distance.");
    }
    const result = await ctx.runMutation(internal.functions.deliveryRouting.recordRouteResult, {
      origin_id: origin._id,
      destination_id: destination._id,
      origin_name: origin.name,
      destination_name: destination.name,
      origin_latitude: originPoint.latitude,
      origin_longitude: originPoint.longitude,
      destination_latitude: destinationPoint.latitude,
      destination_longitude: destinationPoint.longitude,
      provider: config.provider,
      attribution: config.provider === "graphhopper"
        ? "GraphHopper, OpenStreetMap contributors"
        : "OpenStreetMap contributors",
      routing_status: warnings.length ? "route_found_with_warnings" : "route_found",
      review_status: "needs_review",
      distance_meters: route.distance_meters,
      duration_seconds: route.duration_seconds,
      origin_snap_distance_meters: route.origin_snap_distance_meters,
      destination_snap_distance_meters: route.destination_snap_distance_meters,
      ...pricing,
      review_note: warnings.length ? warnings.join(" ") : "Map-derived estimate; pending human route suitability review.",
    });
    return { id: result.id, routing_status: warnings.length ? "route_found_with_warnings" : "route_found", review_status: "needs_review" };
  },
});
