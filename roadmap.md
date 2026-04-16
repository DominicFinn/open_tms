# Open TMS Roadmap

> **Reoriented April 2026.** Restructured around core TMS completeness - the features that make or break a credible demo. Brokerage elevated to first-class, reporting overhauled, customer portal prioritised. Speculative/advanced items (carrier risk/FMCSA, driver mobile app, digital BOL, sustainability/carbon, multi-modal ocean/air/rail, hub-and-spoke) removed or deferred to considerations.

> **WMS added April 2026.** WMS now an active track (Track 7). v1 and v2 are on the roadmap following the gap-analysis review in `docs/gap-analysis/12-WMS-GAP-ANALYSIS.md`. v3+ (slotting, LMS, yard, WCS, etc.) remains in considerations.

---

## Completed Work

### **Phase 1: Core Setup (Foundation)** DONE
- **Lane Management** - Create/manage lanes (point-to-point, multi-stop), associate with locations and carriers
- **Carrier Management** - Add carriers, store negotiated rates, service levels, link to lanes
- **Customer Management** - Manage customers with contact/billing info, customer-specific preferences
- **Shipment Creation (Basic)** - Create shipments with references, customer, origin, destination, status, templates
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
  - Order templates for recurring shipments 🔲
  - Bulk order upload (CSV) through portal 🔲
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
  - 🔲 ProductUom conversions UI and break-case operations
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
  - 🔲 Zone pick strategy
  - 🔲 CartonCatalogue + Cartonization service
  - 🔲 PackAudit for weight/dim-weight variance
  - 🔲 `shipment.cutoff_at_risk` events
- **Loading & BOL** DONE (partial)
  - StagingAssignment creation with unit location tracking
  - Batch loading completion (clears unit location - on vehicle)
  - 🔲 LoadPlan with reverse load-sequence
  - 🔲 BOL generation on `load_plan.completed`
  - 🔲 Seal capture, dock door assignment
- **Cross-dock** 🔲
  - Workflow variant on ReceivingTask with sort-by destination/carrier
- **Returns / RMA** 🔲
  - Rma + RmaLine models with disposition (restock/refurb/scrap/RTV/customer_keeps)
  - Customer portal returns request + label generation
  - Return receiving as ReceivingTask variant
  - Auto CreditNote on disposition
- **WMS EDI** 🔲
  - EDI 940 (Warehouse Shipping Order, inbound) - auto-creates Order
  - EDI 945 (Warehouse Shipping Advice, outbound) - emitted on `load_plan.completed`
- **Warehouse Operations Dashboard** 🔲
  - Dock-to-stock, order cycle time, pick accuracy, perfect order rate
  - Inventory record accuracy, capacity utilization, open exceptions
  - Cut-off risk panel
- **Indoor RTLS Heatmap UI** 🔲
  - 2D floor-plan SVG upload per Location
  - Live markers for TrackableUnits and users via WebSocket/SSE
  - Dwell heatmap, density heatmap, 24h scrub playback
- **Unified WarehouseTask Supertype** 🔲
  - Foundation for v2 task interleaving and LMS-aware dispatch
  - `expectedDurationSeconds` field placed now (wired in v2)
- **Warehouse Mobile App Extensions** 🔲
  - Receiving, Putaway, Picking, Packing, Loading flows
  - PWA offline task queue with IndexedDB
  - Barcode wedge keyboard support (Zebra/Honeywell RF guns)

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
- Device-shipment linking (associate IoT devices with shipments) 🔲
- Real-time data ingestion from System Loco IoT platform (temperature, humidity, shock, light, GPS) 🔲
- Sensor stream visualization on shipment detail pages 🔲
- IoT-based alerts and automation (excursion alerts, geofence+sensor triggers) 🔲

### **Miscellaneous**
- Multi-language support (JSON language files, user-selectable, RTL support) 🔲
- Data export (bulk document/attachment export, CSV/PDF export) 🔲
- N8N workflow integration (webhook emission, custom node package, pre-built templates) 🔲
- TMS-to-TMS integration (JSON APIs modeled after EDI, partner portal) 🔲
- Pluggable map provider interface 🔲

---

## Priorities

1. **Immediate:** **Track 1 (Brokerage)** - Broker entity model, margin tracking, quoting workflow. This unlocks the largest market segment currently unserved.
2. **Immediate:** **Track 2 (Reporting)** - Executive dashboard, carrier scorecards, on-time %. The single biggest credibility gap in a demo.
3. **Short term:** **Track 3 (Customer Portal)** - Customer user management, order entry, shipment tracking. Table stakes for any TMS.
4. **Short term:** **Track 4 (Route Optimization)** - Multi-stop optimization, consolidation, mode selection. This is the ROI pitch.
5. **Medium term:** **Track 5 (Cold Chain Completion)** - Regulatory audit trail UI, compliance reporting, cold chain dashboard. Finish what's started.
6. **Medium term:** **Track 6 (Routes & Maps)** - Route lines on map, spatial indexing. Visual polish on existing infrastructure.
7. **Medium-to-long term:** **Track 7 (WMS v1)** - Foundation WMS bolt-on. Unlocks true end-to-end coverage (order → warehouse → shipment → delivery) and is the single largest domain expansion on the roadmap. v1 sequence in `docs/WMS_SPECIFICATION.md`.
8. **Long term:** **Track 7 (WMS v2)** - 3PL billing, VAS/kitting, parcel/rate-shop, serial tracking, appointment portal. Differentiation vs commercial tier-1.
9. **Ongoing:** EDI hub completion, audit trail, SRE/observability, AI enhancements, warehouse app improvements.

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
