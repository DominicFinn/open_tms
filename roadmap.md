# Open TMS Roadmap

> **Reoriented April 2026.** Restructured around core TMS completeness - the features that make or break a credible demo. Brokerage elevated to first-class, reporting overhauled, customer portal prioritised. Speculative/advanced items (carrier risk/FMCSA, driver mobile app, digital BOL, sustainability/carbon, multi-modal ocean/air/rail, hub-and-spoke) removed or deferred to considerations.

> **WMS added April 2026.** WMS now an active track (Track 7). v1 and v2 are on the roadmap following the gap-analysis review in `docs/gap-analysis/12-WMS-GAP-ANALYSIS.md`. v3+ (slotting, LMS, yard, WCS, etc.) remains in considerations.

---

## Completed Work

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
- **System Loco Webhook Ingestion** - Hardened device webhook pipeline: verify -> enqueue (pg-boss) -> 202; HMAC X-LocoAware-Signature verification (secret on the IoT vendor config) with API-key fallback; idempotent on the event id (no duplicate readings on redelivery); resolved location updates the shipment's live map/list position; enriched telemetry (humidity, pressure, location type/accuracy) on SensorReading + Telemetry tab. Local replay harness + integration doc (docs/SYSTEM_LOCO_INTEGRATION.md).
- **Item/Line Items** - Model SKUs, quantities, weights, dimensions, CSV/Excel bulk import

### **Phase 2: Orders & Ingestion** DONE
- **Order Management** - CSV import, manual creation, auto-assignment to lanes, pending lane requests, special requirements (FTL/LTL, temp control, hazmat)
- **Customer API** - REST API for programmatic order creation, API key auth, rate limiting, Swagger docs
- **Order Status Lifecycle** - Status flow (unassigned to delivered/exception), geofencing, IoT triggers, audit trail, timeline API/UI
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
- **Live Tracking** - Inbound GPS webhook, ShipmentEvent tracking, geofencing with auto-delivery, ShipmentReadModel with lat/lng
- **ETA Monitoring** - Provider-agnostic routing (TomTom/HERE/Valhalla), adaptive polling, three delay severity levels, traffic-aware ETAs, pg-boss cron, API endpoints
- **Carrier Tracking API Integrations** - ICarrierTrackingProvider interface, FedEx/UPS/DHL implementations, polling worker, webhook receiver, admin setup wizard
- **Route Deviation Alerts** - Planned route per lane via Google Maps, corridor-based deviation detection, real-time alerts
- **Exceptions** - Exception status with type classification, resolution workflow, event-driven notifications, ETA-based auto-detection

### **Phase 6: Cold Chain** DONE (partial)
- **Cold Chain Profiles** - CRUD (name, temp range, alert range, humidity), assign to shipments
- **Excursion Management** - IoT sensor pipeline, disposition lifecycle (monitoring to released/quarantined), auto-triage
- **Regulatory Audit Trail** - Immutable temperature logging with SHA-256 integrity hashes (CFR 21 Part 11)
- **Cold Chain Compliance Report** - Auto-generated PDF on shipment complete
- **Device Calibration** - Certificate, expiry, accuracy tracking
- **CAPA Reports** - Model and management UI
- **Admin & Frontend** - VNext profiles page, CAPA reports page, auto-deliver shipment docs setting

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

## Active Development - Core TMS Completeness

The following tracks are ordered by impact on TMS credibility. Items within each track are sequenced by dependency.

### **Track 1: Brokerage Operations** (NEW - Critical Gap)

The system models the world as "shipper has carriers" but never accounts for the broker role - arguably the single most common TMS user persona. No broker margin tracking, no customer-as-shipper vs carrier-as-capacity pairing, no broker-specific workflows.

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
  - Quote-to-book conversion: "Accept & Book" creates shipment with pre-set sell rate, flows directly to load board
  - Rate confirmation PDF generation (carrier-facing, hides customer sell rate and broker margin)
  - Customer credit check service: validates outstanding balance against creditLimitCents before quoting
  - Customer rate request intake - moved to Track 3 (Customer Portal)
- **Broker Load Board** ✅
  - Internal load board: unmatched shipments needing carrier assignment
  - Carrier capacity search: find carriers with lane rates and historical usage on matching lanes
  - Quick carrier assignment with cost rate capture and real-time margin preview
  - Integration with carrier tendering (existing broadcast/waterfall) for larger operations
  - Tender acceptance rate stats per carrier
  - Load matching suggestions - moved to Track 4 (Route Optimization)
- **Broker-Specific Financials** ✅
  - Carrier quick pay / factoring: request accelerated payment with configurable discount % and payment days
  - Customer invoice with broker markup (not showing carrier cost) - already worked via existing Invoice system
  - Carrier settlement: batch payments to carriers grouped by payment terms - already existed
  - Receivables aging from broker perspective - already existed via AR aging report
  - Commission tracking for broker agents: Commission model with accrued/approved/paid lifecycle, basis on margin or revenue, per-agent summary, management UI

### **Track 2: Reporting & Analytics** (Biggest Credibility Gap - ~40% Coverage)

The current reporting is financial-only (AR aging, carrier spend, margin analysis). Missing the operational KPIs that every TMS demo gets judged on.

- **Executive Dashboard** ✅
  - Reports app with own app switcher entry and dashboard landing page
  - Single performant API call (`GET /api/v1/reports/dashboard`) - all queries hit read models only
  - Shipment stats: total, in transit, at locations (pickup + delivery), delivered, full status breakdown with bars
  - Order stats: total with delivery status breakdown (unassigned/assigned/in transit/delivered/exception)
  - Financial summary: revenue, cost spent, margin ($ and %), with period-over-period trend arrows
  - Invoice health: outstanding count/value, overdue count/value
  - Issue overview: active issues, critical issues
  - Billing pipeline: not invoiced / invoiced / paid counts
  - Period selector: 7 days, 30 days, MTD, QTD, YTD
  - Trend comparison vs prior period (% change with up/down arrows)
  - On-time delivery percentage (OTD%) 🔲
  - Cost per shipment / cost per unit / cost per mile trends 🔲
- **Carrier Scorecards** 🔲
  - On-time pickup and delivery rates per carrier
  - Tender acceptance rate and response time
  - Damage/claim rate
  - Average transit time vs quoted
  - Invoice accuracy (freight audit match rate)
  - Overall composite score with configurable weighting
  - Trend charts (rolling 30/60/90 day)
  - Exportable scorecard PDF for procurement reviews
- **Operational Reports** 🔲
  - Shipment status summary (count by status, mode, customer, carrier)
  - Lane utilization: volume and cost by lane over time
  - Dwell time analysis by location
  - Exception breakdown by type, root cause, and resolution
  - SLA compliance trends (already have SLA data, need the report view)
  - Stop performance: average load/unload times by location
- **Scheduled Reports** 🔲
  - Report scheduling engine (pg-boss cron) - daily, weekly, monthly
  - Report template selection with parameter presets
  - Email delivery with PDF/CSV attachments
  - Recipient lists (internal users + external email addresses)
  - Report history and re-download
- **Ad-Hoc Report Builder** 🔲
  - Drag-and-drop field selection from available data sources
  - Filter/group/sort configuration
  - Chart type selection (bar, line, pie, table)
  - Save and share report definitions
  - CSV/PDF export from any report

### **Track 3: Customer Portal** (Table Stakes - Currently 22%)

Every TMS needs customer self-service. The carrier portal exists but there's nothing for the shipper's customer.

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
  - Map view of active shipments 🔲
  - POD access 🔲
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
    - `ModeRulesService` drives required-ness from `(mode, flags)` — FTL/LTL/parcel × hazmat × international × temp-controlled. Same matrix evaluated client-side in the portal and re-validated server-side
    - `OrderCartonizationService` derives density, suggested freight class (NMFC density table), rolled-up class, total weight, total cube, pallet positions, linear feet — read-only live preview at `POST /api/v1/order-line-items/cartonization/preview`
    - `PalletType` generalised → `PackagingType` (org-scoped catalogue with `kind` discriminator: pallet | carton | crate | drum | roll | bag | tote | loose | custom). Admin CRUD at `/wms/packaging-types`
    - Order-level packing summary auto-generates `TrackableUnit`s from `(packagingTypeId, unitCount, stackable)` — customers don't build pallets by hand
  - **Phase 2: Manual handling-unit modelling** ✅ (Jun 2026)
    - `TrackableUnit` gains optional per-unit overrides: weight, L/W/H + units, stackable
    - 8 per-unit operations promoted from repository-direct to CQRS commands (`CreateTrackableUnit`, `UpdateTrackableUnit`, `DeleteTrackableUnit`, `GenerateBarcode`, `AddLineItemToUnit`, `MoveLineItemBetweenUnits`, `MergeUnits`, `SplitUnit`). Each emits a `trackable_unit.*` event
    - `OrderProjection` subscribes to `trackable_unit.*` and recomputes `trackableUnitCount`, `lineItemCount`, `totalWeight`. Per-unit weight overrides take precedence over line-item weight sums
    - `OrderCartonizationService.computeOrderFromUnits` computes per-unit weight/cube/density/class with three-tier fallback (override → lines → packagingType external dims). Live preview at `POST /api/v1/order-line-items/cartonization/preview-units`
    - `HandlingUnitsEditor` component (shared portal + admin): drag-and-drop line items between units via `@dnd-kit`, per-unit dim/weight edit fields, create/delete/merge/split actions, generate-barcode, live cartonization summary
    - Customer portal mirrors the 8 admin endpoints under `/customer-portal/...` with customer-owns-order ownership checks
  - Order templates for recurring shipments 🔲
  - **Bulk order upload (CSV) through portal** ✅ (Jun 2026, Phase 3 of Order Line Items work)
    - CSVImportService rewritten to dispatch `CREATE_ORDER` per order through the command bus (events fire, OrderProjection stays in sync — previously bypassed)
    - Per-line `ModeRulesService` validation: each row checked against `(serviceLevel, hazmat, international, temp-controlled)`. International derived from origin/destination country mismatch
    - All-or-nothing per order: any failing line rejects that whole order with row-level errors carrying source CSV row numbers; sibling orders still go through
    - Customer-portal endpoint at `POST /api/v1/customer-portal/orders/import/csv` forces customerId to the authed customer (rejects CSVs that declare a different one)
    - CSV template download at `GET /customer-portal/orders/import/csv/template` (admin: `/orders/import/csv/template`)
    - Full Phase 1/2 column coverage: UoM, declared value, freight class, NMFC, UN/class/PG/PSN, HS/CoO, temp range, order-level packing summary, per-unit dim/weight/stackable overrides, packagingTypeCode resolution against the org catalogue
    - Polished upload UI in both admin and portal: drag-drop, staged spinner (reading → validating → creating), per-row error display with order number tag, quick-links to created orders, template download
  - **Phase 4: Line item CQRS + weight consistency** ✅ (Jun 2026)
    - `CreateLineItemCommand` / `UpdateLineItemCommand` / `DeleteLineItemCommand` close the last CQRS gap in the order write surface. Each emits an `order_line_item.*` event consumed by `OrderProjection`
    - New `PUT /api/v1/orders/:orderId/line-items/:itemId` lets operators (and customers, via portal mirror) edit any Phase 1 field on an existing line via sparse patch — no more delete-and-recreate
    - The two legacy `/line-items` endpoints (POST add, DELETE remove) now dispatch commands instead of hitting the repo, so the read model and audit trail finally see them
    - Weight aggregation bug fix: `OrderReadModel.totalWeight` now correctly sums `weight × quantity` per line (line weights are per-piece, matching cartonization). Unit-weight overrides still take precedence. Regression test included
- **Shareable Tracking Links** ✅
  - HMAC-signed tracking tokens (no login required)
  - Public tracking page at /track/:token with status, route, stops timeline, tracking events
  - "Share" button on shipment detail copies tracking URL to clipboard
  - Limited info only - no customer name, carrier details, or financial data exposed
  - Embeddable tracking widget 🔲

### **Track 4: Route Optimization & Load Planning** (Core TMS Value / ROI Pitch)

This is where TMS software earns its keep - the optimization that justifies the subscription.

- **Multi-Stop Route Optimization** 🔲
  - VROOM or Google OR-Tools integration for TSP/VRP solving
  - Optimize stop sequence for minimum distance/time/cost
  - Constraint support: time windows, vehicle capacity, driver hours
  - Compare optimized vs manual route with savings estimate
  - Re-optimize on the fly when stops are added/removed
- **Consolidation Optimizer** 🔲
  - Identify orders on similar lanes that can share a vehicle
  - Consolidation suggestions with fill rate and cost savings estimate
  - Auto-consolidation rules (same customer, same day, same lane)
  - LTL to FTL upgrade suggestions when volume warrants
- **Mode Selection** 🔲
  - Compare FTL vs LTL vs parcel for a given shipment
  - Rate comparison across modes with transit time trade-offs
  - Auto-suggest optimal mode based on weight, dimensions, and urgency
  - Mode-specific carrier ranking (best LTL carrier vs best FTL carrier for a lane)
- **Load Planning Board** 🔲
  - Visual load board: unassigned shipments ready for carrier assignment
  - Drag-and-drop shipment-to-load assignment
  - Load capacity visualization (weight, volume, pallet positions)
  - Multi-order load building with weight/cube optimization
- **Appointment Scheduling** 🔲
  - Dock scheduling and delivery window management
  - Appointment slots by location with capacity limits
  - Integration with shipment stop ETAs

### **Track 5: Cold Chain Completion** (Complete What's Started)

The cold chain infrastructure is strong (profiles, excursion detection, disposition, compliance reports, CAPA). What's missing is the regulatory UI and reporting layer.

- **Regulatory Audit Trail UI** 🔲
  - Full audit trail viewer for temperature records (CFR 21 Part 11 compliance)
  - Tamper-evident display of SHA-256 integrity hashes
  - Chain-of-custody timeline: who handled what, when, with what readings
  - Export audit trail to PDF for regulatory submissions
- **Cold Chain Compliance Reporting** 🔲
  - Customer-facing temperature compliance reports with excursion summaries
  - Regulatory export formats (FDA, USDA requirements)
  - Batch compliance reports across multiple shipments
  - Excursion trend analysis: frequency, severity, root cause by lane/carrier/product
- **Cold Chain Dashboard** 🔲
  - Real-time temperature monitoring overview (active shipments with readings)
  - Excursion alert feed
  - Compliance rate by customer/product/lane
  - Device health and calibration status overview

### **Track 6: Routes & Maps** (Enhance Existing Foundation)

Building on the existing map view, ETA monitoring, and route deviation system.

- **Route Lines on Map** 🔲
  - Draw route polylines between origin and destination on map view
  - Colour-code by status (on-time, delayed, deviated)
  - Animate in-transit shipments along route
- **Spatial Indexing** 🔲
  - PostGIS extension for inverse geofence queries (ST_DWithin with spatial index)
  - Geography column on Location model for fast spatial lookups
  - ISpatialIndexProvider interface (PostGIS default, Tile38 for scale)
  - Security event evaluation in SLA cron worker
- **Traffic & Conditions Integration** 🔲
  - Real-time traffic overlay on map view
  - Road closure and construction alerts on active routes
  - Alternative route suggestions when primary route is degraded
  - Historical traffic pattern analysis for departure time recommendations

### **Track 7: Warehouse Management System (WMS)**

Bolt-on WMS extending the TMS's TrackableUnit/CargoScan/Location models. Full specification in `docs/WMS_SPECIFICATION.md`. Gap analysis against tier-1 WMS (Manhattan, Blue Yonder, Körber, SAP EWM, Oracle WMS) in `docs/gap-analysis/12-WMS-GAP-ANALYSIS.md`. Separate app in VNext app switcher at `/wms`.

#### **v1 - Foundation** (must-ship to be credible)

- **Location Hierarchy** DONE
  - WarehouseZone, WarehouseAisle, WarehouseBin models with capacity denormalization
  - Bulk bin generation (grid pattern), walk sequence, temperature/hazmat attributes
  - Bin types: pallet, shelf, floor, dock door, staging, pack station
  - 14 command handler tests
- **Indoor Positioning (RTLS)** 🔲
  - IndoorZoneAnchor (BLE/WiFi/UWB) extending ArrivalCriteria
  - IndoorPositionHandler maps anchor hits to zones/bins on TrackableUnits
  - IndoorZonePosition read model for current-state queries
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
  - 🔲 QualityHold model (blocks allocation)
  - ProductUom CRUD: SKU dimensions/weights management UI, barcode/GTIN tracking, dimension lookup API for cartonization
  - CartonCatalogue CRUD: per-location carton sizes with cost tracking
  - CartonizationService: First-Fit-Decreasing recommendation (ProductUom dims -> OrderLineItem fallback), volume + weight utilization scoring, alternative carton suggestions (7 tests)
  - 🔲 ProductUom conversions (break-case operations, EA/INNER/CASE/PALLET)
  - 🔲 Auto-measure: automated dimension capture for products without UOM data (scale/dimensioner integration)
- **Receiving** DONE (partial)
  - ReceivingAppointment (scheduled dock time), ReceivingTask, ReceivingLine
  - ASN-based and blind receiving, inspection workflow
  - 10 command handler tests
  - 🔲 Manifest ingestion engine: CSV/XLSX upload, column mapping templates with header-checksum auto-detection, saved mappings per supplier/format
  - 🔲 Extends CargoScan (new scanTypes), CargoDiscrepancy (over/short/damaged)
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
  - 🔲 Soft allocation, FEFO/LIFO strategies, closest-to-pickface, same-lot, avoid-partial-pallet
  - 🔲 ATP (Available-to-Promise) query endpoint
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
  - 4 command handler tests
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
  - 🔲 Auto CreditNote link on completion (creditNoteId field exists, generation deferred)
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
- **Marketplace Return Webhooks** 🔲 (v2)
  - Shopify Returns API webhook (`returns/create`, `returns/update`) - most common marketplace, highest priority
  - eBay Post-Order API webhook for refund/return events (extends existing Stocs Artoo-style refund detection)
  - Amazon MWS / SP-API return polling (MCF and FBA flows where Amazon inspects returns themselves)
  - Magento, WooCommerce, BigCommerce webhook receivers
  - Each maps to `Rma.initiatedVia: marketplace_webhook` with marketplace-specific source metadata
  - Auto-creates and optionally auto-authorizes RMAs based on per-channel configuration
- **Delivery Rejections (shipment refused)** 🔲 (v2)
  - DeliveryRejection model for customer-refused deliveries (Walmart OTIF, cold chain break, temperature excursion, late delivery, damaged in transit, paperwork missing)
  - Triggered by shipment status -> refused, driver records reason + photos + telemetry
  - Auto-creates Rma for the physical goods handling
  - Return trip planning (carrier hold, return to shipper, divert to secondary customer)
  - Links to CAPA / quality system for root cause analysis
  - Spans TMS (return trip), WMS (goods handling), Quality (CAPA trigger)
- **OTIF / Chargeback Tracking** 🔲 (v2)
  - Customer-specific compliance rules (Walmart OTIF, Amazon Vendor Central chargebacks, Target routing guides)
  - Chargeback record with amount, reason code, dispute status
  - Integration with customer invoice (deductions against AR)
  - Performance dashboard per customer showing compliance rate and penalty trends
- **Carrier Freight Claims** 🔲 (v2)
  - Freight claim record with damage/loss/shortage amount, supporting evidence (photos, BOL, POD)
  - Link to carrier via existing carrier system
  - Claim lifecycle: filed, acknowledged, negotiated, paid, denied
  - Integration with carrier invoice (offset claim amounts against payables)
- **WMS EDI** ✅
  - EDI 940 (Warehouse Shipping Order, inbound) - `EDI940ParseService` extracts W05 header, N1 address loops (ST/SF/WH), G62 requested ship dates, W66 carrier + SCAC, NTE free-form notes, W01 line detail with UOM, G69 descriptions, N9 lot / customer line refs. `/api/v1/edi/940/inbound` dispatches `CREATE_ORDER` with `importSource: 'edi_940'`; `/preview` parses without persisting
  - EDI 945 (Warehouse Shipping Advice, outbound) - `EDI945Service` emits W06 header, N1 loops, G62 actual ship date, W27 carrier/tracking, W12 item detail with shipment status codes (CC = complete, PC = partial, CN = cancelled), line-level N9 for tracking/lot/customer refs, W03 totals. `Edi945AutoSendHandler` subscribes to `shipment.delivered` and delivers via SFTP/HTTP to any trading partner with outbound 945 enabled; `/api/v1/edi/945/generate` for manual generation
  - EDI 180 (Return Merchandise Authorization and Notification) - inbound parser creates Rma, outbound generator emits return authorization. Routed via existing universal EDI inbound endpoint and TradingPartner infrastructure.
  - GS functional identifiers: 940 → `OW` (Warehouse Shipping Order), 945 → `SW` (Warehouse Shipping Advice), 180 → `RZ`
  - 21 tests (940 parse: headers / addresses / multi-line / lot+customer refs / SCAC / notes / wrong-transaction / missing depositor / no lines / no SKU; 945 generate: envelope / all status codes (CC/PC/CN) / line-level N9 / overship warning / validation errors / replacement reporting code; full 940→945 roundtrip)
- **Returns Integration Layer** 🔲 (v1)
  - Public REST API endpoint for RMA creation (uses existing ApiKey auth scoped to Customer)
  - `Rma.initiatedVia` extended: `admin`, `customer_portal`, `api`, `edi_180`, `marketplace_webhook`
  - EDI 180 inbound handler wires into existing TradingPartner EDI flow
  - Customer API documentation in Swagger with RMA examples
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
- **Indoor RTLS Heatmap UI** 🔲
  - 2D floor-plan SVG upload per Location
  - Live markers for TrackableUnits and users via WebSocket/SSE
  - Dwell heatmap, density heatmap, 24h scrub playback
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
  - 🔲 Auto-split orders across multiple pallets when volume/weight exceeds capacity (next iteration)
  - 🔲 Route-based pallet building (group by delivery stop) + reverse load-sequence integration
  - 🔲 Mobile pallet-build workflow at pack/staging (scan carton → propose pallet → confirm)
- **Container Intelligence at Pack Time** ✅ (v1 engine)
  - `CartonCatalogue` gains 8 container-intelligence fields: `temperatureZone` (any / ambient / refrigerated / frozen / dry_ice), `insulated` + `insulationHours`, `tamperEvident`, `valueClass` (any / standard / high_value), `hazmatRated` + `hazmatClasses[]` (UN class codes), `materialType` (corrugated / plastic / metal / foam / composite)
  - `ContainerIntelligenceService.recommend(items, cartons, options)` groups items into constraint-compatible packages, picks the smallest qualifying carton per group, and returns required ancillaries (gel_pack / dry_ice / desiccant / fragile_padding / tamper_seal) + special handling flags (hazmat / high_value / fragile) + per-package reasons
  - Constraint enforcement baked in: non-ambient cargo requires strict temperature match (no "any" fallback for refrigerated/frozen); hazmat cargo requires hazmat-rated carton approved for every class in the group; non-hazmat cargo is kept out of dedicated-hazmat cartons; high-value cargo requires explicit high-value carton
  - Hazmat segregation matrix (UN classes 1 / 2.1 / 2.3 / 3 / 4.1 / 4.2 / 4.3 / 5.1 / 5.2 / 6.1 / 8) splits incompatible classes into separate packages (e.g., class 3 flammables away from class 5.1 oxidizers)
  - Transit-hours upgrade: refrigerated packages heading past 24h transit automatically get dry_ice added with a warning
  - `POST /api/v1/containers/recommend` endpoint returns full package plan with volume/weight utilization and total container cost
  - Carton catalogue admin UI extended with all the new fields: temperature zone selector, insulation hours, tamper-evident toggle, value class, material, hazmat classes list, plus per-row chips in the table
  - 37 tests covering input validation, best-fit sizing, temperature grouping, hazmat segregation (compatible and incompatible class pairs), value-class routing, fragile + humidity ancillaries, multi-split combinations, reason strings, cost/weight totals
  - 🔲 Smart tote integration (IoT-paired totes assigned at pack time) - next iteration
  - 🔲 Order-line-item-driven auto-fill from SKU catalog temperature + hazmat attributes at pack time
- **Unified WarehouseTask Supertype** 🔲
  - Foundation for v2 task interleaving and LMS-aware dispatch
  - `expectedDurationSeconds` field placed now (wired in v2)
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
  - 🔲 PWA offline task queue with IndexedDB (v1.5 - needs field validation first)

- **WMS v1 Gap Close-Out** ✅
  - Wave auto-release worker - `WaveAutoReleaseService` + pg-boss cron (`wave-auto-release`, default every 5 min). Templates with `autoRelease=true` and a `releaseSchedule` (HH:MM or simple cron) + `cutoffTime` fallback fire `APPLY_WAVE_TEMPLATE` when due. `lastAutoReleasedAt` dedup stamp prevents re-firing within a 12h window. Configurable via `WAVE_AUTO_RELEASE_CRON`
  - Pack audit events (`pack.audit_recorded`, `pack.audit_variance_detected`) now subscribed by `CustomerWebhookHandler` via pack task → order → customer resolver so third-party integrations receive them as webhooks (inline issue creation in the command stays for atomicity)
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

- **Navbar polish (v1.5)** 🔲
  - Integrations app has no transaction-type-scoped EDI shortcut (e.g. "EDI 940 received today", "EDI 945 auto-sent this week"). The universal Transaction Log at `/integrations/edi/logs` covers them via filters, but the 940/945 3PL pair is heavily used and would benefit from dedicated quick-links
  - Follow-up from WMS v1 navbar audit - LLM usage + agent prompt version history already live inline in `/settings/llm` and `/settings/agents` respectively (no gap)
  - Standalone apps (customer portal, carrier portal, warehouse mobile PWA) are intentionally outside the app switcher - not in scope for this item

#### **v2 - Differentiation** (after v1 ships)

- **3PL Billing Suite** 🔲
  - BillingContract per customer (storage/handling/VAS rate cards)
  - Daily storage accrual cron (per pallet-day, per cbm-day)
  - Handling charges on receipt / pick / pack / ship events
  - Integrates with existing Charge + Invoice pipeline
- **Value-Added Services & Kitting** 🔲
  - VasTask (ticketing, re-labelling, gift-wrap, FBA prep)
  - BillOfMaterials + KittingTask (assemble/disassemble kits)
  - Billing hooks for per-VAS-unit charges
- **Advanced Palletization** 🔲
  - Pallet weight distribution optimization (heavy items on bottom)
  - Stacking constraint rules (fragile, orientation, max stack pressure)
  - Mixed-SKU pallet building with layer optimization
  - Display-ready pallet builds for retail (quarter-pallet with shelf-ready packaging)
  - Pallet label generation (SSCC-18, GS1-128)
- **Smart Container Fleet Management** 🔲
  - Container pool management: track smart tote fleet (available, in-use, charging, maintenance)
  - Auto-assignment based on IoT capability requirements (temperature range, sensor type)
  - Container health monitoring: battery level, sensor calibration status, last-seen
  - Container return tracking: expected return date, overdue alerts
  - Integration with existing cold chain compliance system for continuous temperature monitoring through the container
- **Parcel & Compliance Labels** 🔲
  - Multi-carrier rate-shop at pack (ShipEngine or direct APIs)
  - End-of-day manifest (SCAN form, EDI 215)
  - SSCC-18 pallet labels, UCC-128 carton labels (GS1-128 barcodes)
  - Retailer-specific ComplianceLabelTemplate (Walmart, Target, Amazon routing guides)
- **Serial Number Tracking** 🔲
  - SerialNumber model, optional capture on receive and pick
  - Foundation for DSCSA / UDI / 21 CFR Part 820 compliance
- **Batch Genealogy & Recall Management** 🔲
  - LotGenealogy projection (upstream/downstream trace)
  - Recall entity with affected-lots query and customer notification workflow
- **Extended WMS EDI** 🔲
  - 846 (Inventory Inquiry/Advice, outbound) - critical for 3PL client dashboards
  - 943 / 944 (Stock transfer shipment / receipt advice)
  - 947 (Inventory Adjustment Advice)
- **Dock Appointment Portal (self-service)** 🔲
  - Carrier-facing appointment request/confirm UI (extends carrier portal)
  - Availability calendar per dock, auto-approval rules
  - ICS feed, live-board URL for drivers
- **Task Dispatcher (interleaving)** 🔲
  - Cross-task-type queue using WarehouseTask supertype
  - Geographic proximity routing (do putaway then pick nearby on return)
- **Quality Hold + Supplier Scorecard** 🔲
  - Release-from-hold workflow with sign-off
  - SupplierScorecard read model (ASN accuracy, on-time, quality)
- **Cold Chain Zone Integration** 🔲
  - Zone-level SensorReading, per-zone excursion events
  - Auto-hold inventory in excursion zones

#### **v3+ - Advanced (deferred to considerations)**

See `docs/gap-analysis/12-WMS-GAP-ANALYSIS.md` for full detail:
- Slotting optimization (ABC velocity, affinity, SlottingRecommendation)
- Labour Management System (engineered standards, productivity, incentive pay)
- Yard Management (YardLocation, YardMove, gate / guard shack, ANPR)
- WCS / Automation Integration (AS/RS, AMR, conveyor, voice, pick-to-light)
- Hazmat Segregation Engine (UN class matrix, SDS, DG shipping papers)
- Bonded / FTZ Warehouse
- 21 CFR Part 11 Electronic Signatures
- Wearable / Voice Picking UI
- Simulation / What-If Planning
- Catch-Weight Items
- Warehouse Carbon per Order

---

## Remaining In-Progress Work

### **EDI Communication Hub** (Continue)
Items from the unified trading partner model that are not yet complete:
- EDI 855 (PO Acknowledgment) - outbound 🔲
- Automated EDI 204 delivery via SFTP/HTTP (currently manual) 🔲
- Automated EDI 990 polling from SFTP (currently manual) 🔲
- AS2 transport for enterprise trading partners 🔲
- SAP/ERP integration patterns (iDoc mapping, CSV/fixed-width adapters, REST/SOAP) 🔲
- Outbound file naming conventions (configurable per partner) 🔲

### **Audit Review & Compliance Trail**
- Searchable, filterable audit log viewer (Admin > Audit Log) 🔲
- Timeline view per entity (shipment, order, carrier, customer) 🔲
- Immutable audit records with checksums/hash chains on DomainEventLog 🔲
- Compliance reporting: user activity reports, data access logging, SOC 2/ISO 27001 templates 🔲

### **SRE, Observability & Operations**
- **Queue Monitoring** (partial) - Dashboard API done, alerting thresholds and auto-scaling 🔲
- **Metrics** (partial) - /metrics endpoint done, Prometheus format, Grafana dashboards, OpenTelemetry 🔲
- **Health Checks** - Enhanced /health with dependency checks, worker liveness endpoint 🔲
- **Connection Pool Management** - PgBouncer, pool utilization metrics 🔲
- **Error Tracking** - DLQ dashboard enhancements, Sentry/Rollbar integration 🔲
- **Deployment** - Blue/green guide, migration safety, worker drain, rollback playbook 🔲
- **Capacity Planning** - Sizing guide, resource recommendations, load testing scripts 🔲

### **Intelligence & AI** (Continue)
- Visual node builder for skill chains (drag-and-drop flowchart UI) 🔲
- Self-improving prompts: track agent suggestions vs human overrides, auto-refine 🔲
- Carrier & lane performance scoring (on-time %, damage %, excursion rate, route adherence) 🔲
- Advanced analytics: predictive dashboards, trend analysis, visual reports 🔲

### **Warehouse App** (Continue)
- Order creation from warehouse app 🔲
- Offline mode / queue operations for WiFi dead zones 🔲
- False start detection (IoT devices sent on wrong shipment) 🔲
- Full shipment management for admin users (mini TMS) 🔲
- Flutter native app (for app store distribution) 🔲
- Geofence-based auto-transition from "ready" to "in_transit" 🔲

### **IoT Integration (System Loco)**
- Device-shipment linking (associate IoT devices with shipments) ✅
- Real-time data ingestion from System Loco IoT platform (temperature, humidity, pressure, shock, light, GPS) ✅ — hardened webhook pipeline (verify→enqueue→202, HMAC signature, idempotency), resolves to shipment, updates live position, enriched telemetry. See `docs/SYSTEM_LOCO_INTEGRATION.md`
- Sensor stream visualization on shipment detail pages ✅ (Telemetry tab)
- IoT-based alerts and automation (excursion alerts, geofence+sensor triggers) 🔲
- _Future:_ **Device Reports V2 feed** — continuous full-sensor snapshots + `timeSeries` arrays (denser telemetry than Device Events) 🔲
- _Future:_ **System Loco Shipments feed** — consume their shipment lifecycle / `leavesOrigin` / `entersDestination` / `leavesRoute` events and map onto our lifecycle + timeline 🔲

### **Miscellaneous**
- Multi-language support (JSON language files, user-selectable, RTL support) 🔲
- Data export (bulk document/attachment export, CSV/PDF export) 🔲
- N8N workflow integration (webhook emission, custom node package, pre-built templates) 🔲
- TMS-to-TMS integration (JSON APIs modeled after EDI, partner portal) 🔲
- Pluggable map provider interface 🔲

### **Internal User Auth Improvements**
Base login (email + password, JWT, admin password reset, RequireAuth guard, global 401 → /login interceptor) is shipped. Improvements to harden and productionise:

- **Self-service password reset via email** 🔲 - `/api/v1/auth/forgot-password` is currently a stub that only logs. Implement: time-limited signed reset token, reset-password page (`/reset-password?token=...`), email delivery via the existing EmailService + EmailTemplate system, token invalidation on use, rate-limit per email.
- **First-login forced password change** 🔲 - Flag users provisioned via admin reset so they must change password on first sign-in before accessing the app.
- **MFA / TOTP** 🔲 - Optional TOTP second factor (QR code enrolment, recovery codes, enforce-per-role policy, trusted-device cookie).
- **SSO expansion** 🔲 - Google / Microsoft OAuth providers already scaffolded in the `AuthProvider` model; finish the redirect flow, domain allowlist enforcement, auto-provisioning rule, and SAML support for enterprise IdPs.
- **Session management** 🔲 - Token revocation list / server-side session records; "sign out all other devices" action; session audit in the user profile.
- **DB-backed login lockout** 🔲 - Replace the in-memory `failedAttempts` map (per-process, lost on restart) with a DB column / Redis store so lockouts survive restarts and scale across worker replicas.
- **Stronger password hashing** 🔲 - Migrate from HMAC-SHA256-with-salt to argon2id (gradual rehash-on-login, add `passwordHashAlgo` column).
- **Audit log for auth events** 🔲 - Record login success/failure, password change, password reset (by admin), lockout, token issuance, and SSO provisioning in `LoginAuditLog` with IP, user agent, outcome.
- **Password policy per organisation** 🔲 - Configurable min length, complexity, rotation days, history depth.
- **Account invitation flow** 🔲 - Admin creates user → email invite with signed acceptance link → user sets their own initial password (replaces the current "admin types a temporary password and sends it manually" workflow).
- **Login UI polish** 🔲 - "Remember me" / long-lived refresh tokens, per-tenant branded login if org has a logo, CAPTCHA after N failures.

---

## Priorities

1. **NEXT (Immediate):** **Carrier API Integration** - Real-time shipment tracking through carrier APIs is table stakes. FedEx/UPS/DHL first-party tracking already exist (real, sandbox-ready). Expand with **multi-carrier aggregators** (EasyPost, AfterShip) so one integration pools dozens of carriers, then broaden. Poll + webhook, all sandbox/ngrok-testable. Landscape + selection in `docs/CARRIER_INTEGRATIONS.md`; testing in `docs/CARRIER_TESTING.md`.
2. **Immediate:** **Track 1 (Brokerage)** - Broker entity model, margin tracking, quoting workflow. This unlocks the largest market segment currently unserved.
3. **Immediate:** **Track 2 (Reporting)** - Executive dashboard, carrier scorecards, on-time %. The single biggest credibility gap in a demo.
4. **Short term:** **Track 3 (Customer Portal)** - Customer user management, order entry, shipment tracking. Table stakes for any TMS.
5. **Short term:** **Track 4 (Route Optimization)** - Multi-stop optimization, consolidation, mode selection. This is the ROI pitch.
6. **Medium term:** **Track 5 (Cold Chain Completion)** - Regulatory audit trail UI, compliance reporting, cold chain dashboard. Finish what's started.
7. **Medium term:** **Track 6 (Routes & Maps)** - Route lines on map, spatial indexing. Visual polish on existing infrastructure.
8. **Medium-to-long term:** **Track 7 (WMS v1)** - Foundation WMS bolt-on. Unlocks true end-to-end coverage (order → warehouse → shipment → delivery) and is the single largest domain expansion on the roadmap. v1 sequence in `docs/WMS_SPECIFICATION.md`.
9. **Long term:** **Track 7 (WMS v2)** - 3PL billing, VAS/kitting, parcel/rate-shop, serial tracking, appointment portal. Differentiation vs commercial tier-1.
10. **Ongoing:** EDI hub completion, audit trail, SRE/observability, AI enhancements, warehouse app improvements.

---

## Considerations (Outside Active Roadmap)

These items are acknowledged but deliberately deferred. They may be re-evaluated based on user demand or strategic shifts.

- **Multi-Tenancy** - Row-level security vs schema-per-tenant vs database-per-tenant. Current single-org model works for self-hosted. Evaluate when there is a concrete need for multiple paying customers on a single deployment.
- **Control Tower Dashboard** - Real-time command centre with live maps, alert streams, SLA gauges. Depends on WebSocket/SSE. Evaluate alongside brokerage operations (brokers need this).
- **Carrier Risk Scoring / FMCSA** - MC/DOT validation, insurance monitoring, safety ratings, fictitious carrier detection. Important for compliance but not core TMS table-stakes.
- **Carrier Onboarding Workflow** - Self-registration, document collection, automated validation. Nice-to-have, evaluate with brokerage (brokers onboard carriers constantly).
- **Driver Mobile App** - Mobile status updates, signature capture, photo POD, GPS tracking, offline support. Large standalone project, consider Flutter approach from warehouse app.
- **Digital BOL / e-Signature** - External eBOL provider integration, tamper-proof sharing, digital signatures. Requires choosing a legally binding signature provider.
- **Hub-and-Spoke & Multi-Modal Transport** - Location type classification, multi-modal legs (ocean/air/rail), intermodal container tracking. Significant complexity for a niche use case at this stage.
- **WMS v3+ (advanced / tier-1 parity)** - Labour management, slotting optimization, yard management, WCS/automation integration, hazmat segregation engine, serial/genealogy, voice picking, 3PL billing advanced features. See `docs/gap-analysis/12-WMS-GAP-ANALYSIS.md` for full catalogue. Core WMS v1 and v2 are now on the active roadmap below.
- **Sustainability / Carbon** - Carbon footprint calculation, emissions reporting. Regulatory pressure increasing but not yet a TMS deal-breaker.
- **Data Providers & External Feeds** - Weather, maritime, aviation, rail, traffic, market/rate data. Valuable for intelligence layer but premature before core reporting is solid.
- **Advanced Operations** - Yard management, returns/reverse logistics, claims management. Enterprise depth features for later.
