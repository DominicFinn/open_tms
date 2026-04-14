# WMS Feature Specification for Open TMS

> **Revision April 2026.** Updated in light of the tier-1 WMS gap analysis (`docs/gap-analysis/12-WMS-GAP-ANALYSIS.md`). v1 scope now includes UOM conversions, 3PL ownership on inventory, an explicit allocation engine, wave templates, cartonization, returns/RMA, a warehouse operations dashboard, an indoor RTLS heatmap UI, and WMS EDI 940/945. Larger items (3PL billing, labour management, slotting optimization, yard management, WCS/automation, hazmat engine, serial tracking) are called out as v2+ and tracked in the gap analysis.

## Context

The TMS has no internal warehouse operations. It knows a shipment "arrived at Location X" and "departed Location X" but nothing about what happens inside. The WMS fills that gap: receiving, putaway, storage, inventory tracking, picking, packing, staging, loading, and cross-dock. This is a TMS bolt-on, not a standalone WMS - it extends existing models (TrackableUnit, CargoScan, Location, Order, Shipment) rather than duplicating them.

The scope of this specification is **v1 (Foundation + Intelligence)**. It covers everything needed for an internal-use or single-client warehouse to run end-to-end. Multi-client 3PL billing, labour management, slotting optimization, yard management, parcel rate-shopping, hazmat segregation engines, automation/WCS integration, and serial/genealogy are explicitly deferred to v2+ tracks documented in the gap analysis, with interface hooks placed in v1 so the door is open.

Key user requirements:
- **Goods in** (receiving against ASN or blind)
- **Goods out** (pick, pack, load, dispatch)
- **Routing rules into zones** (directed putaway)
- **Locations and location management** (bins, zones, racks, aisles)
- **Loading** (building shipments from orders, when BOL gets created)
- **Pick and pack strategies** (discrete, batch, zone, wave)
- **Inventory tracking as digital twins** using existing TrackableUnit hierarchy (pallet > tote > box > item)
- **Indoor zones** (BLE/WiFi/UWB positioning within the warehouse)

---

## 1. Warehouse Location Hierarchy

### Models

**WarehouseZone** - logical area within a Location

| Field | Type | Notes |
|-------|------|-------|
| id | uuid PK | |
| locationId | FK Location | ties to existing model |
| name | string | e.g. "Bulk A", "Dock 3", "Cold Store" |
| zoneType | string enum | `receiving`, `bulk_storage`, `pick_face`, `staging`, `packing`, `shipping_dock`, `quarantine`, `returns`, `cross_dock` |
| temperatureZone | string? | `ambient`, `refrigerated`, `frozen` |
| hazmatCertified | boolean | default false |
| maxWeightKg | float? | zone-level capacity |
| maxVolumeCbm | float? | |
| sortOrder | int | display/walk order |
| active | boolean | default true |

**WarehouseAisle** - physical corridor within a zone (optional - small warehouses skip this)

| Field | Type | Notes |
|-------|------|-------|
| id | uuid PK | |
| zoneId | FK WarehouseZone | |
| name | string | e.g. "A", "B" |
| sortOrder | int | |

**WarehouseBin** - lowest addressable storage location

| Field | Type | Notes |
|-------|------|-------|
| id | uuid PK | |
| zoneId | FK WarehouseZone | |
| aisleId | FK WarehouseAisle? | if aisles used |
| label | string | unique within location, e.g. "BULK-A-01-03-B" |
| binType | string enum | `pallet`, `shelf`, `floor`, `dock_door`, `staging`, `pack_station` |
| maxWeightKg | float? | |
| maxVolumeCbm | float? | |
| maxPalletPositions | int? | for pallet bins |
| temperatureZone | string? | inherits from zone if null |
| hazmatCertified | boolean | inherits from zone if not set |
| level | int? | vertical position (lower = easier to reach) |
| walkSequence | int | monotonically increasing along natural walk path |
| active | boolean | default true |
| currentWeightKg | float | denormalized running total, default 0 |
| currentVolumeCbm | float | denormalized running total, default 0 |
| currentPalletCount | int | denormalized, default 0 |

### Relationship to existing Location model

The hierarchy lives **beneath** Location. Only locations with `locationType` of `warehouse`, `distribution_centre`, or `cross_dock` can have zones/bins. Location gets a `warehouseZones` relation, no other field changes.

### Commands & Events
- `warehouse_zone.create` / `.update` / `.archive`
- `warehouse_bin.create` / `.update` / `.archive` / `.bulk_create` (generate grid from pattern)
- Events: `warehouse_zone.created`, `warehouse_zone.updated`, `warehouse_bin.created`, `warehouse_bin.updated`

---

## 2. Indoor Zones

### Concept

Indoor zones extend the existing **ArrivalCriteria** system (which already supports geofence, WiFi SSID/BSSID, and BLE beacon UUID/major/minor/RSSI) to provide zone-level positioning within the warehouse. This gives us "digital twin" awareness of where TrackableUnits are inside the building, not just at the facility level.

### Model

**IndoorZoneAnchor** - maps a physical BLE/WiFi/UWB anchor to a WarehouseZone

| Field | Type | Notes |
|-------|------|-------|
| id | uuid PK | |
| zoneId | FK WarehouseZone | which zone this anchor represents |
| anchorType | string enum | `ble`, `wifi`, `uwb` |
| bleUuid | string? | BLE beacon UUID |
| bleMajor | int? | BLE major value |
| bleMinor | int? | BLE minor value |
| bleRssiThreshold | int? | proximity threshold (e.g. -70 dBm) |
| wifiSsid | string? | WiFi network name |
| wifiBssid | string? | WiFi AP MAC address |
| uwbAnchorId | string? | UWB anchor identifier |
| name | string? | friendly name, e.g. "Dock 3 Reader" |
| lat | float? | indoor coordinate (optional, for map rendering) |
| lng | float? | indoor coordinate |
| active | boolean | default true |

### How it works

1. IoT devices on TrackableUnits (already assigned via warehouse launch wizard) periodically report BLE/WiFi/UWB proximity data
2. The existing inbound telemetry pipeline (`SensorReading`, `DeviceEvent`) receives these reports
3. A new **IndoorPositionHandler** (event handler) matches reported anchor IDs against `IndoorZoneAnchor` records
4. When a unit's device reports proximity to an anchor, the unit's `currentBinId` or at minimum `currentZoneId` is updated
5. This enables: real-time "where is pallet X?" queries, zone-level dwell time tracking, and automatic putaway confirmation

### Integration with existing ArrivalCriteria

ArrivalCriteria handles "has this shipment arrived at this Location?" (facility-level). IndoorZoneAnchor handles "where within this facility is this unit?" (zone/bin-level). They share the same BLE/WiFi tech stack but serve different purposes. The IndoorZoneAnchor is NOT a replacement for ArrivalCriteria - it's the indoor equivalent.

### Commands & Events
- `indoor_zone_anchor.create` / `.update` / `.delete`
- Events: `indoor_zone.unit_entered` (unit detected in a new zone), `indoor_zone.unit_exited`

---

## 3. Inventory Tracking (Digital Twins)

### Core Concept

Inventory is tracked as **digital twins of physical containers** using the existing TrackableUnit model. A pallet contains totes, a tote contains boxes, a box contains items. Each level is a TrackableUnit with a `unitType`. The WMS adds location awareness (which bin) and nesting (which unit contains which unit).

### Model Changes to TrackableUnit

| New Field | Type | Notes |
|-----------|------|-------|
| currentBinId | FK WarehouseBin? | where this unit physically is in the warehouse |
| parentUnitId | FK TrackableUnit? | nesting: this box is on that pallet |
| currentZoneId | FK WarehouseZone? | denormalized from bin, or set by indoor positioning |
| lotNumber | string? | batch/lot tracking |
| expiryDate | DateTime? | for FEFO strategy |
| receivedAt | DateTime? | for FIFO strategy |
| ownerCustomerId | FK Customer? | 3PL multi-client segregation; null = org-owned stock |
| qualityStatus | string | `available`, `hold`, `quarantine`, `damaged`; default `available` |

### Unit of Measure (UOM) Master Data

Real warehouses receive, store, pick, and ship in different UOMs (each, inner-pack, case, pallet). Without explicit UOM conversions, short-pick and cycle-count variances are inevitable.

**ProductUom** - per-SKU UOM catalogue

| Field | Type | Notes |
|-------|------|-------|
| id | uuid PK | |
| sku | string | |
| uomCode | string | `EA`, `INNER`, `CASE`, `PALLET`, or custom |
| parentUomCode | string? | which UOM this rolls up into (e.g. CASE -> PALLET) |
| conversionFactor | int | how many children fit in one of this (e.g. CASE = 12 EA) |
| lengthMm | int? | dimensions at this UOM |
| widthMm | int? | |
| heightMm | int? | |
| weightGrams | int? | |
| barcodeGtin | string? | GTIN/UPC/EAN for scanning at this UOM |
| isDefault | boolean | default UOM for picking/inventory display |

All quantity fields on InventoryRecord, ReceivingLine, PickLine, PackLine carry a `uomCode`. A "break case" operation creates an `inventory.uom_converted` transaction that splits one parent UOM into N children.

The `parentUnitId` self-referencing FK creates the digital twin hierarchy:
```
Pallet (TrackableUnit, unitType="pallet")
  -> Tote (TrackableUnit, unitType="tote", parentUnitId=pallet.id)
    -> Box (TrackableUnit, unitType="box", parentUnitId=tote.id)
      -> OrderLineItem (SKU, qty, weight, dims)
```

Moving a pallet moves everything on it. Scanning a pallet at a bin sets `currentBinId` for the pallet AND all nested children.

### InventoryRecord - aggregate view per SKU per bin

This is a **denormalized summary** for fast queries ("how much of SKU-X is in the warehouse?"). The TrackableUnit is the source of truth; InventoryRecord is a read model. The projection is the **only** writer to this table - all mutations flow through commands that emit InventoryTransaction events.

| Field | Type | Notes |
|-------|------|-------|
| id | uuid PK | |
| locationId | FK Location | |
| binId | FK WarehouseBin | |
| sku | string | from OrderLineItem |
| uomCode | string | default UOM for this record |
| quantityOnHand | int | total physical count in uomCode |
| quantityAllocated | int | reserved for picks, default 0 |
| quantityAvailable | int | onHand - allocated |
| quantityOnHold | int | blocked by QualityHold, default 0 |
| ownerCustomerId | FK Customer? | 3PL multi-client partition |
| lotNumber | string? | |
| expiryDate | DateTime? | |
| lastCountedAt | DateTime? | |

### InventoryTransaction - immutable ledger

| Field | Type | Notes |
|-------|------|-------|
| id | uuid PK | |
| inventoryRecordId | FK InventoryRecord | |
| transactionType | string | `receive`, `putaway`, `pick`, `adjust`, `transfer`, `cycle_count`, `replenish` |
| quantityChange | int | positive for in, negative for out |
| previousQuantity | int | |
| newQuantity | int | |
| referenceType | string? | `receiving_task`, `pick_task`, `adjustment`, `cycle_count` |
| referenceId | string? | source entity ID |
| reasonCode | string? | `damage`, `expired`, `recount`, `return`, `scrap`, `found` |
| performedBy | string? | user ID |
| trackableUnitId | FK TrackableUnit? | which physical unit was involved |
| createdAt | DateTime | |

### Pick Strategy (per location)

Add to Location model: `pickStrategy` (string, default "FIFO")
- **FIFO**: order by `TrackableUnit.receivedAt ASC`
- **FEFO**: order by `TrackableUnit.expiryDate ASC NULLS LAST`
- **LIFO**: order by `TrackableUnit.receivedAt DESC`

### Allocation Engine

The `quantityAllocated` field is meaningless without a service that owns the decisions. The AllocationEngine is a named service responsible for binding OrderLineItems to specific InventoryRecords.

**Allocation** - explicit link between an order line and inventory

| Field | Type | Notes |
|-------|------|-------|
| id | uuid PK | |
| orderLineItemId | FK OrderLineItem | |
| inventoryRecordId | FK InventoryRecord | |
| trackableUnitId | FK TrackableUnit? | specific unit if allocated at unit level |
| quantity | int | |
| uomCode | string | |
| state | string | `soft`, `hard`, `picked`, `released` |
| lotNumber | string? | |
| allocatedAt | DateTime | |
| expiresAt | DateTime? | soft allocations auto-expire |

**Soft allocation** - reserves stock visually but does not block other orders; used at order acceptance / ATP check.
**Hard allocation** - locks stock to the order; created at wave release / pick release.

**Strategies** (configurable per Location and per Customer override):
- FIFO / FEFO / LIFO (as above)
- `closest_to_pickface` - prefer bins with lowest `walkSequence`
- `avoid_partial_pallet` - prefer to break fewer units
- `same_lot` - keep an order on one lot for traceability
- `customer_dedicated` - only allocate from inventory with matching `ownerCustomerId`

**ATP (Available-to-Promise)** query: for SKU X at location Y on date Z, how many can I promise?
- Uses `quantityAvailable` minus soft allocations, plus inbound POs/ASNs arriving before Z.
- Exposed as `GET /api/v1/inventory/atp?sku=X&locationId=Y&date=Z`.

**Commands & Events (allocation):**
- `allocation.soft_allocate` / `.hard_allocate` / `.release` / `.convert_soft_to_hard`
- Events: `allocation.created`, `allocation.hardened`, `allocation.released`, `allocation.failed` (insufficient stock)

### Cycle Counting

**CycleCount** (header) and **CycleCountLine** (per bin):
- Count types: `full`, `zone`, `abc_class`, `random_sample`
- Worker scans bin, counts items, system compares to InventoryRecord
- Variances auto-create InventoryTransactions with `transactionType = 'cycle_count'`

### Replenishment

**ReplenishmentRule** - when pick face drops below threshold, move from bulk:
- `sku`, `pickFaceBinId`, `bulkZoneId`, `minQuantity`, `maxQuantity`
- Triggered by `inventory.below_minimum` event (emitted when pick reduces qty below min)
- Creates a transfer task (PutawayTask variant with `putawayType = 'replenishment'`)

### Commands & Events
- `inventory.adjust` (with reason code), `inventory.transfer` (between bins)
- `cycle_count.create` / `.start` / `.record_line` / `.complete`
- `replenishment_rule.create` / `.update`
- Events: `inventory.adjusted`, `inventory.transferred`, `inventory.below_minimum`, `cycle_count.completed`, `cycle_count.variance_detected`

---

## 4. Goods In (Receiving)

### Models

**ReceivingAppointment** - scheduled dock time

| Field | Type | Notes |
|-------|------|-------|
| id | uuid PK | |
| locationId | FK Location | |
| inboundShipmentId | FK Shipment? | expected shipment |
| dockBinId | FK WarehouseBin? | assigned dock door |
| scheduledAt | DateTime | |
| scheduledEndAt | DateTime | |
| status | string | `scheduled`, `checked_in`, `receiving`, `completed`, `no_show`, `cancelled` |
| carrierName | string? | |
| trailerNumber | string? | |
| sealNumber | string? | |
| asnReference | string? | EDI 856 reference |

**ReceivingTask** - unit of receiving work

| Field | Type | Notes |
|-------|------|-------|
| id | uuid PK | |
| locationId | FK Location | |
| appointmentId | FK ReceivingAppointment? | |
| inboundShipmentId | FK Shipment? | null for blind receiving |
| dockBinId | FK WarehouseBin? | |
| status | string | `pending`, `in_progress`, `inspection`, `completed`, `cancelled` |
| receivingType | string | `asn` or `blind` |
| crossDock | boolean | default false - skips putaway to storage |
| assignedToUserId | FK User? | |

**ReceivingLine** - per-item receiving detail

| Field | Type | Notes |
|-------|------|-------|
| id | uuid PK | |
| receivingTaskId | FK ReceivingTask | |
| orderLineItemId | FK OrderLineItem? | link to expected item |
| trackableUnitId | FK TrackableUnit? | scanned unit |
| sku | string | |
| expectedQuantity | int? | from ASN/order |
| receivedQuantity | int | default 0 |
| damagedQuantity | int | default 0 |
| inspectionStatus | string | `pending`, `pass`, `fail`, `quarantine` |
| lotNumber | string? | |
| expiryDate | DateTime? | |

### Workflow

1. **Appointment/arrival** - inbound shipment triggers `tracking.geofence_entered`. If appointment exists, match by shipment ID.
2. **Dock assignment** - operator assigns dock door bin
3. **Check-in** - verify trailer/seal numbers. Seal compared to ShipmentAccessory if present.
4. **Unload & scan** - scan each TrackableUnit off the truck. Reuse **CargoScan** with `scanType = 'receive'` (new value extending existing load/unload/checkpoint). Unit nesting captured: scan pallet, then scan totes/boxes onto it (sets `parentUnitId`).
5. **Quantity verification** - compare received vs expected. Discrepancies use existing **CargoDiscrepancy** with new types: `over_received`, `short_received`, `damaged_on_receipt`.
6. **Quality inspection** - mark lines as pass/fail/quarantine. Failed items routed to quarantine zone.
7. **Putaway generation** - on completion, generate PutawayTask per received unit.

### Integration
- Inbound EDI 856 (existing TradingPartner) pre-creates appointment + populates ReceivingLines
- CargoScan and CargoDiscrepancy (existing models) record all scan events and exceptions
- Issue system auto-creates issues for discrepancies above configurable threshold

---

## 5. Putaway & Routing Rules

### Models

**PutawayRule** - maps product attributes to target zone/bin

| Field | Type | Notes |
|-------|------|-------|
| id | uuid PK | |
| locationId | FK Location | per-warehouse |
| name | string | |
| priority | int | lower = higher priority |
| active | boolean | default true |
| **Criteria (all nullable = match any):** | | |
| skuPattern | string? | glob pattern, e.g. "PHARMA-*" |
| temperatureRequirement | string? | `refrigerated`, `frozen` |
| hazmat | boolean? | |
| customerId | string? | dedicated customer storage |
| velocityClass | string? | `A`, `B`, `C` (fast/medium/slow) |
| unitType | string? | `pallet`, `tote`, `box` |
| crossDockSortBy | string? | `destination`, `carrier`, `route` - for cross-dock |
| **Action:** | | |
| targetType | string | `zone`, `specific_bin`, `next_available_in_zone` |
| targetZoneId | FK WarehouseZone? | |
| targetBinId | FK WarehouseBin? | |
| preferLevel | string? | `low`, `medium`, `high` (ergonomic) |

**PutawayTask** - directed work order

| Field | Type | Notes |
|-------|------|-------|
| id | uuid PK | |
| locationId | FK Location | |
| receivingTaskId | FK ReceivingTask? | source |
| trackableUnitId | FK TrackableUnit | what to put away |
| sourceBinId | FK WarehouseBin? | where it is now |
| targetBinId | FK WarehouseBin | where it should go |
| status | string | `pending`, `assigned`, `in_progress`, `completed`, `cancelled` |
| putawayType | string | `directed`, `manual`, `replenishment` |
| assignedToUserId | FK User? | |

### Rule Evaluation

1. Fetch active rules for location, ordered by priority ASC
2. Match item attributes against non-null criteria (first match wins)
3. If `next_available_in_zone`: query bins in target zone with available capacity, ordered by `walkSequence`, pick first
4. No match: assign to default bulk storage zone, or flag for manual putaway

### Putaway Confirmation

Worker scans target bin label (CargoScan with `scanType = 'putaway'`). System verifies match. If different bin, allow with deviation warning. Sets `TrackableUnit.currentBinId`.

---

## 6. Pick and Pack

### Pick Strategy Models

**WaveTemplate** - reusable wave definition (the planner's "recipe")

| Field | Type | Notes |
|-------|------|-------|
| id | uuid PK | |
| locationId | FK Location | |
| name | string | e.g. "Daily FedEx 14:00 cutoff" |
| groupingRules | Json | customer, carrier, service level, ship-from, ship-complete only |
| cutoffTime | string? | HH:MM local; triggers release risk alerts |
| pickStrategy | string | `discrete`, `batch`, `zone`, `wave` |
| minOrders | int? | do not release below this size |
| maxOrders | int? | cap wave size |
| maxLabourHours | float? | capacity-aware sizing |
| priority | int | |
| releaseSchedule | string? | cron for auto-release |
| autoRelease | boolean | default false |
| active | boolean | default true |

Wave planner UI consumes eligible orders, applies a template, and previews: order count, line count, expected labour hours (from LabourStandard once v2 adds LMS), projected on-time rate, carrier cut-off countdown. A `shipment.cutoff_at_risk` event is emitted when projected completion exceeds cut-off.

**Wave** - batch of orders grouped for picking efficiency

| Field | Type | Notes |
|-------|------|-------|
| id | uuid PK | |
| locationId | FK Location | |
| templateId | FK WaveTemplate? | source template, null for ad-hoc |
| waveNumber | string | auto-generated, e.g. "W-2026-04-14-001" |
| status | string | `planning`, `released`, `in_progress`, `completed`, `cancelled` |
| pickStrategy | string | `discrete`, `batch`, `zone`, `wave` |
| groupingCriteria | Json? | e.g. `{ carrier: "FedEx", cutoffTime: "16:00" }` |
| orderCount | int | |
| lineCount | int | |
| projectedCompletionAt | DateTime? | used for cut-off risk |
| cutoffAt | DateTime? | resolved from template cutoffTime |

**WaveOrder** - join: wave to orders

| Field | Type | Notes |
|-------|------|-------|
| waveId | FK Wave | |
| orderId | FK Order | |
| priority | int | default 0 |

**PickTask** - directed pick work order

| Field | Type | Notes |
|-------|------|-------|
| id | uuid PK | |
| locationId | FK Location | |
| waveId | FK Wave? | null for ad-hoc |
| orderId | FK Order? | for discrete picking |
| assignedToUserId | FK User? | |
| status | string | `pending`, `assigned`, `in_progress`, `completed`, `short_pick`, `cancelled` |
| pickType | string | `discrete`, `batch`, `zone` |
| zoneId | FK WarehouseZone? | for zone picking |
| totalLines | int | |
| completedLines | int | default 0 |

**PickLine** - individual item to pick

| Field | Type | Notes |
|-------|------|-------|
| id | uuid PK | |
| pickTaskId | FK PickTask | |
| orderId | FK Order | which order (important for batch) |
| orderLineItemId | FK OrderLineItem | |
| inventoryRecordId | FK InventoryRecord | which stock slot to pick from |
| binId | FK WarehouseBin | |
| trackableUnitId | FK TrackableUnit? | which physical unit to pick |
| sku | string | |
| requestedQuantity | int | |
| pickedQuantity | int | default 0 |
| status | string | `pending`, `picked`, `short`, `skipped` |
| walkSequence | int | from bin's walkSequence |
| lotNumber | string? | specific lot for FEFO |
| shortPickAction | string? | `backorder`, `substitute`, `cancel_line` |

### Pick Strategy Workflows

**Discrete** (one order, one picker, full walk):
1. One PickTask per order, PickLines ordered by `bin.walkSequence`
2. Worker walks route, scans bin, scans unit/item, confirms qty
3. Completed PickTask triggers PackTask

**Batch** (multiple orders combined):
1. One PickTask with PickLines from N orders
2. Deduplicate where possible (3 orders each need SKU-X from Bin-5 = one line with qty 3)
3. After pick, items go to sort station, split back to individual orders
4. N PackTasks created

**Zone** (each picker owns a zone):
1. One PickTask per zone with relevant items
2. Zone picker completes, items move to next zone or to pack
3. Requires zone ordering (walkSequence on zones)

**Wave** (group by carrier/cutoff):
1. Dispatcher selects grouping criteria
2. System finds eligible orders, creates Wave
3. Wave uses any sub-strategy above for actual picking

### Pick Path Optimization

PickLines sorted by `WarehouseBin.walkSequence`. This gives a serpentine walk path without a graph solver. Sufficient for TMS-grade WMS.

### Short Pick Handling

1. Picker enters actual quantity found
2. Options: `backorder` (keep open for next wave), `substitute` (scan alt SKU), `cancel_line`
3. Backorder: remaining qty stays allocated, reappears in next wave
4. Cancel: allocation released, order line updated

### Pack Models

**PackTask** - pack station work order

| Field | Type | Notes |
|-------|------|-------|
| id | uuid PK | |
| locationId | FK Location | |
| orderId | FK Order | |
| pickTaskId | FK PickTask? | link to completed pick |
| assignedToUserId | FK User? | |
| packStationBinId | FK WarehouseBin? | binType = 'pack_station' |
| status | string | `pending`, `in_progress`, `completed`, `cancelled` |

**PackLine** - each item verified and packed

| Field | Type | Notes |
|-------|------|-------|
| id | uuid PK | |
| packTaskId | FK PackTask | |
| orderLineItemId | FK OrderLineItem | |
| trackableUnitId | FK TrackableUnit | which package it was packed into |
| sku | string | |
| expectedQuantity | int | |
| packedQuantity | int | default 0 |
| status | string | `pending`, `verified`, `packed` |

### Pack Workflow

1. Worker scans order barcode at pack station
2. System shows expected items from completed pick
3. Worker scans each item, system verifies against PackLines
4. Worker accepts or overrides a **cartonization recommendation** (see below)
5. Selected carton creates or assigns a **TrackableUnit** (the digital twin of the outbound package)
6. Weight captured (manual or scale); if it deviates from expected by >X% a PackAudit record + Issue is created
7. Pack completion triggers: shipping label print (via existing Document Generation), TrackableUnit associations updated
8. Packed unit moves to staging zone

### Cartonization

Recommend the smallest viable shippable carton from a configurable catalogue, reducing dim-weight charges and void fill.

**CartonCatalogue** - per-location available cartons

| Field | Type | Notes |
|-------|------|-------|
| id | uuid PK | |
| locationId | FK Location | |
| name | string | e.g. "Small Mailer", "Medium Box" |
| lengthMm | int | |
| widthMm | int | |
| heightMm | int | |
| maxWeightGrams | int | |
| unitCostCents | int? | for optimization cost function |
| active | boolean | |

**Algorithm:** First-Fit-Decreasing 3D bin packing over items already picked for the order (using ProductUom dimensions). Recommend primary carton, allow manual override. Service: `CartonizationService.recommend(orderId)` returns `{ cartonId, utilization, fallbackCartonIds[] }`.

Events: `pack.cartonization_recommended`, `pack.cartonization_overridden`.

### Commands & Events
- `wave.create` / `.release` / `.cancel`
- `pick_task.assign` / `.start` / `.complete_line` / `.short_pick` / `.complete`
- `pack_task.assign` / `.start` / `.verify_line` / `.select_package` / `.complete`
- Events: `wave.released`, `wave.completed`, `pick_task.completed`, `pick_task.short_pick` (triggers replenishment check), `pack_task.completed` (triggers label gen + staging)

---

## 7. Loading & Shipment Build-up

### Models

**StagingAssignment** - packed unit waiting for loading

| Field | Type | Notes |
|-------|------|-------|
| id | uuid PK | |
| locationId | FK Location | |
| orderId | FK Order | |
| shipmentId | FK Shipment? | may not exist yet at staging time |
| stagingBinId | FK WarehouseBin | binType = 'staging' |
| trackableUnitId | FK TrackableUnit | |
| status | string | `staged`, `loading`, `loaded`, `cancelled` |
| groupingKey | string? | carrier + route for visual grouping |

**LoadPlan** - load sequence and confirmation

| Field | Type | Notes |
|-------|------|-------|
| id | uuid PK | |
| shipmentId | FK Shipment | |
| dockBinId | FK WarehouseBin? | dock door |
| status | string | `planning`, `loading`, `loaded`, `cancelled` |
| loadSequence | Json | ordered array of trackableUnitIds (last delivery first) |
| totalUnitsExpected | int | |
| totalUnitsLoaded | int | default 0 |
| sealNumber | string? | applied after loading |
| loadedByUserId | FK User? | |

### Workflow

1. **Staging** - PackTask completion moves units to staging bins, grouped by carrier/route
2. **Shipment build-up** - orders accumulate for same shipment (reuses existing order-to-shipment conversion)
3. **Load sequence** - calculated from `ShipmentStop.sequenceNumber` in reverse (last delivery loaded first = deepest in truck)
4. **Load execution** - dock worker scans each TrackableUnit onto vehicle. CargoScan with `scanType = 'load_to_vehicle'`. System checks against load sequence, warns if out of order.
5. **Load completion** - when all units loaded, worker enters seal number
6. **BOL creation** - triggered at load completion (`load_plan.completed` event), NOT at shipment launch. Rationale: BOL must reflect actual loaded freight (after short picks, substitutions).
7. **Shipment launch** - existing warehouse launch wizard remains the final step (IoT devices, accessories, review). Gets a "Loading Status" panel showing LoadPlan state.

### Key Decision: When does the BOL get created?

**At load completion.** The BOL lists actual freight on the truck. Short picks and substitutions mean it may differ from planned orders. The carrier signs the BOL at pickup, so it must be ready before departure. Regeneration available if shipment modified post-BOL.

### Commands & Events
- `staging.assign` / `.cancel`
- `load_plan.create` / `.assign_dock` / `.scan_unit` / `.complete`
- Events: `load_plan.completed` (triggers BOL generation + shipment status to `ready_for_dispatch`), `load_plan.unit_loaded`, `load_plan.sequence_deviation`

---

## 8. Cross-dock Operations

Cross-dock is a **workflow variation**, not a separate system. Uses existing models with different parameters.

### How it differs

| Aspect | Normal Receiving | Cross-dock |
|--------|-----------------|------------|
| Putaway | Items to storage bins | Items to outbound staging |
| Inventory | Creates persistent InventoryRecord | Transient (no storage dwell) |
| Dwell time | Hours to weeks | Minutes to hours |
| Sorting | N/A | Sort by outbound destination/carrier |

### Implementation

- `ReceivingTask.crossDock = true` skips putaway-to-storage
- PutawayRules with `crossDockSortBy` set direct items to staging bins grouped by outbound destination/carrier
- Location must have `facilityCapabilities.crossDockCapable = true`
- On receiving completion, items go directly to StagingAssignment (skipping inventory storage)

No new models. No new commands. Just workflow branching on the `crossDock` flag.

---

## 9. Returns & Reverse Logistics (RMA)

The quarantine zone alone is insufficient for real returns flows. v1 adds a first-class RMA with disposition routing.

### Models

**Rma** - Return Merchandise Authorization header

| Field | Type | Notes |
|-------|------|-------|
| id | uuid PK | |
| rmaNumber | string | auto-generated, customer-facing |
| customerId | FK Customer | |
| originalOrderId | FK Order? | if traceable |
| reason | string | `damaged`, `wrong_item`, `not_needed`, `defective`, `warranty`, `other` |
| status | string | `requested`, `approved`, `in_transit`, `received`, `disposed`, `closed`, `rejected` |
| expectedAt | DateTime? | |
| returnShipmentId | FK Shipment? | inbound return leg |
| refundCreditNoteId | FK CreditNote? | link to financial credit |

**RmaLine** - expected returned items

| Field | Type | Notes |
|-------|------|-------|
| id | uuid PK | |
| rmaId | FK Rma | |
| sku | string | |
| expectedQuantity | int | |
| receivedQuantity | int | default 0 |
| disposition | string? | `restock`, `refurb`, `scrap`, `return_to_vendor`, `customer_keeps` |
| dispositionBinId | FK WarehouseBin? | |
| conditionGrade | string? | `A`, `B`, `C`, `scrap` |

### Workflow

1. Customer requests return via **Customer Portal** or CSR creates RMA manually. System generates an RMA number and (optionally) a pre-paid return label.
2. Carrier delivers returned freight. Receiving uses `ReceivingTask` with `receivingType = 'return'` linked to the RMA.
3. Each line is inspected, graded, and dispositioned. Disposition drives downstream flow:
   - `restock`: standard putaway to a restock bin (or prime if A-grade).
   - `refurb`: putaway to refurb queue zone; VAS work order (deferred to v2) processes.
   - `scrap`: inventory decremented, no putaway, reason code captured.
   - `return_to_vendor`: creates an outbound shipment to the supplier.
   - `customer_keeps`: inventory not affected; financial credit only.
4. On disposition, a `CreditNote` is generated via the existing financial pipeline.
5. An Issue is auto-created on any RMA with `reason = damaged` or `defective` so QC and supplier scorecard (v2) can track.

### Integration

- Reuses existing ReceivingTask, CargoScan, and Shipment models for the inbound return leg.
- Reuses existing CreditNote from the financial subsystem.
- Uses the existing Customer Portal shell to host the returns request UI.

### Commands & Events
- `rma.create` / `.approve` / `.receive_line` / `.dispose_line` / `.close` / `.reject`
- Events: `rma.created`, `rma.approved`, `rma.received`, `rma.line_dispositioned`, `rma.closed`

---

## 10. WMS EDI Extensions

The existing TMS EDI stack (TradingPartner + EdiRouterService) is extended with the two WMS-specific transactions that v1 cannot ship without. The others (943, 944, 947, 846, 753, 754) are deferred to v2.

| Code | Name | Direction | v1 | Notes |
|------|------|-----------|:--:|-------|
| 940 | Warehouse Shipping Order | Inbound | ✓ | Client tells 3PL what to ship; auto-creates Order |
| 945 | Warehouse Shipping Advice | Outbound | ✓ | 3PL tells client what shipped; emitted on `load_plan.completed` |
| 943 | Warehouse Stock Transfer Shipment Advice | Outbound | v2 | |
| 944 | Warehouse Stock Transfer Receipt Advice | Inbound | v2 | |
| 947 | Warehouse Inventory Adjustment Advice | Outbound | v2 | |
| 846 | Inventory Inquiry/Advice | Outbound | v2 | Critical for 3PL client dashboards |
| 753/754 | Routing Request / Routing Instructions | Both | v2 | |

New services: `EDI940ParseService`, `EDI945Service`. Router updated to route ST 940 to the order pipeline.

---

## 11. Warehouse Operations Dashboard

Warehouse KPIs are materially different from TMS dashboards and must have a dedicated page.

**Tiles:**
- Dock-to-stock time (receipt → available) - rolling 7d avg
- Order cycle time (release → ship)
- Pick accuracy (picks without short / substitution)
- Inventory record accuracy (last N cycle counts)
- On-time ship rate (by carrier, by customer)
- Perfect order rate (on time + in full + damage free + documentation correct)
- Labour productivity index (placeholder in v1, fully wired once v2 LMS ships)
- Capacity utilization by zone (from denormalized `current*` fields on WarehouseBin)
- Open exception count by category
- Cut-off risk panel (waves projected to miss carrier cut-off)

Each tile reads from a dedicated read model updated by projections. New page: `/wms/dashboard`.

---

## 12. Indoor RTLS Heatmap UI

The investment in IndoorZoneAnchor pays off visibly in a real-time floor-plan UI. This is a v1 deliverable because it is the headline differentiator vs commercial tier-1 WMS.

- 2D floor-plan SVG upload per Location (admin-provided PNG/SVG with pixel-to-metre scale).
- Zone polygons overlaid, fill-coloured by current occupancy / dwell.
- Live markers for TrackableUnits (pallets/totes) and logged-in users (pickers, forklift drivers).
- WebSocket/SSE stream from existing event bus.
- Heatmap toggle: picker density, dwell time, bottleneck detection.
- Playback mode: scrub a time slider through the last 24h of movements.

Page: `/wms/rtls`. Reuses existing `SensorReading`, `DeviceEvent`, and new `IndoorZonePosition` events.

---

## 13. Task Dispatcher Foundations (v2-ready)

To enable task interleaving (deferred to v2), v1 introduces a unified task abstraction so the four existing task types (Receiving, Putaway, Pick, Pack) share a common supertype and dispatcher queue. This costs almost nothing now and saves a painful retrofit later.

**WarehouseTask** - supertype

| Field | Type | Notes |
|-------|------|-------|
| id | uuid PK | |
| taskType | string | `receiving`, `putaway`, `pick`, `pack`, `cycle_count`, `replenishment`, `rma_receive`, `reslot` (v2) |
| detailTable | string | name of the detail table (e.g. `PickTask`) |
| detailId | uuid | row in detail table |
| locationId | FK Location | |
| status | string | `pending`, `assigned`, `in_progress`, `completed`, `cancelled` |
| priority | int | lower = higher priority |
| assignedToUserId | FK User? | |
| assignedAt | DateTime? | |
| startedAt | DateTime? | |
| completedAt | DateTime? | |
| expectedDurationSeconds | int? | hook for v2 LabourStandard |
| nearBinId | FK WarehouseBin? | geographic hint for dispatcher |

Each existing task detail row has a corresponding WarehouseTask row (1:1). Dispatcher is a stub in v1 (just returns next pending task by priority); full interleaving + LMS-aware selection is v2.

---

## Changes to Existing Models

| Model | Change | Reason |
|-------|--------|--------|
| TrackableUnit | Add `currentBinId` (FK WarehouseBin?) | warehouse location tracking |
| TrackableUnit | Add `parentUnitId` (FK TrackableUnit?, self-ref) | nesting hierarchy (pallet > tote > box) |
| TrackableUnit | Add `currentZoneId` (FK WarehouseZone?) | denormalized from bin or indoor positioning |
| TrackableUnit | Add `lotNumber` (string?) | batch tracking |
| TrackableUnit | Add `expiryDate` (DateTime?) | FEFO strategy |
| TrackableUnit | Add `receivedAt` (DateTime?) | FIFO strategy |
| TrackableUnit | Add `ownerCustomerId` (FK Customer?) | 3PL multi-client segregation |
| TrackableUnit | Add `qualityStatus` (string, default `available`) | hold / quarantine / damaged |
| Location | Add `pickStrategy` (string, default "FIFO") | FIFO/FEFO/LIFO |
| Location | Add `allocationStrategy` (string, default "FIFO") | AllocationEngine default |
| Location | Add `warehouseZones` relation | |
| Customer | Add `inventoryOwnershipEnabled` (boolean) | enables 3PL partition for this customer |
| CargoScan | No schema change | `scanType` is string, new values: `receive`, `putaway`, `pick`, `pack`, `stage`, `load_to_vehicle` |
| CargoDiscrepancy | No schema change | `discrepancyType` is string, new values: `over_received`, `short_received`, `damaged_on_receipt` |
| Organization | Add `wmsEnabled` (boolean, default false) | feature flag |

---

## New Models Summary (31 models)

| Model | Section | Purpose |
|-------|---------|---------|
| WarehouseZone | 1 | Zones within a warehouse |
| WarehouseAisle | 1 | Aisles within zones (optional) |
| WarehouseBin | 1 | Individual storage locations |
| IndoorZoneAnchor | 2 | BLE/WiFi/UWB anchor-to-zone mapping |
| InventoryRecord | 3 | SKU stock position per bin (read model) |
| InventoryTransaction | 3 | Immutable inventory ledger |
| CycleCount | 3 | Planned count header |
| CycleCountLine | 3 | Per-bin count line |
| ReplenishmentRule | 3 | Bulk-to-pick-face trigger rules |
| ReceivingAppointment | 4 | Scheduled dock times |
| ReceivingTask | 4 | Receiving work order |
| ReceivingLine | 4 | Per-item receiving detail |
| PutawayRule | 5 | Directed putaway rules |
| PutawayTask | 5 | Putaway work order |
| Wave | 6 | Pick wave header |
| WaveOrder | 6 | Wave-to-order join |
| PickTask | 6 | Pick work order |
| PickLine | 6 | Individual pick line |
| PackTask | 6 | Pack station work order |
| PackLine | 6 | Individual pack line |
| StagingAssignment | 7 | Staging for loading |
| LoadPlan | 7 | Load sequence and confirmation |
| ProductUom | 3 | Per-SKU UOM conversions (EA/CASE/PALLET etc.) |
| Allocation | 6 | Explicit order line → inventory binding (soft/hard) |
| WaveTemplate | 6 | Reusable wave definition with cut-off, capacity, priority |
| CartonCatalogue | 6 | Available cartons for cartonization engine |
| Rma | 9 | Return Merchandise Authorization header |
| RmaLine | 9 | Returned line item + disposition |
| WarehouseTask | 13 | Unified task supertype (task interleaving foundation) |
| QualityHold | 3 | Hold state on inventory blocking allocation |
| PackAudit | 6 | Weight/dim-weight variance at pack |
| IndoorZonePosition | 2 | Current RTLS position for heatmap UI |

---

## Design Decisions (Confirmed)

- **App structure**: Separate WMS app in VNext app switcher at `/wms` (not merged into Operations)
- **Auth model**: Existing User model with role-based access (no separate WmsUser)
- **Nesting depth**: Arbitrary depth via self-referencing `parentUnitId` FK on TrackableUnit
- **Domain reuse**: Maximum reuse of existing models (TrackableUnit, CargoScan, CargoDiscrepancy, Location, Order, Shipment, Document Generation) - extend, don't duplicate

## Frontend Structure

### New "Warehouse" app in VNext app switcher

Add to APPS array in `vnext-layout.tsx`:
- key: `warehouse-ops`, basePath: `/wms`, icon: warehouse, label: "Warehouse"

Sections:
- **Operations**: Dashboard, Receiving, Putaway Tasks, Pick/Pack, Loading, Staging, Returns (RMA)
- **Inventory**: Stock Levels, UOM Catalogue, Allocations, Cycle Counts, Adjustments, Replenishment, Holds
- **Visibility**: RTLS Heatmap (indoor), Warehouse Dashboard
- **Configuration**: Zones & Bins, Putaway Rules, Replenishment Rules, Wave Templates, Carton Catalogue, Indoor Anchors, Floor Plans

### Warehouse Mobile App Extension

Extend existing `/warehouse/*` app with new tabs:
- **Receiving**: scan-to-receive, inspection, nesting (scan pallet, scan totes onto it)
- **Putaway**: directed putaway with bin confirmation
- **Picking**: pick list with walk path, scan-to-confirm
- **Packing**: verify-and-pack at pack station
- **Loading**: load confirmation with sequence guidance

Reuse existing `useBarcodeScanner` hook and `CameraScannerModal`.

---

## Implementation Sequence

Each phase is independently useful. Phases 1-8 match the original v1 foundation; phases 9-12 add the must-have items identified in the gap analysis.

1. **Location Hierarchy** - Zones, Aisles, Bins (foundation)
2. **Indoor Zones** - Anchor mapping + IndoorZonePosition read model
3. **Inventory Foundations** - Records, Transactions, TrackableUnit extensions, **ProductUom master**, **ownerCustomerId partition**, QualityHold (digital twin hierarchy)
4. **Receiving** - Appointments, Tasks, Lines + extended CargoScan types
5. **Putaway** - Rules, Tasks, confirmation (depends on 1, 3, 4)
6. **Allocation Engine** - Allocation model, soft/hard states, ATP query, strategies (depends on 3)
7. **Pick & Pack** - Waves, **WaveTemplate**, Tasks, Lines, pack station, **Cartonization**, **PackAudit** (depends on 3, 5, 6)
8. **Loading & Staging** - LoadPlan, StagingAssignment, BOL trigger (depends on 7)
9. **Cross-dock** - Workflow variant (depends on 4, 8)
10. **Returns / RMA** - Rma, RmaLine, disposition flow, customer portal returns page (depends on 4, 6, financial)
11. **WMS EDI** - EDI 940 (inbound) + EDI 945 (outbound) services, router updates
12. **Dashboard + RTLS UI + WarehouseTask supertype** - warehouse dashboard, indoor heatmap, unified task queue stub

Each phase includes: Prisma migration, command handlers, event types, repository, DI registration, API routes, VNext UI pages, and tests.

---

## Deferred to v2+ (see gap analysis)

The items below are explicitly **out of v1 scope**. Each has an `IFoo` interface or extension point reserved in v1 so it can be dropped in without disruption. Full detail and priorities in `docs/gap-analysis/12-WMS-GAP-ANALYSIS.md`.

- **3PL Billing Suite** - BillingContract, storage/handling/VAS accrual, extends existing Charge/Invoice pipeline. Biggest single differentiator.
- **Labour Management (LMS)** - LabourStandard, LabourPerformance read model, productivity dashboards. `expectedDurationSeconds` on WarehouseTask already placed in v1.
- **Task Interleaving** - TaskDispatcher upgrade on the WarehouseTask supertype.
- **Slotting Optimization** - ABC classification, affinity analysis, SlottingRecommendation, re-slot task type. Needs 60-90d data.
- **Yard Management + Dock Appointment Portal** - YardLocation, YardMove, TrailerCheckIn, carrier-facing scheduling UI.
- **Automation / WCS Integration** - `IAutomationProvider` interface for AS/RS, AMR, conveyor, pick-to-light, voice.
- **Hazmat Segregation Engine** - HazmatClass catalogue, HazmatSegregationRule matrix, putaway validator, SDS management.
- **Serial Number Tracking** - SerialNumber model; receive/pick serial capture.
- **Batch Genealogy & Recall** - LotGenealogy projection, Recall entity, customer notification workflow.
- **Parcel Rate-Shop + Multi-Carrier Manifest** - ShipEngine/EasyPost integration, end-of-day SCAN form.
- **GS1 / SSCC / UCC-128 Compliance Labels** - ComplianceLabelTemplate per trading partner, ZPL/EPL generation.
- **Value-Added Services / Kitting** - VasTask, BillOfMaterials, KittingTask.
- **Catch Weight**, **Bonded Warehouse**, **Electronic Signatures (21 CFR Part 11)**, **Voice / Wearable Picking**, **Carbon per Order**, **Simulation**.
- **Extended WMS EDI** - 943, 944, 947, 846, 753, 754.

---

## Key Files to Modify

- `backend/prisma/schema.prisma` - all new models
- `backend/src/events/eventTypes.ts` - all new event types
- `backend/src/di/tokens.ts` - new DI tokens
- `backend/src/di/registry.ts` - register repos/services/commands
- `frontend/src/vnext-design/vnext-layout.tsx` - Warehouse app in app switcher
- `frontend/src/warehouse/warehouse-layout.tsx` - extend mobile app
- `frontend/src/main.tsx` - new routes

## Verification

- `cd backend && npx jest --config jest.config.cjs` - all existing tests pass
- `cd frontend && npx tsc --noEmit` - frontend compiles
- Each phase: create tracking file at `.tracking/wms-phase-N.md`
- Manual verification in browser for all UI pages
