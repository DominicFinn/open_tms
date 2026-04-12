# Rating, Quoting & Tendering

## Rating & Quoting - What's Built

- Lane-carrier rate lookup with linehaul + fuel surcharge breakdown
- LTL class-based rating with NMFC lookup and density-based class calculation
- Weight break matrix pricing with deficit weight optimization
- FAK (Freight All Kinds) override support
- Minimum charge thresholds
- LTL accessorial codes (liftgate, residential, inside delivery, notification, limited access)
- Quote model with revision tracking and expiration
- Quote acceptance auto-creates Order with approved revenue charges
- Quote revision workflow (supersede + new version)
- Quote expiration cron
- LTL rate + freight class REST API endpoints
- Re-weigh / re-class adjustment workflow
- Multi-order LTL consolidation billing (pro-rate by weight)

## Rating & Quoting - What's Missing

| Feature | Commercial Standard | Impact |
|---------|-------------------|--------|
| **Parcel rate shopping** | UPS/FedEx/USPS/DHL API integration for real-time rate comparison | High - parcel is huge volume |
| **Multi-currency rating** | Enter and compare rates in different currencies | High - blocks international |
| **Fuel surcharge table management** | DOE index linkage with weekly auto-update of fuel surcharge % | Medium - currently manual |
| **Spot rate capture** | DAT/Truckstop integration for market rate benchmarking | Medium - procurement intelligence |
| **Rate shopping UI** | Compare rates across all carriers for a given lane in one view | Medium - core TMS workflow |
| **Contract rate library** | Centralized rate card management with effective/expiry dates, bulk import | Medium - operational efficiency |
| **Customer credit limit enforcement** | Block order/quote if customer exceeds credit limit | Low - financial controls |

## Tendering - What's Built

- Broadcast tender (all carriers simultaneously)
- Waterfall tender (sequential with timeout and auto-progression)
- Configurable tender duration
- Carrier accept/decline workflow
- EDI 204 (Load Tender) generation with full X12 segment mapping
- EDI 990 (Response to Load Tender) parsing with auto-bid creation
- Tender bid model (rate, transit days, equipment type, notes)
- Bid source tracking (portal, edi_990, manual)
- Award flow (accept winner, reject others, assign carrier)
- Auto-tender for laneless shipments (org toggle)
- 5-step create tender wizard UI
- Tender history and filtering
- Financial side-effect: auto-create cost charge on award

## Tendering - What's Partially Built

- **EDI 204 delivery via SFTP/HTTP**: Service exists (OutboundEdiDeliveryService) but auto-delivery on tender open is marked as manual

## Tendering - What's Missing

| Feature | Commercial Standard | Impact |
|---------|-------------------|--------|
| **Counter-offer workflow** | Carrier proposes a different rate; shipper accepts/rejects/counters | Medium - common negotiation |
| **Load board publishing** | Post untendered loads to DAT/Truckstop automatically | Medium - capacity sourcing |
| **Electronic BOL auto-distribution** | Auto-generate and send BOL to carrier on tender acceptance | Medium - execution efficiency |
| **Re-tender on no-show** | Automatic re-tender if carrier fails to pick up within window | Medium - exception handling |
| **Appointment scheduling on award** | Trigger dock appointment booking when tender is awarded | Low - requires dock scheduling |
