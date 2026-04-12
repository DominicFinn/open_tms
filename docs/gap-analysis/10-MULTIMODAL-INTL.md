# Multi-Modal & International

## Multi-Modal - What's Built

- Truckload (FTL) rating, tendering, and tracking
- LTL rating (class-based, weight breaks, NMFC, deficit weight, accessorials)
- LTL consolidation billing (pro-rate by weight across orders)
- Service level field on orders/lanes (FTL/LTL/Both)

## Multi-Modal - What's Partially Built

- **Mode selection**: FTL vs LTL exists but no automated recommendation engine or cost comparison tool

## Multi-Modal - What's Planned

| Feature | Phase | Notes |
|---------|-------|-------|
| Ocean data feeds (AIS, port congestion, container tracking) | Phase 9c | Not started |
| Air cargo data feeds (flight tracking, milestones) | Phase 9c | Not started |
| Rail data feeds (terminal status, dwell times) | Phase 9c | Not started |

## Multi-Modal - What's Missing

| Feature | Commercial Standard | Impact |
|---------|-------------------|--------|
| **Parcel management** | UPS/FedEx/USPS rate shopping, label generation, tracking, returns labels | High - huge shipment volume |
| **Intermodal rail** | Ramp-to-ramp planning, drayage coordination, Class I railroad visibility, demurrage tracking | High - cost savings opportunity |
| **Ocean FCL/LCL** | Booking, vessel/voyage scheduling, container tracking, port milestones, demurrage calc | Medium - international shippers |
| **Air freight** | Booking, HAWB/MAWB management, flight tracking, customs integration | Medium - time-critical freight |
| **Drayage management** | Port/rail terminal automation, container availability, last free day alerts | Medium - intermodal support |
| **Mode recommendation engine** | Auto-suggest TL vs LTL vs intermodal vs parcel based on cost/service/weight | High - optimization value |
| **Multi-modal route planning** | Single shipment with road + rail + ocean legs | Medium - complex logistics |
| **Final mile / last mile** | High-stop-count delivery route optimization, consumer notification | Medium - e-commerce segment |

---

## International / Cross-Border - What's Built

- Currency field on carrier and customer models (stored but not used for multi-currency logic)

## International - What's Missing

This is the weakest area. Open TMS is currently domestic-only.

| Feature | Commercial Standard | Impact |
|---------|-------------------|--------|
| **Multi-currency support** | Rate entry, invoicing, payments in multiple currencies with exchange rates | Critical - blocks all international |
| **Multi-language UI** | Language files for UI translations, user-selectable language | High - non-English markets |
| **Commercial invoice generation** | Auto-generate from order data for customs | High |
| **Packing list generation** | Itemized packing list for customs inspection | Medium |
| **Certificate of Origin** | Template-based generation | Medium |
| **HTS code on line items** | Harmonized Tariff Schedule code for duty calculation | High |
| **Incoterms field** | FOB, CIF, DDP, DAP etc. on orders - drives cost responsibility allocation | High |
| **Denied party screening** | OFAC, BIS, EU, UN sanctions list checking | Critical - legal requirement |
| **Customs broker assignment** | Assign and communicate with customs broker per shipment | Medium |
| **VAT/GST calculation** | Tax calculation and reporting for international invoices | High |
| **Country-specific document templates** | Localized language, currency, regulatory format per country | Medium |
| **Border crossing wait times** | Data feed for cross-border lane planning | Low |
| **Duty drawback tracking** | Track recoverable import duties | Low |
