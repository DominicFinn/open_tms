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
