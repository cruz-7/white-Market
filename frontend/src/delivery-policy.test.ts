import { describe, expect, it } from "vitest";
import {
  DELIVERY_LAUNCH_ENABLED,
  isDeliveryConfigurationComplete,
  isDeliveryEnabled,
  isOperationalDelivery,
  isApprovedRider,
} from "../convex/lib/deliveryPolicy";

const zones = [
  { _id: "near", name: "Nearby", fee: 5, is_configured: true, is_active: true },
  { _id: "mid", name: "Intermediate", fee: 10, is_configured: true, is_active: true },
  { _id: "far", name: "Farther", fee: 15, is_configured: true, is_active: true },
];

describe("delivery policy", () => {
  it("requires every active destination to use a configured active zone", () => {
    expect(isDeliveryConfigurationComplete(zones, [
      { zone_id: "near", is_active: true },
      { zone_id: "far", is_active: true },
      { is_active: false },
    ])).toBe(true);
    expect(isDeliveryConfigurationComplete(zones, [
      { zone_id: "near", is_active: true },
      { is_active: true },
    ])).toBe(false);
    expect(isDeliveryConfigurationComplete(zones, [
      { zone_id: "unknown", is_active: true },
    ])).toBe(false);
  });

  it("never enables delivery unless the explicit switch is enabled too", () => {
    const mappedLocations = [{ zone_id: "near", is_active: true }];
    expect(DELIVERY_LAUNCH_ENABLED).toBe(false);
    expect(isDeliveryEnabled(false, zones, mappedLocations)).toBe(false);
    expect(isDeliveryEnabled(true, zones, mappedLocations)).toBe(true);
    expect(isDeliveryEnabled(true, zones.slice(0, 2), mappedLocations)).toBe(false);
  });

  it("treats the latest rider application as authoritative", () => {
    expect(isApprovedRider([
      { status: "approved", created_at: 1 },
      { status: "suspended", created_at: 2 },
    ])).toBe(false);
    expect(isApprovedRider([
      { status: "suspended", created_at: 1 },
      { status: "approved", created_at: 2 },
    ])).toBe(true);
  });

  it("marks in-flight delivery stages as operational until closed", () => {
    expect(isOperationalDelivery("awaiting_pickup")).toBe(true);
    expect(isOperationalDelivery("in_transit")).toBe(true);
    expect(isOperationalDelivery("delivered")).toBe(true);
    expect(isOperationalDelivery("disputed")).toBe(true);
    expect(isOperationalDelivery("completed")).toBe(false);
    expect(isOperationalDelivery("cancelled")).toBe(false);
  });
});
