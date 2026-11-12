import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { deliveryApi, deliveryRoutingApi } from "./api";
import { Button } from "./button";
import { Card, CardContent, CardHeader, CardTitle } from "./card";
import { Input } from "./input";

type RoutingConfig = {
  provider: string;
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
  pricing_reviewed: boolean;
};

type RouteLocation = {
  _id: string;
  name: string;
  category: string;
  is_active: boolean;
  latitude?: number;
  longitude?: number;
  coordinate_source?: string;
  coordinate_reference?: string;
  meeting_point_name?: string;
  coordinate_review_status?: string;
};

type RouteReviewRecord = {
  _id: string;
  origin_name: string;
  destination_name: string;
  provider: string;
  attribution?: string;
  routing_status: string;
  review_status: string;
  distance_meters?: number;
  duration_seconds?: number;
  origin_snap_distance_meters?: number;
  destination_snap_distance_meters?: number;
  estimated_zone?: string;
  estimated_bicycle_rental_cost?: number;
  estimated_rider_compensation?: number;
  estimated_repositioning_allowance?: number;
  estimated_parking_allowance?: number;
  estimated_margin?: number;
  estimated_total?: number;
  override_distance_meters?: number;
  override_duration_seconds?: number;
  override_estimated_total?: number;
  override_note?: string;
  review_note?: string;
  created_at: number;
};

type Dashboard = {
  config: RoutingConfig;
  locations: RouteLocation[];
  routes: RouteReviewRecord[];
  usage: { utc_day: string; requests_reserved: number }[];
  daily_request_limit: number;
  graphhopper_key_configured: boolean;
  graphhopper_no_billing_confirmed: boolean;
  routing_pilot_enabled: boolean;
  development_deployment: boolean;
  osrm_url_configured: boolean;
};

export default function DeliveryRoutingAdmin() {
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [originId, setOriginId] = useState("");
  const [destinationId, setDestinationId] = useState("");
  const [testing, setTesting] = useState(false);

  const load = async () => {
    const result = await deliveryRoutingApi.adminDashboard();
    setLoading(false);
    if (result.error || !result.data) {
      toast.error(result.error || "Could not load routing pilot settings.");
      return;
    }
    setDashboard(result.data as Dashboard);
  };

  useEffect(() => {
    let active = true;
    void deliveryApi.initializeAdminDefaults().then((result) => {
      if (!active) return;
      if (result.error) {
        setLoading(false);
        toast.error(result.error);
        return;
      }
      void load();
    });
    return () => { active = false; };
  }, []);

  const testableLocations = useMemo(
    () => dashboard?.locations.filter((location) =>
      location.is_active && location.latitude !== undefined && location.longitude !== undefined &&
      location.coordinate_review_status !== "restricted",
    ) ?? [],
    [dashboard?.locations],
  );
  const today = new Date().toISOString().slice(0, 10);
  const usedToday = dashboard?.usage.find((usage) => usage.utc_day === today)?.requests_reserved ?? 0;

  const testRoute = async () => {
    if (!originId || !destinationId) return toast.error("Choose an origin and destination.");
    setTesting(true);
    const result = await deliveryRoutingApi.testRoute(originId, destinationId);
    setTesting(false);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success(result.data?.routing_status === "route_unavailable"
      ? "No usable route. The attempt was recorded for admin review."
      : "Route recorded as pending admin accuracy and cycling-suitability review.");
    void load();
  };

  if (loading) return <Card><CardContent className="p-5">Loading routing pilot...</CardContent></Card>;
  if (!dashboard) return null;

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader><CardTitle>Map-based routing pilot — delivery disabled</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="rounded-md border border-amber-400 bg-amber-50 p-3 text-sm text-amber-950">
            Development research only. Route estimates and cost previews are not customer charges. Delivery remains hard-disabled.
          </div>
          <p className="text-sm">Provider key stays on the Convex backend. GraphHopper free-account confirmation: {dashboard.graphhopper_no_billing_confirmed ? "configured" : "not configured"} · API key: {dashboard.graphhopper_key_configured ? "configured" : "not configured"} · pilot flag: {dashboard.routing_pilot_enabled ? "on" : "off"} · development deployment: {dashboard.development_deployment ? "yes" : "no"}</p>
          <p className="text-sm font-medium">Strict request cap: {usedToday}/{dashboard.daily_request_limit} route calls used today (UTC). Each two-point GraphHopper route is limited as one route request; no matrix calls or automatic retries are made.</p>
          {!dashboard.development_deployment && <p className="text-sm text-destructive">Route calls are blocked unless this is a local or development Convex deployment.</p>}
          {dashboard.config.provider === "graphhopper" && !dashboard.graphhopper_no_billing_confirmed && <p className="text-sm text-destructive">Route calls are blocked until you confirm the API key is from a free account with no billing method.</p>}
          {dashboard.config.provider === "osrm" && !dashboard.osrm_url_configured && <p className="text-sm text-muted-foreground">Self-hosted OSRM is selected but has no server URL configured.</p>}
          <p className="text-xs text-muted-foreground">No customer charge is calculated or used by checkout. Verify map coverage, bicycle access and designated public meeting points manually. OSM-derived data: © OpenStreetMap contributors, ODbL.</p>
        </CardContent>
      </Card>

      <RoutingConfigEditor initial={dashboard.config} onSave={async (config) => {
        const result = await deliveryRoutingApi.saveConfig(config);
        if (result.error) toast.error(result.error);
        else { toast.success("Pilot thresholds and estimate formula saved. Pricing review remains incomplete."); void load(); }
      }} />

      <Card>
        <CardHeader><CardTitle>Destination coordinates and meeting points</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">Seeded OSM way centroids are unverified candidate points, not delivery entrances. Confirm each exact coordinate and public bicycle-accessible meeting point. Mark restricted areas so they cannot be route-test endpoints.</p>
          <div className="space-y-3">
            {dashboard.locations.map((location) => <LocationCoordinateEditor
              key={location._id}
              location={location}
              onSave={async (coordinates) => {
                const result = await deliveryRoutingApi.saveCoordinates(coordinates);
                if (result.error) toast.error(result.error);
                else { toast.success(`${location.name} coordinates saved.`); void load(); }
              }}
            />)}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Manual bicycle route tests</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">Test one directed origin-to-destination pair at a time. Unverified points can be tested for research, but are automatically flagged for review. The daily hard cap is five provider requests.</p>
          <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
            <select className="rounded-md border bg-background p-2 text-sm" value={originId} onChange={(event) => setOriginId(event.target.value)} aria-label="Route origin">
              <option value="">Select pickup origin</option>
              {testableLocations.map((location) => <option key={location._id} value={location._id}>{location.name} · {location.coordinate_review_status ?? "unreviewed"}</option>)}
            </select>
            <select className="rounded-md border bg-background p-2 text-sm" value={destinationId} onChange={(event) => setDestinationId(event.target.value)} aria-label="Route destination">
              <option value="">Select destination</option>
              {testableLocations.filter((location) => location._id !== originId).map((location) => <option key={location._id} value={location._id}>{location.name} · {location.coordinate_review_status ?? "unreviewed"}</option>)}
            </select>
            <Button onClick={() => void testRoute()} disabled={testing || usedToday >= dashboard.daily_request_limit || !dashboard.development_deployment}>
              {testing ? "Requesting..." : "Test bicycle route"}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">A route request is only attempted when the backend pilot flag, development deployment, provider credentials and (for GraphHopper) no-billing confirmation are all valid.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Route results and manual review</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {dashboard.routes.map((route) => <RouteReviewEditor key={route._id} route={route} onSave={async (review) => {
            const result = await deliveryRoutingApi.reviewRoute(review);
            if (result.error) toast.error(result.error);
            else { toast.success("Route review saved."); void load(); }
          }} />)}
          {dashboard.routes.length === 0 && <p className="text-sm text-muted-foreground">No routes tested yet.</p>}
        </CardContent>
      </Card>
    </div>
  );
}

function RoutingConfigEditor({ initial, onSave }: {
  initial: RoutingConfig;
  onSave: (config: Omit<RoutingConfig, "pricing_reviewed">) => void;
}) {
  const [config, setConfig] = useState(initial);
  const [saving, setSaving] = useState(false);
  const numericFields: { key: keyof RoutingConfig; label: string; unit: string }[] = [
    { key: "nearby_max_distance_m", label: "Nearby max distance", unit: "m" },
    { key: "intermediate_max_distance_m", label: "Intermediate max distance", unit: "m" },
    { key: "nearby_max_time_seconds", label: "Nearby max travel time", unit: "seconds" },
    { key: "intermediate_max_time_seconds", label: "Intermediate max travel time", unit: "seconds" },
    { key: "bicycle_rental_hourly_cost", label: "Bicycle rental", unit: "GHS/hour" },
    { key: "rider_compensation_base", label: "Rider base compensation", unit: "GHS" },
    { key: "rider_compensation_per_minute", label: "Rider compensation", unit: "GHS/minute" },
    { key: "delivery_margin_fixed", label: "Fixed margin", unit: "GHS" },
    { key: "delivery_margin_percent", label: "Margin percentage", unit: "%" },
    { key: "repositioning_minutes", label: "Repositioning allowance", unit: "minutes" },
    { key: "parking_allowance", label: "Parking allowance", unit: "GHS" },
  ];
  return (
    <Card>
      <CardHeader><CardTitle>Routing thresholds and estimate formula</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">These are research settings only. Saving them never enables delivery and never affects checkout totals.</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1 text-sm">Routing provider
            <select className="w-full rounded-md border bg-background p-2" value={config.provider} onChange={(event) => setConfig({ ...config, provider: event.target.value })}>
              <option value="graphhopper">GraphHopper hosted API</option>
              <option value="osrm">Self-hosted OSRM (development only)</option>
            </select>
          </label>
          <label className="space-y-1 text-sm">Zone classification based on
            <select className="w-full rounded-md border bg-background p-2" value={config.zone_basis} onChange={(event) => setConfig({ ...config, zone_basis: event.target.value })}>
              <option value="distance">Cycling route distance</option>
              <option value="travel_time">Estimated cycling travel time</option>
            </select>
          </label>
          {numericFields.map(({ key, label, unit }) => <label key={key} className="space-y-1 text-sm">{label} ({unit})
            <Input type="number" min="0" step="0.01" value={config[key] as number} onChange={(event) => setConfig({ ...config, [key]: Number(event.target.value) })} />
          </label>)}
        </div>
        <Button disabled={saving} onClick={async () => {
          setSaving(true);
          await onSave({
            provider: config.provider,
            zone_basis: config.zone_basis,
            nearby_max_distance_m: config.nearby_max_distance_m,
            intermediate_max_distance_m: config.intermediate_max_distance_m,
            nearby_max_time_seconds: config.nearby_max_time_seconds,
            intermediate_max_time_seconds: config.intermediate_max_time_seconds,
            bicycle_rental_hourly_cost: config.bicycle_rental_hourly_cost,
            rider_compensation_base: config.rider_compensation_base,
            rider_compensation_per_minute: config.rider_compensation_per_minute,
            delivery_margin_fixed: config.delivery_margin_fixed,
            delivery_margin_percent: config.delivery_margin_percent,
            repositioning_minutes: config.repositioning_minutes,
            parking_allowance: config.parking_allowance,
          });
          setSaving(false);
        }}>{saving ? "Saving..." : "Save pilot settings"}</Button>
      </CardContent>
    </Card>
  );
}

function LocationCoordinateEditor({ location, onSave }: {
  location: RouteLocation;
  onSave: (coordinates: {
    id: string; latitude: number; longitude: number; coordinate_source: string;
    coordinate_reference: string; meeting_point_name: string; coordinate_review_status: string;
  }) => void;
}) {
  const [latitude, setLatitude] = useState(location.latitude?.toString() ?? "");
  const [longitude, setLongitude] = useState(location.longitude?.toString() ?? "");
  const [source, setSource] = useState(location.coordinate_source ?? "OpenStreetMap");
  const [reference, setReference] = useState(location.coordinate_reference ?? "");
  const [meetingPoint, setMeetingPoint] = useState(location.meeting_point_name ?? "");
  const [reviewStatus, setReviewStatus] = useState(location.coordinate_review_status ?? "needs_review");
  return (
    <div className="space-y-2 rounded-md border p-3">
      <p className="font-medium">{location.name} · {location.category} {location.is_active ? "" : "(inactive)"}</p>
      <p className="text-xs text-muted-foreground">{location.coordinate_source ?? "No coordinate source"}{location.coordinate_reference ? ` · ${location.coordinate_reference}` : ""}</p>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <Input aria-label={`${location.name} latitude`} placeholder="Latitude" type="number" step="0.000001" value={latitude} onChange={(event) => setLatitude(event.target.value)} />
        <Input aria-label={`${location.name} longitude`} placeholder="Longitude" type="number" step="0.000001" value={longitude} onChange={(event) => setLongitude(event.target.value)} />
        <Input aria-label={`${location.name} coordinate source`} placeholder="Coordinate source" value={source} onChange={(event) => setSource(event.target.value)} />
        <Input aria-label={`${location.name} map reference`} placeholder="OSM URL or feature ID" value={reference} onChange={(event) => setReference(event.target.value)} />
        <Input className="sm:col-span-2" aria-label={`${location.name} public meeting point`} placeholder="Designated public bicycle-accessible meeting point" value={meetingPoint} onChange={(event) => setMeetingPoint(event.target.value)} />
        <select className="rounded-md border bg-background p-2 text-sm" value={reviewStatus} onChange={(event) => setReviewStatus(event.target.value)} aria-label={`${location.name} coordinate review status`}>
          <option value="needs_review">Needs review</option>
          <option value="manual_review">Manual review</option>
          <option value="approved">Admin-approved for route testing</option>
          <option value="restricted">Cycling restricted / do not route</option>
        </select>
        <Button disabled={!latitude || !longitude || !source.trim() || !meetingPoint.trim()} onClick={() => onSave({
          id: location._id, latitude: Number(latitude), longitude: Number(longitude), coordinate_source: source,
          coordinate_reference: reference, meeting_point_name: meetingPoint, coordinate_review_status: reviewStatus,
        })}>Save coordinates</Button>
      </div>
    </div>
  );
}

function RouteReviewEditor({ route, onSave }: {
  route: RouteReviewRecord;
  onSave: (review: {
    id: string; review_status: string; review_note: string;
    override_distance_meters?: number; override_duration_seconds?: number;
    override_estimated_total?: number; override_note?: string;
  }) => void;
}) {
  const [status, setStatus] = useState(route.review_status === "manual_override" ? "suitable" : route.review_status);
  const [note, setNote] = useState(route.review_note ?? "");
  const [overrideDistance, setOverrideDistance] = useState(route.override_distance_meters?.toString() ?? "");
  const [overrideTime, setOverrideTime] = useState(route.override_duration_seconds?.toString() ?? "");
  const [overrideTotal, setOverrideTotal] = useState(route.override_estimated_total?.toString() ?? "");
  const [overrideNote, setOverrideNote] = useState(route.override_note ?? "");
  const hasRouteOverride = Boolean(overrideDistance || overrideTime);
  const hasOverride = hasRouteOverride || Boolean(overrideTotal);
  const displayedDistance = route.override_distance_meters ?? route.distance_meters;
  const displayedDuration = route.override_duration_seconds ?? route.duration_seconds;
  return (
    <div className="space-y-2 rounded-md border p-3">
      <div className="flex flex-wrap justify-between gap-2">
        <p className="font-medium">{route.origin_name} → {route.destination_name}</p>
        <span className="text-xs">{route.provider} · {route.routing_status} · {route.review_status}</span>
      </div>
      <p className="text-sm">{displayedDistance ? `${(displayedDistance / 1000).toFixed(2)} km · ${Math.round((displayedDuration ?? 0) / 60)} min${route.override_distance_meters !== undefined ? " · admin route override" : ""}` : "No usable route"}{route.estimated_zone ? ` · estimated ${route.estimated_zone}` : ""}</p>
      {route.attribution && <p className="text-xs text-muted-foreground">{route.attribution}</p>}
      {route.estimated_total !== undefined && <p className="text-sm text-muted-foreground">Research-only cost preview: bicycle GHS {route.estimated_bicycle_rental_cost?.toFixed(2)} + rider GHS {route.estimated_rider_compensation?.toFixed(2)} + repositioning GHS {route.estimated_repositioning_allowance?.toFixed(2)} + parking GHS {route.estimated_parking_allowance?.toFixed(2)} + margin GHS {route.estimated_margin?.toFixed(2)} = GHS {route.estimated_total.toFixed(2)}. Not a customer price.</p>}
      {route.override_estimated_total !== undefined && <p className="text-sm font-medium">Admin research estimate override: GHS {route.override_estimated_total.toFixed(2)}. Not a customer price.</p>}
      {(route.origin_snap_distance_meters !== undefined || route.destination_snap_distance_meters !== undefined) && <p className="text-xs text-muted-foreground">Provider snap offset: origin {Math.round(route.origin_snap_distance_meters ?? 0)}m, destination {Math.round(route.destination_snap_distance_meters ?? 0)}m</p>}
      {route.review_note && <p className="text-xs text-amber-800">{route.review_note}</p>}
      <div className="grid gap-2 sm:grid-cols-2">
        <select className="rounded-md border bg-background p-2 text-sm" value={status} onChange={(event) => setStatus(event.target.value)} aria-label="Route review result">
          <option value="needs_review">Needs review</option>
          <option value="suitable">Suitable for pilot</option>
          <option value="unsuitable">Unsuitable / inaccurate</option>
        </select>
        <Input placeholder="Review evidence and any cycling access concerns" value={note} onChange={(event) => setNote(event.target.value)} aria-label="Route review note" />
        <Input type="number" min="0.01" step="1" placeholder="Override distance (m, optional)" value={overrideDistance} onChange={(event) => setOverrideDistance(event.target.value)} />
        <Input type="number" min="0.01" step="1" placeholder="Override duration (seconds, optional)" value={overrideTime} onChange={(event) => setOverrideTime(event.target.value)} />
        <Input type="number" min="0" step="0.01" placeholder="Override estimate (GHS, optional)" value={overrideTotal} onChange={(event) => setOverrideTotal(event.target.value)} />
        {hasOverride && <Input className="sm:col-span-2" placeholder="Why is the route overridden? (required)" value={overrideNote} onChange={(event) => setOverrideNote(event.target.value)} />}
      </div>
      <Button disabled={!note.trim() || (hasRouteOverride && (!overrideDistance || !overrideTime)) || (hasOverride && !overrideNote.trim())} onClick={() => onSave({
        id: route._id, review_status: status, review_note: note,
        ...(hasRouteOverride ? {
          override_distance_meters: Number(overrideDistance),
          override_duration_seconds: Number(overrideTime),
        } : {}),
        ...(overrideTotal ? { override_estimated_total: Number(overrideTotal) } : {}),
        ...(hasOverride ? { override_note: overrideNote } : {}),
      })}>Save route review</Button>
    </div>
  );
}
