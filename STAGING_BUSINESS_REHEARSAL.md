# White Market staging business rehearsal

**Purpose:** Exercise the buyer, seller, and administrator journeys before any live launch.
**Environment:** Non-production only. This guide does not create accounts, listings, orders, or payments.
**Delivery:** Keep disabled; map-routing estimates are not checkout prices.

## Journey map

```text
Student applicant
      │ submit test ID/admission letter
      ▼
Admin reviews verification ── reject ──► applicant fixes/resubmits
      │ approve
      ▼
Verified buyer ─► browse/search ─► message seller ─► order ─► test payment
      │                                                   │
      │                                      seller prepares campus meetup
      │                                                   │
      └──────── buyer confirms receipt ◄──── handoff ◄────┘
                                  │
                         seller balance / payout
                                  │
                         dispute or support, if needed

Administrator: verification → listing moderation → orders/disputes → payouts
Delivery: unavailable throughout this rehearsal
```

## Safe setup

1. Use a Convex development deployment whose name and dashboard clearly identify it as non-production. Do not rely on `localhost` alone to establish which backend it uses.
2. Use Paystack test mode only: the Vercel Preview public key must be `pk_test_...`, and the Convex development deployment secret must be `sk_test_...`. Backend requests reject a key whose mode does not match the deployment. Do not enter real card or Mobile Money details, add billing details, or perform a real transfer.
3. Use disposable accounts tied to inboxes controlled by the testers. Do not put passwords, real student documents, or personal student data in this guide.
4. Create two synthetic student accounts (Buyer A and Seller A), a second buyer (Buyer B), and use a separately controlled admin account. Submit only clearly marked test documents through the non-production application.
5. Create sample listings such as a used course textbook (GHS 40, available quantity 1) and a calculator (GHS 85, available quantity 2). Use synthetic descriptions and test images. Never use a real seller's listing.
6. Record tester, date, deployment name, scenario, expected result, actual result, and test order ID. Redact personal data and payment references in screenshots.
7. Reset test data only through a documented staging reset process. Do not manually delete records from a shared or production database.

## Buyer walkthrough

| Step | Page / action | Expected result |
|---|---|---|
| B1 | Open `/marketplace`, browse, search for the sample textbook, and filter by category. | Listings can be discovered; an empty catalogue or a backend error is clearly explained rather than presented as a successful purchase. |
| B2 | Sign up as Buyer A with a test student document. | Account can access browsing while verification is pending. The verification status and next action are clear. |
| B3 | Before admin approval, attempt to create an order and attempt a purchase through the backend API in staging. | Both are rejected server-side; no order, payment, stock change, or seller notification is created. |
| B4 | After approval, open the listing and message Seller A. | Conversation is associated with the right product and participants; both parties see new messages without refreshing. |
| B5 | Create an order, choose campus pickup, and inspect the amount before paying. | Total is derived from the listing and server values. Delivery remains unavailable. |
| B6 | In Paystack test mode, exercise a successful payment, a failed/cancelled payment, and a repeated callback. | Only a verified successful payment marks the order paid, and repeated callbacks do not credit it twice. Failed payment leaves it unpaid. |
| B7 | Review order history and payment method. | Displayed method matches the backend record. Missing method metadata is shown as not recorded, never guessed. |
| B8 | After a real handoff in staging, confirm receipt; also open a dispute on a separate test order. | Completion and dispute states, notifications, and money records are consistent and authorized. Do not use the test site to claim a physical handoff that did not occur. |

## Seller walkthrough

| Step | Page / action | Expected result |
|---|---|---|
| S1 | Sign up as Seller A and submit the synthetic student document. | Seller dashboard may be visited, but create/edit/publish and sales actions remain blocked until verification approval. |
| S2 | After approval, create the textbook listing with clear condition, price, category, available whole-number stock, and test image. | Listing validation catches missing/invalid required fields and the published item appears in marketplace search. |
| S3 | Receive Buyer A's message and reply. | Seller can identify the product and buyer; reply appears to Buyer A in real time. |
| S4 | Receive a paid campus-pickup order and coordinate a meetup. | Seller sees the authoritative paid state and order details; no fake or stale payment state is shown. |
| S5 | After completion, inspect wallet transactions and request a test payout if the staging setup supports it. | Commission, seller earnings, pending/available balance, payout status, and transaction history reconcile. |
| S6 | Try to edit, deactivate, or sell the same listing during an open order. | Listing/order rules prevent contradictory availability or unaudited balance changes. Record any mismatch as a blocker. |

## Administrator walkthrough

| Step | Page / action | Expected result |
|---|---|---|
| A1 | Open `/admin` as the dedicated admin; try the same path as a non-admin test account. | Admin functions load for the admin only; non-admin access is denied. Marketplace navigation from admin works. |
| A2 | Review and approve Buyer A; separately reject Buyer B with a clear reason. | Status, verified badge, and trading permissions change only for the approved account. |
| A3 | Search for the sample listing and review seller/listing state. | Admin can find and moderate content; changes are reflected in public listings and audit/notification state. |
| A4 | Review the order, transaction, and dispute created in the buyer/seller walkthrough. | Admin can trace the order without changing payment evidence or silently rewriting financial records. |
| A5 | Review a test payout request. | Payout actions are authorized, status transitions are visible, and the same request cannot be paid twice. |
| A6 | Open Campus Delivery settings and attempt checkout with delivery selected or tampered request fields. | Delivery is unavailable and backend rejects direct requests. No pilot route or estimate is treated as a buyer fee. |

## Negative and recovery cases

- Wrong password, duplicate email, malformed/oversized document, and interrupted registration.
- Rejected verification, resubmission, and trying to trade again while pending.
- Listing owner attempts to buy their own product; inactive or nonexistent listing is ordered.
- Payment canceled, provider timeout, mismatched amount/currency, and duplicate provider callback.
- Buyer and seller independently attempt to cancel/complete/dispute the same order.
- Message send failure, reconnect, unread/read state, and conversation opened from a product page.
- Direct request attempts to access another user's order, payout, conversation, or verification document.
- Rider suspension and reassignment cases are out of scope for customer delivery while delivery remains off; do not create or assign real deliveries as part of this rehearsal.

## Current verification and known launch blockers

- The order-history UI previously selected a payment method from the order ID, which could show a false method. It now displays the recorded `payment_method` or “Payment method not recorded”; targeted unit tests cover both.
- Product orders now atomically reserve one available unit when the pending order is created. Cancellation restores a reserved unit; successful wallet/card payment consumes the reservation. Checkout rejects missing, zero, negative, or fractional stock, and listing removal is blocked while a pending product order exists. Product creation now requires an available quantity. Verify concurrent requests against an isolated Convex staging deployment before launch.
- Pending inventory is held until the order is cancelled or paid; there is no automatic expiration because expiring an order during an external payment could leave a captured payment without stock. Define and test an operational process for abandoned pending orders before live sales.
- Existing products with missing or invalid stock, and pending orders created before this change, need reconciliation in staging before rollout. Do not assume legacy orders already reserved stock.
- Before deploying this behavior to a live environment, reconcile all existing pending product orders and any Paystack checkout sessions already issued. A previously issued payment session can complete after the code cutover; handle or settle those sessions before relying on the new reservation invariant.
- Campus-pickup handoff must be demonstrated end-to-end in staging. Verify who can confirm handoff and completion, and whether completion is blocked until the buyer actually receives the item. Do not infer this from status labels alone.
- Real Paystack callbacks, payout processing, email delivery, and message real-time behavior require staging credentials and a non-production backend; they were not exercised by these local tests.
- No disposable accounts, listings, orders, payment attempts, or backend writes were made to create this rehearsal.

## Pass / fail evidence

For each scenario record:

| Field | Record |
|---|---|
| Scenario ID and tester | |
| Date and non-production deployment | |
| Buyer / seller / admin test roles | |
| Steps and expected outcome | |
| Actual result and pass/fail | |
| Order/listing/conversation reference | |
| Screenshot or sanitized request evidence | |
| Follow-up owner and retest date | |

**Release gate:** Do not call the platform ready for live business until all applicable scenarios pass in staging, the inventory and handoff blockers above are resolved, payment and payout reconciliation is verified, support/dispute actions are exercised, access controls are tested with direct requests, and the owner separately approves production launch. Keep campus delivery disabled until its own review is complete.
