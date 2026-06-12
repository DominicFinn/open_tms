# 03 - Operating Workflows

The recurring day-to-day workflows once setup and onboarding are done. Each is described as **trigger →
activities → actors → outcome**, with broker / shipper / 3PL variations and the gaps each workflow exposes.

The spine that ties them together:

```
Demand in ──► Order ──► Shipment ──► Cover (tender/assign) ──► Track ──► Deliver ──► Bill ──► Cash/Pay
   (W1)        (W1)       (W2)          (W3)                    (W4)      (W4)       (W5)     (W5/W6)
                                                                   └────► Exceptions (W7) ◄──── Returns (W8)
```

---

## W1 - Demand intake → Order

**Trigger:** a need to move freight. **Outcome:** a validated Order ready to become a shipment.

**Channels (all land as an `Order`):**
- Internal manual entry - `POST /api/v1/orders` · UI `/orders/create`. Required: `orderNumber`,
  `customerId`, origin+destination (existing IDs or inline `originData`/`destinationData` to auto-create
  locations). Optional: `serviceLevel` (FTL/LTL), `temperatureControl`, `requiresHazmat`,
  `specialRequirements`, and `trackableUnits[]` (preferred) or `lineItems[]`.
- **Customer portal** self-service - `POST /api/v1/customer-portal/orders`.
- **Customer API** - `POST /api/v1/customer-api/orders` (optional `autoAssign`).
- **EDI 850** - inbound purchase order via the universal inbound endpoint / edi-collector.
- **CSV bulk import** - with automatic customer/location matching.

**Order status path:** `pending` → `validated` (locations resolved) → `assigned`/`converted`, with
`location_error` (raw address needs matching) and `pending_lane` (no matching lane) as sidings.

| Model | Who drives intake |
|-------|-------------------|
| **[Shipper]** | Ops keys orders, or they arrive by EDI 850 / CSV from internal systems |
| **[Broker]** | The shipper client submits via portal/API/EDI, or an agent keys it from an email/phone tender |
| **[3PL]** | Each client submits via their portal/API/EDI; 3PL ops handles exceptions |

**Gaps:** ❌ customers can't edit an order after submission; ❌ no order-templating/recurring-order scheduler.

---

## W2 - Order → Shipment

**Trigger:** a validated order (or several). **Outcome:** a `draft` shipment with a route.

**Activities (the conversion wizard / API):**
- Convert one: `POST /api/v1/orders/:id/convert-to-shipment`.
- **Combine** several orders into one shipment, or **split** one large order across shipments
  (`/batch-convert`, `/split-to-shipments`, `/assign-to-shipment`).
- Or create a shipment directly: `POST /api/v1/shipments` (lane *or* origin+dest, optional pre-assigned
  `carrierId`, items, pickup/delivery windows).
- Lane auto-match: if origin/dest match a lane, the shipment inherits it (and its carrier rates).

| Model | Consolidation behaviour |
|-------|-------------------------|
| **[Shipper]** | Combine LTL orders heading the same lane; FTL one-to-one |
| **[Broker]** | Usually one order → one shipment → one load to cover; consolidation is opportunistic |
| **[3PL]** | Multi-order LTL consolidation with pro-rate billing; cross-dock staging at network nodes |

**Gaps:** ❌ no load-optimisation/VRP to *suggest* consolidations - it's a manual operator decision.

---

## W3 - Cover the load (tender or assign)

**Trigger:** a shipment needs a carrier. **Outcome:** an awarded carrier at an agreed cost.

Two paths, depending on model:

### Path A - Tendering (RFQ to carriers)
- Create a tender (5-step wizard / `POST /api/v1/tenders`): strategy **broadcast** (all carriers at once) or
  **waterfall** (sequential, auto-advance on decline/timeout), duration, target rate.
- Carriers receive `TenderOffer`s, view them in the **carrier portal**, and **bid** (or it arrives as **EDI
  990**). Bids compared in the admin tender detail; **award** the winner.
- **Auto-tender:** for laneless shipments with `autoTenderEnabled`, a broadcast tender is created automatically
  on `shipment.created`.

### Path B - Direct assign / load board
- **[Broker]** uses the **internal load board**: unmatched shipments are matched to carriers by lane rates and
  historical usage, with **quick-assign** and a **real-time margin preview**. A **quick quote** from
  lane-carrier rates (with markup) can drive a **quote → book** flow that lands the shipment back on the board.
- A **rate confirmation PDF** (carrier-facing, hides the customer rate) is generated on assignment.

| Model | Typical cover path |
|-------|--------------------|
| **[Shipper]** | Assign the contracted lane carrier; tender only when the primary declines |
| **[Broker]** | Load board + quick-assign with margin preview; tender to spot-cover; margin alerts if below `minMarginPercent` |
| **[3PL]** | Waterfall tender down a ranked carrier list, or assign per client routing guide |

**Side effects:** awarding emits events that **auto-create a cost charge** (`TenderAwardFinancialHandler`) and,
for **[Broker]**, surface margin. EDI 204 load tender is auto-delivered to the carrier's trading-partner config.

**Gaps:** ❌ no performance-based waterfall ordering (carrier rank isn't driven by scorecards yet);
❌ awarded carriers have no portal "accept & view load" screen (bidding only).

---

## W4 - Track → Deliver

**Trigger:** an awarded/dispatched shipment. **Outcome:** a delivered shipment with POD and an audit trail.

**Activities:**
- **GPS / IoT tracking** - inbound webhook posts location/sensor readings; `ShipmentReadModel` carries
  lat/lng; the map/control-centre view clusters everything live.
- **Geofencing** - auto-arrival detection (GPS radius, WiFi SSID, BLE beacon) → auto-advances status; auto
  **delivery** when destination arrival criteria are met.
- **ETA monitoring** - cron, traffic-aware, adaptive polling; emits delay severity (minor/warning/critical)
  and **route-deviation** alerts (if a lane planned-route exists).
- **Carrier API tracking** - FedEx/UPS/DHL polling/webhooks bridge carrier status to shipment lifecycle
  (delivery, exception, in-transit milestones).
- **Cold chain** - immutable temperature logging, excursion detection, CAPA, compliance PDF on completion.
- **POD** - signature/photos/notes captured at delivery.

| Model | Tracking emphasis |
|-------|-------------------|
| **[Shipper]** | Own-fleet/contracted GPS + carrier API; internal visibility |
| **[Broker]** | Carrier API aggregation + EDI 214 status from carriers; pass-through to customer portal |
| **[3PL]** | Control-tower view across all clients; cold-chain & security telemetry; EDI 214 forwarded to client trading partners |

**Gaps:** ❌ no real-time push (dashboards/portal poll); ❌ no shareable public tracking link; ❌ no driver app
for field status/POD; ❌ multi-carrier *aggregation UI* is thin.

---

## W5 - Bill the customer (AR) - **[Broker] / [3PL] only**

**Trigger:** `shipment.delivered`. **Outcome:** an invoice sent and (eventually) paid.

**Activities:**
- **Billing trigger** marks the shipment ready-to-invoice; with `autoInvoice` a draft is created.
- **Charges** (revenue lines) are rated (lane-carrier rate + markup, or class-based LTL rating with weight
  breaks/FAK/deficit-weight). Lifecycle: pending → approved → invoiced.
- **Invoice lifecycle:** create → approve → send → record payment (full/partial) → (void/reissue).
  **Consolidation** per customer: per-shipment / weekly / monthly (cron) - or manual
  `POST /api/v1/invoices/consolidate`.
- **EDI 810** outbound invoice; **EDI 820** inbound remittance auto-applies payments.
- Customer can **view and dispute** invoices in the portal (→ financial query → possible credit note).

**[Shipper]:** this whole workflow is typically **n/a** - a shipper isn't billing a customer; it only incurs
carrier cost (W6). Charges still model expected vs actual cost for margin/landed-cost reporting.

**Gaps:** 🔌 no payment capture (record-only); 🔌 GL/accounting is export-only; ❌ no scheduled report email.

---

## W6 - Pay & audit the carrier (AP)

**Trigger:** a carrier invoice (manual, or **EDI 210** inbound). **Outcome:** an audited, approved, paid carrier
invoice.

**Activities:**
- Receive carrier invoice → **automatic three-way freight audit**: tender rate vs expected charges vs the
  carrier invoice. Auto-approve within tolerance (2%); flag discrepancies.
- Approve → schedule carrier payment batch → record carrier payment. **[Broker]** can offer **quick pay** at a
  configurable discount.
- Disputes raise financial queries; resolution can issue a credit note.

| Model | AP emphasis |
|-------|-------------|
| **[Shipper]** | Core money flow - this *is* the financial workflow |
| **[Broker]** | AP paired with AR; margin = customer charge − carrier cost; commission accrues to the agent |
| **[3PL]** | AP per carrier; cost allocated to the client for AR |

**Gaps:** 🔌 no payment execution; 🟡 freight-audit rules limited to tolerance (no duplicate-billing /
unauthorised-accessorial detection).

---

## W7 - Exceptions & SLA (runs alongside everything)

**Trigger:** an exception event (delay, deviation, cold-chain excursion, cargo misdrop, SLA breach, low
margin). **Outcome:** a resolved issue with an audit trail.

**Activities:**
- Events auto-create **Issues** (or the **AI triage agent** triages them: create/escalate/contact driver).
- **SLA policies** (org + per-customer) with 8 rule types detect breaches (hybrid event + cron) and auto-raise
  issues.
- The **triage centre** kanban manages the lifecycle (open → in_progress → resolved → closed, snooze/reopen),
  with comments, labels, CAPA, and an auto-generated **closure report PDF**.
- **Automation rules** promoted from proven agent decisions handle recurring cases deterministically (zero LLM
  cost) and can run **skills** (create issue, escalate, email, webhook).

| Model | Exception emphasis |
|-------|--------------------|
| **[Shipper]** | Delivery exceptions, cold-chain, SLA to internal stakeholders |
| **[Broker]** | Margin-alert issues, carrier-failure cover, customer comms |
| **[3PL]** | Control-tower triage across clients; client-specific SLAs; security/tamper telemetry |

**Gaps:** ❌ no full claims lifecycle (filed→investigation→settled) - only financial queries; ❌ no real-time
alert push.

---

## W8 - Returns / Reverse logistics

**Trigger:** a customer needs to return goods. **Outcome:** an RMA tracked like an outbound shipment, with a
possible credit note.

**Activities:**
- Customer requests a return in the **portal** (`POST /api/v1/customer-portal/rmas`) or via **customer API**;
  selects a delivered order, reason, and lines. Internal staff authorise it.
- RMA lifecycle: requested → authorized → in_transit → received → inspecting → pending_refund → completed
  (or rejected). Return **label** generated; line inspection; refund/credit note.
- **EDI 180** (return authorization) supported.

**Per model:** **[Broker]/[3PL]** expose this to clients via the portal; **[Shipper]** uses it for inbound
returns into their own DCs.

---

## Workflow → gap summary

| Workflow | Biggest gaps |
|----------|--------------|
| W1 Intake | Order edit after submit; recurring-order scheduling |
| W2 Order→Shipment | Load/consolidation optimisation |
| W3 Cover | Performance-based waterfall; carrier "accept load" portal screen |
| W4 Track | Real-time push; public tracking link; driver app; multi-carrier aggregation UI |
| W5 AR | Payment capture & GL (out of scope by design); scheduled report email |
| W6 AP | Payment execution; advanced freight-audit rules |
| W7 Exceptions | Full claims lifecycle; real-time alert push |
| W8 Returns | (Most complete newer workflow; minor) |
