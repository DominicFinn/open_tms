# Order & Shipment Management

## What Open TMS Has (Built)

### Order Management
- Order CRUD with full lifecycle (pending, validated, converted, cancelled, archived)
- Delivery status lifecycle (unassigned, assigned, in_transit, delivered, exception, resolved)
- CSV bulk import with customer/location auto-matching
- EDI X12 850 Purchase Order import
- Customer REST API for programmatic order creation (API key auth)
- Order-to-shipment conversion (individual, batch, split)
- Compatibility checks before combining orders
- Auto-match to lanes and carriers (ShipmentAssignmentService)
- Pending lane request queue for unmatched orders
- Line items with SKU, description, quantity, weight, dimensions, hazmat, temp class, pricing, NMFC, freight class
- Trackable units (pallets, totes, boxes, stillages, custom types)
- Barcode generation for trackable units
- Per-unit IoT device tracking
- FTL/LTL service level selection
- Temperature control (ambient, refrigerated, frozen)
- Hazmat flag
- Custom fields (versioned, any type)
- Delivery confirmation with multiple methods (manual, geofence, geofence+IoT, auto, driver_app)
- Exception creation and resolution with type classification

### Shipment Management
- Shipment CRUD with full lifecycle (draft, in_transit, delivered, exception)
- PRO number field
- Multi-stop routes (ShipmentStop with sequence, type, ETA/ATA, status lifecycle)
- Geofence per stop with automatic arrival detection
- Stop notes and delivery instructions
- POD fields per stop (signature URL, photo URLs, proof data)
- Cargo scan and discrepancy tracking per stop
- Load model (vehicle + driver assignment)
- Vehicle model (plate, type, capacity in kg and m3)
- Driver model (name, phone, email)
- GPS tracking via webhook ingestion
- Shipment accessories (door seal, temp sensors, BLE tracker)
- Shipment flags with resolution workflow
- Auto-tender on creation (org-level toggle)
- Read model with current lat/lng for map queries

## What's Partially Built

- **Bulk import/update via CSV**: CSV import exists for orders but not for shipments or bulk status updates
- **Shipment templates/cloning**: No clone or template feature for recurring shipments

## What's Missing

| Feature | Commercial Standard | Impact |
|---------|-------------------|--------|
| **Blanket/recurring order templates** | Schedule recurring orders that auto-create on cadence | Medium - saves time for repeat shippers |
| **Shipment cloning** | Clone an existing shipment as a template for a new one | Low - quality of life |
| **Reference number management** | Structured fields for BOL#, container#, seal#, trailer# (beyond single PRO#) | Medium - operational traceability |
| **Order/shipment comments** | Threaded comment system for internal team communication | Medium - on roadmap but not built |
| **Inbound/3PL shipment types** | Explicit inbound vs outbound vs third-party (drop-ship) classification | Medium - needed for inbound freight programs |
| **Bulk shipment status update** | CSV or API-based bulk status changes | Low - operational convenience |
