# Completed Roadmap Work

Historical record of shipped phases, moved out of the root `roadmap.md` (which holds active work
and priorities). Newest entries append at the bottom of their phase; new phases append at the end.

### **Phase 1: Core Setup (Foundation)** DONE
- **Lane Management** - Create/manage lanes (point-to-point, multi-stop), associate with locations and carriers
- **Carrier Management** - Add carriers, store negotiated rates, service levels, link to lanes
- **Carrier Archive / Delete Lifecycle** - Archive (reversible, deactivates portal logins) and admin soft-delete (tombstone, 404s everywhere, blocked when assigned to lanes); archived banner + management list via `?includeArchived`; portal users notified on archive/delete (auditable event, email stubbed); portal-user PII anonymised 1 year later via daily cron
- **Customer Management** - Manage customers with contact/billing info, customer-specific preferences
- **Shipment Creation (Basic)** - Create shipments with references, customer, origin, destination, status, templates
- **Shipment Lifecycle States** - Canonical draft → ready → in_progress → complete lifecycle with a readiness gate (customer, route/lane, carrier, dates, reference, shipment-type fields), forward/step-back-only manual transitions, audit logging of who/when, an orthogonal exception flag, and bulk status updates on the list page
- **Shipment Archive & Soft Delete** - Users archive shipments (recoverable, `shipments:write`); an archived shipment still opens with an "archived" banner and admins can unarchive it (`shipments:delete`). Admins soft-delete (`shipments:delete`, hidden everywhere, deleted shipments show a styled not-found screen, retained for audit). All actions audit-logged. _Future: an archived-shipments screen to browse/restore archived records._
- **Shipment Event Timeline** - Read-only, platform-generated timeline on the shipment detail page. A projection materializes domain events (created, updated, status changed, carrier assigned, exception, delivered, archived/unarchived/deleted, leaves origin, enters destination, entered/exited waypoint) into filterable timeline entries. Filter by event type and date range. No manual/custom events.
- **IoT Device Association** - Admin per-org IoT vendor on/off toggle (System Loco is vendor #1) at /settings/iot-vendors; when enabled, the shipment create/edit form shows an IoT Devices section to attach one or many devices (name + external ID). Devices create Device + active DeviceAssignment records so System Loco webhooks resolve to the shipment by device id. Disabling a vendor skips its webhooks. Shipment-level tracking.
- **System Loco Webhook Ingestion** - Hardened device webhook pipeline: verify -> enqueue (pg-boss) -> 202; HMAC X-LocoAware-Signature verification (secret on the IoT vendor config) with API-key fallback; idempotent on the event id (no duplicate readings on redelivery); resolved location updates the shipment's live map/list position; enriched telemetry (pressure, location type/accuracy) on SensorReading + Telemetry tab. Local replay harness + integration doc (docs/SYSTEM_LOCO_INTEGRATION.md).
- **Shipment Creation Fixed on Every Path (#264)** - `ShipmentAssignmentService` (auto-assignment on order intake), `OrderConversionService` (convert/combine/split), and the warehouse app's admin shipment route all wrote the `Shipment` row directly and never dispatched a command, so `shipment.created` never fired for shipments created this way. That silently broke `ShipmentReadModel` (so `GET /api/v1/shipments`, the shipment map, and the fleet map never saw them), plus `AutoTenderHandler` and `SlaEvaluationHandler`, both of which subscribe to `shipment.created`. All five paths now dispatch `CreateShipmentCommand` or a new dedicated command (`ConvertOrderToShipmentCommand`, `CombineOrdersIntoShipmentCommand`, `SplitOrderCommand`), matching the one path that already worked (`POST /api/v1/shipments`, `AcceptQuoteCommand`). Verified live: an order placed and auto-assigned through the real HTTP flow now appears in `GET /api/v1/shipments`, and a tracking webhook ping for it updates `currentLat`/`currentLng`.
- **Manually Adding Orders to a Shipment Now Emits order.assigned_to_shipment (#266)** - Sibling gap to #264: `OrderConversionService.addOrdersToShipment` (manually linking order(s) to an *existing* shipment via `POST /api/v1/shipments/:id/add-orders`) called the shared linking helper with a no-op `emit`, so `order.assigned_to_shipment` — despite a working, tested projection — never fired for this path, and `OrderReadModel.shipmentId`/`shipmentReference` silently never populated for orders linked this way. Now dispatches a new `AddOrdersToShipmentCommand`, mirroring the #264 pattern: eligibility filtering (origin/customer/service-level/hazmat/temp-control match) stays a soft pre-dispatch check in the service so partial success is preserved, and the command re-reads fresh state and emits the event inside its own transaction. `removeOrderFromShipment` (the reverse operation) and `SplitOrderCommand`'s one-order-to-many-shipments case are left open — both need a real design call, not a mechanical fix.
- **Item/Line Items** - Model SKUs, quantities, weights, dimensions, CSV/Excel bulk import

### **Phase 2: Orders & Ingestion** DONE
- **Order Management** - CSV import, manual creation, auto-assignment to lanes, pending lane requests, special requirements (FTL/LTL, temp control, hazmat)
- **Order Archive, Soft Delete & Auto-Archive** - Customers and operational users (`orders:write`) archive an order (recoverable, removed from active lists, captures pre-archive status for restore); admins (`orders:delete`) soft-delete (hidden everywhere, retained for audit) and unarchive (restores prior status). Delivered/cancelled orders are auto-archived after a retention window (default 30 days) by a daily pg-boss cron.
- **Customer API** - REST API for programmatic order creation, API key auth, rate limiting, Swagger docs
- **Order Status Lifecycle** - `pending → verified → assigned` (+ `issue`, `cancelled`, `archived`) on the order itself; a separate nullable `deliveryStatus` (`in_transit → delivered`, or `exception`) once assigned. Cancel is only valid pre-assignment; `issue` pairs with a real Triage issue row (verification failure or no matching lane). Geofencing, IoT triggers, audit trail, timeline API/UI.
- **EDI Import (850)** - X12 850 parser, EDI partner config, file storage/dedup, preview, history, SFTP polling (edi-collector)
- **Order to Shipment Workflow** - Pending queue, auto-match to lanes/carriers, combine/split orders
- **Queue-Based Integration** - pg-boss queue engine, outbound carrier/tracking workers, inbound webhook worker, retry with backoff

### **Phase 3: Platform Foundations** DONE
- **User Management & Auth** - Accounts, SSO/OAuth (Google, Microsoft), roles & permissions, JWT sessions, user attribution
- **Document Templates** - Auto-generate BOLs, shipping labels, customs forms (pdf-lib), Handlebars templates, daily ops report (Excel)
- **Document Management** - S3-compatible storage (AWS S3, MinIO, Azure), IBinaryStorageProvider interface with DB fallback, file attachments on any entity, drag-and-drop upload, opaque UUID storage keys, 10-year retention
- **Theming & White-labeling** - CSS custom properties, theme API, ThemeProvider context, logo upload, Admin app with AppSwitcher, email/document branding
- **Custom Fields** - Configurable per-entity fields (7 types), versioned definitions, server-side validation, management UI
- **Units of Measure** - System defaults + user overrides (temperature, distance, weight, dimensions), canonical metric storage with display conversion

### **Phase 3b: Location & Auto-Tender** DONE
- **Location Auto-Creation** - LocationResolutionService (name+city match or create), arrival criteria (geofence, WiFi, BLE), configurable default geofence radius
- **Shipment Completion Criteria** - Auto-deliver on destination arrival, geofence-triggered
- **Auto-Tender for Laneless Shipments** - Event-driven on shipment.created, broadcast tender to all active carriers
- **Admin Settings** - Auto-tender toggle, default geofence radius

### **Phase 4: Notifications, Tracking & Exceptions** DONE (partial)
- **Emails & Notifications** - Pluggable email service (SMTP, SendGrid, SES), Handlebars templates, per-user/org preferences, event-triggered, pg-boss worker, in-app notification centre
- **CQRS & Event-Driven Architecture** - 20+ command handlers, immutable DomainEventLog, pg-boss event bus with wildcards, read model projections (6 entities), event export API, /metrics endpoint, 59 tests, domain behaviours docs
- **Triage Centre / Issue Management** - Full issue lifecycle (open to closed), kanban board (drag-and-drop), comments system, issue labels, snooze/close/reopen, CAPA workflows, PDF closure reports, agent driver contact, in-app notifications, entity search
- **SLA Tracking & Breach Alerts** - Two-tier SLA policies (org + customer), 7 rule types, hybrid event+cron breach detection, auto-create issues on breach, SLA policy config UI, shipment detail SLA tab, kanban SLA badges, dashboard SLA health widget
- **AI Auto-Triage** - Claude-powered triage agent, exception events to auto-create/escalate issues
- **Triage Centre (dedicated app)** - Standalone `/triage` app: signal dashboard (volume, noise ratio, SLA health, recurring offenders), board with kanban + list views and batch actions, faceted search, QA spot check, performance reports. Signal confidence scoring per Issue Type with corroboration boost, noise suppression (latched safety types never suppressed), SLA deadlines and first-response/resolution metrics. Saved boards reuse `KanbanView`.
- **Live Tracking** - Inbound GPS webhook, ShipmentEvent tracking, geofencing with auto-delivery, ShipmentReadModel with lat/lng
- **ETA Monitoring** - Provider-agnostic routing (TomTom/HERE/Valhalla), adaptive polling, three delay severity levels, traffic-aware ETAs, pg-boss cron, API endpoints
- **Carrier Tracking API Integrations** - ICarrierTrackingProvider interface, FedEx/UPS/DHL implementations, polling worker, webhook receiver, admin setup wizard
- **Route Deviation Alerts** - Planned route per lane via Google Maps, corridor-based deviation detection, real-time alerts
- **Exceptions** - Exception status with type classification, resolution workflow, event-driven notifications, ETA-based auto-detection

### **Phase 6: Cold Chain** DONE (partial)
- **Excursion Management** - IoT sensor pipeline, disposition lifecycle (monitoring to released/quarantined), auto-triage. Effective temperature/alert range derives from order temperatureControl defaults (no standalone profile entity)
- **Regulatory Audit Trail** - Immutable temperature logging with SHA-256 integrity hashes (CFR 21 Part 11)
- **Cold Chain Compliance Report** - Auto-generated PDF on shipment complete
- **Device Calibration** - Certificate, expiry, accuracy tracking
- **CAPA Reports** - Model and management UI
- **Admin & Frontend** - CAPA reports page, auto-deliver shipment docs setting

### **Phase 7: Financial & Commercial** DONE
- **7A: Charges + Rating** - Charge model (revenue/cost), ShipmentFinancialSummary, CQRS commands, RatingService, ChargeService, financial tab on shipment detail
- **7B: Quotes** - Quote model with revision tracking, create/accept/decline/revise commands, markup config, expiration cron, LTL rate endpoints
- **7C: Customer Invoicing (AR)** - Invoice generation, approve/send/payment/void lifecycle, billing trigger on delivery, invoice projection, consolidation (per-shipment/weekly/monthly), overdue detection, VNext Finance app (15 pages)
- **7D: Carrier Invoices (AP) + Freight Audit** - Three-way match (tender vs expected vs carrier invoice), auto-approve (2% tolerance), EDI 210 inbound, carrier payment batch scheduling
- **7E: Queries, Disputes & Credit Notes** - Financial queries, auto-raise from cargo events, credit notes on resolution
- **7F: LTL Enhancements + EDI 810** - Class-based LTL rating, weight breaks, deficit weight, FAK, density calc, re-weigh/re-class, consolidation billing, EDI 810 outbound
- **Basic Reporting** - AR aging report (JSON + CSV), carrier spend summary, margin analysis by customer, CSV exports (invoice register, carrier invoice register, payment ledger, charge detail)

### **Phase 8: Portals & Tendering** DONE (partial)
- **Carrier Tendering** - Broadcast and waterfall strategies, TenderOffer/TenderBid models, configurable duration, full lifecycle (draft to confirmed), admin UI with bid comparison, 5-step creation wizard
- **Carrier Portal** - CarrierUser auth (JWT), login, dashboard, tender view with bid form, bid/tender history with win rate, profile with password change
- **Carrier User Management** - Admin UI for create/activate/deactivate/reset, password strength validation, account lockout
- **Carrier Enhancements** - SCAC codes, contract rate fields on LaneCarrier
- **EDI 204/990** - EDI 204 generation, EDI 990 parsing with auto bid creation

### **Phase 8b: EDI Communication Hub** DONE (partial)
- **EDI 214 (Shipment Status)** - Inbound parser (carrier status updates), outbound generator (customer status), status code mapping, auto-forward to customer trading partners, stop-level updates, 997 auto-generation, SFTP polling
- **EDI 210 (Freight Invoice)** - Inbound parsing with auto three-way match
- **EDI 810 (Invoice)** - Outbound customer invoice generation
- **EDI 820 (Payment/Remittance)** - Inbound parser, auto-apply to invoices
- **EDI 997 (Functional Acknowledgment)** - Auto-generation for inbound transactions
- **Unified Trading Partner Model** - TradingPartner replacing separate EdiPartner/OutboundIntegration, TradingPartnerTransaction registry, EdiTransactionLog audit, SFTP+HTTP delivery engine, EdiRouterService, management UI

### **Phase 9: Maps & Spatial** DONE (partial)
- **Shipment Map View** - Full-page map at /map, OpenStreetMap/Google Maps, supercluster client-side clustering, entity type switching (shipments/orders/units), bbox-filtered GeoJSON API, status-coloured markers, location markers overlay, issue/SLA overlay, fullscreen mode, auto-refresh
- **SLA Dashboard** - Control centre at /sla, compliance rate, at-risk/breach tables, auto-refresh, CSV export, SLA compliance reports
- **Location Operations View** - Per-location dashboard (/locations/:id/ops), incoming/at-location/outgoing stats, dwell time, facility info, map integration, location-type SLA rules (dock_turnaround, sort_to_dispatch, facility_dwell)
- **Map Provider** - OpenStreetMap default with Google Maps auto-fallback, admin settings for API key

### **Phase 9b: Intelligence & AI** DONE
- **Agent Decision Logging** - CQRS commands, domain events, AgentDecisionReadModel
- **AI Triage Agent** - ILlmProvider interface, AnthropicLlmProvider, TriageAgentHandler (event-driven), context gathering, structured prompting, action execution, decision logging, deduplication
- **Configurable Agent Prompts** - AgentConfig per-org, AgentConfigVersion (immutable prompt versioning), template variables, admin UI, auto-seed
- **LLM Key Management** - Org-level config, masked key display, env var detection, token tracking, usage telemetry
- **Automation Rule Engine** - ConditionEvaluator (10 operators), AutomationRuleHandler, unified condition format, promote from decisions, API with dry-run, frontend rule builder
- **Skills System** - ISkill interface, SkillRegistry, 6 built-in skills (create_issue, escalate_issue, add_comment, contact_driver, send_email, call_webhook), TemplateResolver, SkillChainExecutor with branching, SkillConfig/SkillChain models, admin UI

### **Phase 11: Warehouse Shipment App** DONE
- **Warehouse Login & Auth** - Password + magic link/QR code login, audit log, account lockout
- **Location Selection** - Location selector on first login, preferred location saved to profile
- **Shipment List** - Today's work filtered by origin warehouse, filter chips, search, scan-to-filter, auto-refresh
- **Shipment Detail** - Full details (route, customer, dates, carrier, driver, vehicle), orders/units, flag button with resolution workflow
- **Launch Wizard** - 4-step flow: assign IoT trackers, add accessories, pair trackable units, review/launch
- **IoT Device Integration** - Device lookup by barcode, assignment warnings, shipment/unit level assignment
- **Archive** - Stale shipments (>2 days) on separate screen
- **Barcode Scanning** - HID scanner support (Zebra/Honeywell), rapid keystroke detection, manual fallback, camera-based fallback (BarcodeDetector API)
- **WiFi Monitoring** - Offline/online event logging, duration tracking
- **Mobile-First Design** - Bottom nav, touch-optimized, keyboard-aware, CSS custom properties

---

## Shipped after the April 2026 reorientation

Moved out of `roadmap.md` in Sep 2026 (#319). Items still open from these tracks live in
[backlog.md](backlog.md) and [finnwms.md](finnwms.md).

### Carrier integrations: US LTL (Sep 2026)

- **National LTL carrier catalogue** ✅ (Sep 2026)
  - Extends the existing per-carrier PRO number hint (`proNumberPrefix`/`proNumberMaxLength`,
    #172/#175) with `proNumberMinLength` and `proNumberNumericOnly` for a more precise — still
    non-blocking — warning on shipment assignment (too short / non-numeric, not just "too long")
  - SCAC code field added to the carrier create/edit form (the field already existed on the
    model/API for EDI 204/214/210, just had no UI)
  - One-click **"Load national LTL carriers"** on the Carriers list seeds 10 major US national
    carriers (Old Dominion, Estes, ABF/ArcBest, Saia, XPO, FedEx Freight, R+L, Southeastern,
    Averitt, TForce Freight) with SCAC + PRO format, same on-demand pattern as the PackagingType
    standards seed. **Caveat: SCAC codes and PRO formats are public reference data, not verified
    against each carrier's own EDI implementation guide** — verify before relying on this for
    production EDI/tendering. No check-digit validation yet; several national carriers have one,
    but it's carrier-specific and unconfirmed per carrier.

### Brokerage operations

- **Broker Entity Model** ✅
  - Organization type flag: shipper, carrier, broker, 3PL (determines available features and terminology)
  - Broker-specific fields: MC number, bond info, operating authority status
  - Admin settings UI for brokerage configuration
  - Customer-as-shipper relationship: customers are the shippers in a brokerage, the broker is the intermediary
  - Carrier-as-capacity: carrier assignment represents capacity procurement, not just a transport provider
  - Broker user roles and permissions: broker_admin, broker_agent, finance, readonly system roles with hierarchical permission system (resource:action format with wildcards)
- **Broker Margin Tracking** ✅
  - Buy rate (carrier cost) vs sell rate (customer price) per shipment - leverages existing Charge + ShipmentFinancialSummary models
  - Real-time margin visibility on shipment list (togglable Revenue/Cost/Margin columns) and detail pages
  - Margin alerts: auto-create issues when margin drops below configurable threshold (MarginAlertHandler)
  - Financial columns denormalized to ShipmentReadModel for fast list queries
  - Margin reporting by customer, carrier, lane, and time period with date range filtering
  - Target margin per customer and per lane-carrier with variance tracking (actual vs target %)
- **Broker Quoting Workflow** ✅
  - Quick quote endpoint: auto-populate from lane-carrier rates via RatingService + configurable markup percentage
  - Quote-to-book conversion: "Accept & Book" creates an unassigned shipment with pre-set sell rate
  - Rate confirmation PDF generation (carrier-facing, hides customer sell rate and broker margin)
  - Customer credit check service: validates outstanding balance against creditLimitCents before quoting
  - Customer rate request intake - moved to Track 3 (Customer Portal)
- **Broker Load Board** ❌ Removed
  - The standalone Load Board page (list of unassigned shipments + quick carrier assignment) was removed in favor of assigning carriers directly from shipment creation/detail. Carrier tendering (broadcast/waterfall) remains available for larger operations.
- **Broker-Specific Financials** ✅
  - Carrier quick pay / factoring: request accelerated payment with configurable discount % and payment days
  - Customer invoice with broker markup (not showing carrier cost) - already worked via existing Invoice system
  - Carrier settlement: batch payments to carriers grouped by payment terms - already existed
  - Receivables aging from broker perspective - already existed via AR aging report
  - Commission tracking for broker agents: Commission model with accrued/approved/paid lifecycle, basis on margin or revenue, per-agent summary, management UI

### Reporting: executive dashboard

- **Executive Dashboard** ✅
  - Reports app with own app switcher entry and dashboard landing page
  - Single performant API call (`GET /api/v1/reports/dashboard`) - all queries hit read models only
  - Shipment stats: total, in transit, at locations (pickup + delivery), delivered, full status breakdown with bars
  - Order stats: total with delivery status breakdown (not yet moving/in transit/delivered/exception)
  - Financial summary: revenue, cost spent, margin ($ and %), with period-over-period trend arrows
  - Invoice health: outstanding count/value, overdue count/value
  - Issue overview: active issues, critical issues
  - Billing pipeline: not invoiced / invoiced / paid counts
  - Period selector: 7 days, 30 days, MTD, QTD, YTD
  - Trend comparison vs prior period (% change with up/down arrows)

### Customer portal

- **Customer User Management** ✅
  - CustomerUser model (separate from internal User, same pattern as CarrierUser)
  - Email/password auth with dedicated JWT issuer (`open-tms-customer`)
  - Password strength validation (8+ chars, uppercase, lowercase, number), 5-attempt lockout (15 min)
  - Admin CRUD at `/api/v1/customers/:customerId/users` (list, create, update, reset-password, deactivate)
- **Customer Portal App** ✅
  - Separate app at `/customer-portal/` with its own layout and header nav
  - Dashboard with summary stats (active shipments, deliveries, issues, outstanding invoices) + recent shipments
  - All data scoped by customerId from JWT - no cross-customer access
- **Order Visibility** ✅
  - Order history with search (by order number, PO number) and status filter
  - Order detail with line items and trackable units
- **Shipment Tracking** ✅
  - Shipment list with status filter from ShipmentReadModel
  - Shipment detail with origin/destination, stops, carrier, tracking events timeline
- **Document Access** ✅
  - Download BOLs, invoices, compliance reports from portal
  - Document list filtered by customer's shipments
- **Invoice & Payment View** ✅
  - Invoice list with amounts, paid, balance, status, due date, days overdue
  - Dispute submission (creates FinancialQuery with type customer_dispute)
- **Order Entry** ✅
  - Customer self-service order creation from portal with PO number, origin/destination, line items, service level
  - Location auto-resolution from city/state
  - **Phase 1: Order Line Items & Cartonization** ✅ (Jun 2026)
    - Surfaced existing schema gaps: hazmat detail (UN/class/PG/PSN), unit of measure, customs (HS code, country of origin), temperature range (tempMinC/tempMaxC) added to OrderLineItem
    - `ModeRulesService` drives required-ness from `(mode, flags)`: FTL/LTL/parcel × hazmat × international × temp-controlled. Same matrix evaluated client-side in the portal and re-validated server-side
    - `OrderCartonizationService` derives density, suggested freight class (NMFC density table), rolled-up class, total weight, total cube, pallet positions, linear feet, with a read-only live preview at `POST /api/v1/order-line-items/cartonization/preview`
    - `PalletType` generalised → `PackagingType` (org-scoped catalogue with `kind` discriminator: pallet | carton | crate | drum | roll | bag | tote | loose | custom). Admin CRUD at `/wms/packaging-types`
    - Order-level packing summary auto-generates `TrackableUnit`s from `(packagingTypeId, unitCount, stackable)`, so customers don't build pallets by hand
  - **Phase 2: Manual handling-unit modelling** ✅ (Jun 2026)
    - `TrackableUnit` gains optional per-unit overrides: weight, L/W/H + units, stackable
    - 8 per-unit operations promoted from repository-direct to CQRS commands (`CreateTrackableUnit`, `UpdateTrackableUnit`, `DeleteTrackableUnit`, `GenerateBarcode`, `AddLineItemToUnit`, `MoveLineItemBetweenUnits`, `MergeUnits`, `SplitUnit`). Each emits a `trackable_unit.*` event
    - `OrderProjection` subscribes to `trackable_unit.*` and recomputes `trackableUnitCount`, `lineItemCount`, `totalWeight`. Per-unit weight overrides take precedence over line-item weight sums
    - `OrderCartonizationService.computeOrderFromUnits` computes per-unit weight/cube/density/class with three-tier fallback (override → lines → packagingType external dims). Live preview at `POST /api/v1/order-line-items/cartonization/preview-units`
    - `HandlingUnitsEditor` component (shared portal + admin): drag-and-drop line items between units via `@dnd-kit`, per-unit dim/weight edit fields, create/delete/merge/split actions, generate-barcode, live cartonization summary
    - Customer portal mirrors the 8 admin endpoints under `/customer-portal/...` with customer-owns-order ownership checks
    - **Order creation with explicit `trackableUnits[].lineItems` bug fix** ✅ (Sep 2026, #269): `CreateOrderCommand`'s doubly-nested Prisma create (`order.create` → `trackableUnits.create` → `lineItems.create`) left the required `OrderLineItem.orderId` FK unset — Prisma only auto-fills the FK for the relation it directly traverses at each nesting level, not a grandparent FK two levels up — so every order creation with unit-attached line items failed outright. Fixed by creating the order first, then trackable units and their line items as separate writes with `orderId` supplied explicitly. Regression test included
  - **Bulk order upload (CSV) through portal** ✅ (Jun 2026, Phase 3 of Order Line Items work)
    - CSVImportService rewritten to dispatch `CREATE_ORDER` per order through the command bus (events fire and OrderProjection stays in sync; previously this was bypassed)
    - Per-line `ModeRulesService` validation: each row checked against `(serviceLevel, hazmat, international, temp-controlled)`. International derived from origin/destination country mismatch
    - All-or-nothing per order: any failing line rejects that whole order with row-level errors carrying source CSV row numbers; sibling orders still go through
    - Customer-portal endpoint at `POST /api/v1/customer-portal/orders/import/csv` forces customerId to the authed customer (rejects CSVs that declare a different one)
    - CSV template download at `GET /customer-portal/orders/import/csv/template` (admin: `/orders/import/csv/template`)
    - Full Phase 1/2 column coverage: UoM, declared value, freight class, NMFC, UN/class/PG/PSN, HS/CoO, temp range, order-level packing summary, per-unit dim/weight/stackable overrides, packagingTypeCode resolution against the org catalogue
    - Polished upload UI in both admin and portal: drag-drop, staged spinner (reading → validating → creating), per-row error display with order number tag, quick-links to created orders, template download
  - **Phase 4: Line item CQRS + weight consistency** ✅ (Jun 2026)
    - `CreateLineItemCommand` / `UpdateLineItemCommand` / `DeleteLineItemCommand` close the last CQRS gap in the order write surface. Each emits an `order_line_item.*` event consumed by `OrderProjection`
    - New `PUT /api/v1/orders/:orderId/line-items/:itemId` lets operators (and customers, via portal mirror) edit any Phase 1 field on an existing line via sparse patch, replacing delete-and-recreate
    - The two legacy `/line-items` endpoints (POST add, DELETE remove) now dispatch commands instead of hitting the repo, so the read model and audit trail finally see them
    - Weight aggregation bug fix: `OrderReadModel.totalWeight` now correctly sums `weight × quantity` per line (line weights are per-piece, matching cartonization). Unit-weight overrides still take precedence. Regression test included
- **Shipment Share Links** ✅ (Sep 2026, #155)
  - Replaces the old HMAC `/track/:token` link, which could not be revoked or expired and had no
    access control. Existing tracking URLs stop working.
  - `ShipmentShareLink` carries a hashed URL token, a scrypt-hashed access code, an expiry, a
    revoke marker and an access counter. Both credentials are shown to the operator once.
  - The sender ticks which sections the link exposes: overview, tracking events, orders, cargo,
    documents and BOL, telemetry, carrier. Financials, activity, SLA, customs and rate
    confirmations are never shareable, enforced server-side on both the write and the read.
  - Recipients enter an email address and the access code at `/share/:token`, which buys a
    two-hour viewer session scoped to one shipment (`iss: open-tms-share`).
  - Every attempt, granted or denied, is written to the `ShipmentShareAccess` ledger. Five wrong
    codes lock the link for 15 minutes; the public routes are rate limited per IP.
  - New `shipments:share` permission gates issuing, editing, revoking and reading the access log,
    plus the Shared links tab on shipment detail.

### Inventory companion app, first slice (#233)

  - First slice landed (#233): a lighter, standalone "inventory app" mobile-web surface
    (`frontend/src/inventory-app/`) on top of the existing `inventory` module — read-only stock
    levels + a new `InventoryObservation` ledger for ad hoc scan/spot-check records, behind a new
    narrower `scope: 'inventory'` session JWT. Mobile-web first, deliberately, to validate the API
    contract before committing to a native Android client. `Product` SKU master still not
    introduced — `sku` stays a bare string, per this phase's own note above
- [x] `InventoryObservation` ledger entity + `inventory_observation.record` command (#233)
- [x] `scope: 'inventory'` JWT, narrower than `scope: 'warehouse'` (read levels + record
      observations only)
- [x] Mobile-web levels view + scan/observation flow, reusing the warehouse PWA's scanning hooks

### WMS v1

- **Location Hierarchy** DONE
  - WarehouseZone, WarehouseAisle, WarehouseBin models with capacity denormalization
  - Bulk bin generation (grid pattern), walk sequence, temperature/hazmat attributes
  - Bin types: pallet, shelf, floor, dock door, staging, pack station
  - 14 command handler tests
- **Inventory Foundation (digital twin)** DONE (partial)
  - TrackableUnit nesting (parentUnitId), lot/expiry/receivedAt, currentBinId, currentZoneId
  - `ownerCustomerId` for 3PL multi-client segregation
  - `qualityStatus` (available/hold/quarantine/damaged)
  - InventoryRecord (read model) + InventoryTransaction (immutable ledger)
  - Stock adjust (with reason codes) and bin-to-bin transfer commands
  - Per-bin detail view and per-SKU summary aggregation
  - ProductUom model in schema
  - 11 command handler tests
  - Cycle counting: full, zone, and random sample types, auto-adjust inventory on completion, variance detection events (5 tests)
  - Replenishment rules: min/max thresholds per SKU per pick-face bin, manual check trigger, auto-creates putaway tasks, deduplication (6 tests)
  - ProductUom CRUD: SKU dimensions/weights management UI, barcode/GTIN tracking, dimension lookup API for cartonization
  - CartonCatalogue CRUD: per-location carton sizes with cost tracking
  - CartonizationService: First-Fit-Decreasing recommendation (ProductUom dims -> OrderLineItem fallback), volume + weight utilization scoring, alternative carton suggestions (7 tests)
- **Receiving** DONE (partial)
  - ReceivingAppointment (scheduled dock time), ReceivingTask, ReceivingLine
  - ASN-based and blind receiving, inspection workflow
  - 10 command handler tests
- **Putaway** DONE
  - PutawayRule (SKU pattern, temperature, hazmat, velocity, customer, unit type)
  - PutawayTask (directed, manual, replenishment)
  - `next_available_in_zone` resolver with walk sequence + capacity + consolidation preference
  - Scan-to-confirm with deviation tracking, bin constraint validation (temperature, hazmat)
  - Auto-generates InventoryRecord + InventoryTransaction on completion
  - 9 command handler tests
- **Allocation Engine** DONE (partial)
  - Allocation model (soft/hard states)
  - Hard allocation on wave release (FIFO), multi-bin split allocation
- **Pick & Pack** DONE (partial)
  - Wave creation with auto-generated wave numbers, WaveOrder join
  - Wave release: hard-allocates inventory, generates PickTasks with walk-sequence-sorted PickLines
  - PickTask + PickLine with walk-sequence ordering
  - Two strategies: discrete (one task per order), batch (one task for wave)
  - Short-pick handling: backorder / cancel_line with allocation release
  - PackTask + PackLine with verification, auto-complete
  - Auto-complete cascade: line -> task -> wave
  - 9 wave/pick tests + 9 packing/loading tests
  - WaveTemplate: create templates with grouping rules, cutoff time, min/max orders, cron schedule, auto-release. Apply template to auto-create waves from eligible orders (6 tests)
  - Zone pick strategy: sequential (pick-and-pass) and parallel (pick-and-merge) modes, zonePickMode on Wave/WaveTemplate, zoneSequence on PickTask, startedAt/completedAt timestamps for SLA (2 tests)
  - CartonizationService: First-Fit-Decreasing recommendation with ProductUom + OrderLineItem fallback, volume + weight utilization, alternatives. Carton catalogue CRUD. Product dimensions CRUD. Recommendation wired into pack task detail page (7 tests)
  - ✅ PackAudit for weight/dim-weight variance
    - `PackAudit` model with expected/actual weight and LWH dims, computed weight and dim-weight variance percent, per-audit tolerance, verdict (pass/warning/fail), optional issueId link
    - Verdict logic: `|variance| ≤ tolerance` = pass, `≤ 2x tolerance` = warning, otherwise fail. Default tolerance 10%, configurable per-audit
    - Expected weight auto-computed from `ProductUom.weightGrams × expectedQuantity` across pack lines; caller can override
    - Dim-weight uses industry standard `(L×W×H cm) / 5000 = kg` formula; only compared when a carton is linked and all actual dims are captured
    - Warning auto-creates a medium-priority quality issue on the triage kanban; fail creates a high-priority issue - both link back to the `pack_task` via `sourceEntityType/sourceEntityId`
    - Events: `pack.audit_recorded` (every audit), `pack.audit_variance_detected` (warning/fail only)
    - Admin: `/wms/pack-audits` - sortable list with 30-day stats (total, pass rate, warnings, failures), filterable by verdict, one-click jump to the raised issue
    - Warehouse mobile: `/warehouse/tasks/pack-audit/:packTaskId` - shows expected weight, scale input, optional LWH inputs, notes, and previous-audit history. Submit returns an immediate pass/warning/fail tile
    - Routes: `POST/GET /api/v1/pack-audits`, `GET /api/v1/pack-audits/stats`, `GET /api/v1/warehouse/pack-tasks/:id/audit-context`
    - 10 command tests (expected-weight auto-calculation, verdict boundaries, override behavior, dim-weight math, validation failures)
  - ✅ `shipment.cutoff_at_risk` events
    - New `CarrierCutoff` model - per-day-of-week cutoff times with IANA timezone and optional service level + per-location override
    - `ShipmentCutoffMonitorService` evaluates open, carrier-assigned shipments against today's cutoff; projected ready time = now + (pendingPicks × 45min) + (pendingPacks × 15min) + (no load plan ? 30min : 0) - all buffers configurable
    - Severity: minor (≥30 min buffer, dashboard-only), warning (<30 min), critical (<10 min or already past)
    - Warning auto-creates a medium-priority triage issue; critical creates high-priority; both link to the shipment via `sourceEntityType: shipment`. Re-use the same issue across escalations - no spam
    - Dedup: same-severity re-notification only after a 30-min window; escalation fires immediately and reuses the existing issue
    - Events: `shipment.cutoff_at_risk` (with severity, cutoffAt, projectedReadyAt, bufferMinutes, blockingStage, pending work counts, issueId), `shipment.cutoff_cleared` (reserved)
    - pg-boss cron worker (`cutoff-monitor`, default `*/5 * * * *`, configurable via `CUTOFF_MONITOR_CRON`)
    - Admin: `/wms/cutoff-monitor` at-risk dashboard + `/wms/carrier-cutoffs` config page. Plus REST: carrier cutoff CRUD, at-risk list, single-shipment evaluate (no notify), manual full run
    - 24 tests (timezone day-of-week, local-time construction, cutoff resolution, severity bands, projected-ready calc, evaluateShipment full flow, dedup window + escalation)
- **Loading & BOL** DONE
  - StagingAssignment creation with unit location tracking
  - Batch loading completion (clears unit location - on vehicle)
  - LoadPlan model with reverse load-sequence (lines ordered by stop sequence)
  - BOL auto-generated on `load_plan.completed` via DocumentGenerationService
  - Seal capture + dock door assignment on load plan create/complete
  - BOL readiness gate (#78): a BOL is legally required cargo data, but Open TMS treats that data as optional, so generation is blocked (sync + async endpoints) and the manual "Generate BOL" button greys out until the shipment has a shipper/consignee, attached orders, and every order line item carries a goods description, quantity, and weight. `evaluateBolReadiness` (single source of truth) drives both the API guards and the button state; missing requirements are surfaced inline on the shipment Documents tab
  - 4 command handler tests + 6 BOL readiness tests
- **Cross-dock** DONE
  - When ReceivingTask has crossDock=true, CompleteReceiving skips putaway and sorts directly to staging bins
  - Units moved to staging/shipping_dock/cross_dock zone bins
  - StagingAssignments created with order linkage for outbound routing
  - cross_dock.sorted event emitted with sort stats
  - 2 tests (cross-dock sort + non-crossdock control)
- **Returns / RMA** DONE (core)
  - Rma + RmaLine models with 7 dispositions: restock, refurb, scrap, recycle, donate, rtv, customer_keeps
  - Partial returns (subset of order line quantity)
  - Quarantine/QA flow: returned items go to quarantine zone first, inspector sets final disposition, then routed (putaway for restock, refurb zone for refurb, outbound queue for scrap/recycle/donate/rtv)
  - Auto-calculated refund with finance review queue (finance can override suggested amount)
  - 6 command handlers: Create, Authorize, Reject, ReceiveLine, InspectLine, Complete
  - 9 API endpoints for list/detail/create/authorize/reject/receive/inspect/complete/refund-queue
  - Inventory movements on restock: new InventoryRecord + InventoryTransaction (type: receive, reason: return)
  - Admin pages: RMA list, multi-step create form, detail with inline inspection/completion, refund review queue
  - 15 command handler tests
  - Full specification in `docs/RETURNS_SPECIFICATION.md`
  - ✅ Customer portal pages: my returns, request return, return detail
    - `/customer-portal/returns` - list your RMAs with status filters
    - `/customer-portal/returns/new` - self-service multi-step request form (select order → select lines → reason → submit)
    - `/customer-portal/returns/:id` - return detail with status explanation, refund summary, return shipping panel (label download + pickup info)
    - 5 backend endpoints: list, detail, create (with order-scope check), label download, eligible-orders helper
    - JWT-scoped to the authenticated customer; uses `CREATE_RMA` with `initiatedVia: customer_portal` and `autoAuthorize: false`
  - ✅ Warehouse mobile: return receiving task + inspection/disposition task
    - `/warehouse/tasks/return-receive/:id` - mobile-first receive flow: per-line received-qty input, progress tracking, auto-routes to inspection when all lines received
    - `/warehouse/tasks/return-inspect/:id` - mobile-first inspect flow: per-line condition (pass/fail/partial_damage) + disposition (7 options, with hints), notes, one-tap submit
    - `GET /api/v1/warehouse/rmas?stage=receive|inspect|any` - enriched list with `linesToReceive` / `linesToInspect` counts; supports `rmaNumber` exact lookup for scanned RMA labels
    - Returns tab added to WarehouseTasks alongside Picking and Putaway
  - ✅ Return label generation + pickup scheduling
    - `IReturnLabelProvider` interface + Manual provider (v1 default) + FedEx/UPS/DHL stubs for future live integrations
    - Commands: GenerateReturnLabel, SchedulePickup, CancelPickup (all transactional, emit domain events)
    - Admin endpoints: `/api/v1/rmas/:id/return-label`, `/pickup`, `/pickup/cancel`, `/return-label/download`
    - Customer API: `GET /api/v1/customer-api/rmas/:id/return-label` to download the label
    - Labels stored via `IBinaryStorageProvider` with opaque `files/{uuid}` keys
    - Rma fields: returnCarrierId, returnServiceLevel, returnTrackingNumber, returnLabelStorageKey, returnLabelFormat, returnPickupScheduledAt, returnPickupWindow, returnPickupConfirmationNumber
    - Carrier fields: returnLabelProvider, returnLabelAccountNumber, returnLabelDefaultService
    - VNextWmsReturnDetail has a Return Shipping panel with inline generate/schedule/cancel forms
    - 12 additional tests (27 total RMA)
- **WMS EDI** ✅
  - EDI 940 (Warehouse Shipping Order, inbound) - `EDI940ParseService` extracts W05 header, N1 address loops (ST/SF/WH), G62 requested ship dates, W66 carrier + SCAC, NTE free-form notes, W01 line detail with UOM, G69 descriptions, N9 lot / customer line refs. `/api/v1/edi/940/inbound` dispatches `CREATE_ORDER` with `importSource: 'edi_940'`; `/preview` parses without persisting
  - EDI 945 (Warehouse Shipping Advice, outbound) - `EDI945Service` emits W06 header, N1 loops, G62 actual ship date, W27 carrier/tracking, W12 item detail with shipment status codes (CC = complete, PC = partial, CN = cancelled), line-level N9 for tracking/lot/customer refs, W03 totals. `Edi945AutoSendHandler` subscribes to `shipment.delivered` and delivers via SFTP/HTTP to any trading partner with outbound 945 enabled; `/api/v1/edi/945/generate` for manual generation
  - EDI 180 (Return Merchandise Authorization and Notification) - inbound parser creates Rma, outbound generator emits return authorization. Routed via existing universal EDI inbound endpoint and TradingPartner infrastructure.
  - GS functional identifiers: 940 → `OW` (Warehouse Shipping Order), 945 → `SW` (Warehouse Shipping Advice), 180 → `RZ`
  - 21 tests (940 parse: headers / addresses / multi-line / lot+customer refs / SCAC / notes / wrong-transaction / missing depositor / no lines / no SKU; 945 generate: envelope / all status codes (CC/PC/CN) / line-level N9 / overship warning / validation errors / replacement reporting code; full 940→945 roundtrip)
- **Customer Portal Developer Area** ✅ (v1)
  - Customer portal restructured to multi-app layout with sidebar + topbar and an app switcher (Google-style grid) in the top-right, matching the main admin app. Two apps: Portal (orders, shipments, returns, invoices, documents, profile) and Developer (api keys, webhooks, EDI setup, integration logs)
  - **API Keys** at `/customer-portal/developer/api-keys`: self-service create, enable/disable, and revoke. Plaintext key shown once on creation with copy button. Scoped to the authenticated customer
  - **Webhooks** at `/customer-portal/developer/webhooks`: new `CustomerWebhook` + `CustomerWebhookDelivery` models. CRUD, test-delivery button, rotate-secret, expandable delivery log per webhook. Event pattern subscription with wildcards (`*`, `rma.*`, exact). HMAC-SHA256 signatures via `X-OpenTms-Signature: t=<unix>,v1=<hex>` header using signed payload `${timestamp}.${body}` - customer-side verify with 5-minute clock tolerance
  - Event fanout via `CustomerWebhookHandler` subscribing to `rma.*`, `order.*`, `shipment.*`, `invoice.*` - resolves per-customer subscribers by matching `payload.customerId` and delivers through `CustomerWebhookDeliveryService`
  - **EDI Setup** at `/customer-portal/developer/edi`: read-only view of their `TradingPartner` configuration with redacted credentials, supported transaction types, SFTP/HTTP connection details
  - **Integration Logs** at `/customer-portal/developer/logs`: paginated `EdiTransactionLog` list filtered by the customer's trading partners, with direction and transaction-type filters
  - **Developer Dashboard** at `/customer-portal/developer`: overview tiles for API keys, webhooks, trading partners, 7-day EDI activity, plus quick-start and signing/security guidance
  - 14 tests (signing, pattern matching, delivery success/failure, timeout handling)
- **Warehouse Operations Dashboard** ✅
  - Single endpoint `GET /api/v1/wms/operations-dashboard` returns six KPI groups in parallel queries
  - **Throughput** today vs last 7 days: receipts, putaways, picks, packs, shipments dispatched
  - **Cycle times** (30-day): avg pick cycle (completedAt - startedAt), dock-to-stock (putaway.updatedAt - receivingTask.createdAt), order-to-ship (first dispatch - order.createdAt), plus sample counts
  - **Quality & accuracy** (30-day): pick accuracy (completed / (completed + short_pick)), pack audit pass rate, inventory record accuracy (1 - Σ|variance| / Σ expected) computed from recent cycle count lines
  - **Live work queue**: pending pick / putaway / pack tasks, active waves, receiving-in-progress counts
  - **Exceptions**: open issues with critical breakdown, cutoff-at-risk shipments (critical + warning), returns-in-progress, open pack-audit-fail issues
  - **Capacity**: total bins, bins with inventory, utilization percent
  - Frontend page at `/wms/operations` with KPI cards grouped by section. Tone coloring (success/warning/error) on accuracy metrics and capacity utilization. Auto-refreshes every 60s. Clickable cards drill to the related operational page (picks → /wms/picking, cutoff → /wms/cutoff-monitor, etc.)
  - Sidebar entry "Operations KPIs" alongside the WMS Dashboard
  - 13 service tests (throughput windowing, cycle time math, pick accuracy, pack pass rate, inventory accuracy from cycle counts, null-sample handling, bin utilization, cutoff exception rollup)
- **Pallet Types & Palletization** ✅ (foundation)
  - `PalletType` catalog model: unique `(orgId, code)`, external dimensions (mm), tare + max-load (grams), optional max stack height, material (wood/plastic/metal/cardboard/composite), reusable/ISPM-15/stackable/active flags
  - `TrackableUnit.palletTypeId` FK so pallet-level units reference their spec (nullable - legacy / ad-hoc pallets unaffected)
  - Standard pallet seed covering EUR1 (EPAL 1200×800), EUR2/3/6, US GMA (48×40), US 42×42, CHEP 1210 + CHEP 48×40, AU 1165, plastic variants, one-way export, quarter display - 13 types total with real ISO specs
  - `GET /api/v1/pallet-types/standards` exposes the seed; `POST /api/v1/pallet-types/seed-standards` bulk-adds missing rows to the org
  - `PalletizationPlanner.planHomogeneousPallet` - given a pallet type and carton spec returns cartonsPerLayer (best of 2 orientations), layers (min of height-bound and weight-bound), stacked height, total weight, weight + height utilization %, warnings (weight-first vs height-first)
  - `PalletizationPlanner.recommendPalletType` ranks active pallet types by cartons-carried, tie-breaks on weight utilization, returns `{ best, all }`
  - Endpoints: `POST /api/v1/pallet-types/:id/plan`, `POST /api/v1/pallet-types/recommend`, plus full CRUD (create/update/delete with soft-deactivation when referenced by TrackableUnits)
  - Admin page `/wms/pallet-types` - table with code, name, dimensions in cm, tare/max-load in kg, chip badges for reusable / ISPM-15 / stackable, "Load standard types" one-click seed, create/edit modal
  - 11 planner tests (orientation optimization, height limit, weight limit, utilization math, null-height-cap path, recommendation ranking, inactive filtering, tie-break)
- **Container Intelligence at Pack Time** ✅ (v1 engine)
  - `CartonCatalogue` gains 8 container-intelligence fields: `temperatureZone` (any / ambient / refrigerated / frozen / dry_ice), `insulated` + `insulationHours`, `tamperEvident`, `valueClass` (any / standard / high_value), `hazmatRated` + `hazmatClasses[]` (UN class codes), `materialType` (corrugated / plastic / metal / foam / composite)
  - `ContainerIntelligenceService.recommend(items, cartons, options)` groups items into constraint-compatible packages, picks the smallest qualifying carton per group, and returns required ancillaries (gel_pack / dry_ice / desiccant / fragile_padding / tamper_seal) + special handling flags (hazmat / high_value / fragile) + per-package reasons
  - Constraint enforcement baked in: non-ambient cargo requires strict temperature match (no "any" fallback for refrigerated/frozen); hazmat cargo requires hazmat-rated carton approved for every class in the group; non-hazmat cargo is kept out of dedicated-hazmat cartons; high-value cargo requires explicit high-value carton
  - Hazmat segregation matrix (UN classes 1 / 2.1 / 2.3 / 3 / 4.1 / 4.2 / 4.3 / 5.1 / 5.2 / 6.1 / 8) splits incompatible classes into separate packages (e.g., class 3 flammables away from class 5.1 oxidizers)
  - Transit-hours upgrade: refrigerated packages heading past 24h transit automatically get dry_ice added with a warning
  - `POST /api/v1/containers/recommend` endpoint returns full package plan with volume/weight utilization and total container cost
  - Carton catalogue admin UI extended with all the new fields: temperature zone selector, insulation hours, tamper-evident toggle, value class, material, hazmat classes list, plus per-row chips in the table
  - 36 tests covering input validation, best-fit sizing, temperature grouping, hazmat segregation (compatible and incompatible class pairs), value-class routing, fragile ancillaries, multi-split combinations, reason strings, cost/weight totals
- **Warehouse Mobile App Extensions** DONE (v1)
  - Pick task execution (line-by-line with quantity confirmation)
  - Putaway task execution (scan-to-confirm destination bin)
  - Return receiving flow (scan RMA, receive per-line with qty input, auto-routes to inspection)
  - Return inspection / disposition flow (two-column disposition picker with hints, pass/fail/partial_damage, notes, customer-preferred disposition pre-selected)
  - Pack audit flow (scale input with optional LWH dims, immediate pass/warning/fail verdict, raises quality issue on variance)
  - Receiving flow (scan SKU → enter received qty + inspection status, unified across ASN and blind)
  - Packing flow (line-by-line item verification with barcode scan, carton recommendation, complete task when all lines packed)
  - Receiving appointment check-in flow (today's scheduled arrivals, one-tap check-in before receiving)
  - Barcode wedge keyboard hook (`useBarcodeScanner`) supports Zebra / Honeywell RF guns that emit rapid keystrokes + Enter
  - Unified task list with Picking / Putaway / Returns / Receive / Pack tabs; bottom nav surfaces Arrivals alongside Tasks
- **WMS v1 Gap Close-Out** ✅
  - Wave auto-release worker - `WaveAutoReleaseService` + pg-boss cron (`wave-auto-release`, default every 5 min). Templates with `autoRelease=true` and a `releaseSchedule` (HH:MM or simple cron) + `cutoffTime` fallback fire `APPLY_WAVE_TEMPLATE` when due. `lastAutoReleasedAt` dedup stamp prevents re-firing within a 12h window. Configurable via `WAVE_AUTO_RELEASE_CRON`
  - Pack audit events (`pack.audit_recorded`, `pack.audit_variance_detected`) now subscribed by `CustomerWebhookHandler` via pack task → order → customer resolver so third-party integrations receive them as webhooks (issue creation moved after commit via `PackAuditIssueHandler` → `CREATE_ISSUE` in #131, so the issues reach the read model and triage board)
  - Receiving Appointments admin UI at `/wms/receiving-appointments` - date-filterable list with one-click check-in and cancel; new appointment form with carrier, trailer, seal, ASN reference, dock bin picker. Exposes `/api/v1/receiving/appointments/:id/check-in` and `/cancel` endpoints
  - Receiving Appointments mobile flow at `/warehouse/appointments` - today's arrivals with status chips and single-tap check-in, accessible from the bottom nav
  - Fixes from audit gaps 1-3: WaveTemplate `zonePickMode` wired end-to-end, `/cycle-counts/:id` `params` schema added, `ManifestUpload.location` relation + FK migration
  - 16 new tests (WaveAutoReleaseService: HH:MM + cron parsing, schedule-due logic, dedup window, runOnce dispatch / skip / failure paths; CustomerWebhookHandler: subscription patterns, pack task → order → customer resolver, graceful skip for missing data)

- **Event-driven auto-replenishment** ✅
  - `AutoReplenishmentHandler` subscribes to `pick_line.completed` and `inventory.adjusted`
  - Resolves location via PickTask → locationId (for pick events) or WarehouseBin → locationId (for adjust events)
  - Dispatches `CHECK_REPLENISHMENT` scoped to the affected `(locationId, sku)` so only matching rules are evaluated
  - Replenishment tasks fire the moment inventory drops - no waiting for a cron sweep - while the command-level dedup still prevents duplicate putaway tasks
  - 7 tests covering subscription patterns, both location resolution paths, direct-payload path, missing sku / missing lookup graceful skip, dispatch-error resilience

- **Customer webhook retry with exponential backoff** ✅
  - `CustomerWebhookDeliveryService.retry(deliveryId)` re-sends a failed delivery with a fresh HMAC signature and `X-OpenTms-Retry` header; increments `attemptCount` atomically
  - `findEligibleForRetry(maxAttempts, now)` selects `status='failed'` deliveries whose age has cleared the backoff window for their current attempt
  - Backoff schedule: attempt 1 → 2 min wait, 2 → 4 min, 3 → 8 min, 4 → 16 min, 5+ → capped at 30 min. Max 5 attempts before giving up
  - `webhookRetryWorker` runs every minute (`*/1 * * * *`, override `WEBHOOK_RETRY_CRON`), calls `findEligibleForRetry` then retries each one
  - 12 tests covering backoff math per attempt, cap at 30 min for high attempt counts, maxAttempts query filter, retry success + failure paths, idempotent already-delivered handling, missing-delivery error, fetch-error recording, retry header format

### IoT integration (System Loco)

- Device-shipment linking (associate IoT devices with shipments) ✅
- Real-time data ingestion from System Loco IoT platform (temperature, pressure, shock, light, GPS) ✅ hardened webhook pipeline (verify→enqueue→202, HMAC signature, idempotency), resolves to shipment, updates live position, enriched telemetry. See `docs/SYSTEM_LOCO_INTEGRATION.md`
- Sensor stream visualization on shipment detail pages ✅ (Telemetry tab)
- **IoT tidy-up** (#291) ✅ telemetry reads scoped to the caller's org, device and vendor settings on commands and repositories, shipment form can no longer take over another org's device, legacy GCP `webhook-service/` removed
- Full-journey proof: origin departure + ~10 route-based in-transit checkpoints + destination arrival, all as domain events (`tracking.geofence_exited`/`tracking.journey_checkpoint`/`tracking.geofence_entered`) ✅ (#283). v1: origin/destination only, location only — see `docs/DOMAIN_BEHAVIOURS.md` > Tracking (IoT)

### Internal user auth

- **Role & permission management UI** ✅ (#142) - create/edit/delete custom roles from /settings with a grouped permission picker (catalogue-driven, so new permission families appear automatically); system roles locked in the UI and on the API (seeder re-syncs them on boot); roles:read/roles:write guards added to all role routes, closing a privilege-escalation hole where any authenticated user could create and self-assign a '*' role
