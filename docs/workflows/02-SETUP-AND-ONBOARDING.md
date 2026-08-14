# 02 - Setup & Onboarding

This is the **order of operations**: what must be set up first, who does it, and the dependency chain. Setup is
one-time; onboarding (customers, carriers, lanes) is ongoing but front-loaded.

The golden rule of dependencies: **Locations before Lanes; Customers/Carriers before the work that references
them; Carrier-on-Lane rates before tendering is meaningful; portal logins last (the parent entity must exist
first).**

---

## Phase A - Bring the platform up (one-time, admin)

| # | Step | Who | How | Notes |
|---|------|-----|-----|-------|
| A1 | Deploy + database migrated | IT/admin | `run.sh` (local) or a cloud template | Backend :3001, Frontend :5173, Postgres :55432 |
| A2 | Create the **first admin user + Organization** | First admin | Bootstrap (see runbook). In the `run.sh` stack this is done by `npm run seed`, which also creates demo data; in a clean production deploy, `auth-service`'s `POST /api/v1/auth/setup` | Setup only works when **no users exist** |
| A3 | Log in | Admin | `POST /api/v1/auth/login` → JWT | Use the JWT as `Authorization: Bearer <token>` for all internal API calls |

---

## Phase B - Configure the Organization (one-time, admin)

All via `PUT /api/v1/organization/settings` (or the Admin app UI). **Set the operating model first** because it
shapes everything after.

| # | Setting | Field(s) | Model relevance |
|---|---------|----------|-----------------|
| B1 | **Operating model** | `organizationType` = `shipper` \| `broker` \| `3pl` \| `carrier` | Decides the workflows in doc 03 |
| B2 | Brokerage identity | `mcNumber`, `bondAmountCents`, `bondExpirationDate`, `operatingAuthorityStatus`, `minMarginPercent`, `marginAlertEnabled` | **[Broker]** (and brokering 3PLs) |
| B3 | Units of measure | `weightUnit`, `dimUnit`, `temperatureUnit`, `distanceUnit` | All |
| B4 | Tracking unit model | `trackingMode` (`group`/`item`), `trackableUnitType` (`pallet`/`tote`/`box`/`stillage`/`custom`), `customUnitName` | All |
| B5 | Operational toggles | `autoTenderEnabled`, `defaultGeofenceRadiusMeters`, `autoDeliverShipmentDocs`, `magicLinksEnabled`, `warehouseScanMode` | All |
| B6 | Email delivery | `emailProvider` (`console`/`smtp`/`sendgrid`/`ses`), `emailEnabled`, `emailFrom*`, SMTP creds | All (keep `console` for testing) |
| B7 | Maps key (route planning + deviation) | `googleMapsApiKey` | Needed for lane planned-routes & deviation alerts |
| B8 | LLM key (AI triage) | `llmProvider`, `llmApiKey`, `llmModel`, `llmEnabled` | Optional; enables the triage agent |
| B9 | Branding / white-label | logo upload, `themeConfig`, email header/footer | **[3PL]** especially (white-label) |

---

## Phase C - Reference data & configuration (admin / ops)

These can be created in parallel once the org is configured. Several are prerequisites for later onboarding.

| # | What | Endpoint / UI | Depends on |
|---|------|---------------|-----------|
| C1 | Internal users + role assignment | created via auth, then `POST /api/v1/roles/:roleId/users/:userId` | - |
| C2 | Document templates (BOL, labels, customs) | Admin → Document Templates | - |
| C3 | Custom fields (per entity) | Admin → Custom Fields | - |
| C4 | SLA policies (org defaults + per-customer overrides) | `/api/v1/sla-*` / Admin | Customers (for overrides) |
| C5 | Cold-chain profiles | VNext Cold Chain | - |
| C6 | EDI Trading Partners (per partner, per transaction type) | Integrations → Trading Partners | Customers/Carriers they map to |
| C7 | Automation rules / skills config | Admin → Automation / Skills | - |

---

## Phase D - Onboarding flows (ongoing)

The substance of "who creates customers, how lanes get created, how carriers are onboarded." Order matters
because of foreign keys.

### D1. Locations - **do these first** (lanes and orders reference them)

- **Who:** Ops. **Create:** `POST /api/v1/locations` · UI `/locations/create`.
- **Required:** `name`, `address1`, `city`, `country`.
- **Important optional:** `locationType` (`warehouse` | `distribution_centre` | `cross_dock` | `terminal` |
  `port` | `rail_yard` | `customer` | `store` | `manufacturing`), `lat`/`lng` (for geofencing),
  `facilityCapabilities`, `appointmentRequired`, `dockCount`, operating hours, contacts.
- **Auto:** a default geofence arrival criterion is created from `defaultGeofenceRadiusMeters`. Locations are
  also **auto-created** from raw address data on orders/shipments (name+city match or create).
- **Per model:** **[Shipper]** own DCs + the receiver sites they deliver to. **[Broker]** pickup & delivery
  sites (often created on the fly from order data). **[3PL]** the client's sites + the 3PL's own network nodes
  (cross-docks/terminals).

### D2. Customers - **who creates them**

- **Who:** **[Shipper]** ops · **[Broker]** sales/`broker_agent` · **[3PL]** onboarding team. **No customer
  self-registration.**
- **Create:** `POST /api/v1/customers` · UI `/customers/create`. **Required:** `name`.
- **Billing config** (set at create or via edit): `invoiceConsolidation` (`per_shipment`/`weekly`/`monthly`),
  `creditLimitCents`, `paymentTermsDays` (default 30), `autoInvoice`, `currency`, `taxId`,
  `targetMarginPercent`, billing address block.
- **Then (optional): provision portal logins** - `POST /api/v1/customers/:customerId/users` with
  `email`/`password`/`name`/`role` (`viewer`|`admin`). Hand the customer their login (seed uses `Portal123!`).
- **Per model:** **[Shipper]** a "customer" is usually a *receiver*; billing config is often unused (no customer
  AR). **[Broker]/[3PL]** the customer is the paying client - set credit limit, payment terms, consolidation,
  and target margin, and almost always give them a portal login.

### D3. Carriers - **how they're onboarded** (admin-only; no self-onboarding)

1. **Create the carrier:** `POST /api/v1/carriers` · UI `/carriers/create`. **Required:** `name`. **Key:**
   `scacCode` (needed for EDI 204), `mcNumber`, `dotNumber`, contacts, address, `paymentTermsDays`, `currency`,
   remit-to block, optional return-label provider.
2. **Run the validation checklist** (the onboarding gate) on the carrier record: `validationTier`
   (`tier1`/`tier2`/`tier3`), and the booleans `registrationChecked`, `insuranceDocReceived`,
   `insuranceVerified`, `identityConfirmed`, `complianceChecked`, plus `validationNotes`, `validatedAt`,
   `validatedBy`. *This is the manual stand-in for a real onboarding pipeline - the docs are tracked as flags,
   not collected through a self-service flow (see gap below).*
3. **Add vehicles / drivers** (separate endpoints on the carrier).
4. **Assign the carrier to lanes with rates** (D4 / LaneCarrier) - until this exists, the carrier won't surface
   in lane-based rating or quick-assign.
5. **Provision a portal login (optional):** `POST /api/v1/carriers/:carrierId/users` with
   `email`/`password`/`name`/`role` (`dispatcher`|`admin`). Seed uses `Carrier123!`.

   ❌ **Gap:** there is no carrier self-registration, no document-upload onboarding, no approval pipeline.
   Onboarding is entirely admin-driven and the validation tier is a manual checklist.

### D4. Lanes - **how they get created**

- **Who:** Procurement / ops / pricing. **Create:** `POST /api/v1/lanes` · UI `/lanes/create`.
- **Required:** `originId`, `destinationId` (so **D1 Locations must exist first**).
- **Multi-stop:** add `stops[]` with sequential `order` (1,2,3…); stops cannot repeat origin/destination.
  Optional `distance`, `notes`.
- **Assign carriers + rates:** `POST /api/v1/lanes/:id/carriers` with `carrierId`, `price`, `currency`,
  `serviceLevel`, `notes`; mark the primary with `assigned: true` via the PUT. **This LaneCarrier rate is what
  feeds rating, quick-quote, and waterfall tendering.**
- **Plan the route (optional, needs Google Maps key):** `POST /api/v1/lanes/:laneId/route/calculate` then save;
  enables corridor-based route-deviation detection. UI: `VNextCreateLane` with a draggable Google Maps editor.
- **Per model:** **[Shipper]/[3PL]** lanes model the recurring network with negotiated contract rates.
  **[Broker]** may run "laneless" - relying on **auto-tender** (`autoTenderEnabled`) and the load board instead
  of pre-built lanes, building lanes only for repeat business.

### D5. Portal logins - **always last**

The parent entity (Customer or Carrier) must exist before its portal user can be created. Customer users:
`POST /api/v1/customers/:id/users`. Carrier users: `POST /api/v1/carriers/:id/users`. No self-registration in
either case.

---

## Onboarding dependency graph

```
Org config (B1 model first)
   │
   ├── Locations ─────────────┐
   │                          ▼
   ├── Carriers ──► LaneCarrier rates ──► Lanes ──► (auto-tender / load board ready)
   │      │
   │      └── Carrier portal user
   │
   └── Customers ──► Customer portal user / API key
                 └── Billing config (consolidation, credit, terms, margin)
```

---

## Setup-flow gaps (raw material for the gap analysis)

| Gap | Impact | Model most affected |
|-----|--------|---------------------|
| ❌ No carrier self-onboarding / document-collection / approval pipeline | All carrier onboarding is manual admin work; validation is a checklist of booleans | [Broker], [3PL] |
| ❌ No customer self-registration | Every customer login is admin-provisioned | All (esp. [Broker] scaling shippers) |
| ❌ Single-org: no per-client isolation/branding | 3PL clients share one data space and one brand surface | [3PL] |
| 🟡 SLA/EDI/automation config is admin-only and somewhat scattered | Slows multi-customer onboarding | [3PL], [Broker] |
| 🟡 Lane planned-route requires a Google Maps key | Route-deviation detection silently skipped without it | All |
