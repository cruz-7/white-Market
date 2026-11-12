import { ConvexError } from "convex/values";

export const MAX_ROUTING_REQUESTS_PER_UTC_DAY = 5;
export const ROUTING_REQUEST_TIMEOUT_MS = 10_000;
export const MAX_SNAP_DISTANCE_METERS = 250;

export interface RoutingPoint {
  latitude: number;
  longitude: number;
}

export interface RouteResult {
  distance_meters: number;
  duration_seconds: number;
  origin_snap_distance_meters?: number;
  destination_snap_distance_meters?: number;
}

export interface RoutingEnvironment {
  provider: string;
  graphhopperApiKey?: string;
  osrmBaseUrl?: string;
}

export interface RoutingConfig {
  zone_basis: string;
  nearby_max_distance_m: number;
  intermediate_max_distance_m: number;
  nearby_max_time_seconds: number;
  intermediate_max_time_seconds: number;
  bicycle_rental_hourly_cost: number;
  rider_compensation_base: number;
  rider_compensation_per_minute: number;
  delivery_margin_fixed: number;
  delivery_margin_percent: number;
  repositioning_minutes: number;
  parking_allowance: number;
}

export class RoutingProviderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RoutingProviderError";
  }
}

export function classifyDeliveryZone(
  distanceMeters: number,
  durationSeconds: number,
  config: Pick<RoutingConfig,
    "zone_basis" | "nearby_max_distance_m" | "intermediate_max_distance_m" |
    "nearby_max_time_seconds" | "intermediate_max_time_seconds">,
): "Nearby" | "Intermediate" | "Farther" {
  const value = config.zone_basis === "travel_time" ? durationSeconds : distanceMeters;
  const nearbyMax = config.zone_basis === "travel_time"
    ? config.nearby_max_time_seconds : config.nearby_max_distance_m;
  const intermediateMax = config.zone_basis === "travel_time"
    ? config.intermediate_max_time_seconds : config.intermediate_max_distance_m;
  if (value <= nearbyMax) return "Nearby";
  if (value <= intermediateMax) return "Intermediate";
  return "Farther";
}

export function estimateDeliveryCost(
  distanceMeters: number,
  durationSeconds: number,
  config: RoutingConfig,
) {
  const travelMinutes = durationSeconds / 60;
  const bicycleRentalCost = roundMoney(
    travelMinutes * config.bicycle_rental_hourly_cost / 60,
  );
  const riderCompensation = roundMoney(
    config.rider_compensation_base +
      (travelMinutes + config.repositioning_minutes) * config.rider_compensation_per_minute,
  );
  const repositioningAllowance = roundMoney(
    config.repositioning_minutes * config.bicycle_rental_hourly_cost / 60,
  );
  const baseCost = bicycleRentalCost + riderCompensation +
    repositioningAllowance + config.parking_allowance;
  const margin = roundMoney(
    config.delivery_margin_fixed + baseCost * config.delivery_margin_percent / 100,
  );
  return {
    estimated_zone: classifyDeliveryZone(distanceMeters, durationSeconds, config),
    estimated_bicycle_rental_cost: bicycleRentalCost,
    estimated_rider_compensation: riderCompensation,
    estimated_repositioning_allowance: repositioningAllowance,
    estimated_parking_allowance: roundMoney(config.parking_allowance),
    estimated_margin: margin,
    estimated_total: roundMoney(baseCost + margin),
  };
}

export function distanceBetweenPointsMeters(a: RoutingPoint, b: RoutingPoint): number {
  const toRadians = (degrees: number) => degrees * Math.PI / 180;
  const lat1 = toRadians(a.latitude);
  const lat2 = toRadians(b.latitude);
  const deltaLat = lat2 - lat1;
  const deltaLon = toRadians(b.longitude - a.longitude);
  const h = Math.sin(deltaLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) ** 2;
  return 6_371_000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

export async function fetchRoute(
  origin: RoutingPoint,
  destination: RoutingPoint,
  environment: RoutingEnvironment,
): Promise<RouteResult> {
  if (environment.provider === "graphhopper") {
    if (!environment.graphhopperApiKey) {
      throw new RoutingProviderError("GraphHopper API key is not configured on the backend");
    }
    return fetchGraphHopperRoute(origin, destination, environment.graphhopperApiKey);
  }
  if (environment.provider === "osrm") {
    if (!environment.osrmBaseUrl) {
      throw new RoutingProviderError("Self-hosted OSRM URL is not configured on the backend");
    }
    return fetchOsrmRoute(origin, destination, environment.osrmBaseUrl);
  }
  throw new RoutingProviderError("Unsupported routing provider");
}

async function fetchGraphHopperRoute(
  origin: RoutingPoint,
  destination: RoutingPoint,
  apiKey: string,
): Promise<RouteResult> {
  const url = new URL("https://graphhopper.com/api/1/route");
  url.searchParams.set("point", `${origin.latitude},${origin.longitude}`);
  url.searchParams.append("point", `${destination.latitude},${destination.longitude}`);
  url.searchParams.set("profile", "bike");
  url.searchParams.set("points_encoded", "false");
  url.searchParams.set("instructions", "false");
  url.searchParams.set("key", apiKey);
  const { response, body } = await request(url, "GraphHopper");
  if (!response.ok) {
    throw new RoutingProviderError(`GraphHopper route request failed (HTTP ${response.status})`);
  }
  if (!isRecord(body) || !Array.isArray(body.paths) || !isRecord(body.paths[0])) {
    throw new RoutingProviderError("GraphHopper returned no usable bicycle route");
  }
  const path = body.paths[0];
  if (!isFinitePositive(path.distance) || !isFinitePositive(path.time)) {
    throw new RoutingProviderError("GraphHopper returned invalid distance or travel time");
  }
  const snapped = Array.isArray(path.snapped_waypoints?.coordinates)
    ? path.snapped_waypoints.coordinates : undefined;
  const originSnap = snapped?.[0];
  const destinationSnap = snapped?.[1];
  return {
    distance_meters: path.distance,
    duration_seconds: path.time / 1000,
    origin_snap_distance_meters: isValidCoordinate(originSnap)
      ? distanceBetweenPointsMeters(origin, { latitude: originSnap[1], longitude: originSnap[0] })
      : undefined,
    destination_snap_distance_meters: isValidCoordinate(destinationSnap)
      ? distanceBetweenPointsMeters(destination, { latitude: destinationSnap[1], longitude: destinationSnap[0] })
      : undefined,
  };
}

async function fetchOsrmRoute(
  origin: RoutingPoint,
  destination: RoutingPoint,
  baseUrl: string,
): Promise<RouteResult> {
  let base: URL;
  try {
    base = new URL(baseUrl);
  } catch {
    throw new RoutingProviderError("Self-hosted OSRM URL is invalid");
  }
  if (!["http:", "https:"].includes(base.protocol) || base.username || base.password) {
    throw new RoutingProviderError("Self-hosted OSRM URL must use HTTP(S) without embedded credentials");
  }
  const url = new URL(
    `/route/v1/bike/${origin.longitude},${origin.latitude};${destination.longitude},${destination.latitude}`,
    base,
  );
  url.searchParams.set("overview", "false");
  url.searchParams.set("steps", "false");
  const { response, body } = await request(url, "OSRM");
  if (!response.ok) throw new RoutingProviderError(`OSRM route request failed (HTTP ${response.status})`);
  if (!isRecord(body) || body.code !== "Ok" || !Array.isArray(body.routes) || !isRecord(body.routes[0])) {
    throw new RoutingProviderError("OSRM returned no usable bicycle route");
  }
  const route = body.routes[0];
  if (!isFinitePositive(route.distance) || !isFinitePositive(route.duration)) {
    throw new RoutingProviderError("OSRM returned invalid distance or travel time");
  }
  return { distance_meters: route.distance, duration_seconds: route.duration };
}

async function request(url: URL, provider: string): Promise<{ response: Response; body: unknown }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ROUTING_REQUEST_TIMEOUT_MS);
  try {
    let response: Response;
    try {
      response = await fetch(url, { signal: controller.signal });
    } catch {
      throw new RoutingProviderError("Routing provider could not be reached or timed out");
    }
    if (!response.ok) return { response, body: undefined };
    try {
      return { response, body: await response.json() };
    } catch {
      throw new RoutingProviderError(`${provider} returned malformed route data`);
    }
  } finally {
    clearTimeout(timeout);
  }
}

function isValidCoordinate(value: unknown): value is [number, number] {
  return Array.isArray(value) && value.length >= 2 &&
    Number.isFinite(value[0]) && Number.isFinite(value[1]) &&
    value[0] >= -180 && value[0] <= 180 &&
    value[1] >= -90 && value[1] <= 90;
}

export function validateRoutingConfig(config: RoutingConfig): void {
  const numericValues = [
    config.nearby_max_distance_m,
    config.intermediate_max_distance_m,
    config.nearby_max_time_seconds,
    config.intermediate_max_time_seconds,
    config.bicycle_rental_hourly_cost,
    config.rider_compensation_base,
    config.rider_compensation_per_minute,
    config.delivery_margin_fixed,
    config.delivery_margin_percent,
    config.repositioning_minutes,
    config.parking_allowance,
  ];
  if (numericValues.some((value) => !Number.isFinite(value) || value < 0)) {
    throw new ConvexError("Routing thresholds and pricing inputs must be finite non-negative numbers");
  }
  if (
    config.nearby_max_distance_m <= 0 ||
    config.intermediate_max_distance_m <= config.nearby_max_distance_m ||
    config.nearby_max_time_seconds <= 0 ||
    config.intermediate_max_time_seconds <= config.nearby_max_time_seconds ||
    !["distance", "travel_time"].includes(config.zone_basis)
  ) {
    throw new ConvexError("Zone thresholds must increase from Nearby to Intermediate and use a supported basis");
  }
}

export function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function isRecord(value: unknown): value is Record<string, any> {
  return typeof value === "object" && value !== null;
}

function isFinitePositive(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}
