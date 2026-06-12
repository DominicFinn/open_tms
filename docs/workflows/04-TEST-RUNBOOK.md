# 04 - Test Runbook (executable)

Follow this top-to-bottom to bring up Open TMS and **walk every workflow end to end**. It is written so you can
do each step in the **UI** (preferred - you see what a real user sees) with a **curl** alternative for anything
that's API-only or that you want to script.

- **Backend:** http://localhost:3001   **API docs (Swagger):** http://localhost:3001/docs
- **Frontend:** http://localhost:5173   **Postgres:** localhost:55432 (`tms`/`tms`/`tms`)
- Response envelope is always `{ data, error }`.
- Tick the `[ ]` boxes as you go. Each phase maps to a workflow in `03-OPERATING-WORKFLOWS.md`.

> **Environment note.** This needs Docker (for Postgres) + Node 18+. Run it on your own machine; the managed
> web container used to author these docs has no Docker daemon, so the stack can't be booted there.

---

## Phase 0 - Boot & seed

```bash
# from the repo root
./run.sh                 # boots Postgres (Docker), runs migrations, starts backend :3001 + frontend :5173
```

In a second terminal, seed a full demo org (Meridian Global Logistics, a 3PL) with users + data:

```bash
cd backend
npm run seed             # WIPES then seeds. Use `npm run seed:keep` to seed without wiping.
```

Seed gives you these logins (all internal users password `Password1!`):

| Email | Role |
|-------|------|
| `admin@meridian-tms.demo` | admin |
| `dispatch@meridian-tms.demo` | dispatcher |
| `ops-manager@meridian-tms.demo` | admin |
| `warehouse@meridian-tms.demo` | warehouse |
| `finance@meridian-tms.demo` | admin |

Plus **customer portal** users (`Portal123!`) and **carrier portal** users (`Carrier123!`).

- [ ] `./run.sh` prints "Open TMS is running!" and `/docs` loads.
- [ ] `npm run seed` finishes and prints the demo credentials.

**Get an API token** (used by every curl below):

```bash
TOKEN=$(curl -s -X POST http://localhost:3001/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@meridian-tms.demo","password":"Password1!"}' | sed 's/.*"token":"\([^"]*\)".*/\1/')
echo "$TOKEN" | cut -c1-20      # sanity check: should print the start of a JWT
AUTH="Authorization: Bearer $TOKEN"
```

- [ ] Log in to the **UI** at http://localhost:5173 with `admin@meridian-tms.demo` / `Password1!`.

---

## Phase 1 - Confirm the operating model (doc 02, Phase B)

```bash
curl -s http://localhost:3001/api/v1/organization/settings -H "$AUTH" | grep -o '"organizationType":"[^"]*"'
```

To test each variant, set the model (this is the one switch that reshapes the workflows):

```bash
# choose one: shipper | broker | 3pl
curl -s -X PUT http://localhost:3001/api/v1/organization/settings -H "$AUTH" \
  -H 'Content-Type: application/json' -d '{"organizationType":"broker"}' | grep -o '"organizationType":"[^"]*"'
```

- [ ] Settings load; `organizationType` reads back what you set.
- [ ] **[Broker]** also set `minMarginPercent` and `marginAlertEnabled:true` to exercise margin alerts later.

---

## Phase 2 - Onboarding (doc 02, Phase D) - order matters

Seed already created locations/customers/carriers/lanes, so you can **either** verify those **or** create fresh
ones to feel the dependency chain. To create fresh, follow D1→D5 in order.

### 2.1 Location (first - lanes & orders depend on it)
- **UI:** `/locations/create` → fill name/address1/city/country, pick `locationType`, set lat/lng.
- **curl:**
```bash
curl -s -X POST http://localhost:3001/api/v1/locations -H "$AUTH" -H 'Content-Type: application/json' -d '{
  "name":"Test DC East","address1":"100 Dock Rd","city":"Newark","state":"NJ","country":"US",
  "locationType":"distribution_centre","lat":40.7357,"lng":-74.1724}'
```
- [ ] Location appears in `/locations`. Repeat for a destination location.

### 2.2 Customer (+ billing config + portal login)
- **UI:** `/customers/create` → name; then edit to set `invoiceConsolidation`, `creditLimitCents`,
  `paymentTermsDays`, `autoInvoice`, `targetMarginPercent`.
- **curl:**
```bash
CUST=$(curl -s -X POST http://localhost:3001/api/v1/customers -H "$AUTH" -H 'Content-Type: application/json' \
  -d '{"name":"Acme Retail","paymentTermsDays":30,"invoiceConsolidation":"per_shipment","autoInvoice":true}' \
  | sed 's/.*"id":"\([^"]*\)".*/\1/')
# provision a portal login
curl -s -X POST http://localhost:3001/api/v1/customers/$CUST/users -H "$AUTH" -H 'Content-Type: application/json' \
  -d '{"email":"buyer@acme.test","password":"Portal123!","name":"Acme Buyer","role":"admin"}'
```
- [ ] Customer in `/customers`; portal user created. **No self-registration** - you (admin) created it.

### 2.3 Carrier (+ validation + portal login)
- **UI:** `/carriers/create` → name, `scacCode`, `mcNumber`; then on the detail page set the validation tier
  flags (`registrationChecked`, `insuranceVerified`, `identityConfirmed`, `complianceChecked`) and add a portal
  user via the Carrier User Management panel.
- **curl:**
```bash
CARR=$(curl -s -X POST http://localhost:3001/api/v1/carriers -H "$AUTH" -H 'Content-Type: application/json' \
  -d '{"name":"Swift Test Lines","scacCode":"SWFT","mcNumber":"MC-100200","validationTier":"tier1","insuranceVerified":true}' \
  | sed 's/.*"id":"\([^"]*\)".*/\1/')
curl -s -X POST http://localhost:3001/api/v1/carriers/$CARR/users -H "$AUTH" -H 'Content-Type: application/json' \
  -d '{"email":"dispatch@swift.test","password":"Carrier123!","name":"Swift Dispatch","role":"dispatcher"}'
```
- [ ] Carrier created; validation flags set (this is the manual onboarding gate); portal login created.

### 2.4 Lane (+ carrier rate)
- **UI:** `/lanes/create` → pick origin + destination (the two locations above), add multi-stop if wanted; then
  on the lane detail assign the carrier with a `price`.
- **curl:** (replace ORIG/DEST with real location IDs from `GET /api/v1/locations`)
```bash
LANE=$(curl -s -X POST http://localhost:3001/api/v1/lanes -H "$AUTH" -H 'Content-Type: application/json' \
  -d '{"originId":"ORIG","destinationId":"DEST","distance":350}' | sed 's/.*"id":"\([^"]*\)".*/\1/')
curl -s -X POST http://localhost:3001/api/v1/lanes/$LANE/carriers -H "$AUTH" -H 'Content-Type: application/json' \
  -d "{\"carrierId\":\"$CARR\",\"price\":1200,\"currency\":\"USD\",\"serviceLevel\":\"standard\",\"assigned\":true}"
```
- [ ] Lane shows the assigned carrier and rate. (Optional: `POST /api/v1/lanes/$LANE/route/calculate` if a
  Google Maps key is configured - otherwise route-deviation detection is skipped.)

---

## Phase 3 - W1/W2: Order → Shipment

- **UI:** `/orders/create` → customer, origin/destination, service level, add a trackable unit with a line
  item → save. Then open the order and **Convert to shipment**.
- **curl:**
```bash
ORD=$(curl -s -X POST http://localhost:3001/api/v1/orders -H "$AUTH" -H 'Content-Type: application/json' -d "{
  \"orderNumber\":\"TEST-0001\",\"customerId\":\"$CUST\",\"originId\":\"ORIG\",\"destinationId\":\"DEST\",
  \"serviceLevel\":\"FTL\",\"trackableUnits\":[{\"identifier\":\"PLT-1\",\"unitType\":\"pallet\",
  \"lineItems\":[{\"sku\":\"SKU-1\",\"quantity\":10,\"weight\":50,\"weightUnit\":\"kg\"}]}]}" \
  | sed 's/.*"id":"\([^"]*\)".*/\1/')
SHIP=$(curl -s -X POST http://localhost:3001/api/v1/orders/$ORD/convert-to-shipment -H "$AUTH" \
  | sed 's/.*"id":"\([^"]*\)".*/\1/')
```
- [ ] Order reaches `validated`; conversion yields a `draft` shipment that inherits the lane + carrier rate.
- [ ] **Also test the customer self-service path:** log into `/customer-portal` as `buyer@acme.test` /
  `Portal123!` and submit an order. Confirm it appears for internal ops.

---

## Phase 4 - W3: Cover the load (tender + carrier portal bid)

- **UI (admin):** create a tender from the shipment (5-step wizard) - choose **broadcast** or **waterfall**,
  set duration + target rate, send.
- **UI (carrier):** open a new browser/incognito → `/carrier-portal` → log in as `dispatch@swift.test` /
  `Carrier123!` → open the tender → **submit a bid** (rate, transit days, equipment).
- **UI (admin):** in tender detail, compare bids → **award** the winner.
- [ ] Carrier sees the offer in the portal and can bid/decline.
- [ ] Award succeeds; a **cost charge** is auto-created on the shipment (check the shipment Financial tab).
- [ ] **[Broker]** margin preview shows on the load board / shipment; if below `minMarginPercent`, a margin
  issue is auto-created.
- [ ] **[Broker]** generate the **rate confirmation PDF** and confirm the customer rate is hidden.

---

## Phase 5 - W4: Track → Deliver

Simulate GPS pings to drive geofence arrival + delivery. Find the tracking webhook in `/docs` (search
"webhook"/"tracking"); typical shape:

```bash
# push a location near the destination geofence to trigger auto-arrival/delivery
curl -s -X POST http://localhost:3001/api/v1/webhooks/tracking -H 'Content-Type: application/json' -d "{
  \"shipmentId\":\"$SHIP\",\"lat\":40.7357,\"lng\":-74.1724,\"timestamp\":\"$(date -u +%FT%TZ)\"}"
```

- [ ] Shipment status advances; arriving inside the destination geofence auto-delivers it.
- [ ] The map/control-centre view (`/` ops map) shows the shipment moving.
- [ ] Customer can track it in `/customer-portal` (status, stops, recent events).
- [ ] (If cold-chain profile assigned) a compliance PDF is generated on completion.

---

## Phase 6 - W5/W6: Billing (AR) & Carrier audit (AP)

**AR (customer invoice)** - **[Broker]/[3PL]**:
- On delivery, the billing trigger marks the shipment ready-to-invoice (auto-draft if `autoInvoice`).
- **UI (finance):** VNext Finance → approve the draft → send. Or `POST /api/v1/invoices/consolidate`.
- **Customer portal:** as `buyer@acme.test`, view the invoice and **raise a dispute** → confirm a financial
  query is created internally.

**AP (carrier invoice + freight audit)**:
- **UI/curl:** receive a carrier invoice (or post **EDI 210**) → three-way audit runs (tender vs expected vs
  invoice) → auto-approve within 2% or flag.
- [ ] AR: invoice created → approved → sent → customer sees it → dispute creates a query.
- [ ] AP: carrier invoice received → freight audit result visible → approve → record payment.
- [ ] Confirm **no real payment is processed** - payment is *recorded only* (out of scope by design).

---

## Phase 7 - W7: Exceptions, SLA & triage

- Trigger an exception: let a shipment blow an SLA (or post a delay), or trip a cold-chain excursion.
- [ ] An **Issue** is auto-created (or the **AI triage agent** triages it, if `llmEnabled` + key set).
- [ ] The issue appears on the triage **kanban**; move it open → in_progress → resolved → closed.
- [ ] Closing generates a **closure report PDF**.
- [ ] (Optional) promote a triage decision to an **automation rule** and confirm the next matching event is
  handled deterministically (no LLM call).

---

## Phase 8 - W8: Returns / RMA

- **Customer portal:** as `buyer@acme.test`, request a return against a delivered order (reason + lines).
- **UI (internal):** authorise the RMA → generate the return label → mark received → inspect → refund/credit.
- [ ] RMA walks requested → authorized → in_transit → received → inspecting → completed.
- [ ] A return label is generated; a credit note can be issued on completion.

---

## Phase 9 - External-task sweep (portals & API)

- [ ] **Carrier portal:** login, view tenders, bid, decline, bid/tender history, change password. Confirm there
  is **no** "accept awarded load" screen and **no** POD capture (known gaps).
- [ ] **Customer portal:** orders, shipment tracking, document download, invoice view + dispute, returns, and
  the **Developer area** (create an API key, register a webhook, send a test, view the EDI log).
- [ ] **Customer API:** with a created API key, `POST /api/v1/customer-api/orders` and
  `GET /api/v1/customer-api/orders/:id/status`.

---

## What "done" looks like

You've created the full chain (location → customer → carrier → lane → order → shipment → tender → award →
track → deliver → invoice → pay → return), exercised both portals, and confirmed the scope boundaries hold
(payments recorded not processed; no carrier self-onboarding; single-org). Every box ticked = the platform's
core operating loop works on your machine.

## Issues you hit → gap analysis

Keep a scratch list as you run this. Anywhere a step needed a manual workaround, an API-only action with no UI,
or simply couldn't be done, note it against the W-number. That list, combined with the ❌ flags in docs 01-03,
is the input to the **workflow-lens gap analysis** (the next deliverable).
