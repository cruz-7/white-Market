export interface DeliveryZonePolicy {
  _id: string;
  name: string;
  fee: number;
  is_configured: boolean;
  is_active: boolean;
}

export interface DeliveryLocationPolicy {
  zone_id?: string;
  is_active: boolean;
}

export interface RiderApplicationPolicy {
  status: string;
  created_at: number;
}

export const DELIVERY_LAUNCH_ENABLED = false;

export const ACTIVE_DELIVERY_STATUSES = [
  "awaiting_pickup",
  "picked_up",
  "in_transit",
  "delivered",
  "disputed",
] as const;

export function isDeliveryConfigurationComplete(
  zones: DeliveryZonePolicy[],
  locations: DeliveryLocationPolicy[],
): boolean {
  const requiredNames = ["Nearby", "Intermediate", "Farther"];
  const activeZones = zones.filter((zone) => zone.is_active);
  if (
    activeZones.length !== requiredNames.length ||
    requiredNames.some((name) => {
      const zone = activeZones.find((candidate) => candidate.name === name);
      return !zone || !zone.is_configured || zone.fee <= 0;
    })
  ) {
    return false;
  }

  const configuredZoneIds = new Set(
    activeZones.filter((zone) => zone.is_configured && zone.fee > 0).map((zone) => zone._id),
  );
  const activeLocations = locations.filter((location) => location.is_active);
  return activeLocations.length > 0 && activeLocations.every(
    (location) => location.zone_id !== undefined && configuredZoneIds.has(location.zone_id),
  );
}

export function isDeliveryEnabled(
  isEnabled: boolean,
  zones: DeliveryZonePolicy[],
  locations: DeliveryLocationPolicy[],
): boolean {
  return isEnabled && isDeliveryConfigurationComplete(zones, locations);
}

export function latestRiderApplication<T extends RiderApplicationPolicy>(
  applications: T[],
): T | undefined {
  return [...applications].sort((a, b) => b.created_at - a.created_at)[0];
}

export function isApprovedRider<T extends RiderApplicationPolicy>(
  applications: T[],
): boolean {
  return latestRiderApplication(applications)?.status === "approved";
}

export function isOperationalDelivery(status: string): boolean {
  return ACTIVE_DELIVERY_STATUSES.includes(status as (typeof ACTIVE_DELIVERY_STATUSES)[number]);
}
