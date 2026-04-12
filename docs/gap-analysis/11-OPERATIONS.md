# Dock Scheduling, Yard Management, Returns & Sustainability

## Dock Scheduling & Yard - What's Built

- Location model with dock count, appointment required flag, operating hours
- Location operations dashboard (incoming/at-location/outgoing shipments)
- Dwell time tracking with badges on at-location shipments
- Facility info display (dock count, cross-dock, cold storage, hazmat, appointment required)
- Location-type-specific SLA rules (dock_turnaround, sort_to_dispatch, facility_dwell)
- Stop-level SLA evaluations (created on arrival, met on completion)

## Dock Scheduling - What's Partially Built

- **Dock capacity awareness**: Dock count and appointment required flag exist but there's no actual appointment booking system
- **Dwell time monitoring**: Tracked and displayed but no detention billing automation from it

## Dock Scheduling - What's Planned

| Feature | Phase | Notes |
|---------|-------|-------|
| Appointment scheduling view with dock calendars | Phase 9 | Not started |

## Dock Scheduling - What's Missing

| Feature | Commercial Standard | Impact |
|---------|-------------------|--------|
| **Dock appointment calendar** | Configurable time slots per dock door, visual calendar view | High |
| **Carrier self-booking** | Carriers book appointments through portal based on available slots | High |
| **Appointment confirmations & reminders** | Automated notifications to carrier/driver | Medium |
| **Real-time dock availability dashboard** | Which docks are occupied, available, or blocked | Medium |
| **QR/PIN check-in at gate** | Driver scans code to check in, triggers dock assignment | Medium |
| **Detention clock automation** | Auto-start clock from scheduled vs actual arrival, auto-create detention charge | High |
| **Yard trailer tracking** | Track trailer spot assignments, dwell time, yard truck dispatch | Medium |
| **Dynamic rescheduling from ETA** | Auto-adjust appointments when truck ETA shifts | Low |

---

## Returns / Reverse Logistics - What's Built

Nothing. This is a complete gap.

## Returns - What's Missing

| Feature | Commercial Standard | Impact |
|---------|-------------------|--------|
| **Return order creation** | Create return from original outbound shipment with linked reference | High |
| **Return reason coding** | Standardized reason codes (defective, wrong item, refused, etc.) | Medium |
| **Disposition routing** | Route returns to different locations based on reason/condition | Medium |
| **Return carrier selection** | Tender return shipments using same workflow as outbound | Medium |
| **Return tracking** | Same visibility as outbound (map, milestones, ETA) | Medium |
| **Return credit notes** | Auto-generate credit note from return, link to original invoice | Medium |
| **Pre-paid return labels** | Generate parcel return labels for customer (requires parcel integration) | Low |
| **Return analytics** | Return rate by carrier, reason, product, customer | Low |

---

## Sustainability / Carbon Tracking - What's Built

Nothing built. Carbon footprint calculation per route is mentioned in roadmap Phase 9.

## Sustainability - What's Missing

| Feature | Commercial Standard | Impact |
|---------|-------------------|--------|
| **CO2 calculation per shipment** | Based on distance, mode, weight, vehicle type using GLEC Framework | High - CSRD compliance |
| **Emissions by mode/lane/carrier** | Breakdown and comparison views | Medium |
| **Modal shift identification** | Highlight lanes where rail/intermodal would reduce emissions | Medium |
| **Emissions dashboard** | Trend reporting, targets, progress visualization | Medium |
| **SmartWay carrier flag** | Display SmartWay certification status on carrier record | Low |
| **CSRD / Scope 3 export** | Structured data export for regulatory reporting | High - EU requirement |
| **Carbon offset tracking** | Record offset purchases and apply to shipments | Low |
