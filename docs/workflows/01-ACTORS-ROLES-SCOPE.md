# 01 - Actors, Roles, Scope & Reporting

This defines **who acts on the platform**, what each actor is allowed to do, the **explicit scope boundary**
(what Open TMS does and deliberately does not do), and the **reporting suite** the operation needs.

---

## 1. Actors

There are three classes of actor: **internal users** (your staff, authenticated with the internal JWT),
**external portal users** (customers and carriers, each with their own auth model), and the
**system / automation** layer (event-driven workers that act with no human in the loop).

### 1.1 Internal users (roles)

Internal roles are defined in `backend/src/auth/permissions.ts`. A user has one or more roles; permissions are
`resource:action` strings (`*` = wildcard). Assign roles with `POST /api/v1/roles/:roleId/users/:userId`.

| Role | Intended actor | Can do | Cannot do |
|------|---------------|--------|-----------|
| **admin** | Platform owner / IT | Everything (`*`) | - |
| **dispatcher** | Operations / dispatch | Full shipments, orders, issues, tenders, documents, load board; **read** carriers/customers/lanes/locations; read quotes/charges/invoices | Change settings, manage users, write financials |
| **broker_admin** | Brokerage owner/manager | Everything operational **and** financial **and** EDI/integrations/automation/users/settings (everything except role *creation*) | Edit system role definitions |
| **broker_agent** | Brokerage sales/ops rep | Quote customers, manage load board, assign carriers, view margin, run credit checks, generate rate confirmations; write shipments/orders/issues/tenders; full quotes | Manage users or settings, write invoices/charges |
| **finance** | AR/AP / accounts | Full quotes, charges, invoices, carrier invoices, financial reports; run credit checks; generate documents | Write operational shipment/order data, manage users/settings |
| **warehouse** | Warehouse / dock operator | Read+write shipments at their location, read orders, read+write devices, read documents | Anything financial, carriers, customers, settings |
| **readonly** | Management / auditors | Read everything operational and financial | Any write |

**Who does the initial setup?** The **admin** (or **broker_admin**) created during bootstrap. Settings,
org-type, users, and global config are admin-only.

### 1.2 External portal users

Two separate auth models exist (neither is the internal `User`). **There is no self-registration for either**
- an internal admin provisions every external login.

| Portal | Auth model | Roles | Provisioned by | Default seed password |
|--------|-----------|-------|----------------|----------------------|
| **Customer Portal** (`/customer-portal`) | `CustomerUser` | `viewer` (read-only), `admin` (read+write) | Internal admin, after the Customer exists: `POST /api/v1/customers/:customerId/users` | `Portal123!` |
| **Carrier Portal** (`/carrier-portal`) | `CarrierUser` | `dispatcher`, `admin` | Internal admin, after the Carrier exists: `POST /api/v1/carriers/:carrierId/users` | `Carrier123!` |

Both portals enforce password strength (8+ chars, upper/lower/number) and account lockout (5 fails → 15 min).

#### Customer portal user - tasks they perform

| Task | Endpoint | Status |
|------|----------|--------|
| Log in / profile / change password | `POST /api/v1/customer-portal/login`, `/profile`, `/change-password` | ✅ |
| **Submit an order** (self-service order entry) | `POST /api/v1/customer-portal/orders` | ✅ |
| View orders & order detail | `GET /api/v1/customer-portal/orders[/:id]` | ✅ |
| Track shipments (status, stops, recent events) | `GET /api/v1/customer-portal/shipments[/:id]` | ✅ |
| Download documents (BOL, label, customs, POD, rate conf) | `GET /api/v1/customer-portal/documents[/:id/download]` | ✅ |
| View invoices & **raise a dispute** (→ creates a financial query) | `GET .../invoices[/:id]`, `POST .../invoices/:id/dispute` | ✅ |
| **Request a return / RMA**, track it, download return label | `POST /api/v1/customer-portal/rmas`, `/:id`, `/:id/return-label` | ✅ |
| Developer area: API keys, webhooks (HMAC-signed), EDI partner view, EDI log | `/api/v1/customer-portal/developer/*` | ✅ |
| Edit an order after submission | - | ❌ Gap |
| Pay an invoice online | - | 🔌 Out of scope (no payment processing) |
| Configure their own EDI settings | - | 🟡 Read-only (admin-managed) |

#### Carrier portal user - tasks they perform

| Task | Endpoint | Status |
|------|----------|--------|
| Log in / profile / change password | `POST /api/v1/carrier-portal/login`, `/profile`, `/change-password` | ✅ |
| View active tender offers | `GET /api/v1/carrier-portal/tenders[/:id]` | ✅ |
| **Submit a bid** (rate, transit days, equipment, notes) | `POST /api/v1/carrier-portal/tenders/:id/bid` | ✅ |
| Decline a tender | `POST /api/v1/carrier-portal/tenders/:id/decline` | ✅ |
| Bid history & tender history (win/loss) | `GET /api/v1/carrier-portal/bids`, `/history` | ✅ |
| Accept / view an *awarded* load with stop details | - | ❌ Gap (bidding only; no load-acceptance view) |
| Submit POD / status updates from the field | - | ❌ Gap (no driver app) |
| Book a dock appointment | - | ❌ Gap |
| Self-register / upload onboarding docs | - | ❌ Gap (admin-only onboarding) |

### 1.3 Customer API (programmatic, not a human)

Customers (or their systems) can integrate via an API key scoped to a Customer (`x-api-key` header). See
`docs/CUSTOMER_API_GUIDE.md`.

| Task | Endpoint |
|------|----------|
| Create an order (optionally `autoAssign`) | `POST /api/v1/customer-api/orders` |
| List / get / status-check orders | `GET /api/v1/customer-api/orders[/:id][/status]` |
| Create / list / get returns | `POST /api/v1/customer-api/rmas`, `GET .../rmas[/:id]` |

### 1.4 System / automation actors

These act with no human in the loop and are first-class participants in the workflows:

| Actor | What it does | Trigger |
|-------|-------------|---------|
| Projection workers | Maintain denormalized read models (Shipment, Order, Carrier, Customer, Lane, Issue, Invoice) | Every domain event, polled ~0.5s |
| Auto-tender | Broadcasts a tender to all active carriers for laneless shipments | `shipment.created` (if org setting enabled) |
| ETA monitor (cron) | Traffic-aware ETA checks, delay severity, route-deviation alerts | pg-boss cron, adaptive polling |
| Carrier tracking poll | Pulls FedEx/UPS/DHL status, bridges to shipment lifecycle | Cron, every 5 min |
| SLA breach detection | Detects breaches, auto-creates issues | Hybrid event + cron |
| AI triage agent | Triages exceptions/breaches into issues (create/escalate/contact driver) | Exception events (if LLM key set) |
| Automation rule engine | Deterministic when/given/then rules promoted from agent decisions | Matching events |
| Billing trigger | Marks shipment ready-to-invoice, optionally auto-drafts invoice | `shipment.delivered` |

---

## 2. RACI by operating model

Who is **R**esponsible for each major activity. (A = the org owner/admin is Accountable in all models.)

| Activity | [Shipper] | [Broker] | [3PL] |
|----------|-----------|----------|-------|
| Initial setup & org config | Logistics/IT admin | Brokerage admin | 3PL platform admin |
| Create **Customers** | Ops (their receivers/BUs) | Sales / broker_agent (their shipper clients) | Onboarding team (each client) |
| Provision customer portal logins | Ops admin | Broker agent / admin | 3PL onboarding |
| Create **Locations** | Ops (own DCs + customer sites) | Ops (pickup/delivery sites) | Ops (client + network sites) |
| Onboard **Carriers** (+ validation) | Procurement | Carrier sales / broker_admin | Carrier management team |
| Provision carrier portal logins | Procurement | Carrier sales | Carrier management |
| Create **Lanes** + rates | Procurement / ops | Pricing / broker_agent | Network/ops team |
| Create **Orders** | Ops, EDI 850, or customer API | Customer (portal/API), agent, or EDI | Client (portal/API/EDI) or ops |
| Book / cover freight (tender or assign) | Dispatcher | broker_agent (load board) | Dispatcher / control tower |
| Quote a price to the customer | n/a (internal cost only) | broker_agent (quote → margin) | Account manager (quote) |
| Invoice the customer (AR) | n/a (no customer billing) | finance | finance |
| Pay / audit the carrier (AP) | finance | finance | finance |
| Monitor exceptions / SLAs | Dispatcher + triage | Ops + triage | Control tower + triage |

The clearest divergence: **[Shipper]** has *no customer-AR side* (they are the shipper; "customers" are
receivers), whereas **[Broker]** and **[3PL]** run the full quote → AR → margin loop on top of the AP loop.

---

## 3. Scope boundary

### 3.1 In scope (the platform does this)

Order & shipment lifecycle · trackable units & cargo scanning · order→shipment conversion (combine/split) ·
lanes & multi-stop routes · carrier management with validation tiers · broadcast & waterfall tendering ·
carrier & customer portals · GPS/IoT tracking & geofencing · ETA monitoring & route-deviation · cold-chain
compliance (CFR 21 Part 11) · issue/triage centre with SLA management · charges, rating (incl. class-based
LTL), quotes, customer invoicing (AR), carrier invoicing (AP) with three-way freight audit, financial queries
& credit notes · EDI X12 (850/855/856/204/990/997/214/210/810/820/180/940/945) · returns/RMA · document
generation (BOL, labels, customs, PODs, reports) · white-label theming · custom fields · AI triage &
automation rules & skills.

### 3.2 Out of scope - and why

These are deliberate boundaries. Where money or another system of record is involved, Open TMS **records and
hands off** rather than executing. Each is a candidate "integration point", not a build gap.

| Out of scope | What the platform does instead | Belongs to |
|--------------|--------------------------------|-----------|
| **Payment execution / money movement** | Records invoices and payments; no card/ACH/wire processing | 🔌 Payment processor / bank |
| **General ledger & accounting** | Exports CSV (invoice register, payment ledger, charge detail) | 🔌 QuickBooks / NetSuite / SAP / Xero |
| **Tax calculation** | Stores `taxId`/VAT; no rate determination | 🔌 Avalara / tax engine |
| **Full WMS (inventory, pick/pack, slotting, WCS)** | Has location ops, dock, trackable units; WMS v1/v2 is a separate track | 🔌 / 🟡 External WMS or WMS track |
| **Multi-tenant data isolation** | Single org; clients modelled as `Customer` records | ❌ Architectural gap (biggest 3PL limit) |
| **Multi-modal ocean / air / rail legs** | Road-only schema (TL/LTL) | ❌ Deferred |
| **International customs / duty / denied-party screening** | Generates customs *documents* only | ❌ Not built |
| **Route / load optimisation (TSP/VRP)** | Manual lane/stop sequencing; planned route via Google Maps | ❌ Not built |
| **Driver mobile app / ELD / telematics** | GPS via inbound webhook only | ❌ Not built |
| **Carrier self-registration / onboarding portal** | Admin creates carriers and logins | ❌ Not built |
| **Legal-grade e-signature** | Captures POD signature image; not DocuSign-bound | 🔌 DocuSign / Adobe Sign |
| **Predictive / ML analytics** | Rule-based ETA & automation; event-export API for downstream ML | ❌ Not built |
| **Real-time server push (WebSocket/SSE)** | Pull/poll + in-app notifications + email | ❌ Not built |
| **BI dashboards (Power BI/Tableau/Looker)** | CSV export + event-export API | 🔌 External BI |

> **The payments example, made explicit (because it was the user's example):** an invoice can be created,
> approved, sent, and a payment *recorded against it* (full/partial), and it can be voided. What does **not**
> happen is the actual movement of money - no gateway charges a card, no ACH file is generated, no bank
> reconciliation occurs. Payment *capture* and the GL live in an external finance system; Open TMS is the
> billing system of record and the export source.

---

## 4. Required reporting suite

What reporting the operation needs, by audience, with current status. (Gaps here feed the reporting section of
the gap analysis.)

### 4.1 Financial (finance / management)

| Report | Status |
|--------|--------|
| AR aging (JSON + CSV) | ✅ |
| Carrier spend summary | ✅ |
| Margin analysis by customer | ✅ **[Broker][3PL]** |
| CSV exports: invoice register, carrier invoice register, payment ledger, charge detail | ✅ |
| Margin by carrier / lane / time period, target-variance | ✅ **[Broker]** |
| Commission tracking (agent) | ✅ **[Broker]** |
| Scheduled email delivery of financial reports | ❌ Gap (on-demand only) |

### 4.2 Operational (ops / dispatch)

| Report | Status |
|--------|--------|
| Daily ops report (Excel) | ✅ |
| Live dashboard KPI cards | 🟡 Basic |
| Map / control-centre view (clustering, SLA overlay) | ✅ |
| On-time pickup % / on-time delivery % | ❌ Gap |
| Cost per shipment / per lane trend | ❌ Gap |
| Active-exception / dwell dashboard | 🟡 Issue kanban + SLA widget exist; no dedicated ops KPI board |

### 4.3 Carrier performance (procurement)

| Report | Status |
|--------|--------|
| Carrier scorecards (Quality Centre: by carrier/lane/location/customer) | ✅ |
| On-time %, tender acceptance rate, claim rate per carrier | 🟡 Partial (quality metrics yes; tender-acceptance & composite score limited) |
| Performance-based waterfall ordering | ❌ Gap |

### 4.4 Compliance / quality (QA)

| Report | Status |
|--------|--------|
| Cold-chain compliance PDF (CFR 21 Part 11) | ✅ |
| CAPA management + 30/60/90 follow-up | ✅ |
| SOP checklists / GDP audit | ✅ |
| Issue closure report PDF | ✅ |
| SLA compliance dashboard | ✅ |

### 4.5 External (customer / carrier facing)

| Report | Status |
|--------|--------|
| Customer: order/shipment status, documents, invoices, returns | ✅ (portal) |
| Customer: shareable public tracking link (no login) | ❌ Gap |
| Carrier: win/loss & bid history | ✅ (portal) |

### 4.6 Cross-cutting

| Capability | Status |
|------------|--------|
| Event-export API (warehouse/ML feed) | ✅ |
| `/metrics` (read-model lag, throughput, queue depth) | ✅ |
| CSV export on every data grid | 🟡 Some grids only |
| Dashboard builder / saved views | 🟡 Kanban saved views only |
| Native BI connector | 🔌 Use CSV / event-export |
