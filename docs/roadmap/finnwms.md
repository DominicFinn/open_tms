# FinnWMS Backlog

Open warehouse work. WMS v1 has shipped (see [completed.md](completed.md)). The full specification
is [WMS_SPECIFICATION.md](../WMS_SPECIFICATION.md) and the comparison with tier-1 WMS products is
[12-WMS-GAP-ANALYSIS.md](../gap-analysis/12-WMS-GAP-ANALYSIS.md).

v2 waits on the split programme's phase 2 (`Facility`, then `HandlingUnit`), so it isn't built on
the conflated `Location` and `TrackableUnit` models and then moved. Each item is FinnWMS product
work under the module boundary rules.

## v1 leftovers

Small gaps in features that otherwise shipped.

- `QualityHold` model that blocks allocation
- ProductUom conversions for break-case work (EA, INNER, CASE, PALLET)
- Automatic dimension capture from scales and dimensioners
- Manifest ingestion: CSV/XLSX upload with saved column mappings per supplier, detected by header
  checksum
- Receiving scan types and over/short/damaged discrepancies on `CargoScan` and `CargoDiscrepancy`
- Allocation: soft allocation, FEFO and LIFO, closest-to-pickface, same-lot, avoid partial pallets,
  and an available-to-promise endpoint
- Automatic credit note when an RMA completes (`creditNoteId` exists, generation doesn't)
- Returns integration: public RMA API on customer API keys, `initiatedVia` values for api, EDI 180
  and marketplace webhooks, Swagger examples
- Palletisation: split orders across pallets, build pallets by delivery stop, mobile pallet-build
  flow
- Container intelligence: smart tote pairing at pack, auto-fill temperature and hazmat attributes
  from the SKU
- `WarehouseTask` supertype with `expectedDurationSeconds`, ahead of task interleaving
- PWA offline task queue in IndexedDB, once field testing shows it's needed
- Indoor positioning (BLE, WiFi, UWB anchors mapped to zones and bins) and the RTLS heatmap UI
- Integrations nav quick-links for EDI 940 and 945

## Inventory companion app

The mobile-web slice has shipped (#233). Next:

- Promote an observation into a `CycleCount` line
- Native Android client, once the mobile-web contract has had real use
- EDI 846 when a 3PL client dashboard needs it

## v2

- 3PL billing: contracts and rate cards per customer, daily storage accrual, handling charges on
  warehouse events, feeding the existing charge and invoice pipeline
- Value-added services and kitting, with per-unit billing
- Advanced palletisation: weight distribution, stacking rules, mixed-SKU layers, retail display
  pallets, SSCC-18 and GS1-128 labels
- Smart container fleet: pool status, assignment by sensor capability, health, return tracking
- Parcel and compliance labels: rate-shop at pack, end-of-day manifest (EDI 215), UCC-128 carton
  labels, retailer routing guide templates
- Serial number capture on receive and pick
- Lot genealogy and recall management
- Extended EDI: 846, 943, 944, 947
- Self-service dock appointments on the carrier portal
- Task dispatcher that interleaves task types by proximity
- Quality hold release workflow and supplier scorecard
- Cold chain zones: zone-level readings and automatic holds on excursion
- Marketplace return webhooks (Shopify first, then eBay, Amazon, Magento, WooCommerce,
  BigCommerce)
- Delivery rejections: refused deliveries that create an RMA, plan the return trip and raise CAPA
- OTIF and chargeback tracking against customer compliance rules
- Carrier freight claims, offset against payables

## Later (v3 and beyond)

Not planned. Detail is in the gap analysis.

Slotting optimisation, labour management, yard management, WCS and automation integration, a full
hazmat segregation engine, bonded and FTZ warehouses, 21 CFR Part 11 electronic signatures, voice
and wearable picking, what-if simulation, catch-weight items, carbon per order.
