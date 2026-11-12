import { afterEach, describe, expect, it, vi } from "vitest";
import {
  classifyDeliveryZone,
  estimateDeliveryCost,
  fetchRoute,
  MAX_ROUTING_REQUESTS_PER_UTC_DAY,
  RoutingProviderError,
  type RoutingConfig,
} from "../convex/lib/deliveryRouting";

const config: RoutingConfig = {
  zone_basis: "distance",
  nearby_max_distance_m: 1000,
  intermediate_max_distance_m: 3000,
  nearby_max_time_seconds: 300,
  intermediate_max_time_seconds: 900,
  bicycle_rental_hourly_cost: 12,
  rider_compensation_base: 5,
  rider_compensation_per_minute: 0.5,
  delivery_margin_fixed: 2,
  delivery_margin_percent: 10,
  repositioning_minutes: 4,
  parking_allowance: 1,
};

afterEach(() => vi.unstubAllGlobals());

describe("delivery routing pilot policy", () => {
  it("uses configured distance or travel-time thresholds", () => {
    expect(classifyDeliveryZone(1000, 1000, config)).toBe("Nearby");
    expect(classifyDeliveryZone(1001, 2000, config)).toBe("Intermediate");
    expect(classifyDeliveryZone(3001, 1, config)).toBe("Farther");
    expect(classifyDeliveryZone(5000, 300, { ...config, zone_basis: "travel_time" })).toBe("Nearby");
  });

  it("includes rider and bicycle costs for repositioning in the research estimate", () => {
    expect(estimateDeliveryCost(500, 600, config)).toEqual({
      estimated_zone: "Nearby",
      estimated_bicycle_rental_cost: 2,
      estimated_rider_compensation: 12,
      estimated_repositioning_allowance: 0.8,
      estimated_parking_allowance: 1,
      estimated_margin: 3.58,
      estimated_total: 19.38,
    });
  });

  it("keeps the hard daily request cap at five", () => {
    expect(MAX_ROUTING_REQUESTS_PER_UTC_DAY).toBe(5);
  });

  it("requests a GraphHopper bicycle route and reports map snap offsets", async () => {
    let requestedUrl: URL | undefined;
    vi.stubGlobal("fetch", async (input: RequestInfo | URL) => {
      requestedUrl = new URL(String(input));
      return new Response(JSON.stringify({
        paths: [{
          distance: 1250,
          time: 600_000,
          snapped_waypoints: { coordinates: [[-0.2, 5.65], [-0.19, 5.66]] },
        }],
      }), { status: 200 });
    });

    const result = await fetchRoute(
      { latitude: 5.65, longitude: -0.2 },
      { latitude: 5.66, longitude: -0.19 },
      { provider: "graphhopper", graphhopperApiKey: "test-key" },
    );

    expect(requestedUrl?.searchParams.get("profile")).toBe("bike");
    expect(requestedUrl?.searchParams.get("key")).toBe("test-key");
    expect(result.distance_meters).toBe(1250);
    expect(result.duration_seconds).toBe(600);
    expect(result.origin_snap_distance_meters).toBe(0);
  });

  it("uses OSRM bike routing with longitude-latitude coordinate order", async () => {
    let requestedUrl: URL | undefined;
    vi.stubGlobal("fetch", async (input: RequestInfo | URL) => {
      requestedUrl = new URL(String(input));
      return new Response(JSON.stringify({
        code: "Ok",
        routes: [{ distance: 2100, duration: 720 }],
      }), { status: 200 });
    });

    const result = await fetchRoute(
      { latitude: 5.65, longitude: -0.2 },
      { latitude: 5.66, longitude: -0.19 },
      { provider: "osrm", osrmBaseUrl: "http://localhost:5000" },
    );

    expect(requestedUrl?.pathname).toContain("/route/v1/bike/-0.2,5.65;-0.19,5.66");
    expect(result.distance_meters).toBe(2100);
  });

  it("does not make a request without a backend GraphHopper key", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(fetchRoute(
      { latitude: 5.65, longitude: -0.2 },
      { latitude: 5.66, longitude: -0.19 },
      { provider: "graphhopper" },
    )).rejects.toBeInstanceOf(RoutingProviderError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("treats malformed provider data as an unavailable route", async () => {
    vi.stubGlobal("fetch", async () => new Response("{", { status: 200 }));
    await expect(fetchRoute(
      { latitude: 5.65, longitude: -0.2 },
      { latitude: 5.66, longitude: -0.19 },
      { provider: "osrm", osrmBaseUrl: "http://localhost:5000" },
    )).rejects.toThrow("malformed route data");
  });
});
