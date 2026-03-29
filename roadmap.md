# 🚚 Open TMS Roadmap

## **Phase 1: Core Setup (Foundation)** ✅
- **Lane Management** ✅
  - Create/manage lanes (point-to-point, multi-stop).
  - Associate lanes with locations and carriers.
- **Carrier Management** ✅
  - Add carriers, store negotiated rates, service levels.
  - Link carriers to lanes.
- **Customer Management** ✅
  - Manage customers with contact/billing info.
  - Apply customer-specific preferences or rules.
- **Shipment Creation (Basic)** ✅
  - Create shipments with references, customer, origin, destination, status.
  - Support templates for recurring shipment types.
- **Item/Line Items** ✅
  - Model SKUs, quantities, weights, dimensions.
  - CSV/Excel import for bulk item ingestion.

## **Phase 2: Orders & Ingestion** ✅
- **Order Management** ✅
  - ✅ CSV import with trackable units (pallets, totes, etc.)
  - ✅ Manual order creation via UI with trackable units
  - ✅ Automatic order-to-shipment assignment based on lane matching
  - ✅ Pending lane request system for unmatched orders
  - ✅ Special requirements (FTL/LTL, temperature control, hazmat)
  - ✅ **Customer API for Order Creation**
    - ✅ REST API endpoint for customers to programmatically create orders
    - ✅ API key authentication and authorization system (customer-scoped API keys)
    - ✅ Rate limiting and security controls
    - ✅ API documentation via Swagger/OpenAPI at /docs
  - ✅ **Order Status Lifecycle & Multi-Leg Tracking**
    - ✅ Status flow: unassigned → assigned → in_transit → delivered/exception
    - ✅ Auto-set delivery status on order assignment/conversion
    - ✅ Order-to-stop linking for multi-leg shipments
    - ✅ Multiple status update mechanisms:
      - ✅ Manual updates by drivers/logistics users
      - ✅ Geofencing-based automatic updates
      - ✅ IoT sensor triggers (geofence + light sensor = truck opened)
    - ✅ Order-level delivery confirmation tracking
    - ✅ Audit trail for all delivery status transitions
    - ✅ Status timeline API and UI
    - ✅ Shipment stop management (arrive, in progress, complete)
    - ✅ Bulk order updates at stop level
  - **EDI Import Support** ✅
    - ✅ Parse X12 850 Purchase Orders → create orders in TMS
    - ✅ EDI partner configuration and credentials management
    - ✅ EDI file storage with deduplication (database adapter, pluggable interface)
    - ✅ EDI preview endpoint (parse without creating orders)
    - ✅ EDI file history, stats, and reprocessing
    - ✅ Error handling and EDI transaction logging
    - ✅ FTP/SFTP drop folder monitoring (edi-collector service)
    - ✅ Scheduled EDI polling and processing
    - ✅ Frontend: EDI partner config UI
    - ✅ Frontend: Drag-and-drop EDI upload with field mapping preview
    - ✅ Frontend: EDI file history page
- **Order to Shipment Workflow** ✅
  - ✅ Queue of pending orders waiting for conversion
  - ✅ Auto-match orders to lanes/carriers
  - ✅ Combine or split orders into shipments
- **Queue-Based Integration System** ✅
  - ✅ pg-boss queue engine (PostgreSQL-backed, zero infrastructure)
  - ✅ Platform-agnostic IQueueAdapter interface for cloud alternatives (SQS, Pub/Sub, Service Bus)
  - ✅ Outbound carrier worker — EDI 856 and JSON adapters, carrier match patterns
  - ✅ Outbound tracking worker — register shipments with tracking platforms
  - ✅ Inbound webhook worker — async processing with 202 Accepted
  - ✅ Automatic retry with exponential backoff (3 attempts)
  - ✅ Integration type support: carrier vs tracking
  - ✅ Payload format support: EDI 856 vs JSON
  - ✅ Shared authentication helpers (basic, bearer, api_key)

## **Phase 3: Platform Foundations, Documentation & Compliance**
- **User Management & Authentication** ✅
  - ✅ User accounts with login, password management
  - ✅ SSO/OAuth support (Google, Microsoft)
  - ✅ Roles & permissions (admin, dispatcher, warehouse, read-only)
  - ✅ Session management (JWT-based)
  - Multi-tenancy support (extend existing Organization model) 🔲
  - User attribution on audit trail events 🔲
- **Document Templates** 🔲
  - Auto-generate Bills of Lading, labels, customs forms.
  - PDF generation with prefilled shipment details.
  - Document template management UI (create/edit templates)
- **Document Management** 🔲
  - Store and archive generated docs.
  - Document upload/attachment on any entity (shipments, orders, carriers)
  - Electronic signature capture for delivery confirmation
  - Begin audit trail for shipment events.
- **Theming & White-labeling** 🔲
  - Extract core CSS custom properties into database-stored theme config
  - Theme Settings UI page (color palette, typography, spacing overrides)
  - Logo upload and organization branding (leveraging existing IFileStorageProvider)
  - Email header/footer branding configuration
  - Runtime theme application via CSS variable injection
- **Custom Fields** 🔲
  - Allow configurable fields for customers, shipments, and items.

## **Phase 4: Notifications, Tracking & Exception Management**
- **Emails & Notifications** 🔲
  - Email service (pluggable: SMTP, SendGrid, SES) via DI container
  - Email templates with Handlebars/Mustache (uses branding from Phase 3)
  - Notification preferences (per-user, per-organization)
  - Event-triggered notifications (shipment status changes, exceptions, deliveries)
  - Notification worker (leveraging existing pg-boss queue infrastructure)
  - In-app notification centre
- **Triage Centre / Visibility Tower (Basic)** 🔲
  - Trello-like kanban board for managing issues (open → investigating → resolved → closed)
  - Issue model linked to shipments/orders with categorization
  - Comments system on orders, shipments, and issues
  - Issue assignment, escalation, and SLA tracking
  - Query management for carrier/driver communication
  - Quick actions: contact carrier, update status, add notes
- **Live Tracking & Status** 🔲
  - Carrier API integration (FedEx, UPS, DHL) or via middleware (EasyPost, Shippo)
  - Update shipments automatically from carrier feeds
  - Store timestamps, current location
- **Exceptions** 🔲
  - Alerts for delays, route deviations, failed deliveries
  - Exception auto-detection from tracking data
  - Integration with Triage Centre for exception workflow
- **Driver Mobile App** 🔲
  - Mobile app for drivers to update order/shipment status in the field
  - Delivery confirmation with signature capture
  - Photo proof of delivery
  - Real-time GPS location tracking
  - Offline support with sync when reconnected
  - Push notifications for new assignments

## **Phase 5: IoT Integration (System Loco)**
- **Device–Shipment Linking** 🔲
  - Associate IoT devices with shipments (1:1, 1:many).
- **Real-Time Data Ingestion** 🔲
  - Pull telemetry from System Loco's IoT platform (temperature, humidity, shock, light, GPS).
- **Visualization** 🔲
  - Show sensor streams on shipment detail pages.
  - Interactive maps with live device location.
- **IoT-Based Alerts & Automation** 🔲
  - Rule engine for excursion alerts (e.g., temperature breach).
  - Integration with LocoEvents for webhooks and notifications.
  - **Geofencing + IoT Triggers**
    - Automatic order completion when shipment enters destination geofence
    - Enhanced triggers: geofence + light sensor = truck door opened at destination
    - Automatic status updates based on sensor data

## **Phase 6: Cold Chain & Advanced Compliance**
- **Cold Chain Profiles** 🔲
  - Define allowable temperature/humidity bands.
  - Assign to shipments automatically based on product/customer.
- **Excursion Management** 🔲
  - Mark shipments as "released" or "quarantined."
  - Generate compliance reports (CFR 21 Part 11, EU Annex 11).
- **Regulatory Audit Trail** 🔲
  - Immutable logs, timestamps, digital signatures.
- **Customer Reporting** 🔲
  - Auto-generate compliance PDFs/CSVs per shipment.

## **Phase 7: Financial & Commercial**
- **Rate Management** 🔲
  - Contract rates vs spot rates with effective date ranges
  - Accessorial charges (fuel surcharge, liftgate, detention, demurrage, lumper fees)
  - Multi-currency support
- **Quoting Engine** 🔲
  - Request and compare quotes from multiple carriers
  - Auto-select based on cost, service level, and rules
- **Basic Invoicing** 🔲
  - Generate invoices from completed shipments
  - Track payment status, match invoices to purchase orders
  - Freight bill pay
- **Freight Audit** 🔲
  - Compare carrier invoices against contracted rates
  - Flag discrepancies for review
- **Basic Reporting & Analytics** 🔲
  - Operational dashboards and KPIs (on-time %, cost per shipment, carrier scorecard)
  - Financial reports (lane spend analysis, carrier spend)
  - CSV/PDF report export
  - Scheduled reports via email

## **Phase 8: Portals & Integration**
- **Customer Portal** 🔲
  - Customer-facing UI for order tracking, document access, order submission
  - Self-service shipment visibility
- **Carrier Portal** 🔲
  - Carrier-facing UI for load acceptance, status updates, document upload
  - Capacity and availability management
- **TMS-to-TMS Integration** 🔲
  - JSON APIs modeled after EDI structure
  - Share shipments, status, documents across TMS partners
  - Support both EDI and JSON APIs for interoperability
  - Partner portal for 3PLs or carriers to directly access or sync data
- **N8N Workflow Integration** 🔲
  - Standardized event emission via webhooks (extending existing outbound integration infrastructure)
  - N8N custom node package for Open TMS
  - OAuth/API key authentication for N8N callbacks into Open TMS
  - Pre-built workflow templates (e.g., auto-notify on exception, escalate delayed shipments)

## **Phase 9: Intelligence & Optimization**
- **AI Triage Agent** 🔲
  - AgentConfig model: configurable prompts, LLM provider settings (LLM-independent)
  - AgentConversation model: context stored in database, not tied to any specific LLM
  - User-configurable agent setup (prompt editing, behaviour tuning)
  - Auto-triage: agent picks up issues from Triage Centre, suggests resolutions
  - Background monitoring service: watches shipments, issues, and user feedback
  - Self-improving prompts: track agent suggestions vs human overrides, auto-refine prompts
  - Agent action execution via N8N workflow integration (Phase 8)
- **Route Management** 🔲
  - Create/manage routes (point-to-point, multi-stop).
  - Associate routes with lanes, locations and carriers.
- **Route Optimization** 🔲
  - Suggest best routes based on cost, history, traffic.
- **ETA Prediction** 🔲
  - Use ML models on IoT + shipment history.
- **Carrier & Lane Performance Scoring** 🔲
  - On-time %, damage %, excursion rate.
- **Advanced Analytics** 🔲
  - Predictive dashboards, trend analysis
  - Visual reports for operations and finance

## **Phase 10: Advanced Operations**
- **Load Planning & Consolidation** 🔲
  - Multi-order load building and optimization
  - Load board for available capacity
- **Appointment Scheduling** 🔲
  - Dock scheduling and delivery window management
- **Yard Management** 🔲
  - Yard check-in/out, trailer tracking
- **Returns / Reverse Logistics** 🔲
  - RMA workflow, return shipment creation
- **Claims Management** 🔲
  - File and track claims for damaged or lost goods
  - Resolution workflow and reporting

---

🔥 **Priorities:**
- **Immediate:** Continue **Phase 3** — User Management & Auth complete; proceed with Document Templates, Document Management, Theming & Custom Fields.
- **Short term:** Deliver **Phase 4** (notifications, triage centre, live tracking) for operational visibility.
- **Medium term:** Deliver **Phase 5–6** (IoT + cold chain compliance) → unique differentiator.
- **Long term:** **Phase 7–9** (financials, portals, N8N integration, AI agents) to scale and differentiate.
- **Future:** **Phase 10** (advanced operations) for enterprise depth.
