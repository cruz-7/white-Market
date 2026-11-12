# Campus Delivery Test Checklist

**Status:** Pre-launch; delivery must remain disabled.

Use an isolated, non-production Convex deployment with test accounts, test listings, and no real payments. Do not enable delivery or deploy these changes to production as part of this test. Record evidence for every test and investigate every failure before proceeding.

## 1. Test setup and launch gate

- [ ] Confirm the deployment is non-production and uses test accounts and listings.
- [ ] Confirm `DELIVERY_LAUNCH_ENABLED` remains `false`.
- [ ] Confirm checkout offers campus pickup but does not offer campus delivery.
- [ ] Confirm the backend rejects delivery checkout requests even if test zone fees and mappings are configured.
- [ ] Confirm rider test accounts are verified students and have approved rider applications.
- [ ] Create disposable paid test orders using the supported test payment setup only.
- [ ] Record the test deployment, date, tester, and test order IDs: ______________________________

## 2. Map-based destination routing and estimate review

For the development pilot, use provider-calculated bicycle routes from approved pickup points to designated public meeting points. Do not treat straight-line distance as a cycling route, and do not require a physical ride for every origin/destination pair. OSM way-centroid candidates are not entrances or approved meeting points: an administrator must verify each coordinate and public, bicycle-accessible handoff point before considering its route suitable. Map-derived zones and cost breakdowns are research estimates, not customer charges or guaranteed real-world costs.

| Destination | Pickup point | Approved public meeting point | Provider route distance / time | Estimated zone | Snap offset / route notes | Admin reviewed |
|---|---|---:|---:|---:|---|---|
| Legon Hall | | | | | | [ ] |
| Akuafo Hall | | | | | | [ ] |
| Commonwealth Hall | | | | | | [ ] |
| Volta Hall | | | | | | [ ] |
| Mensah Sarbah Hall | | | | | | [ ] |
| Dr. Hilla Limann Hall | | | | | | [ ] |
| Alexander Adum Kwapong Hall | | | | | | [ ] |
| Elizabeth Frances Sey Hall | | | | | | [ ] |
| Jean Nelson Aka Hall | | | | | | [ ] |
| Jubilee Hall | | | | | | [ ] |
| International Students Hostel 1 | | | | | | [ ] |
| International Students Hostel 2 | | | | | | [ ] |
| Valco Graduate Hostel Phase 1 | | | | | | [ ] |
| Valco Graduate Hostel Phase 2 | | | | | | [ ] |
| Diamond Jubilee Hall | | | | | | [ ] |
| Legon Hall Annex C | | | | | | [ ] |
| Mensah Sarbah Hall Annex C | | | | | | [ ] |
| Mensah Sarbah Hall Annex D | | | | | | [ ] |
| Akuafo Hall Annex C | | | | | | [ ] |
| Akuafo Hall Annex D | | | | | | [ ] |
| Pentagon Hostel / African Union Hall | | | | | | [ ] |
| TF Hostel / James Topp Nelson Yankah Hall | | | | | | [ ] |
| Evandy Hostel / United Nations Hall | | | | | | [ ] |
| Bani Hostel | | | | | | [ ] |
| Vikings Hostel | | | | | | [ ] |
| Other private hostel (record actual hostel name) | | | | | | [ ] |
| Other campus location (record actual destination) | | | | | | [ ] |

- [ ] Every supported destination has an admin-reviewed coordinate and a named public bicycle-accessible meeting point; restricted/uncertain points are not approved.
- [ ] Test a representative set of directed routes between the mapped halls and hostels. Review provider distance/time, snap offsets, route suitability, access restrictions, and missing routes; do not use straight-line distance as a route.
- [ ] Configure Nearby, Intermediate, and Farther thresholds and the rental, rider, repositioning, parking, and margin inputs; record who reviewed the assumptions.
- [ ] Keep any route that is missing, poorly snapped, access-restricted, or otherwise unreliable in manual review. Use a fallback price only after an administrator approves and documents it.
- [ ] Confirm research-only estimates and manual overrides never populate checkout or customer-facing charges.
- [ ] Validate a representative sample against campus access rules and actual operating constraints before any later launch review; testing every hall-to-hall pair physically is not required.
- [ ] Disable or remove generic placeholder destinations until they are replaced with a specific, tested destination.
- [ ] Confirm delivery remains disabled after all map and pricing settings have been entered.

## 3. Destination-based checkout pricing

Use a test order and record its merchandise amount before each test.

- [ ] Select a destination mapped to Nearby. Verify the displayed zone and fee match the admin configuration.
- [ ] Change only the destination to one mapped to Intermediate. Verify the zone and fee update automatically.
- [ ] Change only the destination to one mapped to Farther. Verify the zone and fee update automatically.
- [ ] Change back to the original destination. Verify its original configured fee returns.
- [ ] Save each test selection and verify the backend order amount equals merchandise amount plus the server-configured delivery fee.
- [ ] Verify commission and seller earnings are based on merchandise only, not the delivery fee.
- [ ] Change a destination's zone/fee in admin before saving a pending order. Verify the server uses the current mapping, not a stale client selection.
- [ ] Attempt delivery for an unassigned destination, an inactive destination, an inactive zone, and an unconfigured zone. Each request must be rejected.

### Direct-request tampering checks

Call the mutation from a test client/API tool rather than relying only on the UI. Never run these against production.

- [ ] Send a valid destination ID with a forged `zone_id` for a cheaper zone. The request must not select or charge using the forged zone.
- [ ] Send extra client fields such as `fee`, `delivery_fee`, `amount`, or `zone_id`. The backend must reject unsupported input or ignore it and derive the amount from the stored destination mapping.
- [ ] Send an inactive or unrelated destination ID. The backend must reject it.
- [ ] After a rejected request, verify the order's amount, delivery fee, delivery method, and delivery record remain unchanged.
- [ ] Confirm normal campus-pickup selection remains free and cannot retain a delivery fee.

## 4. Suspension and safe reassignment

For each scenario, suspend the assigned rider through the admin workflow. Verify immediately that the rider cannot accept a new job or advance the flagged delivery, that the delivery is visibly marked for admin intervention, and that buyer/seller are notified. Use a distinct test order for each scenario.

### A. Rider suspended while awaiting pickup

- [ ] Assign a rider and leave the delivery in `awaiting_pickup`.
- [ ] Suspend that rider with a recorded reason.
- [ ] Verify the delivery is flagged and the rider cannot accept another job or update this delivery.
- [ ] Verify seller handoff and buyer receipt actions are blocked while intervention is required.
- [ ] Reassign to a different verified, approved rider with no active delivery.
- [ ] Verify status returns to `awaiting_pickup`, the replacement rider is recorded, and the reassignment is in delivery history.
- [ ] Verify the seller must confirm a fresh handoff before the replacement rider can proceed.

### B. Rider suspended after collecting the product (`picked_up`)

- [ ] Seller confirms handoff and delivery reaches `picked_up`.
- [ ] Suspend the rider.
- [ ] Verify the delivery is flagged and the original rider cannot start transit or update status.
- [ ] Before reassignment, physically account for the product: record who has custody and arrange its safe return to the seller or an admin-approved handoff point. Do not treat a database reassignment as proof that the product changed hands.
- [ ] Reassign to a different eligible rider.
- [ ] Verify the delivery returns to `awaiting_pickup`, and seller confirmation of the new physical handoff is required.
- [ ] Verify event history preserves the old rider, suspension/flag, reassignment, and new seller handoff without overwriting prior events.

### C. Rider suspended while in transit

- [ ] Seller confirms handoff; rider starts transit and delivery reaches `in_transit`.
- [ ] Suspend the rider.
- [ ] Verify status is flagged for admin intervention, and rider transit/handoff updates are blocked.
- [ ] Admin contacts the parties and establishes the product's actual location and custody before assigning another rider.
- [ ] Reassign only after the product is safely recovered or physically handed to the replacement rider under seller/admin oversight.
- [ ] Verify the replacement flow requires a fresh seller handoff and does not allow the buyer to confirm receipt based on the former rider's status.
- [ ] Verify the buyer, seller, old rider, replacement rider, admin, and event history agree on the custody timeline.

### Reassignment safeguards

- [ ] An unverified, pending, rejected, suspended, or deactivated rider cannot be selected or assigned, including through a direct backend request.
- [ ] A verified and approved rider with another active delivery cannot be assigned.
- [ ] The suspended rider cannot be selected as their own replacement.
- [ ] Reassignment is rejected while a related delivery complaint is still open; resolve and document the complaint first.
- [ ] A second suspension during an active delivery flags that delivery and pauses further actions again.
- [ ] Buyer receipt confirmation and rider compensation remain blocked until a valid replacement completes the handoff and the buyer confirms receipt.
- [ ] No rider compensation is credited to the suspended rider merely because the delivery was reassigned.

## 5. Evidence and release decision

For each failed or passed case, retain the test order ID, test account roles (not passwords), before/after status, admin event history, relevant request/response, and screenshots where useful. Redact personal data and credentials.

- Test run owner/date: ______________________________
- Non-production deployment: ______________________________
- Failed tests and linked issue(s): ______________________________
- Outstanding destination journeys/mappings: ______________________________
- Outstanding fee evidence or accounting discrepancy: ______________________________

**Do not enable delivery or deploy a launch configuration until all applicable checks pass, failures are resolved and retested, every supported destination has a reviewed point and route or approved fallback, a representative sample has been validated against campus constraints, and the owner explicitly approves a separate launch review. Physical testing of every route pair is not required.**

## 6. Development routing pilot safeguards

- [ ] Configure `ROUTING_PILOT_ENABLED=true`, `GRAPHHOPPER_API_KEY`, and `GRAPHHOPPER_NO_BILLING_ACCOUNT_CONFIRMED=true` only on a local/development Convex deployment. Set the confirmation flag only after verifying the account has no billing method.
- [ ] Never put the GraphHopper key in a `VITE_` variable, frontend `.env` file, browser request, source code, or production environment.
- [ ] Keep the backend hard cap at five route requests per UTC day. Failed provider attempts consume a slot; the pilot has no automatic retries or matrix calls.
- [ ] Run route requests manually from the admin routing panel. Do not make live provider calls until a key is configured and the free account/no-billing condition is confirmed.
- [ ] Keep provider output, zone classification, cost previews, and manual route/price overrides admin-only. None may be used for checkout until separately reviewed and approved.
- [ ] Retain OpenStreetMap attribution and review bicycle restrictions and campus access; GraphHopper's route response does not itself confirm that a path is permitted for campus bicycle use.
- [ ] For a future self-hosted OSRM evaluation, plan for a maintained server, OSM data updates, preprocessing with an appropriate bicycle profile, monitoring, and server costs. Self-hosting avoids a hosted routing API's per-request charges, not all operating costs.
