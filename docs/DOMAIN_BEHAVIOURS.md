# Domain Behaviours — Open TMS

Every write operation in Open TMS flows through a **domain command**. Commands execute inside a database transaction, emit domain events, and those events trigger side effects (read model updates, notifications, audit logs, integrations).

This document is the authoritative reference for what happens when state changes.

---

## How It Works

```
API Request → Validate (Zod) → Dispatch Command → Execute in Transaction
                                                        ↓
                                                   Emit Events
                                                        ↓
                                                 Commit Transaction
                                                        ↓
                                              Publish to Event Bus
                                                        ↓
                                    ┌──────────┬──────────┬──────────┐
                                    ↓          ↓          ↓          ↓
                               Projection  AuditLog   Email    Notification
                              (read model) (immutable) (SMTP)   (in-app)
```

Every event is persisted to the immutable `DomainEventLog` before handler fan-out. Events can be replayed, exported for data warehouses, or consumed by ML pipelines.

---

## Orders

### Commands (CQRS)

| Command | Trigger | Events Emitted |
|---------|---------|----------------|
| `CreateOrderCommand` | `POST /api/v1/orders` | `order.created` |
| `UpdateOrderCommand` | `PUT /api/v1/orders/:id` | `order.updated`, `order.status_changed` (if status changes) |
| `ArchiveOrderCommand` | `DELETE /api/v1/orders/:id` | `order.archived` |

### Sub-Entity Operations (CQRS, Phase 2 + Phase 4)

Per-handling-unit and per-line operations were promoted to CQRS commands across Phase 2 (handling units) and Phase 4 (line items). Each emits a `trackable_unit.*` or `order_line_item.*` event that the `OrderProjection` consumes to keep `OrderReadModel.trackableUnitCount`, `lineItemCount`, and `totalWeight` in sync.

| Command | Trigger | Event Emitted |
|---------|---------|---------------|
| `CreateTrackableUnitCommand` | `POST /api/v1/orders/:id/trackable-units` (admin) or `POST /api/v1/customer-portal/orders/:id/trackable-units` (portal) | `trackable_unit.created` |
| `UpdateTrackableUnitCommand` | `PUT  /api/v1/orders/:orderId/trackable-units/:unitId` or portal equivalent | `trackable_unit.updated` (with `changes` diff) |
| `DeleteTrackableUnitCommand` | `DELETE /api/v1/orders/:orderId/trackable-units/:unitId` or portal equivalent | `trackable_unit.deleted` (with cascaded line-item count) |
| `GenerateTrackableUnitBarcodeCommand` | `POST /api/v1/orders/:orderId/trackable-units/:unitId/generate-barcode` or portal equivalent | `trackable_unit.barcode_generated` |
| `AddLineItemToUnitCommand` | `POST /api/v1/orders/:orderId/trackable-units/:unitId/line-items` or portal equivalent | `trackable_unit.line_item_added` |
| `MoveLineItemBetweenUnitsCommand` | `PUT  /api/v1/orders/:orderId/line-items/:itemId/move` or portal equivalent (body `targetUnitId: null` detaches) | `trackable_unit.line_item_moved` |
| `MergeTrackableUnitsCommand` | `POST /api/v1/orders/:orderId/trackable-units/merge` or portal equivalent | `trackable_unit.merged` |
| `SplitTrackableUnitCommand` | `POST /api/v1/orders/:orderId/trackable-units/:unitId/split` or portal equivalent | `trackable_unit.split` |
| `CreateLineItemCommand` | `POST /api/v1/orders/:id/line-items` or `POST /api/v1/customer-portal/orders/:id/line-items` | `order_line_item.created` |
| `UpdateLineItemCommand` | `PUT  /api/v1/orders/:orderId/line-items/:itemId` or `PUT  /api/v1/customer-portal/line-items/:itemId` (sparse patch) | `order_line_item.updated` (with `changes` diff) |
| `DeleteLineItemCommand` | `DELETE /api/v1/orders/:orderId/line-items/:itemId` or `DELETE /api/v1/customer-portal/line-items/:itemId` | `order_line_item.deleted` |

The only remaining repository-direct operation in this area is `validateLocation`:

| Operation | Trigger | What It Does |
|-----------|---------|-------------|
| Validate location | `POST /api/v1/orders/:id/validate-location` | Creates Location if needed, sets originId/destinationId |

**Per-unit dim/weight overrides:** `TrackableUnit` carries optional `weight`, `weightUnit`, `length`, `width`, `height`, `dimUnit`, `stackable` columns. These override the line-item totals during cartonization (`OrderCartonizationService.computeOrderFromUnits`) and the `totalWeight` aggregate in `OrderReadModel`. Used by sophisticated shippers building mixed-SKU pallets.

**Ownership scoping:** customer-portal endpoints walk `customerUser.customerId → Order.customerId` to verify ownership before dispatching; the order's `orgId` becomes the command's `orgId`. Admin endpoints use the standard `req.orgId!` from the JWT.

### Service Operations (Domain Services)

These call domain services with complex orchestration logic. They currently create AuditLog records but do not yet publish domain events through the event bus.

| Operation | Trigger | Service | What It Does |
|-----------|---------|---------|-------------|
| Assign to shipment | `POST /api/v1/orders/:id/assign-to-shipment` | ShipmentAssignmentService | Matches lane, creates/reuses shipment, creates stop, updates order status |
| Update delivery status | `POST /api/v1/orders/:id/delivery-status` | OrderDeliveryService | Updates deliveryStatus, creates audit log |
| Mark delivered | `POST /api/v1/orders/:id/mark-delivered` | OrderDeliveryService | Sets deliveryStatus=delivered, deliveredAt=now |
| Create exception | `POST /api/v1/orders/:id/delivery-exception` | OrderDeliveryService | Sets deliveryStatus=exception, records type/notes |
| Resolve exception | `POST /api/v1/orders/:id/resolve-exception` | OrderDeliveryService | Sets deliveryStatus=in_transit, records resolution |
| Update orders for stop | `POST /api/v1/shipment-stops/:id/update-orders` | OrderDeliveryService | Bulk updates all orders at a shipment stop |
| Geofence check | `POST /api/v1/shipments/:id/geofence-check` | OrderDeliveryService | Calculates distance to stops, auto-updates if within radius |
| Convert to shipment | `POST /api/v1/orders/:id/convert-to-shipment` | OrdersRepository | Creates shipment + stop + junction, updates order status (uses transaction) |
| Batch convert | `POST /api/v1/orders/batch-convert` | OrderConversionService | Individual or combined mode, compatibility checks |
| Split to shipments | `POST /api/v1/orders/:id/split-to-shipments` | OrderConversionService | Splits order items into multiple shipments |
| Check compatibility | `POST /api/v1/orders/check-compatibility` | OrderConversionService | Validates orders can be combined (read-only) |
| CSV import | `POST /api/v1/orders/import/csv` | CSVImportService | Bulk creates orders from CSV content |

### Side Effects

| Event | Projection | Notification | Other |
|-------|-----------|--------------|-------|
| `order.created` | OrderReadModel inserted (denormalized customer, origin, destination, counts) | — | CustomerReadModel.totalOrderCount incremented |
| `order.updated` | OrderReadModel fields updated | — | — |
| `order.status_changed` | OrderReadModel.status updated | In-app notification | — |
| `order.delivery_status_changed` | OrderReadModel.deliveryStatus updated | In-app + email (if exception) | — |
| `order.assigned_to_shipment` | OrderReadModel.shipmentId/Reference set | — | — |
| `order.delivered` | OrderReadModel.deliveredAt set | In-app notification | — |
| `order.exception` | OrderReadModel.exceptionType set | In-app + email | — |
| `order.exception_resolved` | OrderReadModel.exceptionType cleared | — | — |
| `order.archived` | — | — | Audit log |

### Status Lifecycle

```
pending → validated → converted/assigned → cancelled/archived
                   ↘ location_error (raw location data, needs resolution)
```

### Delivery Status Lifecycle

```
unassigned → assigned → in_transit → delivered
                              ↘ exception → (resolved) → in_transit
```

### Line Items & Cartonization (Phase 1)

Captured at create time on the commercial `OrderLineItem` rows, with derived numbers computed on the fly.

**Fields on `OrderLineItem` (Phase 1 additions in bold):**
description, sku, quantity, **unitOfMeasure**, weight + unit, L/W/H + dim unit, declared value (unitPriceCents / totalPriceCents / priceCurrency), freightClass, nmfcCode, hazmat (bool) + **unNumber / hazmatClass / packingGroup / properShippingName**, **hsCode / countryOfOrigin**, temperature (label) + **tempMinC / tempMaxC**.

**Required-ness is mode-driven (`ModeRulesService`)** — same matrix is evaluated client-side in the portal form and re-evaluated server-side in `POST /api/v1/customer-portal/orders`:

| Field | FTL | LTL | Parcel | + Hazmat | + International | + Temp ctrl |
|---|:--:|:--:|:--:|:--:|:--:|:--:|
| description, qty, UoM, weight | ✓ | ✓ | ✓ | ✓ | | |
| dimensions L/W/H | rec | ✓ | ✓ | ✓ | | |
| freightClass, nmfcCode, stackable | | ✓ | | ✓ (except parcel) | | |
| UN number, hazmat class, packing group, proper shipping name | | | | ✓ | | |
| hsCode, countryOfOrigin | | | | | ✓ | |
| tempMinC, tempMaxC | | | | | | ✓ |

Org-level overrides (`required` / `recommended` / `hidden` per field) are accepted by the service but not yet exposed via UI.

**`OrderCartonizationService` derives (never captures from user):**
- per-line: total weight (lb), total cube (ft³), density (lb/ft³), suggested freight class (NMFC density table)
- per-order: rolled-up freight class (highest class across lines), order-total weight, order-total cube
- from order-level packing summary: pallet positions (halved for stackable), linear feet on a 53' trailer

Available as a read-only live preview at `POST /api/v1/order-line-items/cartonization/preview` (pure compute, no persistence).

**Auto-generated handling units (`TrackableUnit`s):** when an order is created with `packingSummary` (packagingTypeId, unitCount, stackable) and no explicit `trackableUnits[]`, `CreateOrderCommand` auto-generates `unitCount` `TrackableUnit`s tagged with that packaging type and a sequence number. Phase 1 keeps it simple — line items are not allocated to specific units; that's Phase 2.

**Packaging catalogue (`PackagingType`)** is org-scoped with a `kind` discriminator (pallet | carton | crate | drum | roll | bag | tote | loose | custom). Pallet-specific fields (tareWeightGrams, maxLoadGrams, material) are nullable. Generalised from the original `PalletType` model in 2026-06; admin CRUD lives at `/wms/packaging-types`.

**Event payload v2:** `order.created` schema version bumped to 2 — payload now carries `packingSummary` (or null if none was provided).

### Line Items & Cartonization (Phase 2)

Phase 2 adds optional manual handling-unit modelling for sophisticated shippers (mixed-SKU pallets, per-unit weight/dim overrides) on top of the Phase 1 "packing summary auto-generates units" flow.

**Schema additions to `TrackableUnit`:** `weight`, `weightUnit`, `length`, `width`, `height`, `dimUnit`, `stackable`. Nullable per-unit overrides; when null, cartonization falls back to summing the unit's contained line items, then to the unit's `packagingType` external dims.

**CQRS promotion:** the 8 per-unit ops in the table above were promoted from repo-direct to command-dispatched. Each emits a `trackable_unit.*` event; `OrderProjection` subscribes to both `order.*` and `trackable_unit.*` and recomputes `trackableUnitCount` + `lineItemCount` + `totalWeight` on every change. Per-unit weight overrides take precedence over line-item weight sums in the read model.

**Unit-aware cartonization:** `OrderCartonizationService.computeOrderFromUnits(units[])` returns per-unit results (`weightSource: 'override' | 'lines' | 'empty'`, `dimsSource: 'override' | 'packagingType' | 'lines' | 'empty'`), order-level rolled-up class, total weight, total cube, pallet positions (half-floor for stackable, full for floor-loaded), and linear feet (sum of per-unit depth contributions, halved for stackable). Live preview at `POST /api/v1/order-line-items/cartonization/preview-units`.

**`HandlingUnitsEditor` component:** shared between the customer portal and admin VNext detail pages. Drag-and-drop allocation via `@dnd-kit/core` (line items move between unit drop zones + "unassigned"), per-unit dim/weight edit forms, create/delete/generate-barcode/merge/split actions, and a live cartonization summary header. Both ops surface the editor through an "Edit handling units" toggle on the detail page.

**Order ownership for portal:** the customer-portal endpoints walk `customerUser.customerId → Customer.orgId` and verify that any targeted unit/line item belongs to one of the customer's orders before dispatching. Cross-customer access returns 404 (not 403) to keep existence opaque.

### Line Items & Cartonization (Phase 3 — bulk CSV upload)

Phase 3 lets shippers create many orders at once from a single CSV. The same mode-rules engine that gates the portal form re-runs per CSV row, so a bulk import can't smuggle in an under-specified line.

**Endpoints:**

| Operation | Path | Notes |
|-----------|------|-------|
| Download CSV template | `GET /api/v1/orders/import/csv/template` (admin) or `GET /api/v1/customer-portal/orders/import/csv/template` (portal) | Header-only CSV with every column the importer accepts. |
| Bulk import orders | `POST /api/v1/orders/import/csv` (admin) or `POST /api/v1/customer-portal/orders/import/csv` (portal) | Body: `{ csvContent: string }` (JSON) or raw `text/csv`. Returns `{ ordersCreated, errors[], orders[] }`. |

**Behaviour:**
- Each row becomes (part of) an order. Rows with the same `orderNumber` group into one order; rows with the same `unitId` within an order group into a handling unit. Rows with no `unitId` become flat line items on the order.
- Every line item is re-validated against `ModeRulesService` using `(serviceLevel, hazmat, international, temperatureControlled)`. International is derived from the origin/destination country mismatch. Hazmat is line-level OR the order-level `requiresHazmat` flag.
- **All-or-nothing per order.** If any line in an order fails validation (or the packagingType code is unknown, or the customer can't be resolved), the entire order is rejected with per-row errors carrying the source CSV row number. Sibling orders in the same CSV still go through.
- The importer **dispatches `CREATE_ORDER` through the command bus** (rather than calling the repo) so `OrderProjection`, the read model, and any downstream handlers see the inserted orders.
- The customer-portal endpoint forces `customerId` to the authenticated customer. CSVs that declare a different `customerId` get a row-level error.
- Both endpoints return 200 with the full result on partial failure so the UI can show row-level diagnostics alongside the orders that did get created.

**Supported columns** (case-insensitive, with common aliases): order header (orderNumber, poNumber, customerId/Name, origin/destination address blocks, dates, serviceLevel, temperatureControl, requiresHazmat, specialInstructions, notes), order-level packing summary (packagingTypeCode, packingUnitCount, packingStackable), handling unit (unitId, unitType, unitPackagingTypeCode, unitWeight/Length/Width/Height/DimUnit/Stackable, unitBarcode, unitNotes), commercial line (sku, description, quantity, unitOfMeasure, weight, dims, price), LTL classification (freightClass, nmfcCode), hazmat detail (itemHazmat, unNumber, hazmatClass, packingGroup, properShippingName), customs (hsCode, countryOfOrigin), temperature (temperature, tempMinC, tempMaxC).

### Line Items & Cartonization (Phase 4 — full CQRS + weight consistency)

Phase 4 closes the remaining CQRS gap on the line-item write surface and fixes a quiet weight-aggregation inconsistency.

**Three new commands** (`backend/src/commands/lineItems/`):
- `CreateLineItemCommand` — adds an OrderLineItem to an order, optionally attached to a TrackableUnit. Verifies the unit (if provided) belongs to the same order. Emits `order_line_item.created`.
- `UpdateLineItemCommand` — sparse patch over every Phase 1 field (description, quantity, UoM, weight, dims, pricing, freight class, NMFC, hazmat detail, customs, temp range). Emits `order_line_item.updated` with a `changes` diff for audit.
- `DeleteLineItemCommand` — removes a line item. Emits `order_line_item.deleted` (with the parent orderId + sku + previous trackableUnitId).

The two pre-existing `/orders/:id/line-items` endpoints (POST add, DELETE remove) were rewired to dispatch these commands instead of calling the repository directly. A new PUT endpoint exposes the update command. Customer-portal mirrors live under `/api/v1/customer-portal/line-items/...` with line-item-back-to-customer ownership checks.

**Weight consistency fix:** `OrderLineItem.weight` is per-piece (consistent with how `OrderCartonizationService` reads it). The `OrderProjection` weight aggregate previously summed line weights without multiplying by quantity, which silently understated total weight for any order with quantity > 1 lines. Phase 4 fixes the projection to compute `sum(weight × quantity)` and adds a regression test. Unit-weight overrides still take precedence when any TrackableUnit has an explicit weight set.

---

## Shipments

### Lifecycle States

Shipments follow a canonical lifecycle: **`draft` → `ready` → `in_progress` → `complete`**.

- A **draft** can be saved with missing fields. Any field the user does enter is still validated.
- Promoting **out of draft** requires the **readiness gate**: customer, a route (origin+destination OR a lane), a carrier, pickup date, delivery date, a non-empty reference, plus any `ShipmentType.requiredFields`. Validated by `validateShipmentReadiness()` in `shared/shipmentTypeValidator.ts` (mirrored to the frontend).
- Manual transitions are **forward one step or back one step only** (no skipping), enforced by `canTransition()`.
- **Exceptions are orthogonal** to the lifecycle: a carrier/tracking exception sets `Shipment.hasException = true` (and emits `shipment.exception`) without changing the lifecycle status.
- Automatic handlers (carrier tracking, geofence completion) map onto the lifecycle and bypass the manual gate: in-transit milestones → `in_progress`, delivery → `complete`.

### Commands

| Command | Trigger | Events Emitted |
|---------|---------|----------------|
| `CreateShipmentCommand` | `POST /api/v1/shipments` | `shipment.created` (always `draft`) |
| `UpdateShipmentCommand` | `PUT /api/v1/shipments/:id` | `shipment.updated`, `shipment.status_changed`, `shipment.carrier_assigned` |
| `TransitionShipmentStatusCommand` | `POST /api/v1/shipments/:id/transition`, `POST /api/v1/shipments/bulk-transition` | `shipment.status_changed` (gated: adjacency + readiness) |
| `ArchiveShipmentCommand` | `DELETE /api/v1/shipments/:id` (requires `shipments:write`) | `shipment.archived` |
| `UnarchiveShipmentCommand` | `POST /api/v1/shipments/:id/unarchive` (requires `shipments:delete`) | `shipment.unarchived` |
| `SoftDeleteShipmentCommand` | `POST /api/v1/shipments/:id/soft-delete` (requires `shipments:delete`) | `shipment.deleted` |
| `ProcessInbound214Command` | `POST /api/v1/edi/214/inbound` | `edi_214.received`, `shipment.status_changed`, `shipment.stop_arrived`, `shipment.stop_completed`, `shipment.exception`, `shipment.delivered` |

`GET /api/v1/shipments/:id/readiness` returns `{ status, missing, isValid, allowedTransitions }` for the detail-page control. Every `shipment.status_changed` is captured by the `AuditHandler` as an immutable `AuditLog` row recording the actor ("who did it") — this is the audit event for manual lifecycle moves.

### Event Timeline (read-only)

The shipment detail "Events" tab shows a **platform-generated, read-only** timeline — there is no manual event creation. `ShipmentTimelineProjection` (`backend/src/events/projections/ShipmentTimelineProjection.ts`) subscribes to `shipment.*` and materializes a `ShipmentEvent` row per mapped domain event (deduped on `sourceEventId`; pg-boss may redeliver). The canonical `eventType` taxonomy lives in `backend/src/shared/shipmentEventTypes.ts` (mirrored to the frontend):

| Timeline type | Source domain event |
|---------------|---------------------|
| `created` / `updated` / `status_changed` / `carrier_assigned` / `exception` / `delivered` / `archived` / `unarchived` / `deleted` | the matching `shipment.*` event |
| `leaves_origin` | `shipment.stop_completed` at the first stop |
| `enters_destination` | `shipment.stop_arrived` at the last stop |
| `entered_waypoint` / `exited_waypoint` | `shipment.stop_arrived` / `stop_completed` at an intermediate stop |

`GET /api/v1/shipments/:id/events` returns the timeline newest-first, filterable by `eventType`, `fromDate`, `toDate`. IoT/EDI writers still add their own rows (`location`, `edi_214`, …) independently. Backfill historical timelines with `npx tsx backend/src/scripts/backfill-shipment-timeline.ts`.

### Archive vs Soft Delete

Two independent removal states, both retaining the row for audit:

- **Archive** (`archived`/`archivedAt`) — recoverable, available to any operational user (`shipments:write`). Removed from active lists, but the shipment **detail page still loads** and shows an "archived" banner. Admins (`shipments:delete`) can **unarchive** (`POST /:id/unarchive`) to restore it to active lists. Intended to also surface in a future "archived shipments" screen.
- **Soft delete** (`deletedAt`/`deletedBy`) — admin-only (`shipments:delete`). Hidden from **every** view, including the future archived screen. The row is kept only for audit/compliance; idempotent (re-deleting is a no-op). Soft-deleted shipments are filtered out of all read/mutation routes via `deletedAt: null`, so the detail page 404s.

### Side Effects

| Event | Projection | Notification | Integration |
|-------|-----------|--------------|-------------|
| `shipment.created` | ShipmentReadModel inserted (status `draft`) | — | Outbound carrier queue (EDI 856), outbound tracking queue |
| `shipment.status_changed` | ShipmentReadModel.status updated | In-app + email | — |
| `shipment.carrier_assigned` | ShipmentReadModel.carrierName updated | — | — |
| `shipment.delivered` | ShipmentReadModel.status = 'complete' | In-app + email | — |
| `shipment.exception` | ShipmentReadModel.hasException = true (status unchanged) | In-app + email | — |
| `shipment.stop_arrived` | ShipmentReadModel.stopCount updated | In-app | Orders at stop → delivery_status_changed |
| `shipment.stop_completed` | ShipmentReadModel.stopCount updated | In-app | Orders at stop → delivered |
| `shipment.archived` | ShipmentReadModel row removed | — | — |
| `shipment.unarchived` | ShipmentReadModel row re-inserted | — | — |
| `shipment.deleted` | ShipmentReadModel row removed | — | — |
| `edi_214.received` | — | — | Auto-forward outbound 214 to customer trading partners |
| `edi_214.sent` | — | — | — |

### Tracking (IoT)

| Event | Source | Side Effects |
|-------|--------|-------------|
| `tracking.location_received` | Inbound webhook worker | ShipmentReadModel.currentLat/Lng updated, geofence check |
| `tracking.geofence_entered` | Geofence calculation | ShipmentStop marked arrived, orders updated |
| `tracking.eta_updated` | ETA recalculation | — |

### IoT Devices & Vendors

**Admin vendor toggle.** `IotVendor` is a per-org registry (`@@unique([orgId, vendorKey])`) of IoT tracking vendors. System Loco is vendor #1, enabled by default. Managed at `/settings/iot-vendors`:
- `GET /api/v1/settings/iot-vendors` (any authed user; auto-seeds known vendors) — the shipment form uses it to decide whether to show the IoT section.
- `PUT /api/v1/settings/iot-vendors/:vendorKey` (`settings:write`) toggles `enabled`.
- When a vendor is **disabled**, the inbound webhook worker logs its webhooks as `disabled` and skips processing.

**Device assignment on shipments.** The shipment create/edit form (when any vendor is enabled) accepts `devices: [{ name, externalId }]`. `reconcileShipmentDevices` (called inside `CreateShipmentCommand` / `UpdateShipmentCommand`) upserts a `Device` per `externalId` and maintains active `DeviceAssignment` rows: adds new ones (releasing the device's prior assignment), and on edit deactivates assignments dropped from the list. Emits `device.assigned` / `device.unassigned`. Idempotent. Shipment-level only for now.

**Webhook resolution (unchanged).** `SystemLocoAdapter.resolveAssignment` resolves a device to a shipment by: (1) active `DeviceAssignment` for the device id, then (2) device name → `Shipment.reference`, then (3) device name → `Order.orderNumber`. Creating devices on the shipment form populates path (1). Lookups use existing indexes: `Device.name`, `Device.externalId` (`@unique`), `DeviceAssignment[deviceId, active]`, `Shipment.reference`, `Order.orderNumber` (`@unique`).

---

## Carriers

### Commands

| Command | Trigger | Events Emitted |
|---------|---------|----------------|
| `CreateCarrierCommand` | `POST /api/v1/carriers` | `carrier.created` |
| `UpdateCarrierCommand` | `PUT /api/v1/carriers/:id` | `carrier.updated` |
| `ArchiveCarrierCommand` | `DELETE /api/v1/carriers/:id` | `carrier.archived` |

### Side Effects

| Event | Projection |
|-------|-----------|
| `carrier.created` | CarrierReadModel inserted (vehicle/driver/lane counts) |
| `carrier.updated` | CarrierReadModel fields updated |
| `carrier.archived` | CarrierReadModel.status = 'archived' |

---

## Customers

### Commands

| Command | Trigger | Events Emitted |
|---------|---------|----------------|
| `CreateCustomerCommand` | `POST /api/v1/customers` | `customer.created` |
| `UpdateCustomerCommand` | `PUT /api/v1/customers/:id` | `customer.updated` |
| `ArchiveCustomerCommand` | `DELETE /api/v1/customers/:id` | `customer.archived` |

### Side Effects

| Event | Projection |
|-------|-----------|
| `customer.created` | CustomerReadModel inserted |
| `customer.updated` | CustomerReadModel fields updated |
| `customer.archived` | CustomerReadModel deleted |
| `order.created` | CustomerReadModel.activeOrderCount + totalOrderCount incremented |

---

## Locations

### Location Metadata

Locations can be classified by type (`warehouse`, `distribution_centre`, `cross_dock`, `terminal`, `port`, `rail_yard`, `customer`, `store`, `manufacturing`) and enriched with facility capabilities, operating details, and contact information. This metadata supports hub-and-spoke routing, cross-dock planning, and appointment scheduling.

**Facility Capabilities** (JSON): `crossDockCapable`, `hasColdStorage`, `hasHazmatCert`, `hasBondedStorage`

**Operating Details**: `appointmentRequired`, `dockCount`, `maxTrailerLengthFt`, `operatingHours` (per-day open/close schedule)

**Contact**: `contactName`, `contactPhone`, `contactEmail`

### Commands

| Command | Trigger | Events Emitted | Side Effects |
|---------|---------|----------------|-------------|
| `CreateLocationCommand` | `POST /api/v1/locations` | `location.created` | Event payload includes `locationType` |
| `UpdateLocationCommand` | `PUT /api/v1/locations/:id` | `location.updated` | Event payload includes changed field names |
| `CreateShipmentCommand` (resolution) | Shipment with `originData`/`destinationData` | `location.created` | `source: 'shipment_resolution'` in payload |
| `LocationResolutionService` | Order creation, EDI import | `location.created` | `source: 'resolution'` in payload |

---

## Lanes

### Commands

| Command | Trigger | Events Emitted |
|---------|---------|----------------|
| `CreateLaneCommand` | `POST /api/v1/lanes` | `lane.created` |
| `UpdateLaneCommand` | `PUT /api/v1/lanes/:id` | `lane.updated` |
| `ArchiveLaneCommand` | `DELETE /api/v1/lanes/:id` | `lane.archived` |

### Side Effects

| Event | Projection |
|-------|-----------|
| `lane.created` | LaneReadModel inserted (origin/destination names, carrier count) |
| `lane.updated` | LaneReadModel fields updated |
| `lane.archived` | LaneReadModel.status = 'archived' |

---

## Issues / Triage

Issues track operational problems — exceptions, delays, damage, compliance failures. They can be created manually or auto-created from domain events.

### Commands

| Command | Trigger | Events Emitted |
|---------|---------|----------------|
| `CreateIssueCommand` | API or auto-triage handler | `issue.created` |
| `UpdateIssueCommand` | `PUT /api/v1/issues/:id` | `issue.updated`, `issue.status_changed`, `issue.assigned`, or `issue.resolved` |
| `EscalateIssueCommand` | Escalation action | `issue.escalated` |

UpdateIssueCommand also handles these lifecycle operations:

| Operation | Fields Set | Event Emitted |
|-----------|-----------|---------------|
| Snooze Issue | snoozedUntil, snoozedBy, snoozedReason | `issue.snoozed` |
| Unsnooze Issue | clears snoozedUntil, snoozedBy, snoozedReason | `issue.unsnoozed` |
| Close Issue | status=closed, closedAt, closedBy | `issue.closed` |
| Reopen Issue | status=open, clears closedAt | `issue.reopened` |
| Toggle NeedsCapa | sets needsCapa boolean | `issue.needs_capa_marked` |
| Add Label | creates IssueLabelAssignment | `issue.label_added` |
| Remove Label | deletes IssueLabelAssignment | `issue.label_removed` |

### Smart Event Selection

UpdateIssueCommand emits different events based on what changed:
- Status -> `resolved`: emits `issue.resolved`
- Status -> `closed`: emits `issue.closed`
- Status -> `open` (from closed): emits `issue.reopened`
- Status -> anything else: emits `issue.status_changed`
- Assignee changed: emits `issue.assigned`
- Snooze set: emits `issue.snoozed`
- Snooze cleared: emits `issue.unsnoozed`
- needsCapa toggled: emits `issue.needs_capa_marked`
- Label added: emits `issue.label_added`
- Label removed: emits `issue.label_removed`
- Other fields only: emits `issue.updated`

### Side Effects

| Event | Projection | Notification | Other |
|-------|-----------|--------------|-------|
| `issue.created` | IssueReadModel inserted | In-app (if high/critical priority) | -- |
| `issue.assigned` | IssueReadModel.assigneeName updated | In-app to assignee | -- |
| `issue.escalated` | IssueReadModel.escalatedTo set, priority -> critical | In-app + email to escalation target | -- |
| `issue.resolved` | IssueReadModel.resolvedAt set | In-app | -- |
| `issue.snoozed` | IssueReadModel.snoozedUntil set | In-app | Auto-wake on snoozedUntil expiry |
| `issue.unsnoozed` | IssueReadModel.snoozedUntil cleared | In-app | -- |
| `issue.closed` | IssueReadModel.closedAt, status=closed | In-app | IssueClosureReportHandler generates PDF |
| `issue.reopened` | IssueReadModel.closedAt cleared, status=open | In-app | -- |
| `issue.needs_capa_marked` | IssueReadModel.needsCapa updated | In-app | -- |
| `issue.label_added` | IssueReadModel label associations updated | -- | -- |
| `issue.label_removed` | IssueReadModel label associations updated | -- | -- |

### Status Lifecycle

```
open -> in_progress -> resolved -> closed
         |                           |
         ↑                           v (reopen)
    (escalated: auto-set to        open
     in_progress, priority
     -> critical)

Any status can be snoozed (snoozedUntil set). Auto-wakes when time expires.
```

### Issue Closure Report

When an issue is closed (`issue.closed` event), the `IssueClosureReportHandler` automatically generates a PDF closure report:
- **Trigger:** `issue.closed` event
- **Handler:** `IssueClosureReportHandler`
- **Output:** PDF stored via `IBinaryStorageProvider` as a `GeneratedDocument` (documentType: `issue_closure_report`)
- **Content:** issue summary, triggering event, shipment/order context, temperature telemetry, SLA evaluations, activity timeline, CAPA reports

---

## Comments (Polymorphic)

Comments are a generic, polymorphic entity that can be attached to issues, shipments, or orders. The `entityType` + `entityId` fields link a comment to its parent.

### Commands

| Command | Trigger | Events Emitted |
|---------|---------|----------------|
| `AddCommentCommand` | `POST /api/v1/comments` | `comment.added` |
| `UpdateCommentCommand` | `PUT /api/v1/comments/:id` | `comment.updated` |
| `DeleteCommentCommand` | `DELETE /api/v1/comments/:id` | `comment.deleted` |

### Side Effects

| Event | Projection | Notification |
|-------|-----------|--------------|
| `comment.added` | IssueProjection increments commentCount | InAppNotificationHandler creates bell notification |
| `comment.updated` | -- | -- |
| `comment.deleted` | IssueProjection decrements commentCount | -- |

---

## Tenders

### Commands

| Command | Trigger | Events Emitted |
|---------|---------|----------------|
| `CreateTenderCommand` | `POST /api/v1/tenders` | `tender.created` |
| `OpenTenderCommand` | `POST /api/v1/tenders/:id/open` | `tender.published` |
| `AwardTenderCommand` | `POST /api/v1/tenders/:id/award` | `tender.awarded` |
| `CancelTenderCommand` | `POST /api/v1/tenders/:id/cancel` | `tender.cancelled` |

### Status Lifecycle

```
draft → open → evaluating → awarded
                          → cancelled
```

### Side Effects

| Event | What Happens |
|-------|-------------|
| `tender.created` | Tender + TenderOffer records created per carrier |
| `tender.published` | All offers marked 'sent', carriers notified, EDI 204 sent if trading partner configured |
| `tender.awarded` | Winning bid recorded, carrier assigned to shipment |
| `tender.response_received` | Bid recorded or offer declined, waterfall auto-progresses |
| `tender.awarded` | **Financial side effect:** `TenderAwardFinancialHandler` creates a `Charge` (category=cost, type=linehaul, source=tender_bid) on the shipment from the winning bid rate. Recalculates `ShipmentFinancialSummary`. |

---

## Charges (Financial)

### Commands (CQRS)

| Command | Trigger | Events Emitted |
|---------|---------|----------------|
| `CreateChargeCommand` | `POST /api/v1/charges` | `charge.created` |
| `ApproveChargeCommand` | `POST /api/v1/charges/:id/approve` | `charge.approved` |

### Service Operations

| Operation | Trigger | What It Does |
|-----------|---------|-------------|
| Get shipment financials | `GET /api/v1/shipments/:id/financials` | Returns charges, expected vs actual revenue/cost/margin |
| Calculate rate | `POST /api/v1/rates/calculate` | Looks up LaneCarrier rates, computes linehaul + fuel surcharge breakdown |
| Delete charge | `DELETE /api/v1/charges/:id` | Removes a pending charge, recalculates summary |

### Side Effects

| Event | What Happens |
|-------|-------------|
| `charge.created` | `ShipmentFinancialSummary` upserted with recalculated totals |
| `charge.approved` | `ShipmentFinancialSummary` actual figures updated |
| `tender.awarded` | `TenderAwardFinancialHandler` auto-creates cost charge from winning bid |

### Charge Lifecycle

```
pending → approved → invoiced
              ↘ disputed → (resolved)
pending → written_off
```

### Charge Categories

- **revenue**: What the customer pays us (linehaul, fuel surcharge, accessorials)
- **cost**: What we pay the carrier (linehaul, fuel surcharge, detention, adjustments)

### ShipmentFinancialSummary

Denormalized financial snapshot per shipment. Automatically recalculated whenever charges are created, approved, or deleted. Tracks:
- Expected revenue/cost/margin (all non-written-off charges)
- Actual revenue/cost/margin (only approved/invoiced charges)
- Billing status: `not_ready` → `ready_to_invoice` → `invoiced` → `paid`
- Carrier payment status: `not_ready` → `invoice_received` → `approved` → `paid`

---

## Invoices (Customer — Accounts Receivable)

### Commands (CQRS)

| Command | Trigger | Events Emitted |
|---------|---------|----------------|
| `CreateInvoiceCommand` | `POST /api/v1/invoices` | `invoice.created` |
| `ApproveInvoiceCommand` | `POST /api/v1/invoices/:id/approve` | `invoice.approved` |
| `SendInvoiceCommand` | `POST /api/v1/invoices/:id/send` | `invoice.sent` |
| `RecordPaymentCommand` | `POST /api/v1/invoices/:id/payments` | `invoice.payment_received`, `invoice.paid` (if fully paid) |
| `VoidInvoiceCommand` | `POST /api/v1/invoices/:id/void` | `invoice.voided` |

### Service Operations

| Operation | Trigger | What It Does |
|-----------|---------|-------------|
| Ready to invoice | `GET /api/v1/invoices/ready-to-invoice` | Lists shipments with approved revenue charges and billing_status=ready_to_invoice |
| List invoices | `GET /api/v1/invoices` | Filterable by customer, status |

### Side Effects

| Event | What Happens |
|-------|-------------|
| `shipment.delivered` | `BillingTriggerHandler`: marks shipment ready_to_invoice. If customer.autoInvoice=true, auto-creates draft invoice from approved revenue charges |
| `invoice.created` | `InvoiceProjection`: InvoiceReadModel inserted. Charges marked as invoiced. ShipmentFinancialSummary.billingStatus → invoiced |
| `invoice.payment_received` | `InvoiceProjection`: paidCents, balanceCents, daysPastDue updated |
| `invoice.paid` | ShipmentFinancialSummary.billingStatus → paid |
| `invoice.voided` | Charges reverted to approved. ShipmentFinancialSummary.billingStatus → ready_to_invoice |

### Invoice Lifecycle

```
draft → approved → sent → partial_paid → paid
                      ↘ overdue (detected by cron)
draft/approved → void (only if no payments)
sent/partial_paid → disputed
```

### Auto-Invoice (Per Customer)

If `Customer.autoInvoice = true`, when a shipment is delivered:
1. BillingTriggerHandler checks for approved revenue charges
2. If found, creates a draft invoice automatically
3. Staff reviews and approves/sends (invoice still needs manual approval)

---

## Carrier Invoices (Accounts Payable)

### Commands (CQRS)

| Command | Trigger | Events Emitted |
|---------|---------|----------------|
| `ReceiveCarrierInvoiceCommand` | `POST /api/v1/carrier-invoices` | `carrier_invoice.received`, `carrier_invoice.discrepancy` (if mismatch) |
| `ApproveCarrierInvoiceCommand` | `POST /api/v1/carrier-invoices/:id/approve` | `carrier_invoice.approved` |
| `RecordCarrierPaymentCommand` | `POST /api/v1/carrier-invoices/:id/pay` | `carrier_invoice.paid` |

### Three-Way Match (Freight Audit)

When a carrier invoice is received, `ReceiveCarrierInvoiceCommand` automatically performs a three-way match:

1. For each line item, finds expected cost `Charge` records on the referenced shipment
2. Compares invoiced amount vs expected amount per charge type
3. Calculates variance per line and overall
4. Line match statuses: `matched` (exact) | `variance` (amount differs) | `unmatched` (no expected charge)
5. Overall: `matched` | `partial_match` (variance only) | `mismatch` (has unmatched lines)
6. **Auto-approve**: If no unmatched lines AND variance <= 2%, invoice is auto-approved

### Carrier Invoice Lifecycle

```
received → matched/discrepancy → approved → scheduled → paid
                    ↘ disputed
```

### Side Effects

| Event | What Happens |
|-------|-------------|
| `carrier_invoice.received` | ShipmentFinancialSummary.carrierPaymentStatus → invoice_received (or approved if auto) |
| `carrier_invoice.approved` | ShipmentFinancialSummary.carrierPaymentStatus → approved |
| `carrier_invoice.scheduled` | scheduledPayDate set, status → scheduled |
| `carrier_invoice.paid` | ShipmentFinancialSummary.carrierPaymentStatus → paid |

### Payment Batching

The `CarrierPaymentBatchService` groups approved carrier invoices by carrier for batch payment scheduling:

- **GET /api/v1/carrier-invoices/payment-batches** - View approved invoices grouped by carrier (filterable by carrierId, dueBefore)
- **GET /api/v1/carrier-invoices/payment-batches/scheduled** - View scheduled payments grouped by date
- **POST /api/v1/carrier-invoices/payment-batches/schedule** - Schedule invoices for payment on a future date (by specific IDs, carrier, or due date filter)
- **POST /api/v1/carrier-invoices/payment-batches/execute** - Execute all scheduled payments due on or before today

A daily pg-boss cron job (`carrier-payment-batch`, 7am UTC) auto-executes scheduled payments that are due.

---

## Quotes

Quotes let operations staff price a potential shipment for a customer before it becomes a live order. A quote can be revised multiple times; accepting a quote auto-creates an order with pre-populated revenue charges.

### Commands (CQRS)

| Command | Trigger | Events Emitted |
|---------|---------|----------------|
| `CreateQuoteCommand` | `POST /api/v1/quotes` | `quote.created` |
| `AcceptQuoteCommand` | `POST /api/v1/quotes/:id/accept` | `quote.accepted` |
| `DeclineQuoteCommand` | `POST /api/v1/quotes/:id/decline` | `quote.declined` |
| `ReviseQuoteCommand` | `POST /api/v1/quotes/:id/revise` | `quote.revised` |

### Side Effects

| Event | What Happens |
|-------|-------------|
| `quote.created` | Quote + QuoteLineItem records created. Validity period starts (configurable, default from org settings) |
| `quote.accepted` | Order auto-created from quote data. Approved revenue charges added to order from quote line items. Quote marked accepted |
| `quote.declined` | Quote marked declined. No further action |
| `quote.revised` | Original quote status → superseded. New quote version created with `parentQuoteId` linking to original. Revision number incremented |
| (cron) | Quote expiration cron (pg-boss, every 30 min) marks expired quotes past their validity date |

### Quote Lifecycle

```
draft → sent → accepted
             → declined
             → expired (cron-detected)
             → superseded (when revised)
```

---

## Financial Queries & Credit Notes

Financial queries track disputes, discrepancies, and cargo-related claims. They can be raised manually or auto-created by the `FinancialImpactHandler` when cargo events occur. Resolving a query can optionally generate a credit note.

### Commands (CQRS)

| Command | Trigger | Events Emitted |
|---------|---------|----------------|
| `RaiseQueryCommand` | `POST /api/v1/financial-queries` | `financial_query.raised` |
| `ResolveQueryCommand` | `POST /api/v1/financial-queries/:id/resolve` | `financial_query.resolved`, `credit_note.created` (if adjustment) |

### Auto-Created Queries (FinancialImpactHandler)

The `FinancialImpactHandler` listens to cargo and cold-chain events and automatically raises financial queries:

| Source Event | Query Created |
|-------------|---------------|
| `cargo.missing_at_stop` | Query for missing cargo at delivery stop — potential claim for undelivered goods |
| `cargo.misdrop_detected` | Query for cargo delivered to wrong stop — investigation needed for mis-delivery |
| `cold_chain.disposition_changed` (quarantined) | Query for quarantined goods — cold chain excursion rendered cargo unsaleable |

### Side Effects

| Event | What Happens |
|-------|-------------|
| `financial_query.raised` | Query record created with status=raised, linked to shipment/order |
| `financial_query.resolved` | Query status updated. If resolution=resolved_adjusted, a CreditNote is auto-generated with the adjustment amount |
| `credit_note.created` | Credit note linked to query and customer. Can offset future invoices |

### Query Lifecycle

```
raised → investigating → resolved_adjusted (credit note generated)
                       → resolved_upheld (no financial adjustment)
```

---

## EDI Communication Hub

### Universal Inbound Processing

All inbound EDI is processed through the **universal inbound endpoint** (`POST /api/v1/edi/inbound`). The endpoint auto-detects the transaction type, validates partner support, routes to the correct handler, logs to `EdiTransactionLog`, and auto-generates 997 acknowledgments.

**Flow:** SFTP poll (edi-collector) or API POST → `/api/v1/edi/inbound` → `EdiRouterService` detects type → route to handler → log result → send 997 ack if configured

### Inbound Transaction Types

| Type | Parser | Route | Handler Action |
|------|--------|-------|----------------|
| 850 | `EDI850ParseService` | `/api/v1/orders/import/edi` | Parse PO, create Orders |
| 990 | `EDI990ParseService` | `/api/v1/edi/tender/990` | Parse accept/decline, submit bid or decline offer |
| 997 | `EDI997Service.parse997()` | `/api/v1/edi/997/inbound` | Parse ack, update original outbound log |
| 214 | `EDI214ParseService` | `/api/v1/edi/214/inbound` | Parse status, update Shipment via `ProcessInbound214Command` |
| 210 | `EDI210ParseService` | `/api/v1/edi/210/inbound` | Parse freight invoice, `ReceiveCarrierInvoiceCommand`, three-way match |
| 820 | `EDI820ParseService` | `/api/v1/edi/820/inbound` | Parse remittance, `RecordPaymentCommand` per invoice |

### Outbound Transaction Types

| Type | Generator | Trigger |
|------|-----------|---------|
| 204 | `EDI204Service` | Tender opened (manual via API) |
| 214 | `EDI214Service` | Inbound 214 received → `Edi214ForwardHandler` auto-forwards to customer |
| 810 | `EDI810Service` | Invoice sent → `Edi810AutoSendHandler` sends to customer partner |
| 856 | `EDI856Service` | Shipment delivered → `Edi856AutoSendHandler` sends to customer partner |
| 997 | `EDI997Service` | Any inbound processed → auto-ack if partner config `ack997Required` |

### EDI Events

| Event | Trigger | Side Effects |
|-------|---------|-------------|
| `edi_status.received` | Inbound 214 processed | `Edi214ForwardHandler` auto-forwards to customer partners |
| `edi_status.sent` | Outbound 214 delivered | Logged to `EdiTransactionLog` |
| `edi.file_received` | Any inbound EDI processed | Generic tracking |
| `edi.file_sent` | Any outbound EDI delivered | Generic tracking |
| `edi.file_failed` | Parse or delivery failure | Error logged |
| `shipment.delivered` | Shipment delivery confirmed | `Edi856AutoSendHandler` sends 856 to customer partners |
| `invoice.sent` | Invoice sent to customer | `Edi810AutoSendHandler` sends 810 to customer partners |

### Shared X12 Infrastructure

All EDI generators use `X12EnvelopeBuilder` for ISA/GS/ST/SE/GE/IEA envelope construction. All parsers use `X12EnvelopeParser` for envelope validation and body segment extraction. Generators have `validateAndGenerate()` methods returning `EdiOperationResult<T>` with errors/warnings instead of crashing.

### Logging

All EDI operations log to `EdiTransactionLog` with: transaction type, direction, partner, raw content, file hash (dedup), parse result, created entities, 997 ack status, retry count. The unified log viewer at `/integrations/edi/logs` shows all types in one table.

---

## Trading Partners

### Commands

| Command | Trigger | Events Emitted |
|---------|---------|----------------|
| `CreateTradingPartnerCommand` | `POST /api/v1/trading-partners` | `trading_partner.created` |
| `UpdateTradingPartnerCommand` | `PUT /api/v1/trading-partners/:id` | `trading_partner.updated` |

### Connection Testing

`POST /api/v1/trading-partners/:id/test-connection` tests SFTP (connect + list directory) or HTTP (HEAD request with auth) and returns success/failure with details.

---

## Devices (IoT)

### Commands

| Command | Trigger | Events Emitted |
|---------|---------|----------------|
| `CreateDeviceCommand` | `POST /api/v1/devices` | `device.created` |
| `UpdateDeviceCommand` | `PUT /api/v1/devices/:id` | `device.updated` |
| `AssignDeviceCommand` | `POST /api/v1/devices/:id/assign` | `device.assigned` |

### Side Effects

| Event | What Happens |
|-------|-------------|
| `device.assigned` | Previous assignment deactivated, new assignment created |
| `device.unassigned` | Assignment deactivated |

---

## Cargo Tracking

### Commands

| Command | Trigger | Events Emitted |
|---------|---------|----------------|
| `RecordCargoScanCommand` | `POST /api/v1/cargo-scans` | `cargo.scan_recorded` |

### Auto-Generated Events (from CargoReconciliationService)

| Event | Trigger |
|-------|---------|
| `cargo.misdrop_detected` | Scan at wrong stop |
| `cargo.missing_at_stop` | Expected unit not scanned at stop |
| `cargo.left_on_vehicle` | Unit not delivered after final stop |
| `cargo.discrepancy_resolved` | Manual resolution of discrepancy |

---

## Carrier Users

### Commands

| Command | Trigger | Events Emitted |
|---------|---------|----------------|
| `CreateCarrierUserCommand` | `POST /api/v1/carriers/:carrierId/users` | `carrier_user.created` |

---

## Read Models

Read models are flat, denormalized tables optimized for list queries with zero joins.

| Read Model | Source Events | Key Denormalized Fields |
|-----------|--------------|------------------------|
| `OrderReadModel` | `order.*` | customerName, originCity, destinationCity, shipmentReference, trackableUnitCount, totalWeight |
| `ShipmentReadModel` | `shipment.*`, `tracking.*` | customerName, originCity, destinationCity, carrierName, currentLat/Lng, orderCount, stopCount |
| `CarrierReadModel` | `carrier.*` | vehicleCount, driverCount, activeLaneCount, validationTier |
| `CustomerReadModel` | `customer.*`, `order.created` | activeOrderCount, totalOrderCount |
| `LaneReadModel` | `lane.*` | originName/City, destinationName/City, carrierCount, activeShipmentCount |
| `IssueReadModel` | `issue.*` | assigneeName, escalatedTo, resolvedAt |

### Backfill

After deploying new read models, run:
```bash
npx tsx backend/src/scripts/backfill-read-models.ts
```
This populates read models from existing write model data. After backfill, projections keep them in sync via events.

---

## Event Envelope

Every event follows this structure:

```typescript
{
  id: "uuid",                        // Unique event ID
  type: "shipment.status_changed",   // entity.action format
  timestamp: "ISO-8601",
  orgId: "uuid",                     // Multi-tenant scope
  actorId: "uuid | null",            // Who caused it
  entityType: "shipment",
  entityId: "uuid",
  payload: { ... },                  // Event-specific data
  metadata: {
    correlationId: "uuid",           // Traces chain of related events
    causationId: "uuid",             // Which event caused this one
    source: "api | worker | webhook",
    schemaVersion: 1
  }
}
```

### Event Export

All events are queryable via the API:
- `GET /api/v1/events?type=shipment.*&since=2026-01-01T00:00:00Z`
- `GET /api/v1/events?afterId=<cursor>&limit=1000` (for warehouse pulls)
- `GET /api/v1/events/stats?since=<timestamp>` (counts by type)
- `GET /api/v1/events/:entityType/:entityId` (entity history)

---

## Monitoring

### Metrics Endpoint

`GET /metrics` returns:
- **Event throughput**: total events, events in last hour, breakdown by type
- **Read model lag**: write model count vs read model count per entity
- **Projection checkpoints**: last processed event per projection
- **Queue depths**: per-handler queue stats

### Configurable Concurrency

Scale handler throughput via environment variables:

| Variable | Default | Affects |
|----------|---------|---------|
| `PROJECTION_CONCURRENCY` | 3 | All 6 projection handlers |
| `AUDIT_CONCURRENCY` | 5 | AuditHandler |
| `EMAIL_CONCURRENCY` | 2 | EmailHandler |

---

## Cold Chain Profile

Cold chain profiles define allowable temperature and humidity bands for shipments carrying temperature-sensitive cargo.

### Commands

| Command | Trigger | Events Emitted |
|---------|---------|----------------|
| `cold_chain_profile.create` | `POST /api/v1/cold-chain-profiles` | `cold_chain_profile.created` |
| `cold_chain_profile.update` | `PUT /api/v1/cold-chain-profiles/:id` | `cold_chain_profile.updated` |

### Side Effects

| Event | What Happens |
|-------|-------------|
| `cold_chain_profile.created` | — |
| `cold_chain_profile.updated` | — |
| `cold_chain_profile.deactivated` | — |

---

## Cold Chain Monitoring

Monitors temperature telemetry on shipments, detects excursions, and manages the cold chain disposition lifecycle.

### Commands

| Command | Trigger | Events Emitted |
|---------|---------|----------------|
| `cold_chain.set_disposition` | `POST /api/v1/shipments/:id/cold-chain/disposition` | `cold_chain.disposition_changed` |

### Auto-Generated Events

| Event | Trigger |
|-------|---------|
| `cold_chain.temperature_logged` | IoT sensor telemetry ingested |
| `cold_chain.excursion_detected` | Temperature reading outside profile alert range |
| `cold_chain.excursion_acknowledged` | User acknowledges an active excursion |
| `cold_chain.excursion_resolved` | Temperature returns to acceptable range or manual resolution |

### Side Effects

| Event | What Happens |
|-------|-------------|
| `cold_chain.excursion_detected` | Auto-creates triage issue for critical severity excursions |
| `cold_chain.disposition_changed` | — |
| Shipment delivered | Compliance report PDF auto-generated on shipment delivered |

### Disposition Lifecycle

```
monitoring → pending_review → released
                            → quarantined
```

---

## Device Calibration

Tracks calibration records for IoT temperature/humidity devices used in cold chain monitoring.

### Commands

| Command | Trigger | Events Emitted |
|---------|---------|----------------|
| `device.record_calibration` | `POST /api/v1/devices/:id/calibrations` | `device.calibration_recorded` |

### Auto-Generated Events

| Event | Trigger |
|-------|---------|
| `device.calibration_expired` | Calibration expiry date reached |

### Side Effects

| Event | What Happens |
|-------|-------------|
| `device.calibration_recorded` | — |
| `device.calibration_expired` | — |

---

## CAPA Report

Corrective and Preventive Action reports for documenting and resolving cold chain quality incidents.

### Commands

| Command | Trigger | Events Emitted |
|---------|---------|----------------|
| `capa.create` | `POST /api/v1/capa-reports` | `capa.created` |
| `capa.update` | `PUT /api/v1/capa-reports/:id` | `capa.updated` |

### Smart Event Selection

UpdateCapaCommand emits different events based on what changed:
- Status changed: emits `capa.status_changed`
- Status → approved: emits `capa.approved`
- Status → verified: emits `capa.verified`
- Other fields only: emits `capa.updated`

### Side Effects

| Event | What Happens |
|-------|-------------|
| `capa.created` | — |
| `capa.updated` | — |
| `capa.status_changed` | — |
| `capa.approved` | — |
| `capa.verified` | — |

---

## Quality Centre

The Quality Centre provides aggregated quality metrics, CAPA follow-up management, and SOP/GDP audit capabilities.

### Quality Issue Summary (Projection)

The `QualityIssueSummaryProjection` maintains aggregated issue metrics by dimension (carrier, lane, location, customer). On every issue event, it resolves the source shipment's linked carrier, lane, origin/destination locations, and customer, then upserts the corresponding `QualityIssueSummary` rows with updated counts.

### CAPA Follow-Ups

| Command | Trigger | Events Emitted |
|---------|---------|----------------|
| `capa_follow_up.create` | `POST /api/v1/quality/capa-follow-ups` | `capa.follow_up_created` |
| `capa_follow_up.complete` | `PUT /api/v1/quality/capa-follow-ups/:id/complete` | `capa.follow_up_completed` |

Follow-up types: `30_day`, `60_day`, `90_day`, `ad_hoc`, `effectiveness_check`
Outcomes: `on_track`, `needs_attention`, `escalated`, `closed_effective`, `closed_ineffective`

The `POST /api/v1/quality/capa-follow-ups/schedule` endpoint auto-creates 30, 60, and 90-day follow-ups from the CAPA creation date.

### SOP Checklists & Audits

| Command | Trigger | Events Emitted |
|---------|---------|----------------|
| `sop_checklist.create` | `POST /api/v1/quality/sop-checklists` | `sop_checklist.created` |
| `sop_audit.start` | `POST /api/v1/quality/sop-audits` | `sop_audit.started` |
| `sop_audit.complete` | `PUT /api/v1/quality/sop-audits/:id/complete` | `sop_audit.completed` or `sop_audit.failed` |

Audit scoring: pass rate calculated from responses. Critical item failure automatically fails the entire audit. Passing threshold: 80% with no critical failures.

### Side Effects

| Event | What Happens |
|-------|-------------|
| `issue.*` (created/updated/closed/resolved/needs_capa_marked) | `QualityIssueSummaryProjection` rebuilds aggregated metrics for linked carrier/lane/location/customer |
| `capa.follow_up_created` | -- |
| `capa.follow_up_completed` | -- |
| `sop_audit.completed` | Updates checklist `lastCompletedAt` |
| `sop_audit.failed` | Updates checklist `lastCompletedAt` |

---

## ETA Monitoring

The ETA monitor is a cron-driven background service (not a CQRS command) that checks in-transit shipments against traffic-aware routing APIs. It runs via pg-boss schedule and publishes events through the standard event bus.

### Trigger

pg-boss cron schedule (default: every 10 minutes). Can also be triggered manually via `POST /api/v1/eta-monitor/run`.

### Process

1. Query all in-transit shipments (status: `in_transit`, `dispatched`, `picked_up`, `at_stop`)
2. Apply adaptive polling filter (skip stale GPS, parked trucks, distant shipments based on time-to-delivery)
3. For each qualifying shipment:
   - Get current GPS position from ShipmentReadModel
   - Get next pending stop's location coordinates
   - Call routing provider (TomTom/HERE/Valhalla) with traffic-aware ETA request
   - Compare new ETA against scheduled `ShipmentStop.estimatedArrival`
   - Update `ShipmentStop.estimatedArrival` with routing-based ETA

### Events Emitted

| Condition | Event | Payload |
|-----------|-------|---------|
| Delay >= 15 min | `tracking.eta_updated` | `{ shipmentId, shipmentReference, previousEta, newEta, delayMinutes, severity, nextStopName, trafficDelaySeconds, provider }` |
| Delay >= 60 min (critical) | `shipment.exception` | `{ shipmentReference, exceptionType: "eta_critical_delay", description }` |

### Side Effects

| Event | What Happens |
|-------|-------------|
| `tracking.eta_updated` | InAppNotificationHandler creates severity-based notifications (info/warning/error) for all org users |
| `shipment.exception` | InAppNotificationHandler creates error notification; EmailHandler sends exception email (if configured); AuditHandler logs to immutable audit trail |

### Configuration (env vars)

| Variable | Default | Description |
|----------|---------|-------------|
| `ROUTING_PROVIDER` | `none` | Provider: `here`, `tomtom`, `valhalla` |
| `ETA_MONITOR_CRON` | `*/10 * * * *` | Cron schedule |
| `ETA_DELAY_THRESHOLD_MINUTES` | `15` | Minor delay threshold |
| `ETA_WARNING_THRESHOLD_MINUTES` | `30` | Warning threshold |
| `ETA_CRITICAL_THRESHOLD_MINUTES` | `60` | Critical threshold (triggers shipment.exception) |
| `ETA_STALE_GPS_THRESHOLD_MINUTES` | `60` | Skip shipments with GPS older than this |

---

## Route Deviation Alerts

The route deviation system detects when an in-transit shipment deviates from a planned lane route. Routes are defined per-lane using Google Maps Directions API and stored as encoded polylines with a configurable deviation corridor.

### Lane Route Model

Each lane can have one planned route (`LaneRoute`) containing:
- **encodedPolyline** - Google-encoded polyline string of the planned path
- **waypoints** - JSON array of `{lat, lng}` for quick access
- **distanceMeters / durationSeconds** - Route metadata from Google Maps
- **corridorMeters** - Max distance from route before alerting (default: 5000m)
- **summary** - Google's route summary (e.g., "via I-95 N")

### Route Planning (Frontend)

Users create planned routes on the lane create/edit page:
1. Select origin and destination locations (must have lat/lng coordinates)
2. Add intermediate stops for hub-and-spoke routing (these become waypoints)
3. Google Maps renders a draggable DirectionsRenderer on the map
4. Users can drag the route line to adjust the planned path
5. Distance, duration, and corridor are saved with the lane route

**Requires:** Google Maps API key configured in Admin > Map Settings.

### Deviation Detection

During each ETA monitor cycle, for shipments with a `laneId` that has a `LaneRoute`:
1. Get the shipment's current GPS position from ShipmentReadModel
2. Find the nearest point on the planned route polyline (point-to-segment projection)
3. Calculate haversine distance from current position to nearest route point
4. Compare against the lane route's `corridorMeters` threshold

### Events Emitted

| Condition | Event | Payload |
|-----------|-------|---------|
| Distance > corridor (warning) | `tracking.route_deviation` | `{ shipmentId, shipmentReference, laneId, laneName, currentLat, currentLng, deviationMeters, corridorMeters, severity: "warning", nearestRouteLat, nearestRouteLng }` |
| Distance > 2x corridor (critical) | `tracking.route_deviation` + `shipment.exception` | Same as above with `severity: "critical"` + exception event |

### Side Effects

| Event | What Happens |
|-------|-------------|
| `tracking.route_deviation` | InAppNotificationHandler creates deviation notification; Triage agent evaluates for auto-issue creation |
| `shipment.exception` (route_deviation) | Full exception flow: notification, audit, email, triage agent evaluation |

### API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/lanes/:laneId/route` | Get planned route for a lane |
| PUT | `/api/v1/lanes/:laneId/route` | Save/update planned route |
| DELETE | `/api/v1/lanes/:laneId/route` | Delete planned route |
| POST | `/api/v1/lanes/:laneId/route/calculate` | Preview route via Google Maps (not saved) |
| POST | `/api/v1/lanes/:laneId/route/check-deviation` | Check if a position deviates from route |
| GET | `/api/v1/lanes/:laneId/route/google-maps-status` | Check if Google Maps API key is configured |

### Key Files

- `backend/prisma/schema.prisma` - LaneRoute model
- `backend/src/services/routing/GoogleMapsDirectionsService.ts` - Google Maps Directions API + polyline encode/decode
- `backend/src/services/routing/RouteDeviationService.ts` - Point-to-polyline deviation detection
- `backend/src/services/routing/ShipmentEtaMonitorService.ts` - Integrated deviation checking during ETA monitor runs
- `backend/src/routes/laneRoutes.ts` - Lane route API endpoints
- `frontend/src/components/GoogleMapsRouteEditor.tsx` - Draggable Google Maps route editor
- `frontend/src/vnext-design/VNextCreateLane.tsx` - Lane create/edit with route planning
- `frontend/src/vnext-design/VNextLaneDetail.tsx` - Lane detail with route visualization
- `frontend/src/vnext-design/VNextShipmentDetail.tsx` - Route deviation alert banner on shipment detail

---

## Warehouse App

The warehouse app is a mobile-first sub-application for warehouse operatives to "launch" shipments — preparing them for dispatch by assigning IoT trackers, accessories, and verifying details.

### Auth: Magic Links

Magic links are persistent, reusable tokens encoded in QR codes for wall-mounting in warehouses.

| Action | API | What Happens |
|--------|-----|-------------|
| Generate Magic Link | `POST /api/v1/warehouse/auth/magic-link/generate` | Creates SHA-256 hashed token, deactivates previous links for user |
| Validate Magic Link | `POST /api/v1/warehouse/auth/magic-link/validate` | Verifies hash, checks expiry, logs to LoginAuditLog, returns user data |
| Password Login | `POST /api/v1/warehouse/auth/login` | Standard login with lockout (5 attempts → 15 min), logs to LoginAuditLog |
| Revoke Magic Links | `DELETE /api/v1/warehouse/auth/magic-link/:userId` | Deactivates all active magic links for user |

### Login Audit Log

Every login attempt (success or failure) is recorded in `LoginAuditLog` with:
- `method`: password, magic_link, oauth_google, oauth_microsoft
- `success`: boolean
- `failReason`: user_not_found, invalid_password, locked, expired_link, inactive_link
- `ipAddress`, `userAgent`: client metadata

### Shipment Launch Workflow

```
Shipment (draft) → Warehouse Operative opens detail
                  → Step 1: Assign IoT trackers (scan barcode → device lookup → assign)
                  → Step 2: Add accessories (temp sensors, door seals)
                  → Step 3: Pair trackable units with IoT devices
                  → Step 4: Review & Launch
                  → Shipment marked as launched (launchedAt, launchedBy set)
                  → Status transitions from "draft" to "ready"
                  → Geofence exit will later transition to "in_transit"
```

### Shipment Flags

Users cannot edit shipment details — they flag issues instead.

| Action | API | What Happens |
|--------|-----|-------------|
| Flag Issue | `POST /api/v1/warehouse/shipments/:id/flag` | Creates ShipmentFlag record with reason, user info |
| Resolve Flag | `PUT /api/v1/warehouse/shipments/:shipmentId/flags/:flagId/resolve` | Marks flag resolved, records resolver |
| Launch Check | `POST /api/v1/warehouse/shipments/:id/launch` | Blocks launch if unresolved flags exist |

### Device Assignment (Scanning)

| Action | API | What Happens |
|--------|-----|-------------|
| Lookup Device | `GET /api/v1/warehouse/devices/lookup?barcode=X` | Finds by externalId, displayId, or name |
| Assign to Shipment | `POST /api/v1/warehouse/shipments/:id/assign-device` | Deactivates previous assignment, creates new |
| Assign to Unit | Same endpoint with `trackableUnitId` | Links device to specific pallet/tote |
| Remove Device | `DELETE /api/v1/warehouse/shipments/:id/devices/:deviceId` | Soft-deactivates assignment |

### Accessories

Accessories are physical items attached to shipments (BLE sensors, door seals).

Types: `temp_sensor_front`, `temp_sensor_middle`, `temp_sensor_back`, `door_sensor`, `door_seal`, `ble_tracker`

| Action | API | What Happens |
|--------|-----|-------------|
| Add Accessory | `POST /api/v1/warehouse/shipments/:id/accessories` | Creates ShipmentAccessory record |
| Remove Accessory | `DELETE /api/v1/warehouse/shipments/:id/accessories/:id` | Hard deletes record |

### WiFi Connectivity Monitoring

`POST /api/v1/warehouse/connectivity` — Logs `wifi_lost`, `wifi_restored`, `slow_connection` events. Fire-and-forget from the frontend when `navigator.onLine` changes. Used for operational diagnostics.

### Shipment Lifecycle (Warehouse Perspective)

```
draft ──(warehouse launch)──→ ready ──(geofence exit)──→ in_transit ──→ delivered
  │                             │
  └──(idle >2 days)──→ archive  └──(warehouse app shows as "launched")
```

Launched shipments drop off the active list. Stale shipments (>2 days in draft without launch) appear on the archive screen.

---

## SLA (Service Level Agreements)

### Commands

| Command | Type String | What It Does |
|---------|-------------|--------------|
| CreateSlaPolicyCommand | `sla_policy.create` | Creates a policy with nested rules. Scoped to org (default) or customer (override). |
| UpdateSlaPolicyCommand | `sla_policy.update` | Updates policy fields and replaces rules wholesale. |
| DeactivateSlaPolicyCommand | `sla_policy.deactivate` | Sets `active = false`. Existing evaluations continue but no new ones are created. |

### Events

| Event | When It Fires | Side Effects |
|-------|---------------|--------------|
| `sla_policy.created` | Policy created | Audit log |
| `sla_policy.updated` | Policy or rules changed | Audit log |
| `sla_policy.deactivated` | Policy deactivated | Audit log |
| `sla.evaluation_created` | New SLA evaluation started for a shipment or issue | In-app notification |
| `sla.warning` | Evaluation reaches warning threshold | In-app notification, email |
| `sla.breached` | Evaluation exceeds due date | In-app notification, email, auto-create issue (if configured) |
| `sla.met` | SLA satisfied before breach | In-app notification |

### SLA Evaluation Lifecycle

```
[entity created] ──→ SlaEvaluation(active) ──→ [warning threshold] ──→ warning
                                                                         ↓
                                              [due date passed] ──→ breached ──→ auto-create Issue
                                                                         
[entity resolved/delivered] ──→ met (SLA satisfied)
[entity cancelled] ──→ cancelled
```

### Policy Resolution (Two-Tier)

1. Look for `SlaPolicy` where `orgId = X AND customerId = entity.customerId AND active = true`
2. If not found, fall back to `SlaPolicy` where `orgId = X AND customerId IS NULL AND active = true`
3. If neither exists, no SLA enforcement for this entity

### Rule Types

| ruleType | Applies To | Clock Starts | Met When | Breach Threshold |
|----------|-----------|--------------|----------|-----------------|
| `eta_delivery` | Shipments | pickupDate | `shipment.delivered` | `maxDeliveryMinutes` |
| `issue_response` | Issues | issue.createdAt | `issue.assigned` / status → in_progress | `breachThresholdMinutes` |
| `issue_resolution` | Issues | issue.createdAt | `issue.resolved` | `breachThresholdMinutes` |
| `dwell_time` | Shipments | stop.actualArrival | stop completed (shipment departs) | `maxDwellMinutes` |
| `dock_turnaround` | Shipment Stops | stop.actualArrival | stop completed | `maxDwellMinutes` + `locationType` filter |
| `sort_to_dispatch` | Shipment Stops | stop.actualArrival (at cross-dock) | stop completed | `breachThresholdMinutes` + `locationType: cross_dock` |
| `facility_dwell` | Shipment Stops | stop.actualArrival | stop completed | `maxDwellMinutes` + `locationType` filter |
| `light_event` | Shipments | sensor reading | N/A (occurrence-based) | `maxOccurrences` |
| `seal_event` | Shipments | device event | N/A (occurrence-based) | `maxOccurrences` |
| `temperature_excursion` | Shipments | excursion.startedAt | excursion resolved | `maxExcursionMinutes` |
| `temperature_out_of_range` | Shipments | first out-of-range reading | N/A (cumulative) | `maxExcursionMinutes` |

### Breach → Issue Pipeline

When `autoCreateIssue = true` on the rule:
1. Creates an Issue with `category: 'compliance'`, priority from `issuePriorityOnBreach`
2. Links to source entity via `sourceEntityType` / `sourceEntityId`
3. Title: "SLA Breach: {ruleName} on {entityReference}"
4. Links back to the SlaEvaluation via `issueId`

### Event-Driven Automation (Phase 3b)

| Handler | Listens To | What It Does |
|---------|-----------|-------------|
| `AutoTenderHandler` | `shipment.created` | If org.autoTenderEnabled and shipment has no lane/carrier, creates a broadcast tender to all active carriers |
| `ShipmentCompletionHandler` | `shipment.stop_arrived`, `tracking.geofence_entered` | When destination stop arrives, auto-transitions shipment to 'delivered' and publishes shipment.delivered event |

### Location Auto-Resolution

When `CreateShipmentCommand` receives `originData`/`destinationData` (raw address objects) instead of explicit location IDs:
1. Searches for existing location by `name + city` (case-insensitive)
2. If found, reuses the existing location
3. If not found, creates a new `Location` record and emits `location.created` with `source: 'shipment_resolution'`
4. Default geofence arrival criteria are created for new locations (via `LocationResolutionService`)

When `LocationResolutionService.resolveOrCreate()` creates a new location (used by order creation, EDI import):
- Emits `location.created` with `source: 'resolution'` and the actor's ID
- Event is best-effort (location creation succeeds even if event publishing fails)
- The `AuditHandler` records the source in the audit log description

### Workers

| Worker | Queue | Schedule | What It Does |
|--------|-------|----------|-------------|
| SLA Monitor | `sla-monitor` | Every 2 min (configurable via `SLA_MONITOR_CRON`) | Sweeps active evaluations, transitions to warning/breached, auto-creates issues |

---

## Agent Decisions

Agent Decisions provide the compliance and audit layer for AI agent actions. Every decision made by an AI agent is logged with full context, and outcomes can be recorded after the fact. Decisions can also be promoted to serve as training examples or policy references.

### Commands

| Command | Type | Trigger | Events Emitted |
|---------|------|---------|----------------|
| `CreateAgentDecisionCommand` | `agent_decision.create` | `POST /api/v1/agent-decisions` | `agent_decision.created` |
| `RecordDecisionOutcomeCommand` | `agent_decision.record_outcome` | `PUT /api/v1/agent-decisions/:id/outcome` | `agent_decision.outcome_recorded` |
| `PromoteDecisionCommand` | `agent_decision.promote` | `POST /api/v1/agent-decisions/:id/promote` | `agent_decision.promoted` |

### Side Effects

| Event | Projection | Notification | Other |
|-------|-----------|--------------|-------|
| `agent_decision.created` | AgentDecisionReadModel upsert | -- | Audit log |
| `agent_decision.outcome_recorded` | AgentDecisionReadModel outcome update | -- | Audit log |
| `agent_decision.promoted` | AgentDecisionReadModel promotion flag | -- | Audit log |

### Triage Agent

The Triage Agent is an AI event handler (`TriageAgentHandler`) that subscribes to exception events and uses Claude to decide what action to take. It runs as a pg-boss worker job within the event handler infrastructure.

**Subscribed events:** `shipment.exception`, `sla.breached`, `cargo.misdrop_detected`, `cargo.missing_at_stop`, `cargo.left_on_vehicle`, `cold_chain.excursion_detected`

**Flow:**
1. Event arrives via pg-boss queue
2. Handler gathers context (shipment details, open issues, SLA evaluations)
3. Checks for recent duplicate decisions (30-min debounce window)
4. Calls Claude with structured prompt + context
5. Parses structured JSON response
6. Executes action: `create_issue`, `escalate_issue`, `contact_driver`, or `no_action`
7. Logs the full decision via `CreateAgentDecisionCommand`

**contact_driver action:** Gathers driver info from Shipment -> Load -> Driver. Creates or finds the related issue, then posts an agent comment with driver contact details (name, phone, email). Falls back to a "no driver assigned" message if no driver is linked to the shipment's load.

**Configuration:** Set `ANTHROPIC_API_KEY` env var to enable. Optionally set `ANTHROPIC_MODEL` (default: `claude-sonnet-4-20250514`) and `AGENT_TRIAGE_CONCURRENCY` (default: 2).

### Configurable Agent Prompts

Agent behaviour is configurable per-org via `AgentConfig` + versioned prompts (`AgentConfigVersion`). Each prompt change creates an immutable version linked to decisions via `promptVersionId`.

| Setting | Type | Default |
|---------|------|---------|
| System prompt | Text with `{{template}}` vars | Hardcoded triage prompt |
| Subscribed events | String[] | 6 exception events |
| Temperature | Float 0-1 | 0.2 |
| Max tokens | Int | 512 |
| Confidence threshold | Float 0-1 | 0 (accept all) |
| Deduplication window | Int (minutes) | 30 |

### Automation Rules

Deterministic rules promoted from agent decisions or created manually. Uses the same unified condition format as agent-extracted conditions.

| API | Method | Purpose |
|-----|--------|---------|
| `/api/v1/automation-rules` | GET | List rules |
| `/api/v1/automation-rules` | POST | Create rule |
| `/api/v1/automation-rules/:id` | PUT | Update rule |
| `/api/v1/automation-rules/:id/toggle` | POST | Enable/disable |
| `/api/v1/automation-rules/:id/test` | POST | Dry-run against sample event |
| `/api/v1/automation-rules/from-decision/:id` | POST | Create rule from promoted decision |

**Condition format:** `[{ field: "payload.delayMinutes", operator: "greaterThan", value: 60 }]`

**Operators:** equals, notEquals, contains, in, greaterThan, lessThan, greaterThanOrEqual, lessThanOrEqual, exists, notExists

**Rule suppresses agent:** When a rule matches, it writes an AgentDecision marker that prevents the triage agent from processing the same event (deduplication).

### Skills System

Extensible action framework for automation rules and skill chains.

**Built-in skills:**

| Skill | Category | Config Required | Fields |
|-------|----------|----------------|--------|
| `create_issue` | triage | No | title, description, priority, category |
| `escalate_issue` | triage | No | issueId, escalatedTo, reason |
| `add_comment` | triage | No | entityType, entityId, body |
| `contact_driver` | triage | No | shipmentId |
| `send_email` | communication | Yes (SMTP) | to, subject, body |
| `call_webhook` | integration | Yes (URL+auth) | body |

**Skill chains:** Ordered sequences of skill steps with question branching. Question nodes evaluate conditions and follow matched/unmatched branches. Steps support `{{template}}` variable syntax.

**Skill config:** Org-level configuration for skills needing API keys or webhook URLs. Managed via `SkillConfig` model and `/settings/skills` admin page.

---

## Carrier Tracking Integrations

Links carriers to external tracking APIs (FedEx, UPS, DHL, EasyPost, etc.) for automated shipment status updates.

### Commands

| Command | Events | Side Effects |
|---------|--------|-------------|
| `CreateCarrierTrackingIntegration` | `carrier_tracking.integration_created` | None |
| `UpdateCarrierTrackingIntegration` | `carrier_tracking.integration_updated` | None |
| `DeleteCarrierTrackingIntegration` | `carrier_tracking.integration_deleted` | Cascades: deletes related tracking events |
| `RecordCarrierTrackingEvent` | `carrier_tracking.update_received` + conditionally: `carrier_tracking.delivered` or `carrier_tracking.exception` | Writes CarrierTrackingEvent, bridges to shipment lifecycle |

### Provider Interface

`ICarrierTrackingProvider` - provider-agnostic interface (same pattern as `IRoutingProvider`):
- `authenticate(credentials)` - OAuth token management or API key setup
- `pollTracking(trackingNumbers[])` - pull status updates in batch
- `parseWebhook(payload, headers)` - normalize inbound webhook payloads
- `verifyWebhookSignature(body, signature, secret)` - validate webhook authenticity

### Supported Providers

| Provider | Auth | Webhooks | Polling | Batch Size |
|----------|------|----------|---------|------------|
| FedEx | OAuth 2.0 | Yes | Yes | 30 |
| UPS | OAuth 2.0 | Yes | Yes | 1 |
| DHL | API Key | Yes | Yes | 1 |
| EasyPost | API Key | Yes | Yes | 1 |
| EDI 214 | N/A (via TradingPartner) | Push (EDI) | No | N/A |

### Normalized Status Codes

All providers map to 7 standard statuses: `info_received`, `in_transit`, `out_for_delivery`, `delivered`, `exception`, `return_to_sender`, `unknown`.

### Event Handler Side Effects

The `CarrierTrackingHandler` bridges carrier tracking events to the shipment lifecycle:

| Event | Side Effect |
|-------|-------------|
| `carrier_tracking.delivered` | Updates shipment status to `delivered`, emits `shipment.delivered` + `shipment.status_changed` |
| `carrier_tracking.exception` | Updates shipment status to `exception`, emits `shipment.exception` + `shipment.status_changed` |
| `carrier_tracking.update_received` (in_transit) | Advances shipment status forward (draft -> in_transit), emits `shipment.status_changed` |
| `carrier_tracking.integration_error` | Sets integration status to `error`, pauses polling |

Status bridging rules:
- Delivery only applied to shipments in `in_transit`, `dispatched`, or `picked_up` status
- Exception not applied to already-delivered shipments
- Status never regresses (e.g., in_transit will not go back to draft)
- Delivered and exception events from `update_received` are handled by their dedicated handlers

### Polling Worker

`carrierTrackingPollWorker` runs every 5 minutes (configurable via `CARRIER_TRACKING_POLL_CRON`). Polls active integrations that have exceeded their polling interval. Respects per-provider rate limits.

### Key Files
- `backend/src/services/carrierTracking/ICarrierTrackingProvider.ts` - Provider interface
- `backend/src/services/carrierTracking/CarrierTrackingService.ts` - Orchestrator
- `backend/src/services/carrierTracking/ProviderRegistry.ts` - Provider factory
- `backend/src/services/carrierTracking/providers/` - FedEx, UPS, DHL implementations
- `backend/src/repositories/CarrierTrackingIntegrationRepository.ts` - Integration CRUD
- `backend/src/routes/carrierTracking.ts` - API endpoints
- `backend/src/workers/carrierTrackingPollWorker.ts` - Polling cron
- `frontend/src/vnext-design/VNextCarrierTracking.tsx` - Integration list
- `frontend/src/vnext-design/VNextCarrierTrackingSetup.tsx` - Setup wizard
- `frontend/src/vnext-design/VNextCarrierTrackingDetail.tsx` - Integration detail

---

## Brokerage Operations

### Organization Type

The `Organization` model has an `organizationType` field that determines the UI experience and available features. Valid values: `shipper` (default), `broker`, `carrier`, `3pl`.

Broker and 3PL organizations get:
- Load Board in sidebar navigation
- Margin columns on shipment list (on by default)
- Brokerage settings tab in admin (MC number, bond, operating authority, margin alerts)

### Margin Alert

**Event:** `margin.alert`

**Trigger:** `MarginAlertHandler` subscribes to `charge.created` and `charge.approved` events. When a charge is created or approved, it checks the shipment's `ShipmentFinancialSummary` margin against the org's `minMarginPercent` threshold.

**Side Effects:**
- Creates an Issue with category `margin_alert` and priority based on severity (negative margin = critical, low margin = high)
- Deduplicates: will not create a second alert if an open margin_alert issue already exists for the shipment

**Configuration:** Set `marginAlertEnabled = true` and `minMarginPercent` on the Organization model via Settings > Brokerage.

### Load Board

**Endpoint:** `GET /api/v1/loadboard`

Returns shipments where `carrierId IS NULL` and `status IN ('booked', 'confirmed', 'ready', 'pending')`, ordered by pickup date. Includes customer, origin/destination, lane, financial summary, and active tenders.

**Endpoint:** `GET /api/v1/loadboard/:shipmentId/matching-carriers`

Finds carriers with:
1. Lane rates (LaneCarrier records) for the shipment's lane
2. Historical usage (previously assigned to shipments on the same lane)
3. Tender acceptance stats (total bids, accepted bids, acceptance rate %)

**Endpoint:** `POST /api/v1/loadboard/:shipmentId/assign`

Quick-assigns a carrier with a cost rate. In a single transaction:
1. Sets `carrierId` on the shipment
2. Creates an approved cost charge (linehaul) for the agreed rate
3. Updates `ShipmentFinancialSummary` with the new cost

### ShipmentReadModel Financial Columns

The `ShipmentProjection` subscribes to `charge.*` events in addition to `shipment.*` and `tracking.*`. On charge events, it denormalizes the `ShipmentFinancialSummary` fields (expectedRevenueCents, expectedCostCents, expectedMarginCents, actualRevenueCents, actualCostCents, actualMarginCents) into the `ShipmentReadModel` for fast list queries.

### Quick Quote

**Endpoint:** `POST /api/v1/quotes/quick`

Given a `customerId`, `laneId`, and optional `carrierId`/`markupPercent`, auto-populates a quote from `RatingService` lane-carrier rates. Calculates cost (carrier buy rate) and revenue (cost + markup %) line items, then dispatches `CreateQuoteCommand`. Returns the created quote plus a cost/revenue breakdown with margin.

### Quote-to-Book (Broker Flow)

**Endpoint:** `POST /api/v1/quotes/:id/accept` with `{ createShipment: true }`

When `createShipment` is true and the org type is broker or 3PL, the `AcceptQuoteCommand` additionally:
1. Creates a Shipment (status: `booked`, no carrier) from the quote's origin/destination
2. Links Order to Shipment via `OrderShipment`
3. Creates a `ShipmentFinancialSummary` with expected revenue from the quote
4. Copies revenue charges to the shipment
5. Emits `SHIPMENT_CREATED` event (shipment appears on load board for carrier assignment)

The frontend "Accept & Book" button (visible for broker orgs) triggers this flow and navigates to the load board.

### Customer Credit Check

**Endpoint:** `GET /api/v1/customers/:id/credit-status?additionalAmountCents=N`

`CreditCheckService` sums unpaid invoices (draft, approved, sent, overdue, partial) and compares against `Customer.creditLimitCents`. Returns pass/fail with outstanding balance and available credit. Null credit limit = unlimited.

### Rate Confirmation PDF

**Endpoint:** `POST /api/v1/documents/rate-confirmation`

Generates a carrier-facing PDF showing the agreed carrier rate (cost charges only). Does NOT show customer sell rate or broker margin. Uses the same `DocumentGenerationService` + Handlebars template pattern as BOL/customs forms. Stored via `IBinaryStorageProvider` as a `GeneratedDocument` (documentType: `rate_confirmation`).

### Roles & Permissions (RBAC)

**System:** Full RBAC with Role model containing JSON permission arrays. Permissions follow `resource:action` format with wildcard support (`*` for all, `resource:*` for all actions on a resource).

**System Roles:**
| Role | Description | Key Permissions |
|------|-------------|----------------|
| `admin` | Full system access | `*` |
| `broker_admin` | Brokerage administrator | All ops + settings + users |
| `broker_agent` | Sales rep / agent | Loadboard, quotes, margins - no settings/users |
| `dispatcher` | Operational user | Shipments, orders, tendering, loadboard |
| `finance` | Financial operations | Quotes, invoices, charges, reports |
| `warehouse` | Warehouse operator | Shipment read/write, devices |
| `readonly` | Read-only access | All `:read` and `:view` permissions |

**Broker-Specific Permissions:** `loadboard:read`, `loadboard:assign`, `margin:view`, `credit:check`, `rate_confirmation:generate`

**Seeding:** `POST /api/v1/roles/seed` creates or updates system roles (idempotent). Custom roles can be created via the Roles CRUD API.

**Middleware:** `requirePermission(...perms)` in `jwtAuth.ts` checks JWT permissions. `optionalAuth` sets `req.user` when token present without blocking unauthenticated requests.

### Margin Reports

Four report endpoints in `brokerReports.ts`:
- `GET /api/v1/reports/margin/by-customer` - Revenue, cost, margin by customer with target margin variance
- `GET /api/v1/reports/margin/by-carrier` - Revenue, cost, margin by carrier
- `GET /api/v1/reports/margin/by-lane` - Revenue, cost, margin by lane
- `GET /api/v1/reports/margin/over-time` - Margin trends with daily/weekly/monthly granularity

All support `dateFrom`/`dateTo` query parameters. Customer report includes `targetMarginPercent` and `varianceFromTarget` fields.

### Target Margin

- `Customer.targetMarginPercent` - Per-customer target margin (e.g., 15.00%)
- `LaneCarrier.targetMarginPercent` - Per-lane-carrier target margin

Used in margin reports to show variance (actual margin % - target %).

### Commission Tracking

**Model:** `Commission` with `userId` (broker agent), `shipmentId`, `basisType` (margin or revenue), `commissionPercent`, computed `commissionCents`, and lifecycle: accrued -> approved -> paid.

**Endpoints:**
- `GET /api/v1/commissions` - List with filters (userId, shipmentId, status)
- `POST /api/v1/commissions` - Create (auto-computes amount from ShipmentFinancialSummary)
- `POST /api/v1/commissions/:id/approve` - Approve
- `POST /api/v1/commissions/:id/pay` - Mark paid
- `GET /api/v1/commissions/summary` - Totals grouped by agent

### Carrier Quick Pay

**Endpoint:** `POST /api/v1/carrier-invoices/:id/quick-pay`

Requests accelerated payment on a carrier invoice with a discount. Sets `quickPayRequested`, `quickPayDiscountPct`, `quickPayDiscountCents` (computed), and `quickPayDueDate` (today + N days).

### Key Files
- `backend/src/auth/permissions.ts` - Permission constants and system role definitions
- `backend/src/auth/seedRoles.ts` - Role seeding service
- `backend/src/routes/roles.ts` - Roles CRUD API (list, create, update, delete, assign/remove user)
- `backend/src/middleware/jwtAuth.ts` - JWT auth + requirePermission middleware
- `frontend/src/hooks/useCurrentUser.ts` - Frontend role/permission hook
- `frontend/src/vnext-design/VNextRoles.tsx` - Roles management admin page
- `backend/prisma/schema.prisma` - Organization brokerage fields, ShipmentReadModel financial columns
- `backend/src/routes/loadboard.ts` - Load board API (list, matching carriers, quick assign)
- `backend/src/routes/quotes.ts` - Quick quote + credit check endpoints
- `backend/src/routes/organization.ts` - Organization settings (includes brokerage fields)
- `backend/src/services/CreditCheckService.ts` - Customer credit validation
- `backend/src/services/templates/rateConfirmationTemplate.ts` - Rate confirmation Handlebars template
- `backend/src/services/DocumentGenerationService.ts` - Rate confirmation PDF generation
- `backend/src/commands/quotes/AcceptQuoteCommand.ts` - Quote-to-book with shipment creation
- `backend/src/events/handlers/MarginAlertHandler.ts` - Margin alert event handler
- `backend/src/events/projections/ShipmentProjection.ts` - Financial column denormalization
- `backend/src/events/eventTypes.ts` - margin.alert event type
- `frontend/src/vnext-design/VNextLoadBoard.tsx` - Load board page
- `frontend/src/vnext-design/VNextShipments.tsx` - Margin columns on shipment list
- `frontend/src/vnext-design/VNextFinanceQuoteDetail.tsx` - Accept & Book button for brokers
- `frontend/src/vnext-design/VNextShipmentDetail.tsx` - Rate Confirmation button
- `frontend/src/vnext-design/VNextSettings.tsx` - Brokerage settings tab
- `frontend/src/hooks/useOrgContext.ts` - Organization context hook
- `backend/src/__tests__/handlers/MarginAlertHandler.test.ts` - 8 margin alert tests
- `backend/src/__tests__/projections/ShipmentProjectionFinancial.test.ts` - 5 projection tests
- `backend/src/__tests__/services/CreditCheckService.test.ts` - 7 credit check tests
- `backend/src/__tests__/commands/BrokerQuoteToBook.test.ts` - 5 quote-to-book tests
- `backend/src/routes/brokerReports.ts` - Margin reports (by customer/carrier/lane/time)
- `backend/src/routes/commissions.ts` - Commission CRUD + summary
- `backend/src/routes/carrierInvoices.ts` - Quick pay endpoint
- `frontend/src/vnext-design/VNextMarginReports.tsx` - Margin reports page
- `frontend/src/vnext-design/VNextCommissions.tsx` - Commission management page

---

## Warehouse Management System (WMS)

### Domain: Warehouse Zones & Bins

Manages the physical location hierarchy within warehouses: zones (logical areas), aisles, and bins (individual storage locations).

### Commands
- `warehouse_zone.create` - Create a zone within a location (type, temperature, hazmat, capacity)
- `warehouse_zone.update` - Update zone properties
- `warehouse_bin.create` - Create a single bin within a zone
- `warehouse_bin.update` - Update bin properties (label uniqueness enforced on rename)
- `warehouse_bin.bulk_create` - Generate bins from a label pattern ({aisle}-{row}-{level}) with ranges; max 10,000 per batch

### Events
- `warehouse_zone.created`, `warehouse_zone.updated`, `warehouse_zone.archived`
- `warehouse_bin.created`, `warehouse_bin.updated`, `warehouse_bin.archived`, `warehouse_bin.bulk_created`

### Side Effects
- None (pure CRUD, no projections or downstream handlers yet)

---

### Domain: Receiving

Manages inbound goods - dock appointments, receiving tasks, and line-by-line item verification.

### Commands
- `receiving_task.create` - Create a receiving task (ASN-based with expected lines, or blind). Auto-updates linked appointment status.
- `receiving_line.record` - Record a received item against an existing line (ASN) or create a new line (blind). Auto-starts task on first line recorded.
- `receiving_task.complete` - Complete receiving, tally totals, auto-generate putaway tasks for units with trackableUnitIds. Evaluates putaway rules for directed routing, falls back to first available bulk bin.

### Events
- `receiving_appointment.created`, `receiving_appointment.checked_in`
- `receiving_task.created`, `receiving_task.started`, `receiving_task.completed`
- `receiving_line.recorded`, `receiving_line.inspected`
- `putaway_task.created` (emitted by CompleteReceiving for each generated putaway task)

### Side Effects
- CompleteReceiving generates PutawayTasks using PutawayRule evaluation
- Appointment status auto-updated on task creation and completion

### Mobile flow (warehouse app)
- `/warehouse/tasks/receive/:id` opens the task. Summary card shows receiving type (ASN vs blind) + cross-dock flag + dock bin
- Barcode scanner wedge hook (`useBarcodeScanner`) matches the scanned value against expected line SKUs and auto-opens that line with remaining qty pre-filled
- Blind receipts: an unknown scan opens a "New SKU" panel where the worker enters a quantity, and the backend creates the line
- Per-line inputs for received quantity and damaged quantity
- Inspection chips (pass / fail / quarantine) appear next to completed lines
- "Complete Receipt" button fires `receiving_task.complete` which cascades into auto-putaway generation

---

### Domain: Cross-dock

A workflow variant of receiving where goods skip storage entirely and sort directly to staging bins for outbound loading. Used for high-velocity flow-through operations.

### How it works
When a `ReceivingTask` is created with `crossDock: true`, the `CompleteReceiving` command diverges from the normal flow:
- **Normal receiving**: Complete -> generate PutawayTask(s) -> worker puts goods into storage bins
- **Cross-dock receiving**: Complete -> skip putaway entirely -> create StagingAssignment for each received unit -> move units directly to a staging/shipping_dock/cross_dock zone bin

### Behaviour
- Finds a staging bin at the location (zones with zoneType in `staging`, `shipping_dock`, or `cross_dock`)
- For each received unit with a `trackableUnitId`:
  1. Looks up the order via the receiving line's `orderLineItemId`
  2. Creates a `StagingAssignment` (status: `staged`) linking unit to staging bin and order
  3. Updates `TrackableUnit.currentBinId` and `currentZoneId` to the staging location
- Emits `cross_dock.sorted` event with unit count and staging bin

### Events
- `cross_dock.sorted` - Emitted when a cross-dock receiving task sorts units to staging
- `receiving_task.completed` - Includes `crossDock: true` and `crossDockSorted` count in payload

### Side Effects
- Units arrive at staging bins ready for inclusion in LoadPlans
- Inventory is NOT created (goods are transient, never entering storage)
- PutawayTasks are NOT generated

### Key Files
- `backend/src/commands/warehouse/CompleteReceivingCommand.ts` - Cross-dock branch in receiving completion
- `backend/src/__tests__/commands/CrossDockCommands.test.ts` - 2 tests (cross-dock sort + non-crossdock control)

---

### Domain: EDI 940 / 945 (Warehouse Shipping Order + Advice)

The 940/945 pair is the 3PL-to-depositor interchange: a depositor (brand, shipper) sends a 940 telling the warehouse what to ship, and the warehouse sends back a 945 confirming what actually shipped. Together they replace manual order entry and packing-slip emails for customers running on a 3PL WMS.

### GS functional identifiers
- 940: `OW` (Warehouse Shipping Order)
- 945: `SW` (Warehouse Shipping Advice)

Both are registered in `TRANSACTION_TO_GS` / `GS_TO_TRANSACTION` and route through the universal EDI inbound endpoint.

### Inbound 940 flow
1. Depositor posts the 940 to `/api/v1/edi/940/inbound` (or it arrives via the edi-collector SFTP poll and gets routed here by `EdiRouterService`)
2. `EDI940ParseService.parseEDI940()` walks the body: W05 header (purpose code, depositor order number, PO, shipper reference), G62 dates (10 = requested ship, 11 = cancel-by), N1 party loops (ST = ship-to, SF = ship-from = depositor, WH = warehouse), N3/N4 address lines, W66 carrier + SCAC, NTE freeform notes, LX line groups, W01 line detail (qty / UOM / item ID), G69 descriptions, N9 lot / customer line refs
3. Route resolves the depositor customer by `partnerId` (preferred) or SF address match
4. Ship-to location is matched against existing `Location` rows or recorded as raw address data
5. Dispatch `CREATE_ORDER` with `importSource: 'edi_940'` and full parsed ediData

### Outbound 945 flow
1. `Edi945AutoSendHandler` subscribes to `shipment.delivered`
2. Loads the shipment with origin / destination / carrier / customer / orders + line items
3. For every trading partner on that customer with `outbound 945 enabled`, calls `EDI945Service.validateAndGenerate`
4. Envelopes the result and delivers via `OutboundEdiDeliveryService` (SFTP or HTTP per partner config)
5. Also available via `POST /api/v1/edi/945/generate` for manual / preview generation

### 945 line-level status codes
`W12-01` reports what happened to each line:
- `CC` - Complete (shipped qty == ordered qty)
- `PC` - Partial (0 < shipped < ordered; backorder qty reported in W12-04)
- `CN` - Cancelled (shipped qty == 0)

### Key segments emitted in the 945
- W06 - header (reporting code, depositor order number, ship date, shipper ID, PO)
- N1 loop - ST / WH / SF addresses with N3 / N4 detail
- G62 - actual ship date (qualifier 11)
- W27 - carrier detail (method code, SCAC, routing, BOL, tracking number)
- LX + W12 + G69 + N9 - per line (tracking via `N9*CN`, lot via `N9*LT`, customer ref via `N9*PD`)
- W03 - shipment totals (quantity, weight in kg, pallet count)

### Key Files
- `backend/src/services/edi/types.ts` - `TRANSACTION_TO_GS` extended with 940 / 945
- `backend/src/services/EdiRouterService.ts` - 940 added to TRANSACTION_ROUTES
- `backend/src/services/EDI940ParseService.ts`
- `backend/src/services/EDI945Service.ts`
- `backend/src/routes/edi940.ts` - inbound + preview + 945 generate endpoints (+ exported `buildEDI945DataFromShipment` helper reused by the handler)
- `backend/src/events/handlers/Edi945AutoSendHandler.ts`
- `backend/src/__tests__/services/EDI940_945.test.ts` - 21 tests (parse, generate, all three status codes, roundtrip, wrong-transaction, missing fields, overship warnings, replacement reporting)

---

### Domain: Container Intelligence

Given a list of items to pack and the active carton catalogue, the service groups items by constraint profile (temperature zone + value class + hazmat compatibility), picks the smallest carton that qualifies for each group, and returns a multi-package plan with required ancillaries and handling flags. This prevents the warehouse from putting oxidizers next to flammables, high-value watches in a plain mailer, or frozen pharma in an uninsulated box.

### Catalogue fields
`CartonCatalogue` gains eight intelligence fields alongside its physical dimensions:
- `temperatureZone` - `any` | `ambient` | `refrigerated` | `frozen` | `dry_ice`
- `insulated` + `insulationHours` - whether and for how long the carton maintains temp without active cooling
- `tamperEvident` - pre-sealed high-value packaging
- `valueClass` - `any` | `standard` | `high_value`
- `hazmatRated` + `hazmatClasses[]` - UN class codes the carton is approved to transport
- `materialType` - `corrugated` | `plastic` | `metal` | `foam` | `composite`

### Constraint rules
| Cargo attribute | Carton must satisfy |
|-|-|
| `temperatureZone = 'ambient'` | `temperatureZone in ('any', 'ambient')` |
| `temperatureZone in ('refrigerated', 'frozen', 'dry_ice')` | exact match - no "any" fallback |
| `hazmat = true` with class X | `hazmatRated = true` AND class X is in the carton's `hazmatClasses[]` |
| `hazmat = false` | carton's `hazmatClasses[]` is empty (hazmat cartons stay reserved for hazmat) |
| `valueClass = 'high_value'` | carton's `valueClass = 'high_value'` |
| Physical fit | cartonVolume >= sum(item volume × qty); maxWeightGrams >= total weight; longest item edge fits along one carton axis |

### Hazmat segregation
Incompatible UN classes cannot share a package even if both appear in the carton's approved list. The service keeps a simplified 49 CFR §177.848 / UN Model Regulations segregation matrix for classes 1, 2.1, 2.3, 3, 4.1, 4.2, 4.3, 5.1, 5.2, 6.1, and 8. Compatible pairs (e.g., class 3 + class 6.1) can share; incompatible pairs (e.g., class 3 + class 5.1) get split into separate packages automatically.

### Grouping
1. Non-hazmat items with the same `(temperatureZone, valueClass)` cluster into one group.
2. Hazmat items cluster only when all existing classes in the group are compatible with the incoming class AND temperature / value match.
3. Hazmat and non-hazmat items always split.

### Ancillaries
Automatically attached to the package suggestion based on cargo + carton:
- `gel_pack` - refrigerated packages (always)
- `dry_ice` - frozen or dry_ice packages; also added to refrigerated packages when `transitHours > 24`
- `desiccant` - when any item is `humiditySensitive`
- `fragile_padding` - when any item is `fragile`
- `tamper_seal` - high-value group using a carton that isn't already tamper-evident

### API
`POST /api/v1/containers/recommend` with body `{ locationId?, transitHours?, items: PackItem[] }` returns:
```
{
  packages: PackageSuggestion[],        // one per constraint group
  warnings: string[],                   // e.g., "Refrigerated package ... 36h transit - adding dry_ice"
  errors: string[],                     // e.g., "No carton qualifies for group (temperature=frozen, ...)"
  totalContainerCostCents: number,
  totalWeightGrams: number,
}
```

Each `PackageSuggestion` carries the selected `cartonId` + name, items, ancillaries, specialHandling, hazmatClasses, volume and weight utilization %, and a human-readable reason string.

### Key Files
- `backend/prisma/migrations/20260420_add_container_intelligence/migration.sql`
- `backend/src/services/containers/ContainerIntelligenceService.ts` - service + segregation matrix
- `backend/src/routes/containerIntelligence.ts` - recommend endpoint
- `frontend/src/vnext-design/VNextWmsCartonCatalogue.tsx` - extended admin form + chips in table
- `backend/src/__tests__/services/ContainerIntelligenceService.test.ts` - 37 tests (input validation, best-fit, temperature splits, hazmat segregation including the real-world class 3 vs class 5.1 case, value/fragile/humidity ancillaries, multi-constraint splits, cost + weight totals)

---

### Domain: Pallet Types & Palletization

Standard pallet specs are first-class master data. Every org curates a `PalletType` catalog with EUR, US GMA, CHEP, Australian, half/quarter, and plastic variants. Pallet-level `TrackableUnit`s reference a `PalletType` so load plans, BOL generation, and palletization estimates use accurate dimensions and weight limits instead of guessing.

### Schema
`PalletType` fields: `code` (unique per org), `name`, `description`, external dimensions in mm (`lengthMm`, `widthMm`, deck `heightMm`), `tareWeightGrams`, `maxLoadGrams`, optional `maxStackHeightMm`, `material` (wood / plastic / metal / cardboard / composite), `reusable`, `isoCertified` (ISPM-15 heat treatment for international export), `stackable`, `active`.

`TrackableUnit.palletTypeId` is nullable so legacy pallets remain valid. When set, it anchors the unit to a real spec.

### Standard seed
13 standard types covering the common real-world pallets: EUR1 (1200×800), EUR2 (1200×1000), EUR3, EUR6 (half), US GMA (48×40), US 42×42, CHEP 1210, CHEP 48×40, AU 1165, plastic Euro + plastic GMA, one-way export, and quarter display. `POST /api/v1/pallet-types/seed-standards` bulk-adds missing rows (by code uniqueness).

### Palletization planner
`PalletizationPlanner.planHomogeneousPallet(palletType, carton)` returns:
- `cartonsPerLayer` - max of two orientations on the deck (`floor(pL / cL) × floor(pW / cW)` vs the rotated version)
- `layers` - `min(heightBoundLayers, weightBoundLayers)` where heightBound = `floor((maxStackHeight - deckHeight) / cartonHeight)` and weightBound = `floor(maxLoad / (weightPerLayer))`
- `totalCartons`, `stackedHeightMm`, `totalWeightGrams`
- `weightUtilizationPercent` vs `maxLoadGrams`, `heightUtilizationPercent` vs `maxStackHeightMm` (null if unlimited)
- `fits` flag and human-readable warnings (`Weight limit reached before height limit`, etc.)

`recommendPalletType(palletTypes, carton)` ranks active types by cartons-carried (desc) then weight utilization (desc), returning `{ best, all }`.

### API
| Method | Endpoint | Purpose |
|--|--|--|
| GET | `/api/v1/pallet-types` | List (optionally active-only) |
| GET | `/api/v1/pallet-types/standards` | Preview the standard seed |
| GET | `/api/v1/pallet-types/:id` | Detail |
| POST | `/api/v1/pallet-types` | Create |
| PUT | `/api/v1/pallet-types/:id` | Update |
| DELETE | `/api/v1/pallet-types/:id` | Delete (soft-deactivates if referenced by any TrackableUnit) |
| POST | `/api/v1/pallet-types/seed-standards` | Bulk-add missing standards |
| POST | `/api/v1/pallet-types/:id/plan` | Layer/weight estimate for one pallet type and a carton |
| POST | `/api/v1/pallet-types/recommend` | Rank all active types for a carton |

### UI
- `/wms/pallet-types` - table with code, name, dimensions (cm), tare and max load (kg), badges for reusable / ISPM-15 / stackable. Create/edit modal with the full spec form. One-click "Load standard types" button seeds the 13 common types.
- Sidebar entry under the Warehouse app.

### Key Files
- `backend/prisma/migrations/20260420_add_pallet_types/migration.sql`
- `backend/src/services/palletization/standardPalletTypes.ts` - canonical seed data
- `backend/src/services/palletization/PalletizationPlanner.ts` - homogeneous planner + recommender
- `backend/src/routes/palletTypes.ts` - CRUD + seed + plan + recommend
- `frontend/src/vnext-design/VNextPalletTypes.tsx` - admin UI
- `backend/src/__tests__/services/PalletizationPlanner.test.ts` - 11 tests (orientation, height/weight bounds, utilization, recommendation ranking, ties, inactive filtering)

---

### Domain: Warehouse Operations Dashboard

One aggregate endpoint (`GET /api/v1/wms/operations-dashboard`) returns a snapshot of warehouse health across six dimensions, built from parallel Prisma queries. Auto-refreshes every 60 seconds on the admin UI.

### KPI sections
1. **Throughput** - completed receipts, putaways, picks, packs, and dispatched shipments for today (UTC midnight boundary) vs last 7 days.
2. **Cycle times** (30-day avg):
   - Pick cycle = completed PickTask `completedAt - startedAt`
   - Dock-to-stock = completed PutawayTask `updatedAt - receivingTask.createdAt` (only for putaways linked to a receiving task)
   - Order-to-ship = dispatched Shipment `updatedAt - order.createdAt` via OrderShipment join
   - Each metric ships with a `samples` count so operators can gauge confidence
3. **Quality & accuracy** (30-day):
   - Pick accuracy = `completed / (completed + short_pick)` × 100
   - Pack audit pass rate = `pass / total` × 100 (from `PackAudit.verdict`)
   - Inventory record accuracy = `(1 - Σ|counted - expected| / Σ expected) × 100` across recent `CycleCountLine` rows with `countedQuantity != null`
4. **Live work queue** - pending counts for pick tasks, putaway tasks, pack tasks, active waves (`released` / `in_progress`), and receiving tasks in progress.
5. **Exceptions** - open + critical issues, cutoff-at-risk critical + warning counts (driven by `Shipment.lastCutoffRiskSeverity`), pending RMAs in the warehouse lifecycle, open pack-audit-fail issue count.
6. **Capacity** - total bins, bins with inventory, utilization percent. Utilization returns null when no bins exist.

### UI behavior
- Tone coloring on quality metrics: ≥98% success, 95-97% warning, <95% error. Same logic on capacity utilization (inverted for warning at >85%, error at >95%).
- Every KPI card is clickable when there's a relevant drill target (picks → `/wms/picking`, pack audits → `/wms/pack-audits`, cutoff → `/wms/cutoff-monitor`, issues → `/issues`, returns → `/wms/returns`).

### Why a single endpoint
The queries are read-only and run concurrently through `Promise.all` - a single round-trip keeps the admin UI simple and eliminates N+1 fetch patterns. Since most KPIs refresh together, interleaved queries aren't a concern.

### Key Files
- `backend/src/services/warehouse/WarehouseOperationsDashboardService.ts` - Snapshot aggregator
- `backend/src/routes/warehouseOperationsDashboard.ts` - Single endpoint
- `frontend/src/vnext-design/VNextWmsOperationsDashboard.tsx` - Dashboard UI
- `backend/src/__tests__/services/WarehouseOperationsDashboardService.test.ts` - 13 tests (throughput windowing, cycle time math, pick accuracy, pack audit pass rate, inventory accuracy from cycle counts, capacity, exception rollup)

---

### Domain: Cutoff-at-Risk Monitoring

Carriers publish daily handoff cutoff times (e.g. 16:30 for same-day FedEx Ground pickup). Missing one slips the shipment a day. The cutoff-at-risk monitor watches open shipments, projects how long the remaining warehouse work will take, and fires `shipment.cutoff_at_risk` (plus auto-raises an Issue) when the projected ready time will miss the cutoff.

### CarrierCutoff schema
Per-day-of-week rows per carrier: `dayOfWeek (0-6)`, `cutoffLocalTime (HH:mm)`, `timezone (IANA)`, optional `serviceLevel` and `locationId` override, `active` flag. Multiple rows per carrier are supported; the earliest matching row for today wins.

### Projected ready time
Simple additive model (v1, configurable per-instance):
- Each pending pick task: +45 min
- Each pending pack task: +15 min
- No load plan yet: +30 min

Work is resolved by walking `Shipment → OrderShipment[] → Order.id → PickTask/PackTask` (non-completed, non-cancelled rows) and `Shipment → LoadPlan`.

### Severity bands
| Buffer (cutoff - projectedReady) | Severity | Action |
|--|--|--|
| ≥ 30 min | `minor` | Dashboard only, no event, no issue |
| 10 - 29 min | `warning` | Fires event, creates medium-priority issue |
| < 10 min or past cutoff | `critical` | Fires event, creates high-priority issue |

### Dedup
Re-evaluation runs every 5 min. To avoid spam:
- Same-severity alert won't refire within the dedup window (default 30 min)
- Escalating severity (warning → critical) fires immediately regardless of window
- Existing issue is reused across escalations via `Shipment.lastCutoffRiskIssueId`

### Events
- `shipment.cutoff_at_risk` - payload: `{ shipmentId, shipmentReference, carrierId, cutoffAt, projectedReadyAt, bufferMinutes, severity, blockingStage, pendingPickTasks, pendingPackTasks, pendingLoadPlan, issueId }`
- `shipment.cutoff_cleared` - reserved for future use when a shipment that was previously at risk returns to a safe buffer

### API
- CRUD: `GET/POST /api/v1/carriers/:carrierId/cutoffs`, `PUT/DELETE /api/v1/carrier-cutoffs/:id`
- `GET /api/v1/cutoff-monitor/at-risk?severity=warning|critical` - current at-risk list
- `GET /api/v1/cutoff-monitor/evaluate/:shipmentId` - evaluate a single shipment without firing
- `POST /api/v1/cutoff-monitor/run` - manual full scan (useful for testing + on-demand review)

### Worker
`cutoffMonitorWorker` registers a pg-boss cron on the `cutoff-monitor` queue. Default `*/5 * * * *`, override with `CUTOFF_MONITOR_CRON`.

### Key Files
- `backend/prisma/migrations/20260420_add_cutoff_monitoring/migration.sql`
- `backend/src/services/cutoff/ShipmentCutoffMonitorService.ts`
- `backend/src/workers/cutoffMonitorWorker.ts`
- `backend/src/routes/cutoffMonitor.ts`
- `frontend/src/vnext-design/VNextCutoffDashboard.tsx` - at-risk list with stats
- `frontend/src/vnext-design/VNextCarrierCutoffs.tsx` - per-carrier cutoff configuration
- `backend/src/__tests__/services/ShipmentCutoffMonitorService.test.ts` - 24 tests

---

### Domain: Pack Audit (weight / dim-weight variance)

Pack audits run at the pack station after a pick is packed into a carton. A scale captures the actual weight in grams, and optionally a cubiscan (or tape measure) captures LxWxH in mm. The service compares actual against the expected total (sum of `ProductUom.weightGrams × line.expectedQuantity` across the pack task) and assigns a verdict.

### Verdict logic
| `|variance|` vs tolerance | Verdict |
|--|--|
| `≤ tolerance` | `pass` |
| `≤ 2 × tolerance` | `warning` - medium-priority quality issue auto-raised |
| `> 2 × tolerance` | `fail` - high-priority quality issue auto-raised |

Default tolerance is 10%, overridable per-audit via `weightTolerancePercent` on the command payload. The tolerance actually applied is persisted on the `PackAudit` row so historical rows stay self-describing even if defaults change.

### Dim-weight
Dim-weight is calculated only when an audit links to a `CartonCatalogue` (expected dims) AND the caller supplies all three actual dims. Formula is the industry standard `(L × W × H cm) / 5000 = kg`. The result is stored as a separate `dimWeightVariancePercent` column; verdict today is driven only by the scale weight, but the dim-weight delta is surfaced in UI so ops can investigate.

### Issue auto-creation
When verdict is `warning` or `fail`, an `Issue` is created inline within the same transaction (not via `CREATE_ISSUE` dispatch, to keep the audit + issue atomic). The issue uses `category: 'quality'`, `sourceEntityType: 'pack_task'`, `sourceEntityId: packTask.id` so the triage kanban and the pack task detail page both see it.

### Events
- `pack.audit_recorded` - every audit, payload includes verdict, variances, expected/actual weight, tolerance, issueId (nullable)
- `pack.audit_variance_detected` - only warning/fail, payload includes verdict, weight variance, issueId

### Commands
- `RECORD_PACK_AUDIT` - single atomic operation: compute expected (unless override supplied), compute variance, assign verdict, create issue if non-pass, persist audit row, emit events

### API
| Method | Endpoint | Purpose |
|-|-|-|
| POST | `/api/v1/pack-audits` | Record a new audit (weight required, dims optional) |
| GET | `/api/v1/pack-audits` | List with filters `verdict`, `packTaskId` |
| GET | `/api/v1/pack-audits/:id` | Detail including full pack task + lines |
| GET | `/api/v1/pack-audits/stats` | 30-day totals + pass rate |
| GET | `/api/v1/warehouse/pack-tasks/:id/audit-context` | Pre-computed expected totals + SKU catalog data for the mobile app, plus the task's existing audit history |

### UI
- Admin: `/wms/pack-audits` - stats tiles (total, pass rate, warnings, failures over 30 days), verdict filter, table with sign-colored variance, one-click jump to the auto-raised issue
- Warehouse mobile: `/warehouse/tasks/pack-audit/:packTaskId` - shows expected weight prominently, scale input with numeric keyboard, optional LxWxH inputs, notes, previous-audit history. Submit returns an immediate verdict tile with the variance, plus an "issue raised" banner when applicable

### Key Files
- `backend/prisma/migrations/20260419_add_pack_audit/migration.sql` - creates `PackAudit` table
- `backend/src/commands/packAudit/RecordPackAuditCommand.ts` - command handler with verdict logic and auto-issue creation
- `backend/src/routes/packAudit.ts` - five admin + warehouse endpoints
- `frontend/src/warehouse/WarehousePackAudit.tsx` - mobile capture page
- `frontend/src/vnext-design/VNextWmsPackAudits.tsx` - admin list + stats
- `backend/src/__tests__/commands/PackAuditCommands.test.ts` - 10 tests covering verdict boundaries, overrides, dim-weight math, validation

---

### Domain: Returns / RMA

Full returns lifecycle from customer request through physical receipt, inspection, disposition, and refund. See `docs/RETURNS_SPECIFICATION.md` for the complete specification.

### Commands
- `rma.create` - Create a new RMA for a customer return. Validates that requested quantities don't exceed order line quantities. Auto-calculates suggested refund from order line prices. Optionally auto-authorizes for CSR-initiated RMAs.
- `rma.authorize` - CSR approves a requested RMA. Moves status from `requested` to `authorized`.
- `rma.reject` - CSR rejects an RMA with reason notes.
- `rma_line.receive` - Record physical receipt of a returned item at the dock. Moves the unit to quarantine zone with `qualityStatus: quarantine`. Advances RMA status to `received` when all lines are fully received.
- `rma_line.inspect` - Inspector sets final disposition per line. Routes unit to next physical destination (putaway for restock, refurb zone for refurb, etc.). Updates `qualityStatus` based on disposition (available for restock, hold for refurb, damaged for scrap, quarantine for others).
- `rma.complete` - Finalizes RMA. Generates inventory movements for `restock` lines (new `InventoryRecord` + `InventoryTransaction` with reasonCode `return`). Finance can override the suggested refund with `actualRefundCents` and adjustment notes.

### Seven Dispositions
`restock`, `refurb`, `scrap`, `recycle`, `donate`, `rtv`, `customer_keeps`. See specification doc for full behaviour of each.

### Lifecycle
```
requested -> authorized -> in_transit -> received -> inspecting -> dispositioning -> completed
                       ↘
                         rejected
```

### Events
- `rma.requested` - Customer portal submission or CSR creation
- `rma.authorized` - CSR approved or auto-authorized on creation
- `rma.rejected` - CSR declined the return
- `rma.goods_received` - All lines physically received at dock
- `rma.line_inspected` - Inspector set disposition on a line
- `rma.disposition_set` - All lines on an RMA have dispositions (moves to `dispositioning` status)
- `rma.completed` - RMA closed, inventory updated, ready for credit note issuance
- `rma.refund_adjusted` - Finance overrode the suggested refund amount

### Side Effects
- **Quarantine-first flow**: returned units always go to quarantine zone before any other action. No direct restock.
- **Restock inventory movement**: on RMA completion, restock lines create `InventoryRecord` or increment existing record at the route-to-bin with `InventoryTransaction` type `receive`, reason `return`, referenceType `rma`.
- **Trackable unit quality status** changes based on disposition: available/hold/damaged/quarantine.
- **Finance review queue**: RMAs in `dispositioning` status appear in the refund review queue for finance team approval before completion.

### Key Files
- `backend/src/commands/rma/` - All RMA command handlers (6 handlers)
- `backend/src/routes/rma.ts` - RMA API endpoints (9 endpoints)
- `backend/src/__tests__/commands/RmaCommands.test.ts` - 15 tests
- `frontend/src/vnext-design/VNextWmsReturns.tsx` - Returns list
- `frontend/src/vnext-design/VNextWmsCreateReturn.tsx` - Multi-step RMA creation form
- `frontend/src/vnext-design/VNextWmsReturnDetail.tsx` - RMA detail with inline inspection and completion
- `frontend/src/vnext-design/VNextWmsRefundReview.tsx` - Finance refund approval queue
- `backend/src/routes/customerRmaApi.ts` - Public customer-facing RMA API (ApiKey-authenticated)
- `backend/src/routes/customerPortal.ts` - Customer portal RMA endpoints (JWT-authenticated, list/detail/create/label-download/eligible-orders)
- `frontend/src/pages/customer-portal/CustomerReturns.tsx` - Portal: list my returns
- `frontend/src/pages/customer-portal/CustomerRequestReturn.tsx` - Portal: request a return (multi-step form)
- `frontend/src/pages/customer-portal/CustomerReturnDetail.tsx` - Portal: return detail with status explanation + label download
- `backend/src/routes/rma.ts` - `GET /api/v1/warehouse/rmas` - enriched list for warehouse mobile (linesToReceive / linesToInspect counts, supports rmaNumber exact lookup for scanned labels)
- `frontend/src/warehouse/WarehouseReturnReceive.tsx` - Mobile: scan RMA and receive lines with per-line qty input
- `frontend/src/warehouse/WarehouseReturnInspect.tsx` - Mobile: set condition + disposition per received line (7 disposition choices with hints)
- `backend/src/services/EDI180ParseService.ts` - EDI 180 inbound parser with X12 reason code mapping
- `backend/src/services/EDI180Service.ts` - EDI 180 outbound generator (authorization response)
- `backend/src/routes/edi180.ts` - EDI 180 inbound (auto-creates RMA) + outbound generation endpoints
- `backend/src/__tests__/services/EDI180Service.test.ts` - 8 tests (parse, generate, roundtrip)
- `backend/src/services/returnLabel/IReturnLabelProvider.ts` - Return label provider interface (generate, schedulePickup, cancelPickup)
- `backend/src/services/returnLabel/ReturnLabelProviderRegistry.ts` - Provider registry (manual + fedex/ups/dhl stubs)
- `backend/src/services/returnLabel/providers/ManualReturnLabelProvider.ts` - Default provider for v1 (admin-captured tracking + placeholder label buffer)
- `backend/src/commands/rma/GenerateReturnLabelCommand.ts` - Generate + store return label
- `backend/src/commands/rma/SchedulePickupCommand.ts` - Schedule carrier pickup
- `backend/src/commands/rma/CancelPickupCommand.ts` - Cancel a scheduled pickup
- `backend/src/__tests__/commands/RmaReturnLabelCommands.test.ts` - 12 tests (generate/schedule/cancel + manual provider)
- `docs/RETURNS_SPECIFICATION.md` - Full specification

### Return Label & Pickup Flow

Return shipping is provider-agnostic via `IReturnLabelProvider`. A single registry holds Manual, FedEx, UPS, and DHL implementations; the FedEx/UPS/DHL providers currently throw "not yet implemented" and fall back to the Manual provider for v1. Carriers self-select a provider via `Carrier.returnLabelProvider`; admins can override per-RMA.

**Generate label** (`POST /api/v1/rmas/:id/return-label`):
1. Resolve provider from explicit override, assigned carrier's `returnLabelProvider`, or fall back to `manual`
2. Provider returns `{ trackingNumber, labelContent: Buffer, labelFormat }`
3. Label is stored via `IBinaryStorageProvider` at `files/{uuid}`
4. RMA is updated with `returnTrackingNumber`, `returnLabelStorageKey`, `returnLabelFormat`, `returnLabelProvider`, `returnCarrierId`, `returnServiceLevel`, `returnLabelGeneratedAt`
5. Emits `rma.return_label_generated`

**Schedule pickup** (`POST /api/v1/rmas/:id/pickup`): requires an existing tracking number; guarded against double-booking by the `returnPickupScheduledAt && !returnPickupCancelledAt` invariant. Emits `rma.pickup_scheduled`.

**Cancel pickup** (`POST /api/v1/rmas/:id/pickup/cancel`): sets `returnPickupCancelledAt`; provider is called to release the carrier-side booking. Emits `rma.pickup_cancelled`. Rescheduling is allowed once cancelled.

**Label download**: admin (`GET /api/v1/rmas/:id/return-label/download`) and customer (`GET /api/v1/customer-api/rmas/:id/return-label`) can stream the stored label. Customer download is scoped to the API key's customerId.

### Integration Entry Points (how customers create RMAs)

Returns can enter the system through five channels, all converging on the same `CREATE_RMA` command handler with different `initiatedVia` values:

| Channel | How | `initiatedVia` |
|---------|-----|----------------|
| **Admin UI** | CSR creates RMA in the admin app | `admin` |
| **Customer Portal** | Customer self-service via JWT-authenticated portal pages (list/new/detail) | `customer_portal` |
| **Public REST API** | Customer integration via ApiKey auth: `POST /api/v1/customer-api/rmas` | `api` |
| **EDI 180 Inbound** | Customer transmits X12 180 document via SFTP/HTTP to `/api/v1/edi/180/inbound` | `edi_180` |
| **Marketplace Webhook** | Shopify/eBay/Amazon return events (v2, roadmap only) | `marketplace_webhook` |

### EDI 180 Flow

**Inbound** (customer requests RMA):
1. Customer transmits X12 180 via SFTP (existing edi-collector) or direct HTTP POST
2. Universal EDI inbound router detects ST*180 and routes to `/api/v1/edi/180/inbound`
3. `EDI180ParseService` parses envelope, BGN, REF, N1, LX/LQ/SLN segments, maps X12 reason codes to internal reasons
4. Route handler looks up customer (by partner link, customer ID, or name) and original order (by PO/order number)
5. Lines matched to order line items by SKU
6. `CREATE_RMA` command dispatched with `initiatedVia: edi_180`
7. RMA created in `requested` state for CSR review

**Outbound** (authorization response):
1. CSR authorizes the RMA (status: authorized)
2. Admin/automation calls `POST /api/v1/edi/180/generate` with RMA ID
3. `EDI180Service` builds X12 180 with BGN*11 (response), N1 ST/SF with warehouse/customer addresses, LX+SLN per line
4. Content returned for SFTP/HTTP delivery via existing `OutboundEdiDeliveryService`
5. GS functional identifier `RZ` registered in `TRANSACTION_TO_GS` map

---

### Domain: Putaway

Directs received goods to their storage location with scan-to-confirm and constraint validation.

### Commands
- `putaway_task.assign` - Assign a putaway task to a worker
- `putaway_task.complete` - Scan-to-confirm completion:
  1. Resolves scanned bin label to actual bin
  2. Detects deviation (scanned != directed) and records it
  3. Validates bin constraints (temperature compatibility, hazmat certification) - warnings returned but don't block
  4. Updates TrackableUnit.currentBinId and currentZoneId (cascades to child units)
  5. Increments bin capacity counters (currentPalletCount, currentWeightKg)
  6. Creates/updates InventoryRecord + immutable InventoryTransaction

### Events
- `putaway_task.assigned`, `putaway_task.started`, `putaway_task.completed`
- `putaway_task.deviation` - Emitted when scanned bin differs from directed target
- `inventory.received` - Emitted when putaway writes to inventory

### Side Effects
- Putaway completion creates the first InventoryRecord for received goods
- Bin capacity denormalization updated on completion

### Putaway Rule Evaluation
- Rules evaluated in priority order (lower = higher priority), first match wins
- Criteria (all nullable = match any): skuPattern (glob), temperatureRequirement, hazmat, customerId, velocityClass, unitType
- Target types: specific_bin, zone (first available), next_available_in_zone (capacity + level preference)
- Consolidation: when enabled, prefers bins where the same SKU already has inventory
- Fallback: first available bin in any bulk_storage zone

---

### Domain: Inventory

Tracks stock levels across warehouse bins with an immutable transaction ledger.

### Commands
- `inventory.adjust` - Manual stock correction with reason code (damage, expired, recount, scrap, found, return). Validates non-negative result.
- `inventory.transfer` - Move stock between bins. Creates/updates InventoryRecord at target, cleans up empty source records. Two-sided transaction ledger entries.

### Events
- `inventory.adjusted` - Includes sku, quantityChange, reasonCode, previousQuantity, newQuantity
- `inventory.transferred` - Includes sku, quantity, sourceBinId, targetBinId

### Side Effects
- Empty InventoryRecords (zero on-hand, zero allocated, zero hold) are deleted on transfer

---

### Domain: Waves & Picking

Groups orders into pick waves and generates walk-sequence-optimized pick tasks.

### Commands
- `wave.create` - Create a wave from selected order IDs. Auto-generates wave number (W-YYYY-MM-DD-NNN). Counts total line items across orders.
- `wave.release` - Release wave: hard-allocates inventory (FIFO) for each order line, creates PickTasks with walk-sequence-sorted PickLines. Discrete strategy = one task per order, batch = one task for all.
- `pick_line.complete` - Complete a pick line: deducts from InventoryRecord (quantityOnHand + quantityAllocated), creates InventoryTransaction (type: pick). Short pick handling: backorder (keep allocated) or cancel_line (release back to available). Auto-completes task and wave when all lines done.

### Events
- `wave.created`, `wave.released`, `wave.completed`, `wave.cancelled`
- `pick_task.created`, `pick_task.assigned`, `pick_task.completed`
- `pick_line.completed`, `pick_line.short`

### Side Effects
- Wave release hard-allocates inventory (increments quantityAllocated, decrements quantityAvailable)
- Pick line completion decrements quantityOnHand and creates pick transaction
- Short pick with cancel_line releases allocation back to available
- Task auto-completes when all lines done; wave auto-completes when all tasks done

---

### Domain: Packing & Loading

Verifies picked items at pack stations, stages for outbound, and loads onto vehicles.

### Commands
- `pack_task.create` - Create a pack task with lines (typically from completed pick). Links to order and pick task.
- `pack_line.complete` - Verify and pack a line item. Auto-starts task, auto-completes when all lines done.
- `staging_assignment.create` - Stage a packed unit at a dock bin. Moves TrackableUnit to staging bin.
- `loading.complete` - Mark staged assignments as loaded onto vehicle. Clears unit bin/zone (on vehicle now).

### Events
- `pack_task.created`, `pack_line.verified`, `pack_task.completed`
- `staging_assignment.created`, `loading.completed`

### Side Effects
- Staging moves TrackableUnit.currentBinId to the staging bin
- Loading clears TrackableUnit.currentBinId and currentZoneId (unit is on vehicle)

### Mobile flow (warehouse app)
- `/warehouse/tasks/pack/:id` opens the task with a summary card, carton selector (lists active `CartonCatalogue` entries with temperature zone and max weight), and one row per pack line
- Barcode wedge matches the scanned value against expected line SKUs, auto-opens the line, pre-fills remaining qty
- Rejects scans that aren't on the pick (surfaces `Scanned "X" does not match any item on this pack task`)
- Rejects over-scans for already-completed lines
- When all lines are packed, surfaces a "Run Pack Audit" button that navigates straight to `/warehouse/tasks/pack-audit/:id` so the scale + dim variance check runs before the parcel ships

---

### Domain: Cycle Counting

Verifies inventory accuracy by comparing physical bin counts against system records.

### Commands
- `cycle_count.create` - Creates a cycle count from current inventory records. Three types: `full` (all bins), `zone` (specific zone), `random_sample` (~20% random selection). Auto-generates count lines with expected quantities.
- `cycle_count.record_line` - Record a counted quantity for a bin/SKU. Auto-starts count on first recording. Detects variances. On final line: auto-completes count, auto-adjusts inventory for all variances (creates InventoryTransaction with `cycle_count` type), updates `lastCountedAt`.

### Events
- `cycle_count.created`, `cycle_count.started`, `cycle_count.completed`
- `cycle_count.line_recorded`
- `cycle_count.variance_detected` - Emitted for each line where counted != expected

### Side Effects
- On completion: all variance lines auto-adjust InventoryRecord.quantityOnHand to match counted quantity
- InventoryTransaction created for each adjustment (transactionType: `cycle_count`, reasonCode: `recount`)
- All counted InventoryRecords get `lastCountedAt` updated

---

### Domain: Replenishment

Auto-replenishes pick face bins from bulk storage when stock drops below configured minimum levels.

### Commands
- `replenishment_rule.create` - Define a rule: SKU + pick face bin + bulk zone + min/max quantities. Validates min < max, bin and zone exist.
- `replenishment.check` - Evaluates all active rules for a location. For each rule where pick face qty < minQuantity: finds bulk inventory, creates PutawayTask (type: `replenishment`). Skips if already being replenished or no bulk stock available.

### Events
- `replenishment_rule.created`, `replenishment_rule.updated`
- `inventory.below_minimum` - Emitted when a pick face drops below its rule's minQuantity
- `replenishment.triggered` - Emitted when a replenishment putaway task is created

### Side Effects
- CheckReplenishment creates PutawayTask records (putawayType: `replenishment`) that appear in the putaway task queue
- Deduplication: skips if a pending/assigned/in-progress replenishment task already exists for the same target bin

### Event-driven auto-trigger
`AutoReplenishmentHandler` subscribes to `pick_line.completed` and `inventory.adjusted`. When fired, it resolves the affected location (PickTask → locationId or WarehouseBin → locationId) and dispatches `CHECK_REPLENISHMENT` scoped to `(locationId, sku)`. Replenishment tasks are created within seconds of a pick rather than waiting for an operational sweep. The command-level dedup guarantees no duplicate putaway tasks.

---

### Domain: Wave Templates

Automates wave creation from reusable template definitions with grouping rules, cutoff times, and order constraints.

### Commands
- `wave_template.create` - Define a template: name, pick strategy, grouping rules (JSON), cutoff time (HH:MM), min/max orders, priority, cron schedule, auto-release toggle.
- `wave_template.apply` - Run a template: finds eligible orders (excludes already-waved), applies grouping rules, enforces min/max, generates wave number, creates wave with linked orders. Skips gracefully with reason if below minimum or no eligible orders.

### Events
- `wave.created` (with templateId and templateName in payload when template-driven)

### Side Effects
- ApplyWaveTemplate creates Wave + WaveOrder records
- Eligible orders are those not currently in any active (non-completed, non-cancelled) wave
- Cutoff time resolved from template HH:MM to today's datetime

---

### Domain: Cartonization

Recommends the smallest viable shipping carton for items being packed, reducing dim-weight charges.

### Where it fits in the workflow
Cartonization fires at **pack time** - when a PackTask is opened, the system looks up item dimensions, calculates total volume and weight, and recommends the smallest carton from the catalogue that fits. The worker sees the recommendation on the pack task detail page and can accept or override.

### Dimension lookup chain
1. **ProductUom** - Per-SKU master data (lengthMm, widthMm, heightMm, weightGrams). Most reliable - set once, used forever.
2. **OrderLineItem** - Per-order dimensions (length, width, height in cm; weight in kg). Converted to mm/grams. Used when ProductUom is missing.
3. **Neither available** - Recommendation skipped, missing SKUs flagged.

### Algorithm
First-Fit-Decreasing by volume:
1. Sum item volumes (L x W x H x quantity) and weights across all pack lines
2. Score each carton in the catalogue: volumeUtilization = totalItemVolume / cartonVolume, weightUtilization = totalWeight / maxWeight
3. Pick the smallest carton where both volume and weight utilization <= 100% (highest utilization that still fits)
4. Return recommended carton plus up to 3 alternatives

### Scope
- **Applies to**: Parcel/case-level outbound (B2C e-commerce, small shipments)
- **Does not apply to**: Pallet building (FTL/LTL where cases are loaded onto pallets). Palletization is a separate algorithm (layer-building, weight distribution, stacking constraints) for v2+.

### Key files
- `backend/src/services/CartonizationService.ts` - Recommendation engine with dimension lookup
- `backend/src/routes/cartonization.ts` - `POST /api/v1/cartonization/recommend`
- `backend/src/routes/productUom.ts` - ProductUom CRUD (6 endpoints)
- `backend/src/routes/cartonCatalogue.ts` - CartonCatalogue CRUD (4 endpoints)
- `frontend/src/vnext-design/VNextWmsProductUom.tsx` - Product dimensions management
- `frontend/src/vnext-design/VNextWmsCartonCatalogue.tsx` - Carton catalogue management
- `backend/src/__tests__/services/CartonizationService.test.ts` - 7 tests

---

### WMS Key Files
- `backend/src/commands/warehouse/` - All WMS command handlers (23 handlers)
- `backend/src/repositories/WarehouseZoneRepository.ts` - Zone/aisle/bin CRUD
- `backend/src/repositories/ReceivingRepository.ts` - Appointment/task/line CRUD
- `backend/src/services/PutawayRuleEvaluator.ts` - Rule evaluation with consolidation
- `backend/src/routes/warehouseZones.ts` - Zone & bin API (10 endpoints)
- `backend/src/routes/receiving.ts` - Receiving API (8 endpoints)
- `backend/src/routes/putaway.ts` - Putaway API (6 endpoints)
- `backend/src/routes/inventory.ts` - Inventory API (6 endpoints)
- `backend/src/routes/waves.ts` - Wave & pick API (8 endpoints)
- `backend/src/routes/packing.ts` - Packing & loading API (7 endpoints)
- `backend/src/routes/cycleCounts.ts` - Cycle counting API (4 endpoints)
- `backend/src/routes/replenishment.ts` - Replenishment API (5 endpoints)
- `backend/src/routes/waveTemplates.ts` - Wave template API (6 endpoints)
- `backend/src/routes/wmsDashboard.ts` - Dashboard stats API
- `backend/src/__tests__/commands/WarehouseZoneCommands.test.ts` - 14 tests
- `backend/src/__tests__/commands/ReceivingCommands.test.ts` - 10 tests
- `backend/src/__tests__/commands/PutawayCommands.test.ts` - 9 tests
- `backend/src/__tests__/commands/InventoryCommands.test.ts` - 11 tests
- `backend/src/__tests__/commands/WavePickCommands.test.ts` - 9 tests
- `backend/src/__tests__/commands/PackingLoadingCommands.test.ts` - 9 tests
- `backend/src/__tests__/commands/CycleCountCommands.test.ts` - 5 tests
- `backend/src/__tests__/commands/ReplenishmentCommands.test.ts` - 6 tests
- `backend/src/__tests__/commands/WaveTemplateCommands.test.ts` - 6 tests
- `frontend/src/vnext-design/VNextWms*.tsx` - 24 WMS pages

## Customer Portal - Developer Area

The customer portal is a multi-app workspace with an app switcher (Google-style grid) in the top-right. Apps: **Portal** (orders, shipments, returns, invoices, documents, profile) and **Developer**. The Developer app gives customers self-service control over every integration surface that connects their systems to Open TMS.

### Capabilities
- **API Keys** - create/disable/revoke. Plaintext is returned once on creation and never stored readable again. Keys are scoped to the customer, so a customer API key can only read and write that customer's own data via the public REST API.
- **Webhooks** - register HTTP endpoints to receive domain events. Subscriptions use pattern syntax (`*`, `rma.*`, or exact event name). Each webhook has its own HMAC-SHA256 signing secret which customers can reveal or rotate. Deliveries are logged per-webhook with status code, response body, error message, and timing. A "Send test" button triggers a synthetic `webhook.test` delivery.
- **Trading Partners (EDI)** - read-only view of the customer's `TradingPartner` records. Shows SFTP/HTTP connection details (credentials redacted to `***`), EDI envelope IDs, inbound/outbound directories, and supported transaction types. Admins own write access in the admin app.
- **Integration Logs** - paginated list of `EdiTransactionLog` records scoped to the customer's trading partners, filterable by direction and transaction type.
- **Dashboard** - overview tiles for each section plus a quick-start guide and signature-verification documentation.

### Webhook Signature Format
Every delivery includes:

```
X-OpenTms-Event: <event.type>
X-OpenTms-Delivery: <delivery-uuid>
X-OpenTms-Signature: t=<unix_seconds>,v1=<hex_hmac_sha256>
```

`v1` is `HMAC_SHA256(secret, `${timestamp}.${raw_body}`)` hex-encoded. Customers verify by computing the same HMAC and comparing using a constant-time equality check, rejecting requests outside a 5-minute window. `signPayload()` and `verifySignature()` helpers live in `CustomerWebhookDeliveryService` for reuse.

### Event Fanout
`CustomerWebhookHandler` subscribes to `rma.*`, `order.created|confirmed|delivered|cancelled|status_changed`, `shipment.dispatched|delivered|exception|status_changed`, `invoice.created|sent|paid`, and `pack.audit_recorded|pack.audit_variance_detected`. Pack audit events don't carry `customerId` directly, so the handler resolves it via PackTask → Order → customerId. All other events read `payload.customerId` directly. Finds enabled customer webhooks whose event pattern matches and dispatches each through `CustomerWebhookDeliveryService` concurrently. Failed deliveries are logged to `CustomerWebhookDelivery` and rolled up into per-webhook delivery/failure counters.

### Delivery Retry (exponential backoff)
Failed deliveries are retried by the `webhookRetryWorker` pg-boss cron (`*/1 * * * *`, override `WEBHOOK_RETRY_CRON`). Eligibility checks run via `CustomerWebhookDeliveryService.findEligibleForRetry`:

| Attempt | Minimum wait before retry |
|---|---|
| 1 (original failure) | 2 min |
| 2 | 4 min |
| 3 | 8 min |
| 4 | 16 min |
| 5+ | 30 min (capped) |

Capped at 5 total attempts. Retries reuse the original payload, generate a fresh HMAC signature for the new timestamp, and include `X-OpenTms-Retry: <attempt_count>` so the receiver can tell an original delivery apart from a retry. Idempotent: calling `retry` on an already-delivered record is a no-op.

### Key Files
- `backend/src/routes/customerDeveloper.ts` - Developer Area REST API (18 endpoints: summary, API keys CRUD, webhooks CRUD + test + rotate + deliveries, trading partners, EDI logs)
- `backend/src/services/webhooks/CustomerWebhookDeliveryService.ts` - HTTP delivery, HMAC signing, event pattern matching, `signPayload` / `verifySignature`
- `backend/src/events/handlers/CustomerWebhookHandler.ts` - Subscribes to domain events and dispatches to customer webhooks by matching `payload.customerId`
- `backend/prisma/migrations/20260419_add_customer_webhooks/migration.sql` - New `CustomerWebhook` and `CustomerWebhookDelivery` tables
- `frontend/src/customer-portal-layout.tsx` - Multi-app layout with sidebar + topbar + app switcher (Portal, Developer)
- `frontend/src/pages/customer-portal/developer/` - Five pages: Dashboard, ApiKeys, Webhooks, EdiSetup, IntegrationLogs
- `backend/src/__tests__/services/CustomerWebhookDeliveryService.test.ts` - 14 tests (signing, verification with tamper/skew/wrong-secret/malformed-header negatives, pattern matching, delivery success/failure/timeout)
