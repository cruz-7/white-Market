import { useEffect, useState } from "react";
import { toast } from "sonner";
import { deliveryApi } from "./api";
import { Button } from "./button";
import { Card, CardContent, CardHeader, CardTitle } from "./card";
import DeliveryRoutingAdmin from "./DeliveryRoutingAdmin";
import { Input } from "./input";

type AdminLocation = {
  _id: string; name: string; category: string; is_active: boolean;
  zone_id?: string; zone_name?: string;
};
type AdminZone = {
  _id: string; name: string; fee: number; rider_compensation?: number;
  transport_cost?: number; is_configured: boolean; is_active: boolean;
};
type RiderApplication = {
  id: string; email: string; legal_name: string; phone: string; student_id_number: string;
  status: string; rejection_reason?: string; has_document: boolean; created_at?: string;
};
type AdminDelivery = {
  id: string; order_id: string; status: string; buyer_id: string; seller_id: string;
  rider_id?: string; rider_name?: string; rider_phone?: string; destination?: string;
  zone?: string; meeting_point?: string; delivery_fee: number; rider_compensation: number;
  transport_cost: number; delivery_margin: number; item_amount?: number; order_amount?: number;
  commission?: number; seller_earning?: number; rider_compensation_paid: boolean;
  admin_intervention_required: boolean; admin_intervention_reason?: string;
  events: { event: string; actor_id: string; note?: string; at?: string }[];
};
type EligibleRider = { id: string; legal_name: string; phone: string };
type AdminComplaint = {
  _id: string; delivery_id: string; order_id: string; raised_by: string;
  reason: string; details: string; status: string; created_at: number;
};

export default function DeliveryAdminPanel() {
  const [locations, setLocations] = useState<AdminLocation[]>([]);
  const [zones, setZones] = useState<AdminZone[]>([]);
  const [applications, setApplications] = useState<RiderApplication[]>([]);
  const [deliveries, setDeliveries] = useState<AdminDelivery[]>([]);
  const [eligibleRiders, setEligibleRiders] = useState<EligibleRider[]>([]);
  const [complaints, setComplaints] = useState<AdminComplaint[]>([]);
  const [applicationStatus, setApplicationStatus] = useState("pending");
  const [locationName, setLocationName] = useState("");
  const [locationCategory, setLocationCategory] = useState("");
  const [locationZoneId, setLocationZoneId] = useState("");
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const [configuration, riders, deliveryRows, complaintRows, eligibleRiderRows] = await Promise.all([
      deliveryApi.adminConfiguration(),
      deliveryApi.adminRiderApplications(applicationStatus),
      deliveryApi.adminDeliveries(),
      deliveryApi.adminComplaints(),
      deliveryApi.adminEligibleRiders(),
    ]);
    setLoading(false);
    if (configuration.error || riders.error || deliveryRows.error || complaintRows.error || eligibleRiderRows.error) {
      const error = configuration.error || riders.error || deliveryRows.error || complaintRows.error || eligibleRiderRows.error;
      toast.error(error || "Could not load delivery administration data.");
      return;
    }
    setLocations(configuration.data?.locations ?? []);
    setZones(configuration.data?.zones ?? []);
    setApplications(riders.data ?? []);
    setDeliveries(deliveryRows.data ?? []);
    setComplaints(complaintRows.data ?? []);
    setEligibleRiders(eligibleRiderRows.data ?? []);
  };

  useEffect(() => {
    let active = true;
    void deliveryApi.initializeAdminDefaults().then((result) => {
      if (!active) return;
      if (result.error) {
        toast.error(result.error);
        setLoading(false);
      } else {
        void load();
      }
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    void load();
  }, [applicationStatus]);

  const saveZoneFee = async (
    zone: AdminZone, feeText: string, compensationText: string, transportText: string, tested: boolean,
  ) => {
    if (!tested) return toast.error("Confirm the amount was calculated from test deliveries before saving.");
    const fee = Number(feeText);
    const compensation = Number(compensationText);
    const transport = Number(transportText);
    if (!Number.isFinite(fee) || fee <= 0 || fee > 1000) return toast.error("Enter a valid delivery fee greater than zero.");
    if (!Number.isFinite(compensation) || compensation <= 0 || !Number.isFinite(transport) || transport < 0 || compensation + transport > fee) {
      return toast.error("Rider compensation and transport costs must be valid and cannot exceed the delivery fee.");
    }
    const result = await deliveryApi.setZoneFee(zone._id, fee, compensation, transport, true, true);
    if (result.error) toast.error(result.error);
    else { toast.success(`${zone.name} fee configured.`); void load(); }
  };

  const review = async (application: RiderApplication, action: "approved" | "rejected" | "suspended" | "deactivated") => {
    const reason = action === "rejected" || action === "suspended"
      ? window.prompt(`Reason for ${action}:`)?.trim()
      : undefined;
    if ((action === "rejected" || action === "suspended") && !reason) return;
    const result = await deliveryApi.reviewRiderApplication(application.id, action, reason);
    if (result.error) toast.error(result.error);
    else { toast.success(`Rider application ${action}.`); void load(); }
  };

  const openDocument = async (application: RiderApplication) => {
    const result = await deliveryApi.downloadRiderDocument(application.id);
    if (result.error || !result.data) return toast.error(result.error || "Could not load the private document.");
    const url = URL.createObjectURL(result.data);
    const opened = window.open(url, "_blank", "noopener,noreferrer");
    if (!opened) toast.error("Allow pop-ups to view the private document.");
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  };

  const addLocation = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const result = await deliveryApi.setLocation({
      name: locationName, category: locationCategory, is_active: true,
      zone_id: locationZoneId || undefined,
    });
    if (result.error) toast.error(result.error);
    else { setLocationName(""); setLocationCategory(""); setLocationZoneId(""); toast.success("Destination added."); void load(); }
  };

  const toggleLocation = async (location: AdminLocation) => {
    const result = await deliveryApi.setLocation({
      id: location._id, name: location.name, category: location.category, is_active: !location.is_active,
      zone_id: location.zone_id,
    });
    if (result.error) toast.error(result.error);
    else void load();
  };

  const setLocationZone = async (location: AdminLocation, zoneId: string) => {
    const result = await deliveryApi.setLocation({
      id: location._id, name: location.name, category: location.category, is_active: location.is_active,
      zone_id: zoneId || undefined, clear_zone: !zoneId,
    });
    if (result.error) toast.error(result.error);
    else { toast.success(`${location.name} zone assignment updated.`); void load(); }
  };

  const reassign = async (delivery: AdminDelivery, riderId: string) => {
    if (!riderId) return toast.error("Choose an eligible replacement rider.");
    const result = await deliveryApi.reassignDelivery(delivery.id, riderId);
    if (result.error) toast.error(result.error);
    else { toast.success("Replacement rider assigned. Seller confirmation is required for the new handoff."); void load(); }
  };

  const resolve = async (complaint: AdminComplaint) => {
    const resolution = window.prompt("Record the investigation outcome and action taken:")?.trim();
    if (!resolution) return;
    const suspend = window.confirm("Also suspend the assigned rider?");
    const result = await deliveryApi.resolveComplaint(complaint._id, resolution, suspend);
    if (result.error) toast.error(result.error);
    else { toast.success("Complaint resolved and recorded."); void load(); }
  };

  const activeLocations = locations.filter((location) => location.is_active);
  const mappedLocations = activeLocations.filter((location) =>
    location.zone_id && zones.some((zone) =>
      zone._id === location.zone_id && zone.is_active && zone.is_configured && zone.fee > 0,
    ),
  ).length;

  return (
    <div className="space-y-5">
      <DeliveryRoutingAdmin />
      <Card>
        <CardHeader><CardTitle>Delivery availability and tested zone fees</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">Delivery is intentionally disabled. Configure every destination and enter zone prices only after completing test deliveries. These settings will not enable checkout.</p>
          <div className="grid gap-3 md:grid-cols-3">
            {zones.map((zone) => <ZoneFeeEditor key={zone._id} zone={zone} onSave={saveZoneFee} />)}
          </div>
          <div className="rounded-md bg-amber-50 p-3 text-sm text-amber-900">
            Delivery remains disabled. {mappedLocations} of {activeLocations.length} active destinations have an active, priced zone assignment.
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Delivery destinations</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <form onSubmit={addLocation} className="grid gap-2 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_auto]">
            <Input value={locationName} onChange={(event) => setLocationName(event.target.value)} placeholder="Public destination name" required maxLength={100} />
            <Input value={locationCategory} onChange={(event) => setLocationCategory(event.target.value)} placeholder="Category, e.g. Hall" required maxLength={60} />
            <select className="rounded-md border bg-background p-2 text-sm" value={locationZoneId} onChange={(event) => setLocationZoneId(event.target.value)} aria-label="Destination delivery zone" required>
              <option value="">Assign a zone</option>
              {zones.map((zone) => <option key={zone._id} value={zone._id}>{zone.name}</option>)}
            </select>
            <Button type="submit">Add destination</Button>
          </form>
          <div className="grid gap-2">
            {locations.map((location) => <div key={location._id} className="flex flex-wrap items-center justify-between gap-2 rounded border p-3 text-sm">
              <span className="min-w-52 flex-1">{location.name} · {location.category} {location.is_active ? "" : "(inactive)"}</span>
              <select className="rounded-md border bg-background p-2 text-sm" value={location.zone_id ?? ""} onChange={(event) => void setLocationZone(location, event.target.value)} aria-label={`${location.name} delivery zone`}>
                <option value="">Unassigned</option>
                {zones.map((zone) => <option key={zone._id} value={zone._id}>{zone.name}{zone.is_configured ? ` · GHS ${zone.fee.toFixed(2)}` : " · fee not configured"}</option>)}
              </select>
              <Button variant="outline" size="sm" onClick={() => toggleLocation(location)}>{location.is_active ? "Disable" : "Enable"}</Button>
            </div>)}
            {locations.length === 0 && <p className="text-sm text-muted-foreground">No destinations configured.</p>}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Rider applications and approvals</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <select className="rounded-md border bg-background p-2 text-sm" value={applicationStatus} onChange={(event) => setApplicationStatus(event.target.value)}>
            {["pending", "approved", "rejected", "suspended", "deactivated"].map((status) => <option key={status} value={status}>{status}</option>)}
          </select>
          {applications.map((application) => <div key={application.id} className="space-y-2 rounded-lg border p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div><p className="font-semibold">{application.legal_name} · <span className="capitalize">{application.status}</span></p><p className="text-sm">{application.email} · {application.phone}</p><p className="text-sm text-muted-foreground">Student ID: {application.student_id_number} · Submitted {application.created_at ? new Date(application.created_at).toLocaleString() : "—"}</p>{application.rejection_reason && <p className="text-sm text-destructive">{application.rejection_reason}</p>}</div>
              <div className="flex flex-wrap gap-2">
                {application.has_document && <Button variant="outline" onClick={() => openDocument(application)}>View private ID</Button>}
                {application.status === "pending" && <><Button onClick={() => review(application, "approved")}>Approve rider</Button><Button variant="destructive" onClick={() => review(application, "rejected")}>Reject</Button></>}
                {application.status === "approved" && <Button variant="destructive" onClick={() => review(application, "suspended")}>Suspend</Button>}
                {application.status === "suspended" && <Button onClick={() => review(application, "approved")}>Reinstate</Button>}
              </div>
            </div>
          </div>)}
          {!loading && applications.length === 0 && <p className="text-sm text-muted-foreground">No {applicationStatus} rider applications.</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Open delivery complaints</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {complaints.map((complaint) => <div key={complaint._id} className="flex flex-wrap items-start justify-between gap-3 rounded-lg border p-4">
            <div><p className="font-semibold">{complaint.reason} · Order {complaint.order_id}</p><p className="text-sm">{complaint.details}</p><p className="text-xs text-muted-foreground">Reported by {complaint.raised_by} · {new Date(complaint.created_at).toLocaleString()}</p></div>
            <Button onClick={() => resolve(complaint)}>Record resolution</Button>
          </div>)}
          {!loading && complaints.length === 0 && <p className="text-sm text-muted-foreground">No open delivery complaints.</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Delivery assignment history</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {deliveries.map((delivery) => <div key={delivery.id} className="rounded-lg border p-4">
            <p className="font-semibold">Order {delivery.order_id} · <span className="capitalize">{delivery.status.replace(/_/g, " ")}</span></p>
            {delivery.admin_intervention_required && <div className="mt-2 space-y-2 rounded-md border border-amber-400 bg-amber-50 p-3 text-sm text-amber-950">
              <p className="font-semibold">ADMIN INTERVENTION REQUIRED — rider suspended</p>
              <p>{delivery.admin_intervention_reason || "The current delivery is paused pending reassignment."}</p>
              <p>The delivery will return to seller handoff after reassignment so the new rider's pickup is recorded.</p>
              <DeliveryReassignment delivery={delivery} riders={eligibleRiders} onReassign={reassign} />
            </div>}
            <p className="text-sm">{delivery.destination} · {delivery.zone}</p>
            <p className="text-sm">Merchandise GHS {(delivery.item_amount ?? 0).toFixed(2)} · Total charged GHS {(delivery.order_amount ?? ((delivery.item_amount ?? 0) + delivery.delivery_fee)).toFixed(2)} · Delivery fee GHS {delivery.delivery_fee.toFixed(2)}</p>
            <p className="text-sm text-muted-foreground">Marketplace commission GHS {(delivery.commission ?? 0).toFixed(2)} · Seller earnings GHS {(delivery.seller_earning ?? 0).toFixed(2)}</p>
            <p className="text-sm text-muted-foreground">Rider compensation GHS {delivery.rider_compensation.toFixed(2)} ({delivery.rider_compensation_paid ? "paid" : "pending"}) · Transport costs GHS {delivery.transport_cost.toFixed(2)} · White Market margin GHS {delivery.delivery_margin.toFixed(2)}</p>
            <p className="text-sm">Buyer: {delivery.buyer_id} · Seller: {delivery.seller_id} · Rider: {delivery.rider_name || "Unassigned"}{delivery.rider_phone ? ` (${delivery.rider_phone})` : ""}</p>
            {delivery.meeting_point && <p className="text-sm">Meeting point: {delivery.meeting_point}</p>}
            <ol className="mt-2 space-y-1 text-xs text-muted-foreground">{delivery.events.map((event, index) => <li key={`${event.event}-${index}`}>{event.at ? new Date(event.at).toLocaleString() : ""} · {event.event.replace(/_/g, " ")} · {event.actor_id}{event.note ? ` — ${event.note}` : ""}</li>)}</ol>
          </div>)}
          {!loading && deliveries.length === 0 && <p className="text-sm text-muted-foreground">No delivery assignments have been recorded.</p>}
        </CardContent>
      </Card>
    </div>
  );
}

function DeliveryReassignment({
  delivery, riders, onReassign,
}: {
  delivery: AdminDelivery;
  riders: EligibleRider[];
  onReassign: (delivery: AdminDelivery, riderId: string) => void;
}) {
  const [riderId, setRiderId] = useState("");
  const eligible = riders.filter((rider) => rider.id !== delivery.rider_id);
  return <>
    <div className="flex flex-wrap gap-2">
      <select className="min-w-56 rounded-md border bg-background p-2 text-sm" value={riderId} onChange={(event) => setRiderId(event.target.value)} aria-label={`Replacement rider for order ${delivery.order_id}`}>
        <option value="">Select verified approved rider</option>
        {eligible.map((rider) => <option key={rider.id} value={rider.id}>{rider.legal_name} · {rider.phone}</option>)}
      </select>
      <Button disabled={!riderId} onClick={() => onReassign(delivery, riderId)}>Reassign rider</Button>
    </div>
    {eligible.length === 0 && <p>No verified, approved rider without another active delivery is available.</p>}
  </>;
}

function ZoneFeeEditor({ zone, onSave }: {
  zone: AdminZone;
  onSave: (zone: AdminZone, fee: string, compensation: string, transport: string, tested: boolean) => void;
}) {
  const [fee, setFee] = useState(zone.is_configured ? String(zone.fee) : "");
  const [compensation, setCompensation] = useState(zone.is_configured ? String(zone.rider_compensation ?? "") : "");
  const [transport, setTransport] = useState(zone.is_configured ? String(zone.transport_cost ?? "") : "");
  const [tested, setTested] = useState(false);
  return <div className="space-y-2 rounded-lg border p-3">
    <p className="font-semibold">{zone.name}</p>
    <p className="text-xs text-muted-foreground">{zone.is_configured ? `Current fee: GHS ${zone.fee.toFixed(2)}` : "Not configured"} · {zone.is_active ? "Active" : "Inactive"}</p>
    <Input type="number" min="0.01" max="1000" step="0.01" value={fee} onChange={(event) => setFee(event.target.value)} placeholder="Tested delivery fee (GHS)" aria-label={`${zone.name} delivery fee`} />
    <Input type="number" min="0.01" step="0.01" value={compensation} onChange={(event) => setCompensation(event.target.value)} placeholder="Rider compensation (GHS)" aria-label={`${zone.name} rider compensation`} />
    <Input type="number" min="0" step="0.01" value={transport} onChange={(event) => setTransport(event.target.value)} placeholder="Transport costs (GHS)" aria-label={`${zone.name} transport costs`} />
    <p className="text-xs text-muted-foreground">White Market margin: GHS {Math.max(0, Number(fee || 0) - Number(compensation || 0) - Number(transport || 0)).toFixed(2)}</p>
    <label className="flex items-start gap-2 text-xs"><input type="checkbox" checked={tested} onChange={(event) => setTested(event.target.checked)} /> I confirm the fee, rider compensation, and transport costs are based on completed test deliveries.</label>
    <Button className="w-full" disabled={!tested} onClick={() => onSave(zone, fee, compensation, transport, tested)}>Save tested breakdown</Button>
  </div>;
}
