# Customer/Shipper Portal & Mobile Capabilities

## Customer Portal - What's Built

- Customer API for programmatic order creation (API key auth, rate limited)
- EDI 214 outbound status messages to customer trading partners
- EDI 810 outbound invoices
- Cold chain compliance report auto-delivery to customers

## Customer Portal - What's Partially Built

- **Customer data access**: Customers can submit orders via API but cannot view shipment status, documents, or invoices through a self-service interface

## Customer Portal - What's Planned

- Customer portal is on the roadmap (Phase 8) but nothing is built

## Customer Portal - What's Missing

| Feature | Commercial Standard | Impact |
|---------|-------------------|--------|
| **Branded customer login portal** | White-label login page with customer's branding | Critical |
| **Order entry via portal** | Customer submits shipment requests through web form | Critical |
| **Real-time tracking with map** | Customer sees their shipments on a map with milestone timeline | Critical |
| **Shareable public tracking link** | URL anyone can open (like FedEx tracking) without login | Critical |
| **Document access** | Customer downloads BOL, POD, invoices, customs docs | Critical |
| **Invoice review & dispute** | Customer views invoices, pays online or initiates dispute | High |
| **Notification preferences** | Customer configures which events trigger email/SMS | Medium |
| **Historical shipment search** | Customer searches past shipments with filters | Medium |
| **Customer sub-user management** | Customer admin manages their own team's access | Medium |
| **Embeddable tracking widget** | JavaScript widget customer can embed on their own website | Low |

**Note**: The customer portal is the single largest gap. The carrier portal pattern already exists and can be used as a template.

---

## Mobile Capabilities - What's Built

### Warehouse App (Mobile-First Web)
- Password login + magic link/QR code login
- Location selection with preference memory
- Shipment list filtered by warehouse (filter chips, search, barcode scan-to-filter)
- Shipment detail (read-only: route, customer, dates, carrier, driver, orders, trackable units)
- Shipment flagging with resolution workflow
- 4-step launch wizard (assign trackers, add accessories, pair units with devices, review)
- HID barcode scanner support (Zebra/Honeywell)
- Camera-based barcode scanning fallback (native BarcodeDetector API)
- IoT device assignment at shipment and trackable unit level
- Stale shipment archive
- WiFi connectivity monitoring
- Admin shipment creation from warehouse
- Touch-optimized for small Android/Zebra screens

### Carrier Portal (Mobile-Responsive)
- Tender view and bid submission
- Bid history and tender history with win rate
- Profile management

## Mobile - What's Partially Built

- **POD capture**: Schema fields exist on ShipmentStop (signatureUrl, photoUrls, proofData) but no capture UI

## Mobile - What's Planned

| Feature | Phase | Notes |
|---------|-------|-------|
| Driver mobile app | Phase 4 | Not started |
| Electronic signature capture (DocuSign/Adobe Sign) | Phase 4 | Not started |

## Mobile - What's Missing

| Feature | Commercial Standard | Impact |
|---------|-------------------|--------|
| **Driver mobile app** | Accept loads, view stops, navigate, update status, capture POD | Critical - top 5 gap |
| **POD capture (photo + e-signature)** | Driver takes photo of delivery, gets signature on screen | Critical |
| **GPS location sharing from driver** | Periodic location pings from driver's phone | High |
| **Offline mode with sync** | Driver works without connectivity, syncs when back online | High |
| **Push notifications for drivers** | New assignment, schedule change, message from dispatcher | Medium |
| **Dispatcher mobile app** | View active shipments, approve charges, handle exceptions on the go | Low |
| **Barcode/QR scanning for delivery** | Scan packages at delivery to confirm items received | Medium |
