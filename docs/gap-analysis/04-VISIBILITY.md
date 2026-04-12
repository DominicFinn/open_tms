# Track & Trace / Visibility

## What's Built

- Inbound GPS webhook endpoint for IoT device telemetry
- ShipmentEvent model with location, device ID, event type, raw payload
- Webhook log with full request/response audit trail
- Automatic shipment matching from device name
- ShipmentReadModel with currentLat/currentLng/lastLocationAt
- Full-page map view with OpenStreetMap (Google Maps fallback)
- Supercluster client-side point clustering for scale
- Entity type switching on map (Shipments, Orders, Trackable Units)
- Backend bbox-filtered GeoJSON API
- Status-colored markers with filter chips
- Location markers overlay with warehouse icons
- Issue/SLA overlay with pulsing breach/warning markers
- Fullscreen mode for control centre wall monitors
- Auto-refresh (30s) with pause/play
- ETA monitoring with 3 routing providers (TomTom, HERE, Valhalla)
- Adaptive polling (frequency scales with proximity to delivery)
- Three delay severity levels (minor 15m, warning 30m, critical 60m)
- Traffic-aware ETA updates on ShipmentStop.estimatedArrival
- Exception auto-creation on critical delays
- Milestone tracking via shipment stop status lifecycle (pending, arrived, in_progress, completed)
- Geofence-triggered automatic status updates
- EDI 214 inbound parsing (carrier status updates)
- EDI 214 outbound generation (customer status messages)
- Auto-forward inbound 214 to customer trading partners

## What's Partially Built

- **Proof of delivery**: Schema fields exist (signatureUrl, photoUrls, proofData on ShipmentStop) but no capture UI - depends on driver mobile app
- **Customer-facing tracking**: EDI 214 outbound exists but no web-based customer tracking portal or shareable tracking link

## What's Planned (On Roadmap)

| Feature | Roadmap Phase | Notes |
|---------|--------------|-------|
| Route deviation alerts (geofence corridor breach) | Phase 9 | Not started |
| Predictive ETA with ML-based transit time modeling | Phase 9 | Not started |
| Route lines on map (planned vs actual path) | Phase 9 | Not started |

## What's Missing

| Feature | Commercial Standard | Impact |
|---------|-------------------|--------|
| **Carrier ELD/telematics integration** | Direct API feeds from Samsara, KeepTruckin, Omnitracs, Geotab, etc. (commercial TMS: 1,400+ integrations) | High - most common tracking source |
| **Shareable public tracking link** | URL that anyone can open to see shipment status without login (like a FedEx tracking page) | High - customer expectation |
| **Automated status notification emails/SMS** | Auto-send email or SMS to customer contacts on pickup, delivery, delay | High - reduces "where is my truck" calls |
| **Visibility platform integration** | project44 / FourKites / Shippeo overlay for carriers that don't support direct tracking | Medium - enterprise requirement |
| **Ocean container tracking** | Vessel AIS, port milestones, demurrage/detention risk alerts | Medium - requires multi-modal |
| **Check-call management** | Scheduled carrier check-in calls with status capture form | Low - legacy but still used |
| **Geofence-triggered notification to receiver** | Auto-notify the consignee when truck enters their geofence | Medium - last-mile visibility |
