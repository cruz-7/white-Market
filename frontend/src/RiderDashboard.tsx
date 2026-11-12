import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { toast } from "sonner";
import { deliveryApi } from "./api";
import type { LocalUser } from "./data";
import { Button } from "./button";
import { Card, CardContent, CardHeader, CardTitle } from "./card";
import { Input } from "./input";

export default function RiderDashboard({ user }: { user: LocalUser | null }) {
  const application = useQuery(api.functions.delivery.myRiderApplication, user ? {} : "skip");
  const jobs = useQuery(
    api.functions.delivery.availableJobs,
    application?.status === "approved" ? {} : "skip",
  );
  const deliveries = useQuery(api.functions.delivery.myDeliveries, user ? {} : "skip");
  const [legalName, setLegalName] = useState(user?.full_name ?? "");
  const [phone, setPhone] = useState("");
  const [studentIdNumber, setStudentIdNumber] = useState("");
  const [document, setDocument] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const apply = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!document) return toast.error("Upload your student identification document.");
    setSubmitting(true);
    const result = await deliveryApi.submitRiderApplication({
      legal_name: legalName, phone, student_id_number: studentIdNumber, document,
    });
    setSubmitting(false);
    if (result.error) return toast.error(result.error);
    toast.success("Rider application submitted for administrator review.");
    setDocument(null);
  };

  const accept = async (id: string) => {
    const result = await deliveryApi.acceptJob(id);
    if (result.error) toast.error(result.error);
    else toast.success("Delivery accepted. Contact details remain private; coordinate through White Market.");
  };

  const action = async (id: string, status: string) => {
    let note: string | undefined;
    if (status === "delivered") {
      note = window.prompt("Add a public handoff note. Do not include room numbers.")?.trim();
      if (!note) return;
    }
    const result = await deliveryApi.updateJobStatus(id, status, note);
    if (result.error) toast.error(result.error);
    else toast.success(status === "delivered" ? "Handoff reported; buyer confirmation is still required." : "Delivery status updated.");
  };

  if (!user) return <div className="container py-10">Sign in to apply or view delivery work.</div>;
  if (application === undefined) return <div className="container py-10">Loading rider information...</div>;

  return (
    <main className="container max-w-4xl space-y-5 py-8">
      <header>
        <h1 className="text-2xl font-bold">Campus Delivery</h1>
        <p className="mt-1 text-sm text-muted-foreground">Rider applications require verified student status and administrator approval.</p>
      </header>

      {!application || application.status === "rejected" || application.status === "deactivated" ? (
        <Card>
          <CardHeader><CardTitle>Apply to become a delivery rider</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={apply} className="grid gap-3 sm:grid-cols-2">
              <Input value={legalName} onChange={(event) => setLegalName(event.target.value)} placeholder="Full legal name" required />
              <Input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="Active phone number" required />
              <Input value={studentIdNumber} onChange={(event) => setStudentIdNumber(event.target.value)} placeholder="Student ID number" required />
              <Input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={(event) => setDocument(event.target.files?.[0] ?? null)} required />
              <p className="text-xs text-muted-foreground sm:col-span-2">PDF/JPEG/PNG/WebP, maximum 5MB. ID documents are private and visible only to authorized admins. Rider approval is separate from student verification.</p>
              <Button type="submit" disabled={submitting}>{submitting ? "Submitting..." : "Submit application"}</Button>
            </form>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-5">
            <p className="font-semibold">Application status: <span className="capitalize">{application.status}</span></p>
            {application.rejection_reason && <p className="mt-2 text-sm text-destructive">{application.rejection_reason}</p>}
            {application.status === "pending" && <p className="mt-2 text-sm text-muted-foreground">You can browse but cannot accept delivery jobs while your application is pending.</p>}
            {application.status === "suspended" && <p className="mt-2 text-sm text-destructive">Your rider access is suspended. Contact an administrator for information.</p>}
          </CardContent>
        </Card>
      )}

      {application?.status === "approved" && (
        <Card>
          <CardHeader><CardTitle>Available deliveries</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {jobs === undefined ? <p>Loading available jobs...</p> : jobs.filter((job): job is NonNullable<typeof job> => job !== null).length === 0 ? <p className="text-sm text-muted-foreground">No paid delivery requests are available right now.</p> : jobs.filter((job): job is NonNullable<typeof job> => job !== null).map((job) => (
              <div key={job.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3">
                <div>
                  <p className="font-medium">{job.item_name}</p>
                  <p className="text-sm">{job.destination_name} · {job.zone_name}</p>
                  {job.meeting_point && <p className="text-xs text-muted-foreground">Meeting point: {job.meeting_point}</p>}
                  <p className="text-xs text-muted-foreground">Delivery fee: GH₵{job.delivery_fee.toFixed(2)}</p>
                </div>
                <Button onClick={() => accept(job.id)}>Accept job</Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle>My delivery records</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {(deliveries ?? []).length === 0 ? <p className="text-sm text-muted-foreground">No delivery records yet.</p> : deliveries?.map((delivery) => (
            <div key={delivery.id} className="rounded-lg border p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div><p className="font-medium">{delivery.product_name}</p><p className="text-sm">{delivery.destination_name} · {delivery.status.replace(/_/g, " ")}</p></div>
                {delivery.rider_id === user.id && !delivery.admin_intervention_required && delivery.status === "picked_up" && <Button onClick={() => action(delivery.id, "in_transit")}>Start delivery</Button>}
                {delivery.rider_id === user.id && !delivery.admin_intervention_required && delivery.status === "in_transit" && <Button onClick={() => action(delivery.id, "delivered")}>Report handoff</Button>}
                {delivery.seller_id === user.id && !delivery.admin_intervention_required && delivery.status === "awaiting_pickup" && <Button onClick={async () => {
                  const result = await deliveryApi.confirmPickup(delivery.id);
                  if (result.error) toast.error(result.error); else toast.success("Seller handoff recorded.");
                }}>Confirm handoff to rider</Button>}
                {delivery.buyer_id === user.id && !delivery.admin_intervention_required && delivery.status === "delivered" && <Button onClick={async () => {
                  const result = await deliveryApi.confirmReceipt(delivery.id);
                  if (result.error) toast.error(result.error); else toast.success("Receipt confirmed and order completed.");
                }}>Confirm receipt</Button>}
                {delivery.admin_intervention_required && (delivery.buyer_id === user.id || delivery.seller_id === user.id || delivery.rider_id === user.id) && <p className="w-full rounded bg-amber-50 p-2 text-sm text-amber-900">This delivery is paused for administrator reassignment. {delivery.admin_intervention_reason}</p>}
                {delivery.status !== "completed" && delivery.status !== "cancelled" && delivery.status !== "disputed" && !delivery.admin_intervention_required && (delivery.buyer_id === user.id || delivery.seller_id === user.id) && <Button variant="outline" onClick={async () => {
                  const reason = window.prompt("Brief issue category (missing, damaged, late, other):")?.trim();
                  if (!reason) return;
                  const details = window.prompt("Describe the delivery issue:")?.trim();
                  if (!details) return;
                  const result = await deliveryApi.createComplaint(delivery.id, reason, details);
                  if (result.error) toast.error(result.error); else toast.success("Complaint sent to administrators.");
                }}>Report issue</Button>}
              </div>
              <ol className="mt-3 space-y-1 text-xs text-muted-foreground">
                {delivery.events.map((event, index) => <li key={`${event.event}-${index}`}>{event.at ? new Date(event.at).toLocaleString() : ""} · {event.event.replace(/_/g, " ")}{event.note ? ` — ${event.note}` : ""}</li>)}
              </ol>
            </div>
          ))}
        </CardContent>
      </Card>
    </main>
  );
}
