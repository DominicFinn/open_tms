# 🚚 Open TMS Roadmap

## **Phase 1: Core Setup (Foundation)**
- ** Lane Management **  
  - Create/manage lanes (point-to-point, multi-stop).  
  - Associate lanes with locations and carriers.  

- **Carrier Management**  
  - Add carriers, store negotiated rates, service levels.  
  - Link carriers to lanes.  
- **Customer Management**  
  - Manage customers with contact/billing info.  
  - Apply customer-specific preferences or rules.  
- **Shipment Creation (Basic)**  
  - Create shipments with references, customer, origin, destination, status.  
  - Support templates for recurring shipment types.  
- **Item/Line Items**  
  - Model SKUs, quantities, weights, dimensions.  
  - CSV/Excel import for bulk item ingestion.  

## **Phase 2: Orders & Ingestion**
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
- **Custom Fields**
  - Allow configurable fields for customers, shipments, and items.  

## **Phase 3: Documentation & Compliance**
- **Document Templates**  
  - Auto-generate Bills of Lading, labels, customs forms.  
  - PDF generation with prefilled shipment details.  
- **Compliance Basics**  
  - Store and archive generated docs.  
  - Begin audit trail for shipment events.  

## **Phase 4: Live Tracking & Exception Management**
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
- **Driver Mobile App** 🔲
  - Mobile app for drivers to update order/shipment status in the field
  - Delivery confirmation with signature capture
  - Photo proof of delivery
  - Real-time GPS location tracking
  - Offline support with sync when reconnected
  - Push notifications for new assignments
- **Carrier API Integration**
  - Connect to major carriers (FedEx, UPS, DHL).
  - Optionally integrate via middleware (EasyPost, Shippo).
- **Status & Event Tracking**
  - Update shipments automatically from carrier feeds.
  - Store timestamps, current location.
- **Exceptions**
  - Alerts for delays, route deviations, failed deliveries.
  - Dashboard for exception triage.

## **Phase 5: IoT Integration (System Loco)**
- **Device–Shipment Linking**
  - Associate IoT devices with shipments (1:1, 1:many).
- **Real-Time Data Ingestion**
  - Pull telemetry from System Loco's IoT platform (temperature, humidity, shock, light, GPS).
- **Visualization**
  - Show sensor streams on shipment detail pages.
  - Interactive maps with live device location.
- **IoT-Based Alerts & Automation**
  - Rule engine for excursion alerts (e.g., temperature breach).
  - Integration with LocoEvents for webhooks and notifications.
  - **Geofencing + IoT Triggers**
    - Automatic order completion when shipment enters destination geofence
    - Enhanced triggers: geofence + light sensor = truck door opened at destination
    - Automatic status updates based on sensor data  

## **Phase 6: Cold Chain & Advanced Compliance**
- **Cold Chain Profiles**  
  - Define allowable temperature/humidity bands.  
  - Assign to shipments automatically based on product/customer.  
- **Excursion Management**  
  - Mark shipments as “released” or “quarantined.”  
  - Generate compliance reports (CFR 21 Part 11, EU Annex 11).  
- **Regulatory Audit Trail**  
  - Immutable logs, timestamps, digital signatures.  
- **Customer Reporting**  
  - Auto-generate compliance PDFs/CSVs per shipment.  

## **Phase 7: TMS-to-TMS Integration**
- **API-Based Exchange**  
  - JSON APIs modeled after EDI structure.  
  - Share shipments, status, documents across TMS partners.  
- **Standard Mapping**  
  - Support both EDI and JSON APIs for interoperability.  
- **Partner Portal**  
  - Allow 3PLs or carriers to directly access or sync data.  

## **Phase 8: Intelligence & Optimization**
- **Route Management**  
  - Create/manage routes (point-to-point, multi-stop).  
  - Associate routes with lanes, locations and carriers.  

- **Route Optimization**  
  - Suggest best routes based on cost, history, traffic.  
- **ETA Prediction**  
  - Use ML models on IoT + shipment history.  
- **Carrier & Lane Performance Scoring**  
  - On-time %, damage %, excursion rate.  
- **Dashboards & KPIs**  
  - Visual reports for operations and finance.  

---

🔥 **Priorities:**  
- Short term: stabilize **Phase 1–2** (routes, carriers, shipments, EDI order ingestion).  
- Medium term: deliver **Phase 5–6** (IoT + cold chain compliance) → your unique differentiator.  
- Long term: **Phase 7–8** (integration + intelligence) to scale and differentiate.  
