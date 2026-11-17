# Returns & RMA Specification

> A specification for the returns workflow in Open TMS. Covers the RMA (Return Merchandise Authorization) model, disposition types, receipt and inspection, refund calculation, customer portal integration, and the downstream distinctions between customer-initiated returns and customer-refused deliveries.

**Status**: shipped (see `docs/roadmap/completed.md`).

**Scope**: Open TMS is a transport management system. It authorises a return, arranges the return
leg, records what came back and what was decided about it, and closes the refund. It holds no stock
and runs no warehouse, so it does not track where a returned item is put or put anything back into
inventory. The warehouse tasks, bins and stock movements this specification once described were
removed with the warehouse module, and the removed code stays in git history under the tag
`last-with-wms`.

---

## 1. Context and Problem

A customer bought something, it's coming back, and we need to:

1. Authorize and track the return (financial and legal record)
2. Get the goods back, with a return label and a carrier pickup where needed
3. Record what was received
4. Record the inspection and what was decided about each item (disposition)
5. Refund the customer
6. Close the loop with reporting and analytics

Returns are **not** just "receiving in reverse". They have their own lifecycle, their own reason codes, their own financial implications, and often their own compliance requirements (you cannot just restock returned pharma products, for example).

This spec defines the workflow from customer request through receipt and inspection to financial closure.

---

## 2. The Seven Dispositions

When a returned item arrives and is inspected, someone decides what happens to it. We support seven dispositions. Open TMS records the decision and its financial effect. Carrying it out physically happens wherever the goods are handled, outside Open TMS.

| Disposition | What happens physically | Financial effect | Typical reason |
|-------------|------------------------|------------------|----------------|
| **restock** | Item inspected, confirmed saleable, goes back on sale | Full refund to customer, inventory value restored | "Wrong size", "didn't need it", unopened, undamaged |
| **refurb** | Item sent to refurb zone, cleaned/repaired/repackaged, then restocked (often at a lower grade like "refurbished" or "open box") | Refund to customer, refurb cost absorbed, inventory restored at lower grade | Opened but functional, minor cosmetic damage, needs new packaging |
| **scrap** | Item destroyed. Goes to waste stream. No recovery. | Refund to customer, full write-off | Beyond saving, destroying cheaper than refurbing, safety/contamination risk |
| **recycle** | Item sent for material recovery via recycling stream. Different from scrap because the material has value. Required in some jurisdictions (WEEE in EU/UK for electronics, batteries, packaging) | Refund to customer, write-off (may have small material recovery credit) | Electronics that can't be refurbed, packaging, batteries |
| **donate** | Item goes to charity/donation program. Tax-deductible in many jurisdictions. | Refund to customer, write-off (may have tax benefit) | Still usable but not resellable: food nearing best-before, end-of-season clothing, slightly damaged but functional goods |
| **rtv** (Return to Vendor) | Item shipped back to the original supplier for credit under the supplier return agreement | Refund to customer, credit from vendor (offset on carrier invoice/payables) | Defective on arrival, warranty claims, over-shipment by supplier |
| **customer_keeps** | No physical return. Customer keeps the item (or disposes of it themselves). Also known as "no return needed" or "keep it" refund. | Refund to customer, no inventory movement, full write-off | Low-value items where return shipping exceeds item value, damaged goods that can't be resold, service recovery gestures, non-returnable items (food, pharma, custom) |

### Why these specific seven?

- **restock** and **scrap** are the bread-and-butter dispositions, every warehouse has them.
- **refurb** is essential for any electronics, apparel, or goods that can be reconditioned.
- **rtv** unlocks the supplier return-credit flow, which is a real revenue recovery tool.
- **customer_keeps** is critical for low-margin e-commerce where return shipping economics don't work.
- **recycle** and **donate** show ESG compliance, meet WEEE/regulatory requirements, and open up tax benefits. They also match real operational flows that many systems ignore.

---

## 3. Data Model

### Rma (header)

| Field | Type | Notes |
|-------|------|-------|
| id | uuid PK | |
| rmaNumber | string | Auto-generated: `RMA-2026-04-19-001` |
| customerId | FK Customer | Who is returning |
| orderId | FK Order | Original sale order |
| status | string | `requested`, `authorized`, `in_transit`, `received`, `inspecting`, `dispositioning`, `completed`, `rejected` |
| returnReason | string | `damaged`, `wrong_item`, `not_as_described`, `no_longer_needed`, `defective`, `ordered_extra`, `other` |
| customerNotes | string? | Customer's description |
| requestedAt | DateTime | When customer raised it |
| authorizedAt | DateTime? | When CSR approved |
| receivedAt | DateTime? | When goods arrived back |
| completedAt | DateTime? | When fully processed |
| returnLabelUrl | string? | v2: carrier label |
| suggestedRefundCents | int | Auto-calculated from order lines |
| actualRefundCents | int? | Finance override if different |
| creditNoteId | FK CreditNote? | Link to issued credit |
| createdByUserId | string | CSR or customer portal user |
| orgId | string | |
| createdAt, updatedAt | DateTime | |

### RmaLine (per-item)

| Field | Type | Notes |
|-------|------|-------|
| id | uuid PK | |
| rmaId | FK Rma | |
| orderLineItemId | FK OrderLineItem | Original line being returned |
| sku | string | Denormalized for reporting |
| requestedQuantity | int | How many customer wants to return |
| receivedQuantity | int | How many arrived (may be less) |
| disposition | string | `pending` initially, then one of the seven dispositions |
| requestedDisposition | string? | What customer/CSR initially chose |
| inspectionStatus | string | `pending`, `pass`, `fail`, `partial_damage` |
| inspectionNotes | string? | Inspector's comments |
| conditionPhotos | Json? | Array of photo storage keys |
| refundAmountCents | int | Per-line refund amount |
| trackableUnitId | string? | The unit that came back, if it is tracked |
| inspectedByUserId | string? | Who made the disposition decision |
| inspectedAt | DateTime? | |

### Relationship summary

```
Customer
  └── Order
        ├── OrderLineItem
        │     └── RmaLine (partial returns: a line may be returned multiple times if quantities were split)
        └── Rma[] (an order can have multiple RMAs over time)

Rma
  ├── RmaLine[]
  └── CreditNote (auto-generated on completion)
```

---

## 4. Lifecycle and Workflow

### 4.1 Customer-initiated flow (customer portal)

```
Customer views order → Clicks "Request return"
  ↓
Selects items + quantities, chooses reason, optionally picks expected disposition
  ↓
Rma created with status=requested
  ↓
CSR reviews in admin queue
  ↓
CSR authorizes (status=authorized), RMA number issued, customer notified
  ↓
[v2] Return label generated via carrier integration
  ↓
Customer ships item back
  ↓
Receipt recorded (status=authorized or in_transit → received)
```

### 4.2 CSR-initiated flow (admin)

```
CSR speaks with customer (phone/email), or an unexpected return turns up
  ↓
CSR creates Rma on behalf of customer, pre-authorized (status=authorized immediately)
  ↓
Receipt recorded (status=authorized or in_transit → received)
```

### 4.3 Recording receipt

```
Goods arrive back
  ↓
A user with returns:write opens the RMA in the admin app (/returns/:id)
  ↓
For each line, records receivedQuantity (may be less than requested)
  and, optionally, the trackable unit that came back
  ↓
Rma status → received
  ↓
Once every line is fully received, rma.goods_received is emitted
```

`POST /api/v1/rma-lines/:id/receive` takes `receivedQuantity` and an optional `trackableUnitId`.

### 4.4 Inspection and disposition

```
The same page lists each received line that still has disposition = pending
  ↓
Records inspectionStatus (pass/fail/partial_damage)
  ↓
Sets final disposition (may override customer's requested disposition)
  ↓
Adds inspection notes and/or photos
  ↓
Rma status → inspecting, then → dispositioning once every line has a disposition
```

`POST /api/v1/rma-lines/:id/inspect` takes `inspectionStatus`, `disposition`, and optional
`inspectionNotes` and `conditionPhotos`. The disposition is a record of the decision. Open TMS does
not create a task or move anything as a result.

### 4.5 Financial closure

```
All RmaLines have disposition set (not 'pending')
  ↓
Rma status → dispositioning → completed
  ↓
Suggested refund auto-calculated:
  - Sum of RmaLine refundAmountCents
  - Based on original order line prices
  - Restocking fee optionally deducted (customer-specific setting)
  - Shipping refunded if whole order returned; not refunded for partial returns (business rule)
  ↓
Flagged in Finance Refund Review Queue
  ↓
Finance team reviews, can adjust actualRefundCents
  ↓
CreditNote auto-generated (links to Rma via creditNoteId)
  ↓
Refund issued via payment processor (existing financial system)
```

---

## 5. Design Decisions

### 5.1 Inspect before deciding

A line cannot be given a disposition until it has been received, and an RMA cannot be completed
while any line is still `pending`.

**Why:** Returned items are an unknown quantity. Cold chain may be broken, items may be tampered with, packaging may be compromised. Pharma, food, cosmetics, electronics with batteries - all have regulatory reasons to inspect before anything goes back on sale. Keeping returned goods apart until then is the job of whoever handles them physically.

### 5.2 Partial returns

A customer who bought 5 units can return 2. The RMA line `requestedQuantity` may be less than the original order line quantity. Multiple RMAs can exist against the same order line (e.g. customer returns 2 now, then another 1 later - two separate RMAs, two RmaLines referencing the same OrderLineItem).

### 5.3 Refund calculation

**Auto-calculated suggestion:** Sum of RmaLine refund amounts, each based on the original order line unit price times the returned quantity.

**Override:** Finance can adjust `actualRefundCents` at the RMA level. Common reasons:
- Restocking fee deducted
- Shipping cost not refunded (partial returns)
- Damaged return receiving less than full refund
- Promotional credit or goodwill uplift

**Review queue:** Every RMA in `dispositioning` appears in the Finance Refund Review Queue before it is completed. Finance team approves or adjusts, then the CreditNote and payment processor refund are triggered.

### 5.4 Inspector overrides customer disposition

Customer can say "please send me a replacement, this was damaged" (suggesting `refurb` or `scrap` disposition with replacement workflow). The inspector might find the item is actually fine and disposition it as `restock`. The inspector's call is final.

This means `requestedDisposition` and final `disposition` are separate fields on RmaLine.

### 5.5 Multiple dispositions per RMA

An RMA can have lines with different dispositions. Customer returns 3 items: one is restockable, one needs refurb, one is damaged beyond repair. One RMA, three lines, three different dispositions. All possible and expected.

### 5.6 Relationship to existing domain

- **Return leg**: the label and pickup for the item coming back are held on the RMA itself (section 10). A return leg is not modelled as a shipment.
- **Trackable units**: an RMA line can name the `TrackableUnit` that came back. Nothing about the unit changes as a result.
- **Credit notes**: the RMA carries `creditNoteId`, linking it to a `CreditNote` in the existing financial model.
- **Customer webhooks**: every `rma.*` event is offered to the customer's webhooks.

---

## 6. UI Pages

### 6.1 Admin (main app)

**Returns list** (`/returns`)
- Table of all RMAs with filters: status, date range, customer, pending disposition, pending refund
- Bulk actions: export, bulk authorize
- KPI header: total returns this month, refund value, top return reasons

**Create RMA** (`/returns/create`)
- Step 1: Search/select customer and order
- Step 2: Select line items and quantities to return
- Step 3: Choose return reason, customer notes, suggested disposition per line
- Step 4: Review and save (status = authorized since CSR-initiated)

**RMA detail** (`/returns/:id`)
- Header: RMA number, status, customer, order reference
- Lines table: SKU, requested qty, received qty, disposition, inspection status, refund amount
- Activity timeline: requested → authorized → received → inspected → completed
- Linked documents: return label (v2), credit note
- Actions based on status: authorize, record receipt, set disposition, complete

Receipt and inspection happen inline on the detail page: a Receive action per line that is short of its requested quantity, and an Inspect action per received line that still has a pending disposition.

**Refund review queue** (`/returns/refund-review`)
- List of RMAs in `dispositioning`, awaiting refund approval
- Filters: amount threshold, customer, disposition mix
- Per-RMA: suggested vs actual, override field with reason, approve/reject
- Bulk approve for small-value straightforward refunds
- Export for finance audit

### 6.2 Customer portal

**My returns** (`/customer-portal/returns`)
- List of RMAs the customer has raised
- Status badges and progress indicators
- Click through to detail

**Request return** (`/customer-portal/returns/request`)
- Step 1: Select order from recent orders
- Step 2: Select items and quantities
- Step 3: Reason dropdown, notes textarea, optional photo upload, expected disposition guidance (help text explaining the dispositions in customer-friendly language)
- Step 4: Review and submit (status = requested)

**Return detail** (`/customer-portal/returns/:id`)
- Status timeline
- Return label download (v2)
- Tracking number of return shipment (v2)
- Refund status (pending review, processed, amount)

---

## 7. Events

| Event | When emitted | Consumers |
|-------|--------------|-----------|
| `rma.requested` | Customer portal submission | Notification to CSR queue |
| `rma.authorized` | CSR approves OR CSR-initiated creation | Customer notification, label generation (v2) |
| `rma.goods_received` | Every line fully received | Customer webhooks |
| `rma.line_inspected` | Inspector sets disposition on a line | Customer webhooks |
| `rma.disposition_set` | All lines on an RMA have dispositions | Finance review queue |
| `rma.completed` | RMA closed, credit note issued | Customer notification, reporting |
| `rma.rejected` | CSR rejects requested return | Customer notification |
| `rma.refund_adjusted` | Finance overrides suggested refund | Audit log, reporting |

---

## 8. Rejected Shipments (Preview - Deferred to v2)

This specification is focused on customer-initiated returns. A separate but related flow is **delivery rejection** - where the customer (typically a B2B customer like Walmart) refuses delivery at the dock for compliance reasons.

### How it's different

- Not customer-initiated, it's a delivery failure
- Item never entered customer's inventory
- Rejection reasons are compliance-specific: late (OTIF breach), temperature excursion, damaged in transit, wrong paperwork, wrong quantity, wrong product
- Financial implications extend beyond refund: OTIF chargebacks, freight claims against carrier, CAPA triggers
- Receipt and inspection are identical to an RMA once goods arrive back

### Planned implementation (v2)

A `DeliveryRejection` model that:
1. Is triggered by shipment status transitioning to `refused`
2. Records rejection reason, driver notes, telemetry at time of rejection (temperature, timestamp, location)
3. Auto-creates an Rma record for the physical goods handling
4. Has its own lifecycle for the financial/claims side
5. Links to carrier for freight claims
6. Triggers CAPA in the Quality Centre for root cause analysis

**This spans transport (return trip planning), Finance (chargebacks/claims), and Quality (CAPA).** It's therefore scheduled as a v2 feature that builds on this v1 RMA foundation.

---

## 9. Integration Channels

RMAs can originate from five different channels, all converging on the same `CREATE_RMA` command handler. The `initiatedVia` field on the `Rma` record tracks how each one arrived.

### 9.1 Admin UI

A CSR or operations user creates an RMA on behalf of a customer in the main admin app. Typical use cases:
- Customer calls the support line
- Customer emails a return request
- An unexpected return turns up and is reconciled after the fact

**`initiatedVia`**: `admin`

### 9.2 Customer Portal (v1 active)

The customer logs into the customer portal (JWT auth) and self-services the return end to end:
- `GET /customer-portal/returns` - list my returns with status filter and summary line (tracking number, refund, status)
- `GET /customer-portal/returns/new` - multi-step form: pick a delivered order, check line items with per-line quantity and preferred disposition, pick a return reason, add notes, submit
- `GET /customer-portal/returns/:id` - status-explainer detail page with refund summary, return shipping panel (download label + pickup details), and a table of items
- Return label download is available from the detail page once an admin has generated it - same file stored by the admin side, served through the portal's JWT-scoped endpoint

Backend endpoints (all `preHandler: authenticateCustomerJWT`, scoped to `req.customerUser.customerId`):
- `GET /api/v1/customer-portal/rmas` - list
- `GET /api/v1/customer-portal/rmas/:id` - detail
- `POST /api/v1/customer-portal/rmas` - create (verifies order belongs to customer, dispatches `CREATE_RMA` with `initiatedVia: customer_portal`, `autoAuthorize: false`)
- `GET /api/v1/customer-portal/rmas/:id/return-label` - stream the stored label file
- `GET /api/v1/customer-portal/rmas/eligible-orders` - returns delivered/partially_delivered orders with their line items (helper for the request form)

**`initiatedVia`**: `customer_portal`

### 9.3 Public REST API

For customers with technical integrations who want programmatic access:
- Endpoint: `POST /api/v1/customer-api/rmas`
- Authentication: API key via `x-api-key` header or `Authorization: Bearer <key>`
- Rate limit: 100 requests/minute per IP
- Customer ID is derived from the API key; they cannot create RMAs on behalf of other customers
- Full Swagger documentation

Customers self-manage their API keys via the Customer Portal Developer Area (v1 deferred). Admins can provision keys through the admin app today.

**`initiatedVia`**: `api`

### 9.4 EDI 180 (Return Merchandise Authorization and Notification)

The X12 EDI standard transaction for returns. Used by enterprise customers (Walmart, Target, major retailers) with established EDI infrastructure.

**Inbound flow** (customer requests RMA):
- Customer transmits X12 180 via SFTP (handled by existing edi-collector) or direct HTTP POST
- Universal EDI inbound router detects `ST*180` and routes to `POST /api/v1/edi/180/inbound`
- `EDI180ParseService` parses envelope (ISA/GS/ST), BGN (transaction purpose + customer RMA number), REF (original PO/order), N1 (parties), LX + LQ + SLN (lines with reason codes and SKUs)
- Mapped X12 reason codes (001=Damaged, 002=Wrong Item, 003=Defective, etc.) translate to our internal reasons
- Customer lookup: first tries partner link, then falls back to customer name/ID match
- Order lookup: by `orderNumber` or internal order ID
- Line match: by SKU against the original order's line items
- RMA created with `initiatedVia: edi_180`, status `requested` (awaiting CSR authorization)

**Outbound flow** (authorization response):
- CSR authorizes the RMA in the admin UI
- Admin or automation calls `POST /api/v1/edi/180/generate` with the RMA ID
- `EDI180Service` builds X12 180 with BGN*11 (response purpose), echoes customer's RMA number in REF, generates N1 ST/SF with the return-to and customer addresses, LX + SLN per authorized line
- Content returned ready for SFTP/HTTP delivery via existing `OutboundEdiDeliveryService`

**GS functional identifier**: `RZ` (Return Merchandise Authorization).

**`initiatedVia`**: `edi_180`

### 9.5 Marketplace Webhooks (v2 roadmap)

Modern e-commerce marketplaces have their own return APIs that fire webhooks when a customer initiates a return on their platform:
- **Shopify**: `returns/create` and `returns/update` webhook events
- **eBay**: Post-Order API webhooks for refund/return events
- **Amazon MWS/SP-API**: Return polling for MCF and FBA flows
- **Magento, WooCommerce, BigCommerce**: similar webhook patterns

Each would map to `initiatedVia: marketplace_webhook` with marketplace-specific source metadata.

Deferred to v2. The `Rma.initiatedVia` field already supports this value.

---

## 10. Return Shipping (Labels and Pickups)

A return often needs a prepaid label for the customer and, optionally, a carrier pickup. The system models this through a provider-agnostic interface so the same UI and commands work for manual, FedEx, UPS, and DHL.

### Provider Interface

`IReturnLabelProvider` (in `backend/src/services/returnLabel/`) has three methods:

- `generateLabel(input)` — returns `{ trackingNumber, labelContent: Buffer, labelFormat: 'pdf'|'zpl'|'png' }`
- `schedulePickup(input)` — returns `{ confirmationNumber, scheduledFor, window? }`
- `cancelPickup(input)` — returns `void`

Implementations:

| Provider | v1 State | Notes |
|----------|----------|-------|
| `manual` | Active (default) | Admin/CSR captures carrier tracking themselves; the provider generates an opaque tracking string and a minimal placeholder label buffer so the flow is testable end-to-end without carrier credentials |
| `fedex` | Stub | FedEx Ship API (returnShipmentDetail) + Pickup API. Throws "not yet implemented" until credentials are wired |
| `ups` | Stub | UPS Shipping API with ReturnService codes + Pickup API. Throws until credentials are wired |
| `dhl` | Stub | DHL MyDHL API / Parcel UK API. Throws until credentials are wired |

Provider selection resolves in this order: explicit `providerOverride` on the command → assigned carrier's `returnLabelProvider` → `manual` fallback.

### Schema

**Rma** fields:

- `returnCarrierId` — optional FK to Carrier handling the return leg
- `returnServiceLevel` — e.g. `ground`, `2day`, `express_saver`
- `returnTrackingNumber` — carrier tracking for the return leg
- `returnLabelStorageKey` — opaque `files/{uuid}` key in `IBinaryStorageProvider`
- `returnLabelFormat` — `pdf` | `zpl` | `png`
- `returnLabelGeneratedAt`
- `returnLabelProvider` — `manual` | `fedex` | `ups` | `dhl`
- `returnPickupScheduledAt`, `returnPickupWindow`, `returnPickupConfirmationNumber`, `returnPickupAddressId`, `returnPickupCancelledAt`

**Carrier** fields:

- `returnLabelProvider` — null means not configured for returns
- `returnLabelAccountNumber` — carrier-side account for return billing
- `returnLabelDefaultService` — default service level to pre-fill the form

### Commands

1. **GenerateReturnLabel** — validates RMA is not rejected/completed, resolves provider, calls `generateLabel`, stores the buffer via `IBinaryStorageProvider`, updates the RMA, emits `rma.return_label_generated`.
2. **SchedulePickup** — requires an existing `returnTrackingNumber`. Refuses to book if there is an active (non-cancelled) pickup. Emits `rma.pickup_scheduled`.
3. **CancelPickup** — sets `returnPickupCancelledAt`, provider is called to release the carrier-side booking, emits `rma.pickup_cancelled`. After cancellation the RMA can reschedule.

### API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/v1/rmas/:id/return-label` | POST | Generate label |
| `/api/v1/rmas/:id/return-label/download` | GET | Stream stored label (admin) |
| `/api/v1/rmas/:id/pickup` | POST | Schedule carrier pickup |
| `/api/v1/rmas/:id/pickup/cancel` | POST | Cancel scheduled pickup |
| `/api/v1/customer-api/rmas/:id/return-label` | GET | Stream stored label (customer API key) |

### UI

The RMA detail page (`VNextReturnDetail.tsx`) exposes a **Return Shipping** panel with:

- Summary row showing provider, service level, tracking number, label issued timestamp
- Pickup row showing scheduled time, window, confirmation number, cancellation status
- Inline "Generate Label" form (carrier selector, provider override, service level, weight, from/to addresses)
- Inline "Schedule Pickup" form (date/time, window, pickup address, notes)
- Download Label link and Cancel Pickup button

### Events

- `rma.return_label_generated` — payload: `{ rmaNumber, customerId, provider, carrierId, serviceLevel, trackingNumber, labelStorageKey, labelFormat }`
- `rma.pickup_scheduled` — payload: `{ rmaNumber, customerId, provider, trackingNumber, confirmationNumber, scheduledFor, window }`
- `rma.pickup_cancelled` — payload: `{ rmaNumber, customerId, provider, confirmationNumber, cancelledAt, reason }`

### Why Manual-First

The v1 default of a "manual" provider means every customer can use this feature regardless of whether they have integrated a carrier return-label API. The UI, data model, and event flow remain identical when real carrier integrations replace the stubs, so the migration is one adapter class at a time.

---

## 11. Out of Scope (Future)

- **Marketplace refund auto-detection** - eBay/Amazon/Shopify webhook integration to auto-create RMAs (v2)
- **Live FedEx/UPS/DHL label generation** - Real carrier API integration for prepaid return labels (v2+, interface already exists)
- **Grading system** - Richer quality grading with functional, cosmetic, data-wipe fields (v2+)
- **Restocking fee configuration** - Customer-specific restock fee rules (v2)
- **Dropshipped returns** - Customer returns direct to supplier, with no receipt recorded here (v2+)
- **Exchange workflow** - Return + replacement shipment in one flow (v2)
- **Returns analytics dashboard** - Return rate by SKU/customer/reason, cost analysis (v2)

---

## 12. Glossary

- **RMA** - Return Merchandise Authorization. The authorization record for a return.
- **Disposition** - What is decided about a returned item.
- **RTV** - Return to Vendor. Sending the item back to the original supplier.
- **OTIF** - On Time In Full. A customer compliance metric that triggers chargebacks when breached.
- **CAPA** - Corrective and Preventive Action. A quality management workflow to address root causes.
- **WEEE** - Waste Electrical and Electronic Equipment. EU/UK regulation requiring electronics recycling.
