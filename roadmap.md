# 🚚 Open TMS Roadmap

## **Phase 1: Core Setup (Foundation)**
- **Route Management**  
  - Create/manage routes (point-to-point, multi-stop).  
  - Associate routes with locations and carriers.  
- **Carrier Management**  
  - Add carriers, store negotiated rates, service levels.  
  - Link carriers to routes.  
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
- **EDI Support**  
  - Parse X12/EDIFACT orders → map into JSON for the TMS.  
  - Import customer orders (via FTP/SFTP drop or API).  
- **Order to Shipment Workflow**  
  - Queue of pending orders waiting for conversion.  
  - Auto-match orders to routes/carriers.  
  - Combine or split orders into shipments.  
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
- **Carrier API Integration**  
  - Connect to major carriers (FedEx, UPS, DHL).  
  - Optionally integrate via middleware (EasyPost, Shippo).  
- **Status & Event Tracking**  
  - Update shipments automatically from carrier feeds.  
  - Store timestamps, current location.  
- **Exceptions**  
  - Alerts for delays, route deviations, failed deliveries.  
  - Dashboard for exception triage.  

## **Phase 5: IoT Integration (System Loco Differentiator)**
- **Device–Shipment Linking**  
  - Associate IoT devices with shipments (1:1, 1:many).  
- **Real-Time Data Ingestion**  
  - Pull telemetry from System Loco’s IoT platform (temperature, humidity, shock, light, GPS).  
- **Visualization**  
  - Show sensor streams on shipment detail pages.  
  - Interactive maps with live device location.  
- **IoT-Based Alerts**  
  - Rule engine for excursion alerts (e.g., temperature breach).  
  - Integration with LocoEvents for webhooks and notifications.  

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
