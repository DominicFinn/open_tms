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

**Fan-out across processes (#327).** `PgBossEventBus` fans an event out to the queues of the handlers
registered in its own process. A process that runs no handlers (the API with
`DISABLE_EMBEDDED_WORKERS=true`, or a `WORKER_MODE=integrations` worker) can't do that, so it puts
the event on one `evt.__dispatch` queue instead; every process that has started handlers also
consumes that queue and fans each event out to its own handler queues. pg-boss delivers each job
once, so nothing is handled twice, and scaled-out workers share the dispatch queue. Both the API's
embedded workers and the standalone worker register the event handlers with the full command bus,
so the command-driven handlers (issue engine, route planning) run in either
setup; the triage agent still also needs an LLM provider.

---

## Orders

### Commands (CQRS)

| Command | Trigger | Events Emitted |
|---------|---------|----------------|
| `CreateOrderCommand` | `POST /api/v1/orders` | `order.created` |
| `UpdateOrderCommand` | `PUT /api/v1/orders/:id` | `order.updated`, `order.status_changed` (if status changes) |
| `ArchiveOrderCommand` | `DELETE /api/v1/orders/:id`, `POST /api/v1/orders/bulk-archive` (`orders:write`) | `order.archived` |
| `SoftDeleteOrderCommand` | `POST /api/v1/orders/:id/soft-delete`, `POST /api/v1/orders/bulk-delete` (admin, `orders:delete`) | `order.deleted` |
| `UnarchiveOrderCommand` | `POST /api/v1/orders/:id/unarchive` (admin, `orders:delete`) | `order.unarchived` |

**Bulk archive/delete:** the orders list page's multi-select checkboxes drive `POST /api/v1/orders/bulk-archive` and `POST /api/v1/orders/bulk-delete`, which dispatch the same commands per-id (up to 500 ids) and return per-order `{ id, success, error }` results, mirroring the shipment list page's `bulk-archive`/`bulk-delete`/`bulk-transition` pattern.

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

These call domain services with complex orchestration logic. Most still create AuditLog records without publishing domain events through the event bus — the exception is the shipment-creation step of the four rows marked (#264): those now dispatch a command and emit `shipment.created`/`order.assigned_to_shipment` (see the Shipments section's Commands table). Everything else about these rows — order linking mechanics, delivery-status handling — is unchanged.

| Operation | Trigger | Service | What It Does |
|-----------|---------|---------|-------------|
| Assign to shipment (#264) | `POST /api/v1/orders/:id/assign-to-shipment` | ShipmentAssignmentService | Matches lane, creates/reuses shipment (dispatches `CreateShipmentCommand` when creating), creates stop, updates order status |
| Update delivery status | `POST /api/v1/orders/:id/delivery-status` | `ChangeOrderDeliveryStatusCommand` via OrderDeliveryService | Updates deliveryStatus, audit log; emits `order.delivered` / `order.exception` / `order.delivery_status_changed` |
| Mark delivered | `POST /api/v1/orders/:id/mark-delivered` | `ChangeOrderDeliveryStatusCommand` via OrderDeliveryService | Sets deliveryStatus=delivered, deliveredAt=now; emits `order.delivered` |
| Create exception | `POST /api/v1/orders/:id/delivery-exception` | `ChangeOrderDeliveryStatusCommand` via OrderDeliveryService | Sets deliveryStatus=exception, records type/notes; emits `order.exception` |
| Resolve exception | `POST /api/v1/orders/:id/resolve-exception` | `ResolveOrderDeliveryExceptionCommand` via OrderDeliveryService | Sets deliveryStatus=in_transit, records resolution; emits `order.exception_resolved` |
| Update orders for stop | `POST /api/v1/shipment-stops/:id/update-orders` | `RecordStopOrdersDeliveryCommand` via OrderDeliveryService | Moves the stop and its orders (rules below); one order event per changed order |
| Geofence check | `POST /api/v1/shipments/:id/geofence-check` | OrderDeliveryService | Calculates distance to stops, auto-updates if within radius |
| Convert to shipment (#264) | `POST /api/v1/orders/:id/convert-to-shipment` | OrderConversionService | Dispatches `ConvertOrderToShipmentCommand`: creates shipment + stop + junction, updates order status |
| Batch convert (#264) | `POST /api/v1/orders/batch-convert` | OrderConversionService | Individual mode loops `convertOrder`; combine mode dispatches `CombineOrdersIntoShipmentCommand`. Compatibility checks first |
| Split to shipments (#264) | `POST /api/v1/orders/:id/split-to-shipments` | OrderConversionService | Dispatches `SplitOrderCommand`: splits order items into multiple new shipments |
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
| `order.archived` | OrderReadModel deleted (removed from active lists; captures prior `status` in `statusBeforeArchive` for restore) | — | Audit log |
| `order.deleted` (soft delete) | OrderReadModel deleted | — | Sets `deletedAt`/`deletedBy`; hidden from every view, not recoverable from the UI |
| `order.unarchived` | OrderReadModel re-inserted (reuses the `order.created` projection path) | — | Restores `status` from `statusBeforeArchive` (falls back to `pending`) |

### Status Lifecycle

```
pending → verified → assigned → cancelled/archived
                   ↘ issue (verification failed, or no matching lane on auto-assign —
                            each pairs with a real Issue/Triage row carrying the detail)
```

`cancelled` is only reachable from `pending`/`verified`/`issue` — once `assigned`, an order is
physically committed to a shipment; a post-assignment problem is a delivery `exception`, not a
cancellation. `assigned` unifies what used to be two separate outcomes (`converted` from manual
conversion, `assigned` from auto lane-matching) — provenance lives in `AuditLog`, not a second
status value.

### Delivery Status Lifecycle

```
null (not moving yet) → in_transit → delivered
                              ↘ exception → (resolved) → in_transit
```

**What can share a shipment (#325).** `commands/orders/shipmentLoadRules.ts`, enforced inside
`AddOrdersToShipmentCommand`, `CombineOrdersIntoShipmentCommand`, `ConvertOrderToShipmentCommand` and
`SplitOrderCommand`: an FTL shipment carries exactly one order; FTL and LTL orders never share a
shipment; a shipment belongs to one customer (several customers' freight on one truck will be a
consolidation of per-customer shipments, not a shared shipment); a shipment is `tempControlled` / `hazmat` if any order on it needs that. Every path that
creates a shipment from orders sets `serviceLevel`, `tempControlled` and `hazmat` from them, and
starts it with a pickup stop at the origin (sequence 1) so leaving the origin is tracked (#324);
combining orders bound for different places sets the shipment's destination to its last drop; adding
to a shipment with no service level gives it the orders'. `OrderConversionService` runs the same
checks first only to report per order. `scripts/backfill-shipment-service-level.ts` (dry run unless
`--apply`) sets the service level on existing shipments whose orders agree and lists mixed or empty
ones for review.

**Orders on a shipment (#325).** `GET /api/v1/shipments/:id` returns, per linked order, its status,
delivery status, `deliveredAt`, service level, customer and drop stop; the shipment's Orders tab shows
them, with the shipment's service level. In the customer portal, a shipment's detail goes through
`scopeShipmentToCustomer` (`services/portal/customerShipmentView.ts`), which shows only the
customer's own stops and items. A shipment now belongs to one customer, so this is a safeguard; it
also covers shipments that mixed customers before that rule.

**Order delivery events (#325).** Every delivery status write goes through a command, so it runs in
a transaction and emits after commit: `order.delivered` (carrying `deliveredAt`, the device time
for tracking), `order.exception` (with `exceptionType`), `order.exception_resolved`, or
`order.delivery_status_changed` for anything else, one event per order. Free-text confirmer names and
notes stay in the order row and audit log, never the event. `RecordStopOrdersDeliveryCommand` drives
orders from stops: **completing a pickup** puts the not-yet-moving orders collected there `in_transit`
and never delivers anything (before, an order whose delivery stop was the origin was marked
delivered, #307); **arriving at a delivery stop** puts its unmoved orders in transit;
**completing a delivery stop** delivers its active orders. The order read model, customer webhooks,
email and in-app notifications now see deliveries, which they didn't when these were silent writes.

**Other stops (#345).** A stop that is neither a pickup nor a drop (fuel, rest, customs, a hub, an
inspection, a labelled cross-dock pass-through) has `stopType: 'other'`, a `purpose`
(`OTHER_STOP_PURPOSES` in `@open-tms/shared`: fuel, rest, customs, cross_dock, hub, inspection,
other) and an optional `label` (its own name, shown instead of the purpose; the create page only asks for one when the purpose is `other`). `POST`/`PUT
/api/v1/shipments` take one in either waypoint list as `{ locationId, stopType: 'other', purpose,
label }`, so it can sit before, between or after pickups and drops. On the create and edit page a custom route's stops are one ordered list with a single "Add stop": each stop has a location and a type (Pickup, Drop, or one of the purposes), and only Other asks for a name. Making a stop a pickup moves it up before the first drop, and making it a drop moves it down after the last pickup, so pickups always come first; other stops move freely (`toRows`/`fromRows`/`setStopType`/`canSwap` in `lib/shipmentFromOrders.ts`). Tracking treats it like a pickup
for timing (arrived on entry, completed on departure, so its dwell is recorded, and inferred as
left once a later stop is reached) but **it never moves an order**: `RecordStopOrdersDeliveryCommand`
changes no orders at an other stop, and orders are never linked to one. `syncShipmentStops` never
turns a stop into or out of an other stop, so orders can't be stranded on one. A lane stop tagged
fuel, rest, customs, cross_dock, hub or other becomes an other stop on a shipment using the lane;
untagged, pickup and dropoff lane stops stay drops. On a consolidation an other stop goes before the
drops if its shipment visits it before any drop, can be reordered anywhere, and never becomes a
shipment's origin or destination. The customer portal leaves other stops out.

**Multi-pickup shipments (#329).** Orders on one shipment may come from different origins: each
origin is a pickup stop (`stopType: pickup`), and every pickup comes before every drop. An order
links to its pickup through `Order.pickupStopId` as well as to its drop through `deliveryStopId`;
`linkOrdersToShipment` adds a missing pickup after the last one and a missing drop at the end.
`POST`/`PUT /api/v1/shipments` take `pickupWaypoints` (pickups after the origin) beside `waypoints`
(drops), and `syncShipmentStops` keeps both, refusing to drop a stop that orders still collect at or
drop at. Tracking: a pickup is arrived on entry and completed on departure, and completing it moves
the orders collected there (or, for orders with no pickup stop, the first pickup's) `in_transit`.
Arriving at a later stop with an earlier pickup still open records an inferred departure from it.

`deliveryStatus` is nullable and only ever gets a value once the order is `assigned` — there is
no `unassigned`/`assigned`/`cancelled` delivery status; those were redundant with `Order.status`.

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

**Explicit `trackableUnits[]` with nested `lineItems` at order-creation time:** `CreateOrderCommand` creates the `TrackableUnit`s and their `OrderLineItem`s as separate writes after the `Order` row exists, each with `orderId` supplied explicitly. A single Prisma nested create three levels deep (`order.create` → `trackableUnits.create` → `lineItems.create`) only auto-populates the FK for the relation it is directly traversing at each level (`trackableUnitId`), not `OrderLineItem.orderId` two levels up — since that FK is required, the nested form always failed the whole create (#269).

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
| `ArchiveShipmentCommand` | `DELETE /api/v1/shipments/:id`, `POST /api/v1/shipments/bulk-archive` (requires `shipments:write`) | `shipment.archived` |
| `UnarchiveShipmentCommand` | `POST /api/v1/shipments/:id/unarchive` (requires `shipments:delete`) | `shipment.unarchived` |
| `SoftDeleteShipmentCommand` | `POST /api/v1/shipments/:id/soft-delete`, `POST /api/v1/shipments/bulk-delete` (requires `shipments:delete`) | `shipment.deleted` |
| `ProcessInbound214Command` | `POST /api/v1/edi/214/inbound` | `edi_214.received`, `shipment.status_changed`, `shipment.stop_arrived`, `shipment.stop_completed`, `shipment.exception`, `shipment.delivered` |
| `ConvertOrderToShipmentCommand` | `POST /api/v1/orders/:id/convert-to-shipment` (via `OrderConversionService`) | `shipment.created`, `order.assigned_to_shipment` |
| `CombineOrdersIntoShipmentCommand` | `POST /api/v1/orders/batch-convert` (combine mode, via `OrderConversionService`) | `shipment.created`, `order.assigned_to_shipment` (one per combined order) |
| `SplitOrderCommand` | `POST /api/v1/orders/:id/split-to-shipments` (via `OrderConversionService`) | `shipment.created` (one per resulting shipment) |
| `AddOrdersToShipmentCommand` (#266) | `POST /api/v1/shipments/:id/add-orders` (via `OrderConversionService.addOrdersToShipment`) | `order.assigned_to_shipment` (one per added order) |

Eligibility filtering for `AddOrdersToShipmentCommand` (shipment status, origin/customer/service-level/hazmat/temp-control match) runs in `OrderConversionService` as a soft pre-dispatch check — same pattern as `CombineOrdersIntoShipmentCommand`'s `checkCompatibility` — so a batch can partially succeed: eligible orders are linked and dispatched, ineligible ones are reported back as per-order errors without ever reaching the command. Before #266 this path linked orders via a bare `prisma.$transaction` with a no-op `emit`, so despite `OrderProjection.onAssignedToShipment` being implemented and tested, `OrderReadModel.shipmentId`/`shipmentReference` never populated for orders added to an *existing* shipment this way (`removeOrderFromShipment`, the reverse operation, and `SplitOrderCommand`'s one-order-to-many-shipments case remain open — see #266 for why those need a design call rather than a mechanical fix).

`ShipmentAssignmentService.assignOrderToShipment` (auto-assignment on order intake, `POST /api/v1/orders/:id/assign-to-shipment`) also creates shipments. It dispatches the existing `CreateShipmentCommand` rather than writing the row directly, so it emits `shipment.created` too (#264). Before #264, these paths wrote the `Shipment` row with a bare `prisma.shipment.create` and never emitted anything, so `ShipmentReadModel` (and therefore `GET /api/v1/shipments`, live GPS tracking, `AutoTenderHandler`, and `SlaEvaluationHandler`) silently never saw shipments created this way — only the one path that already went through `CreateShipmentCommand` (`POST /api/v1/shipments`, and `AcceptQuoteCommand`) worked.

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
- **Bulk archive/delete** — the shipment list page's multi-select checkboxes drive `POST /api/v1/shipments/bulk-archive` and `POST /api/v1/shipments/bulk-delete`, which dispatch the same commands per-id (up to 500 ids) and return per-shipment `{ id, success, error }` results, mirroring `bulk-transition`'s pattern.

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
| `shipment.route_planned` | — | — | `SetShipmentRouteCommand` stored a custom-route shipment's planned route (#328) |
| `shipment.archived` | ShipmentReadModel row removed | — | — |
| `shipment.unarchived` | ShipmentReadModel row re-inserted | — | — |
| `shipment.deleted` | ShipmentReadModel row removed | — | — |
| `edi_214.received` | — | — | Auto-forward outbound 214 to customer trading partners |
| `edi_214.sent` | — | — | — |

### Public Sharing

A share link puts a redacted view of one shipment in front of someone outside the organisation.
It replaced the old deterministic HMAC `/track/:token` link (#155), which could not be revoked,
never expired and asked for nothing at the door.

| Command | Trigger | Events Emitted |
|---------|---------|----------------|
| `CreateShipmentShareLinkCommand` | `POST /api/v1/shipments/:shipmentId/share-links` (requires `shipments:share`) | `shipment.share_link_created` |
| `UpdateShipmentShareLinkCommand` | `PATCH /api/v1/share-links/:id` (requires `shipments:share`) | `shipment.share_link_updated` |
| `RevokeShipmentShareLinkCommand` | `DELETE /api/v1/share-links/:id` (requires `shipments:share`) | `shipment.share_link_revoked` |
| `RecordShipmentShareAccessCommand` | `POST /api/v1/share/:token/authenticate` (public) | `shipment.share_link_accessed` |

**Credentials.** Creation mints two secrets and returns them once. The URL token is 256 bits of
randomness stored as a SHA-256 hash; the 8-character access code is stored as a scrypt hash. The
code alphabet excludes I, O, 0 and 1 so it survives being read out over the phone, and codes are
matched case- and whitespace-insensitively. Neither secret is recoverable: to replace one, revoke
the link and issue another.

**What can be shared.** An allowlist, defined in `packages/shared/src/shipmentShareSections.ts`
and enforced on both the write and the read: `overview`, `events`, `orders`, `cargo`, `documents`,
`telemetry`, `carrier`. Financials, activity, SLA, customs forms and rate confirmations are never
shareable. The repository only queries the granted sections, so an ungranted relation is never
read, and documents are narrowed further to `bol`, `label` and `attachment`.

**Opening a link.** `GET /api/v1/share/:token` reports whether the gate is open without revealing
anything about the shipment. `POST /api/v1/share/:token/authenticate` takes an email address and
the access code and returns a viewer session JWT (`iss: open-tms-share`) scoped to one shipment,
lasting two hours or until the link expires, whichever is sooner. No other guard accepts that
issuer. `GET /api/v1/share/session/shipment` re-reads the link on every request, so revoking or
narrowing a link takes effect immediately rather than at session expiry.

**Audit.** Every attempt writes a `ShipmentShareAccess` row with the email supplied, a hashed
client IP and an outcome of `granted`, `denied_bad_code`, `denied_expired`, `denied_revoked` or
`denied_locked`. The email is deliberate audit data and must not be copied into logs, event
payloads or broadcasts. The operator reads it from the Shared links tab, behind `shipments:share`.

**Brute force.** Five wrong codes lock a link for 15 minutes, mirroring the account lockout rule.
A correct code clears the counter. The public routes carry their own rate limits: 10 authenticate
attempts and 60 reads per minute per IP.

### Side Effects (sharing)

| Event | Projection | Notification | Integration |
|-------|-----------|--------------|-------------|
| `shipment.share_link_created` | — | — | — |
| `shipment.share_link_updated` | — | — | — |
| `shipment.share_link_revoked` | — | — | — |
| `shipment.share_link_accessed` | — | — | — |

No read model: the Shared links tab lists one shipment's links, which is a bounded read straight
off `ShipmentShareLink`, and the open count is a counter on the row rather than an aggregate over
the access ledger.

### Tracking (IoT)

| Event | Source | Side Effects |
|-------|--------|-------------|
| `tracking.location_received` | Inbound webhook worker | ShipmentReadModel.currentLat/Lng updated, geofence check |
| `tracking.geofence_entered` | `RecordGeofenceArrivalCommand` | Origin stop marked arrived; any other stop marked completed (#324), orders at it delivered. Also emits `shipment.stop_arrived` for every stop, plus `shipment.stop_completed` for non-origin stops |
| `tracking.geofence_exited` | `RecordGeofenceDepartureCommand` | Origin ShipmentStop marked completed; a `ready` shipment moves to `in_progress` (`shipment.status_changed`); also emits `shipment.stop_completed` ("Departed origin"). `inferred: true` when implied by reaching a later stop |
| `tracking.journey_checkpoint` | `RecordJourneyCheckpointCommand` | Writes a `ShipmentJourneyCheckpoint` row per checkpoint, including any filled in between pings (`inferred: true`); no shipment/stop side effect |
| `tracking.eta_updated` | ETA recalculation | — |

**Full-journey proof (#283).** `ArrivalCriteriaEvaluationService` dispatches all three geofence events
through the command bus (previously `tracking.geofence_entered` was defined but never published —
arrival was a silent direct write). On each device ping: a match against a `pending` stop dispatches
`RecordGeofenceArrivalCommand`; a stop that was `arrived` and is now outside its geofence radius (origin
only, v1) dispatches `RecordGeofenceDepartureCommand`; otherwise, if the shipment has departed its origin,
has a `LaneRoute`, and hasn't yet arrived at its destination, its position is located along the route
(`RouteProgressService.locateOnRoute`) and bucketed into one of 10 segments — a new segment dispatches
`RecordJourneyCheckpointCommand`. A checkpoint never fires on the same ping as an arrival. Query a
shipment's full journey via `GET /api/v1/shipments/:id/journey`. Waypoints are covered by #324 below;
there is still no GPS-jitter hysteresis on the geofence boundary.

**Journey report for multi-stop shipments (#348).** `/journey` returns every stop in sequence (type,
purpose, status, arrival and departure, `isOrigin`/`isDestination`) plus the checkpoints and the
origin/destination summary. The destination is the *last* stop at the destination location. A
completed pickup or other stop with no departure time is flagged `departureInferred`: the vehicle
was never seen leaving, and reaching a later stop implied it. Drops complete on entry, so they are
never flagged. Checkpoints still run in 10% steps over the whole planned route. A shipment with no
lane route only gets a planned route (and so checkpoints) when the org has a Google Maps server key.

**Changing a shipment's stops (#328).** `syncShipmentStops` (create, and update of a draft with
`waypoints`) reconciles the stored stops with the route instead of rebuilding them: a stop whose
location stays on the route keeps its row and is only renumbered, so the orders dropping there keep
their `deliveryStopId` (before, every edit deleted and recreated the stops and cut that link); new
locations get new stops; stops off the route are deleted, and if orders still drop at one the update
is refused (`StopStillHasOrdersError`). Adding an order whose drop isn't a stop yet
(`AddOrdersToShipmentCommand`) inserts it before the destination, renumbers the stops 1..n and emits
`shipment.updated`, so a custom-route shipment is re-planned. Combine and convert put the new
shipment on a lane only when one matches its stops exactly (same first and last stop, the same
stops in between in order) and supports its service level (`assignMatchingLane`); otherwise it stays
a custom route. `PUT /api/v1/shipments/:id` accepts `laneId: null` to take a shipment off its lane.
The shipment page warns while a draft or ready lane shipment's stops don't match its lane, offering
"Switch to custom route" or "Save as new lane" (a lane with the shipment's stops, then assigned).

**Creating a shipment from orders (#328).** The create-shipment page takes `?orderIds=a,b` (from an
order's "Create shipment" or the orders list's "Ship together"; the older `?fromOrderId=` still works).
"Ship together" is only clickable for two or more available orders that can share a shipment (one
customer, one origin, LTL); otherwise it's disabled and the reason from `shipTogetherProblem` is
shown beside it. The page has an Orders card with an "Add order" search limited to orders that can join (same customer,
origin and service level, available, LTL only when there's more than one). The rules live in
`frontend/src/lib/shipmentFromOrders.ts`: adding orders fills empty fields, widens the dates, adds
each drop as a stop and turns on temperature/hazmat handling, but never overwrites an edit, and no
field is locked; `orderConflicts` blocks saving when the form no longer fits the orders. On open, a
lane from the orders' origin to their last drop is preselected (`GET /api/v1/lanes/between`), if it
supports the orders' service level (or Both), preferring one whose stops cover the other drops; its stops plus any uncovered drops become the
shipment's stops, with a warning that the lane's route won't pass through the extra ones. With no
lane, the shipment gets a custom route through the drops. The Waypoints card is only shown for a
custom route. Saving creates the shipment through `CreateShipmentCommand`, then attaches every order
through add-orders, which enforces the same rules server-side.

**Shipment routes (#328).** A shipment is measured against one planned route:
`ShipmentRouteRepository.findEffectiveRoute` returns its own `ShipmentRoute` when it's on a custom route
(no lane), otherwise its lane's `LaneRoute`. Journey checkpoints, route deviation in the ETA monitor,
`GET /api/v1/shipments/:id/route` and the shipment map all read it. `ShipmentRoutePlanningHandler`
(on `shipment.created` / `shipment.updated`) runs `ShipmentRoutePlanner`: a lane shipment rides its
lane and any route of its own is removed; a custom-route shipment that is `draft` or `ready` gets a
Google Directions route through its stops in sequence, stored by `SetShipmentRouteCommand`, which
emits `shipment.route_planned`. The provider is called outside any transaction and only when the stop
sequence changed (`ShipmentRoute.stopsKey`); with no Google Maps server key in the org's maps settings
planning is skipped and logged. Once a shipment is moving, its route isn't re-planned. Known gap: the
standalone worker only has a command bus when an LLM provider is configured, so without one it doesn't
run command-driven handlers, this one included.

**Multi-stop shipments (#324).** Stops are matched one at a time, not by location
(`services/tracking/journeyStops.ts`). For each location, a ping can only act on that location's
lowest-sequence open stop, and a repeat visit (the same location later in the route) only becomes
eligible once another location has been completed since the earlier visit, so a truck parked after
its first drop doesn't complete the second. Entering the origin's geofence marks it `arrived`;
leaving it completes it and moves a `ready` shipment to `in_progress` (#307). Entering any other
stop's geofence **completes** it: middle stops and destination alike, stop order not enforced, and its
orders are marked delivered. Reaching a later stop when no origin departure was ever seen records an
inferred departure first (no departure time). `ShipmentCompletionHandler` completes the shipment only
once **every** stop is `completed` or `skipped`; if the final stop completes while others are still
open, it publishes `shipment.exception` with `exceptionType: 'stops_not_visited'` and the open stop
ids, and the shipment stays `in_progress` until they're visited or it's completed by hand. Journey
checkpoints are measured over the route between the origin and destination geofence edges, so none
falls inside a geofence. Geofence and checkpoint events carry the matching `deviceId`. On the timeline,
origin arrival is "Arrived at origin" (`arrives_origin`) and a middle stop's completion is
"Completed waypoint". Known gap: the legacy `checkGeofenceAndUpdateOrders` (#288) can still mark a
repeat-visit stop `arrived` while the truck sits at the first visit, if that stop has the legacy
`geofenceEnabled` flag.

**Tracking pings (#323).** Every vendor payload is parsed into one internal `TrackingPing`
(`integrations/tracking/TrackingPing.ts`): device, **device timestamp**, optional position, a
`readings[]` array (temperature, battery level/voltage, light, pressure) and `readingsCount`.
`parseSystemLocoPing` and `parseGenericPing` are the two adapters; the generic shape accepts either a
`readings` array (one entry per buffered reading, each with its own `time`) or a single `sensors`
block. Once the ping resolves to a shipment, both feeds go through the same path in the worker: the
`tracking.location_received` event, then arrival-criteria evaluation (arrival, origin departure,
checkpoints), then the legacy geofence check. Arrival, departure, checkpoint and the stop/order
timestamps written by `OrderDeliveryService.updateOrdersForStop` all use the device time, not the
time the worker ran. Timeline entries for tracking events (and for `shipment.stop_arrived` /
`shipment.stop_completed`, which now carry `eventTime`) are stamped with that device time too, and so is shipment completion:
`ShipmentCompletionHandler` sets `deliveryDate` from the arrival's `eventTime` and carries it on
`shipment.delivered` and the `status_changed` it publishes. Readings from a generic ping are stored through
`SensorReadingRepository.createForDevice`, keyed `webhook:<webhookLogId>:<n>` on
`SensorReading.sourceReportId` so a queue retry is a no-op; a device the org hasn't registered keeps
its readings only in the webhook log's raw payload. The webhook log's response body records
`readingsReceived` and `readingsStored`. System Loco readings are still stored by
`SystemLocoAdapter` (it feeds cold chain and alerting).

**Standalone worker (#287, #327).** `worker.ts` (the separate worker container) sets up the same DI
container as the API, so it uses the same queue adapter, event bus, full command bus, order delivery
service and arrival-criteria service, and wires the same journey pipeline as the embedded API worker.
In `WORKER_MODE=integrations` it runs no event handlers, so its events go through the dispatch queue
to an events worker.

**Skipped checkpoints.** Pings can be far enough apart that a shipment jumps several checkpoints.
`RecordJourneyCheckpointCommand` records every checkpoint between the last recorded one and the one
reached: a filled-in checkpoint is placed on the planned route (`passedCheckpoints`), timed by
interpolating by distance between an anchor and this ping. The anchor is the last recorded
checkpoint or, before the first one, the origin departure at distance 0; with neither, it takes the
ping's time, and its event carries `inferred: true`. The timeline shows it as "passed
(between pings)".

### IoT Devices & Vendors

**Admin vendor toggle.** `IotVendor` is a per-org registry (`@@unique([orgId, vendorKey])`) of IoT tracking vendors. System Loco is vendor #1, enabled by default. Managed at `/settings/iot-vendors`:
- `GET /api/v1/settings/iot-vendors` (any authed user) lists the known vendors. It never writes: a vendor the org hasn't configured is shown as enabled with no secret, which is also how the webhook worker treats a missing row. The shipment form uses it to decide whether to show the IoT section.
- `PUT /api/v1/settings/iot-vendors/:vendorKey` (`settings:write`) dispatches `UpdateIotVendorSettingsCommand`, which toggles `enabled` and sets or clears the webhook secret. Emits `iot_vendor.settings_updated`; the event says whether the secret changed but never carries it.
- When a vendor is **disabled**, the inbound webhook worker logs its webhooks as `disabled` and skips processing.

**Device assignment on shipments.** The shipment create/edit form (when any vendor is enabled) accepts `devices: [{ name, externalId }]`. `reconcileShipmentDevices` (called inside `CreateShipmentCommand` / `UpdateShipmentCommand`) upserts a `Device` per `externalId` and maintains active `DeviceAssignment` rows: adds new ones (releasing the device's prior assignment, with a `device.unassigned` for each), and on edit deactivates assignments dropped from the list. Emits `device.assigned` / `device.unassigned`. Idempotent. Shipment-level only for now. `externalId` is unique across the platform, so an id already registered to another org fails the command with `DEVICE_UNAVAILABLE` instead of being taken over.

**Telemetry reads.** `GET /api/v1/shipments/:id/telemetry` and `GET /api/v1/orders/:id/telemetry` go through `TelemetryService` and `SensorReadingRepository`. `SensorReading` has no `orgId`, so the repository confirms the shipment or order belongs to the caller's org (404 otherwise) and also filters readings by `device.orgId`. The shipment response adds a summary (temperature min/max/avg/latest, alert count, latest battery and pressure, device count).

**Webhook resolution.** `SystemLocoAdapter.resolveAssignment` resolves a device to a shipment by: (1) active `DeviceAssignment` for the device id, then (2) device name → `Shipment.reference`, then (3) device name → `Order.orderNumber`. Creating devices on the shipment form populates path (1). Lookups use existing indexes: `Device.name`, `Device.externalId` (`@unique`), `DeviceAssignment[deviceId, active]`, `Shipment.reference`, `Order.orderNumber` (`@unique`).

**Webhook ingestion (`POST /api/v1/webhook`).** Verify → enqueue (pg-boss `INBOUND_WEBHOOK`) → 202, real work in `inboundWebhookWorker`. Auth: `X-LocoAware-Signature` HMAC-SHA256 (timing-safe, raw body; secret on `IotVendor.webhookSecret`) when present, else API key. **Idempotent**: the worker skips events whose `id` already exists as `DeviceEvent.externalEventId` (logged `duplicate`); `SensorReading.sourceReportId` is a unique backstop. When a resolved event carries a location, the worker publishes `tracking.location_received` → `ShipmentProjection` updates `ShipmentReadModel.currentLat/lng/lastLocationAt` (map/list position). Sensor data is stored on `SensorReading` (hot columns incl. atmosphericPressure, locationType, locationAccuracy + full `rawPayload`) and surfaced on the Telemetry tab. Full details: `docs/SYSTEM_LOCO_INTEGRATION.md`.

---

## Carriers

### Commands

| Command | Trigger | Events Emitted |
|---------|---------|----------------|
| `CreateCarrierCommand` | `POST /api/v1/carriers` | `carrier.created` |
| `UpdateCarrierCommand` | `PUT /api/v1/carriers/:id` | `carrier.updated` |
| `ArchiveCarrierCommand` | `POST /api/v1/carriers/:id/archive` | `carrier.archived` |
| `UnarchiveCarrierCommand` | `POST /api/v1/carriers/:id/unarchive` | `carrier.unarchived` |
| `SoftDeleteCarrierCommand` | `DELETE /api/v1/carriers/:id` | `carrier.deleted` |

### Carrier Lifecycle (Archive / Delete)

- **Archive** — normal-user action. Stops the carrier being selected for new work
  and deactivates its portal users (they can no longer log in), but it stays
  visible to finance/admin (detail page shows an "archived" banner). Reversible
  via **Unarchive** (finance/admin), which reactivates non-anonymised users.
- **Soft delete** — admin action for accidental creates / dev cleanup. Sets a
  `deletedAt`/`deletedBy` tombstone; the carrier 404s everywhere but the row is
  retained for audit/finance history. **A carrier assigned to any lane cannot be
  deleted — only archived** (the command throws, surfaced as a 400).
- **Validation (#93)** — optional format fields treat "" as absent (a blank email
  no longer fails save); only `name` is mandatory. `paymentTermsDays`/`currency`
  now persist.
- **Listing** — `GET /carriers` excludes soft-deleted and (by default) archived;
  `?includeArchived=true` returns archived too for the management list. `findById`
  returns archived (for the banner) but not deleted.
- **Notification** — `CarrierArchivalNotificationHandler` messages the carrier's
  portal users on archive/delete (email **stubbed**) and emits an auditable
  `carrier.users_notified` event (recipients, reason, channel).
- **Anonymisation** — `CarrierUserAnonymizationService` (daily pg-boss cron,
  `CARRIER_USER_ANONYMIZE_DAYS`, default 365) scrubs portal-user PII 1 year after
  the carrier is archived/deleted: email → unique placeholder, name blanked,
  password invalidated, `anonymizedAt` stamped, account deactivated.

### Side Effects

| Event | Projection / Handler |
|-------|-----------|
| `carrier.created` | CarrierReadModel inserted (vehicle/driver/lane counts) |
| `carrier.updated` | CarrierReadModel fields updated |
| `carrier.archived` | CarrierReadModel.status = 'archived'; portal users deactivated; users notified (stub email) |
| `carrier.unarchived` | CarrierReadModel.status = 'active'; non-anonymised users reactivated |
| `carrier.deleted` | CarrierReadModel removed; portal users deactivated; users notified (stub email) |
| `carrier.users_notified` | Auditable record of who was messaged, why, and via which channel |

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

### Geofences

A generic, polymorphic `Geofence` table (radial or polygon, JSON geometry) attachable to any entity
type by `entityType`/`entityId` — no Prisma relation, joined manually like `Attachment`/`Comment`.
Only `entityType: 'location'` is wired up today. Every Location API response embeds that location's
active geofences as `geofences: Geofence[]` (`GeofenceRepository.findByEntity`/`findByEntities` in
`withGeofence`/`withGeofences`, `backend/src/routes/locations.ts`).

Drawn by hand in the Locations create/edit form (`GeofenceEditor`, Leaflet, no drawing plugin —
click to place a radial center or polygon vertices) as its own "Geofence" section. One geofence per
location in the UI today; the API itself supports several per entity.

**Not in scope here**: what counts as being inside a geofence (arrival/departure detection) — that's
`ArrivalCriteria` / `ArrivalCriteriaEvaluationService`, untouched by this feature.

| Command | Trigger | Events Emitted | Side Effects |
|---------|---------|----------------|-------------|
| `CreateGeofenceCommand` | `POST /api/v1/geofences` | `geofence.created` | Validates the target entity exists in-org first |
| `UpdateGeofenceCommand` | `PUT /api/v1/geofences/:id` | `geofence.updated` | |
| `ArchiveGeofenceCommand` | `DELETE /api/v1/geofences/:id` | `geofence.archived` | Soft-delete (`active: false`) |

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

### Lane Stops

Each intermediate hub-and-spoke stop (`LaneStop`) has an optional `purpose` tag describing what the stop is for: `pickup`, `dropoff`, `cross_dock`, `fuel`, `rest`, `hub`, `customs`, or `other`. It doesn't affect routing, rating, or the planned-route (`LaneRoute`) waypoints, but a pass-through purpose (`cross_dock`, `fuel`, `rest`, `hub`, `customs`, `other`) makes the stop an other stop on shipments that use the lane (#345). Set on the create/edit lane form alongside the stop's location and order.

---

## Consolidations (#329)

A consolidation is one truck run carrying several shipments, usually for several customers. Each
shipment stays one customer's (its own BOL, invoice and portal view); the consolidation owns the
combined stops. Models: `Consolidation`, `ConsolidationStop`, `ConsolidationShipment` (join; its
unique `shipmentId` keeps a shipment on at most one consolidation), and `ShipmentStop.consolidationStopId`
linking each shipment stop to the consolidation stop that serves it. Lists read `ConsolidationReadModel`.

### Commands

| Command | Trigger | Events Emitted |
|---------|---------|----------------|
| `CreateConsolidationCommand` | `POST /api/v1/consolidations` | `consolidation.created` |
| `UpdateConsolidationCommand` | `PATCH /api/v1/consolidations/:id` (carrier, notes) | `consolidation.updated` |
| `AddShipmentsToConsolidationCommand` | `POST /api/v1/consolidations/:id/shipments` | `consolidation.shipment_added` (one per shipment) |
| `RemoveShipmentFromConsolidationCommand` | `POST /api/v1/consolidations/:id/shipments/:shipmentId/remove` | `consolidation.shipment_removed` |
| `ArchiveConsolidationCommand` | `POST /api/v1/consolidations/:id/archive` | `consolidation.archived` |
| `TransitionConsolidationStatusCommand` | `POST /api/v1/consolidations/:id/status` (`draft` ⇄ `ready`) | `consolidation.status_changed` |
| `ReorderConsolidationStopsCommand` | `POST /api/v1/consolidations/:id/stops/order` | `consolidation.stops_reordered`, `shipment.updated` per realigned shipment |
| `ShipOrdersTogetherCommand` | `POST /api/v1/consolidations/from-orders` ("Ship together" on the orders list across customers) | `shipment.created` and `order.assigned_to_shipment` per shipment, `consolidation.created` |
| `SyncConsolidationProgressCommand` | `ConsolidationProgressHandler` (on `shipment.stop_arrived`, `shipment.stop_completed`, `shipment.status_changed`) | `consolidation.status_changed`, `consolidation.stops_updated` |

`UpdateConsolidationCommand` also takes `devices` (the run's tracking devices, `DeviceAssignment.consolidationId`)
and pushes a set carrier to every shipment on the run; create and add push the run's carrier too.
Each emits `shipment.updated` for the shipments it changed.

Writes need `shipments:write`. `GET /api/v1/consolidations/candidates` lists shipments that can join.

### Rules

- A shipment can join only while `draft` or `ready`, not archived, and not on another consolidation.
- Shipments are added and removed only while the consolidation is `draft`.
- **Stops are rebuilt on every add and remove** (`rebuildConsolidationStops`): every pickup before
  every drop, each in the order the shipments were added and then each shipment's own stop order.
  Shipments sharing a location share its stop (a pickup and a drop at the same place stay separate
  stops). Stops still needed keep their row and status; stops no longer needed are deleted, which
  unlinks their shipment stops.
- **Each shipment's stops follow the run's order** (`alignShipmentStops`, after every rebuild and
  reorder): its stops are renumbered in the order the run visits them, and its origin and
  destination become the first and last. Tracking runs per shipment, so a shipment whose own order
  disagreed would infer departures from stops the truck hasn't left.
- Drops (or pickups) can be reordered within their section while draft; a pickup never follows a drop.
- **Ready** needs at least one shipment and every shipment `ready`; a ready run can go back to draft.
- Archiving a draft frees its shipments (they can be consolidated again) and deletes its stops. A
  completed or cancelled run keeps its shipments as the record. A run in progress can't be archived.

### Side Effects

| Event | Projection |
|-------|-----------|
| `consolidation.*` | `ConsolidationProjection` rebuilds the row from source: carrier name, shipment and customer counts, customer names, stop count, first and last stop, earliest pickup, latest delivery, archived |

Backfill: `npx tsx backend/src/scripts/backfill-read-models.ts --only=consolidations`.

### Tracking (fan-out)

A device on a consolidation tracks every shipment on it. `SystemLocoAdapter.resolveAssignment` and
the generic-feed path in `inboundWebhookWorker` resolve the device's active assignment to the run's
live shipments (`ConsolidationRepository.memberShipmentIds`), and the ping is applied to each one
through the normal per-shipment journey: position, geofence arrival and departure, checkpoints,
order delivery, cold chain. So each shipment completes at its own last drop, only that stop's
orders move, and each customer's portal shows its own shipment's live position. Each shipment gets
its own copy of the readings; `sourceReportId` is unique, so the first copy keeps the feed's id and
the others are suffixed with their shipment (`fanOutKey`). The device event is stored once.

The run mirrors its shipments (`SyncConsolidationProgressCommand`): a run stop is completed when
every shipment stop it serves is done and arrived once any is; a ready run goes `in_progress` once
anything moves and `complete` when every shipment is complete. Draft, complete and cancelled runs
only change by hand. The detail page's map shows the stops in order and the freshest position
among its shipments.

### Costs

The run has a `carrierRateCents` (and `currency`): what the carrier bills for the whole run.
`allocateConsolidationCost` splits it across the run's shipments **by weight** (each shipment's
order lines, weight × quantity, pounds converted), evenly when nothing is weighed, in whole cents
that add up to the rate (largest remainder). Each share is a pending `cost` / `linehaul` charge on
the shipment with `source: 'consolidation'` and `sourceId` = the consolidation, and every touched
shipment's `ShipmentFinancialSummary` is recalculated, so each customer's shipment shows its own
margin. It re-runs when the rate or currency is set, a shipment joins or leaves, or a draft is
archived (which removes the shares). Shares are updated in place; a shipment that leaves loses its
share. Once any share is approved or invoiced the split is fixed and re-splitting is refused. A
shipment with charges in another currency is refused. Emits `charge.created` for each new share and
`consolidation.cost_allocated` with the basis (`weight`, `even`, `none`) and the shares.

### Shipping several customers' orders together

"Ship together" on the orders list with orders for one customer opens the create page as before
(one shipment). With orders for **several customers** it builds everything in one transaction
(`ShipOrdersTogetherCommand`): one draft shipment per customer (the same
`combineOrdersIntoNewShipment` that `CombineOrdersIntoShipmentCommand` uses: pickups, drops, order
links, matching lane), all on a new draft consolidation. Refused, with nothing created, when any
order is assigned, cancelled or delivered, is FTL, lacks a pickup or drop, or when the orders are
all one customer's.

### Customer portal

A customer only ever reaches their own shipment (`customerId` scoped; another customer's shipment
on the same run is a 404). `scopeShipmentToCustomer` drops `consolidationStopId` from the stops, so
the run stays invisible. Live position comes from the shipment's own location events, which the
fan-out writes for every shipment on the run. Those events are the truck's track, so they include
positions at other customers' stops (coordinates only, no names).

Checkpoints are per shipment, not per run. A changed order weight is picked up the next time the run's cost
is re-split (saving the rate again), not automatically.

---

## Issues / Triage

Issues track operational problems — exceptions, delays, damage, compliance failures. They can be created manually or auto-created from domain events.

### Deterministic Issue Engine

Issue creation for the **shipment-exception domain** is deterministic and LLM-independent. The `IssueEngineHandler` (`backend/src/events/handlers/IssueEngineHandler.ts`) subscribes to every trigger + recovery event declared by the **Issue Type registry** (`backend/src/services/issues/issueTypeRegistry.ts`) and owns issue creation via the command bus — so issues are raised even when no AI is configured, and every issue gets the same downstream side effects (`issue.created` → notifications, projection, SLA evals).

**Issue Type registry (v1, code-defined; admin-editable DB version is a roadmap item):**

| Key | Trigger event(s) | Default priority | Latched | Recovery event (auto-resolve) |
|-----|------------------|:----------------:|:-------:|-------------------------------|
| `shipment_cutoff_risk` | `shipment.cutoff_at_risk` | high | no | `shipment.cutoff_cleared` |
| `shipment_eta_delay` | `tracking.eta_updated` | by severity | no | `tracking.eta_recovered` |
| `shipment_misship` | `cargo.misdrop_detected` / `cargo.missing_at_stop` / `cargo.left_on_vehicle` | high | **yes** | — (investigate) |
| `shipment_temperature` | `cold_chain.excursion_detected` | critical | **yes** | — (investigate) |
| `shipment_tamper_light` | `shipment.tamper_light` (light-in-transit before arrival) | critical | **yes** | — (investigate) |

Each type carries: `defaultPriority`, `latched`, `ignoreSignalSeverity` (temperature/tamper stay critical), and a raise rule `{ thresholdCount, windowMinutes, priorityFloor }`.

**Engine behaviour per event:**
- **Trigger** — append a row to the `IssueSignal` ledger, then apply the raise rule: **N signals within the window OR a signal at/above the severity floor**. Dedup is a single rule — **one open issue per (issueType, source entity)**. A matching event on an already-open issue **escalates** it (bumps priority) and attaches the signal rather than duplicating.
- **Recovery** — auto-resolve the open issue if the type is **unlatched**; **latched** issues are left open ("it happened", must be investigated).
- Signal severity → priority via `{ minor/minor_delay: low, warning: medium, critical: high }`; `ignoreSignalSeverity` types always use their default.

**IssueSignal ledger** (`IssueSignal` table) is append-only: it drives the raise accumulator **and** feeds the per-shipment "events / issues over time" graphs (`GET /api/v1/shipments/:id/issue-activity`, shown on the shipment detail **Activity** tab).

**Recovery emitters** live in the monitors that own each condition: `ShipmentCutoffMonitorService` emits `shipment.cutoff_cleared` on the at-risk→clear edge; `ShipmentEtaMonitorService` tracks `Shipment.lastEtaDelaySeverity` and emits `tracking.eta_recovered` on the delay→on-time edge.

This engine **replaced** the previous bespoke direct-writers (cold-chain compliance handler, cutoff monitor) and the LLM-as-primary-creator. Other domains (order, financial/margin, SLA, EDI) still use their own creators and will be migrated onto this framework incrementally.

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

### Triage: signal scoring, noise and SLA

**Signal confidence** (`signalScore`, 0-100) is maintained by `IssueEngineHandler` from the
`IssueSignal` ledger:

| Behaviour | Rule |
|---|---|
| Initial score | The Issue Type's `baseConfidence` (cutoff 75, mis-ship 70, ETA delay 55, tamper 40, temperature 30) |
| Corroboration | `+15` per additional signal, capped at `95` |
| Recalculation | Recomputed from the ledger on every signal, never incremented, so replayed events cannot inflate it |

**Noise suppression** (`isNoise` + `noiseReason`): set when `signalScore <= 40`. Suppressed issues
are excluded from the board, actionable queue and dashboards unless explicitly requested.

> **Latched types are never suppressed.** `isNoise()` returns false for any latched type regardless
> of score, and `POST /api/v1/triage/batch/dismiss-noise` returns **409** if any target is latched.
> A temperature excursion or possible tamper has already happened; it must be resolved with a
> reason, not hidden.

**SLA and response metrics** are stamped by `UpdateIssueCommandHandler`:
- `slaDeadline` — set at raise time from the Issue Type's `slaMinutes`
- `firstResponseAt` / `timeToFirstResponseMins` — first move off `open` or first assignment,
  recorded once and never overwritten
- `timeToResolutionMins` — on reaching `resolved` or `closed`
- `slaBreach` — set true when an issue settles past its deadline; only ever set true

All of these are mirrored onto `IssueReadModel` by `IssueProjection` so the triage queues filter and
sort without joining back to `Issue`. `onIssueResolved` / `onIssueClosed` re-read the issue so the
resolution metrics reach the read model.

### Manually-raised issues

Not every issue has a detector behind it. "Report issue" on the triage board
(`frontend/src/vnext-design/triage/CreateIssueDialog.tsx`) posts to the shared
`POST /api/v1/issues` endpoint, which dispatches the same `CREATE_ISSUE` command the engine uses. A
manual issue is identified throughout triage by a **null `issueType`**.

Because there is no Issue Type to inherit from, `CreateIssueCommandHandler` stamps the manual
equivalents:

| Field | Manual value | Why |
|---|---|---|
| `signalScore` | `MANUAL_SIGNAL_SCORE` (80) | A person filed it deliberately — stronger than any single detector reading, so it outranks every `baseConfidence` in the registry but stays under the corroboration ceiling of 95 |
| `isNoise` | always false | 80 is well clear of the 40 noise threshold; a human report is never auto-suppressed |
| `slaDeadline` | by priority — critical 60m, high 120m, medium 240m, low 480m | Otherwise hand-raised work ages invisibly, outside SLA health |
| `latched` | false | Nothing to latch; it can be resolved and closed normally |
| `lastActivityAt` | creation time | So it sorts sensibly in the working queue |

The engine always passes `signalScore` and `slaDeadline` explicitly, so these defaults only ever
apply to genuinely manual issues. The subject is optional and may be a **shipment, order or
carrier** (`sourceEntityType` + `sourceEntityId`).

**Batch actions** (`/api/v1/triage/batch/*`) fan out through the command bus, one `UPDATE_ISSUE`
dispatch per issue, so each emits its own domain events. Ids are scoped to the org first; outcomes
are reported per id rather than failing the whole batch.

### Issue Closure Report

When an issue is closed (`issue.closed` event), the `IssueClosureReportHandler` automatically generates a PDF closure report:
- **Trigger:** `issue.closed` event
- **Handler:** `IssueClosureReportHandler`
- **Output:** PDF stored via `IBinaryStorageProvider` as a `GeneratedDocument` (documentType: `issue_closure_report`)
- **Content:** issue summary, triggering event, shipment/order context, temperature telemetry, SLA evaluations, activity timeline, CAPA reports

---

## Comments (Polymorphic)

Comments are a generic, polymorphic entity that can be attached to issues, shipments, or orders. The `entityType` + `entityId` fields link a comment to its parent.

**Tag:** Comments carry an optional free-form `tag` field for categorization (e.g. `"issue"`, `"requirement"`). It's purely a label — no other system reacts to it. The shipment create/edit form (`VNextCreateShipment.tsx`) uses this to let users add notes tagged as "Issue" or "Additional requirement" while building a shipment; notes are posted as comments (`entityType: "shipment"`) once the shipment is saved. Tagged comments render with a colored badge on the shipment detail Notes & Comments tab (`VNextShipmentDetail.tsx`).

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

### Financial tenancy

Charges, invoices, carrier invoices, financial queries, credit notes and quotes are all scoped to
the caller's org (#303). Before that, the routes dispatched with an empty org when none was set and
looked records up by id alone.

- Every repository `findById` and list filter takes `orgId`, and a cross-tenant id returns 404.
- Command handlers load their aggregate with `{ id, orgId: command.orgId }`. A command that fails
  with "not found" maps to 404 through `commandFailureStatus`.
- `CreateChargeCommand` and `ReweighAdjustmentCommand` refuse a shipment or order from another org.
  `RaiseQueryCommand` does the same for the invoice, carrier invoice and shipment it references.
- `CreateOrderCommand` writes under `command.orgId` only. An `orgId` in the payload used to override
  it.
- Carrier payment batching (list, schedule, execute, scheduled summary) only reads and pays the
  caller's invoices.
- Rate calculation and quick quotes only price lanes that belong to the caller, and the credit check
  only sums the caller's invoices.
- `MarginAlertHandler` reads margin settings from the org that raised the charge event, not the first
  organization.

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

**Authentication and tenancy (#314):** every EDI endpoint needs either an internal user JWT (the
admin UI) or an `x-api-key` (the edi-collector). The org comes from that credential. A `partnerId`
in the body or path only selects a partner inside the caller's org; a partner from another org is a
404, and a request with no credential is a 401. Before #314 an unauthenticated request naming a
partner was given that partner's org.

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
| `AssignDeviceCommand` | `POST /api/v1/devices/:id/assign` | `device.unassigned` (per released assignment), `device.assigned` |
| `UnassignDeviceCommand` | `DELETE /api/v1/devices/:id/assign` | `device.unassigned` (per released assignment) |
| `UpdateIotVendorSettingsCommand` | `PUT /api/v1/settings/iot-vendors/:vendorKey` | `iot_vendor.settings_updated` |

Every device command checks the device belongs to the command's org; a device from another org
fails with `DEVICE_NOT_FOUND` (404). `AssignDeviceCommand` needs at least one target (shipment,
order or trackable unit) and checks each is in the org. Trackable units have no `orgId`, so they
are scoped through their order. `CreateDeviceCommand` refuses an `externalId` that is already
registered (409). Reads (`GET /devices`, `/devices/:id`, `/devices/:id/readings`) go through
`DeviceRepository` and `SensorReadingRepository`.

### Side Effects

| Event | What Happens |
|-------|-------------|
| `device.assigned` | Previous assignments released, new assignment created |
| `device.unassigned` | Assignment deactivated |
| `iot_vendor.settings_updated` | None yet. The webhook worker reads the vendor row directly |

---

## Cargo Tracking

`CargoScan` and `CargoDiscrepancy` carry `orgId`. Every route resolves the shipment, stop or
discrepancy under `req.orgId` first, so another tenant's id is a 404, and every write goes through a
command whose events carry the real `orgId` and actor.

### Commands

| Command | Trigger | Events Emitted |
|---------|---------|----------------|
| `RecordCargoScanCommand` (`cargo.record_scan`) | `POST /api/v1/cargo-scans` | `cargo.scan_recorded`; `cargo.misdrop_detected` when an unload lands at a stop the unit wasn't bound for |
| `ReconcileStopCargoCommand` (`cargo.reconcile_stop`) | `POST /api/v1/shipment-stops/:stopId/reconcile-cargo`; stop completion in `OrderDeliveryService` (with `autoScanMethod`) | `cargo.missing_at_stop` per expected unit never unloaded |
| `CheckLeftOnVehicleCommand` (`cargo.check_left_on_vehicle`) | `POST /api/v1/shipments/:shipmentId/check-left-on-vehicle`; last stop completed in `OrderDeliveryService` | `cargo.left_on_vehicle` per unit never confirmed delivered |
| `UpdateCargoDiscrepancyCommand` (`cargo.update_discrepancy`) | `PATCH /api/v1/cargo-discrepancies/:id` | `cargo.discrepancy_resolved` when the status first moves to `resolved` |

### Side Effects

- An unload scan sets the unit's `currentStopId`; every scan sets `lastScannedAt`.
- A misdrop is `misdrop_early` or `misdrop_late` against the unit's own delivery stop, or
  `wrong_destination` when it has none.
- A stop completed automatically (geofence, IoT) gets an unload scan for every expected unit before
  reconciling. A completed stop with no unload scans at all is treated as fully delivered.
- `CargoReconciliationService` is now a thin facade that dispatches the two reconciliation commands
  under the shipment's own org.

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
| `cold_chain.excursion_detected` | Temperature reading outside the shipment's effective alert range |
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

Tracks calibration records for IoT temperature devices used in cold chain monitoring.

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

- `backend/prisma/schema/tms.prisma` - LaneRoute model
- `backend/src/services/routing/GoogleMapsDirectionsService.ts` - Google Maps Directions API + polyline encode/decode
- `backend/src/services/routing/RouteDeviationService.ts` - Point-to-polyline deviation detection
- `backend/src/services/routing/ShipmentEtaMonitorService.ts` - Integrated deviation checking during ETA monitor runs
- `backend/src/routes/laneRoutes.ts` - Lane route API endpoints
- `frontend/src/components/GoogleMapsRouteEditor.tsx` - Draggable Google Maps route editor
- `frontend/src/vnext-design/VNextCreateLane.tsx` - Lane create/edit with route planning
- `frontend/src/vnext-design/VNextLaneDetail.tsx` - Lane detail with route visualization
- `frontend/src/vnext-design/VNextShipmentDetail.tsx` - Route deviation alert banner on shipment detail

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

The Triage Agent is an AI event handler (`TriageAgentHandler`) that runs as a pg-boss worker job. Since the deterministic Issue Engine now **owns** issue creation for the shipment-exception domain, the agent's role has shifted from **creator** to **enricher** for those issues; it still creates issues for exceptions the engine does not yet cover.

**Subscribed events:** `shipment.exception`, `sla.breached` (create/triage — events not owned by the Issue Engine), plus `issue.created` (enrich). The cargo/cold-chain events were removed from its defaults because the engine owns them.

**Enrichment path (`issue.created`):** for issues raised by the engine (`issueType != null`), the agent gathers shipment context, asks Claude for a triage assessment, posts that as an **agent comment**, escalates the issue's priority if the model recommends higher (and is confident enough), and logs a `triage_enrich` AgentDecision. It never creates on this path, skips manual (non-engine) issues, and is idempotent (won't re-enrich).

**Create/triage guard:** even on `shipment.exception`, the agent **skips `create_issue`** when a deterministic engine issue is already open for the entity — so a critical ETA delay (which emits both `tracking.eta_updated` and `shipment.exception`) produces exactly one issue.

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
- Margin columns on shipment list (on by default)
- Brokerage settings tab in admin (MC number, bond, operating authority, margin alerts)

### Margin Alert

**Event:** `margin.alert`

**Trigger:** `MarginAlertHandler` subscribes to `charge.created` and `charge.approved` events. When a charge is created or approved, it checks the shipment's `ShipmentFinancialSummary` margin against the org's `minMarginPercent` threshold.

**Side Effects:**
- Creates an Issue with category `margin_alert` and priority based on severity (negative margin = critical, low margin = high)
- Deduplicates: will not create a second alert if an open margin_alert issue already exists for the shipment

**Configuration:** Set `marginAlertEnabled = true` and `minMarginPercent` on the Organization model via Settings > Brokerage.

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
5. Emits `SHIPMENT_CREATED` event (shipment is created unassigned, ready for carrier assignment)

The frontend "Accept & Book" button (visible for broker orgs) triggers this flow and navigates to the new shipment's detail page.

### Customer Credit Check

**Endpoint:** `GET /api/v1/customers/:id/credit-status?additionalAmountCents=N`

`CreditCheckService` sums unpaid invoices (draft, approved, sent, overdue, partial) and compares against `Customer.creditLimitCents`. Returns pass/fail with outstanding balance and available credit. Null credit limit = unlimited.

### Document Tenancy (#294)

`GeneratedDocument` and `DocumentTemplate` each belong to one organization (`orgId`, NOT NULL).

- Every document route runs under `registerOrgScope` plus `requireOrgScope`, and every repository
  read and write filters on `req.orgId`. A document, template, shipment or order id from another
  organization returns 404, never 403.
- Generation (`DocumentGenerationService`, `evaluateBolReadiness`, the compliance and issue closure
  reports) looks its source up by `{ id, orgId }`. A miss throws `DocumentSourceNotFoundError`,
  which the routes answer with 404. Nothing is written and no BOL number is consumed.
- Async generation jobs carry the requesting user's `orgId`; the worker scopes every lookup to it.
- Templates and defaults are per organization. Setting a default unsets only the caller's own
  default for that document type.
- The customer portal document list and download are narrowed by the customer's organization as
  well as its `customerId`.
- **Backfill:** each existing document took its org from its own shipment, then order, issue,
  customer or carrier. Templates had no owner, so each one went to the org that first used it (or
  the oldest org), and every other org received its own copy, with its documents repointed to it.

### Bill of Lading Generation & Readiness Gate

**Endpoints:**
- `POST /api/v1/documents/generate/bol` (sync) and `/bol/async` (queued) — generate the BOL PDF.
- `GET /api/v1/documents/bol-readiness/:shipmentId` — readiness check driving the UI.

A Bill of Lading is a legal shipping document that must name the shipper and consignee and describe the goods (description, piece count, weight) for every line. Open TMS treats all of that cargo detail as **optional** throughout the shipment/order lifecycle - a shipment can exist with no orders, and an order line can exist with no weight - so a shipment can easily lack enough information to produce a valid BOL.

`evaluateBolReadiness` (`backend/src/services/bolReadiness.ts`) is the **single source of truth** for whether a shipment can produce a legally-sufficient BOL. A shipment is BOL-ready only when:
- the shipment has an origin (shipper) and destination (consignee), and
- at least one order is attached, and
- the attached orders have at least one line item, and
- **every** line item carries a goods description, a quantity > 0, and a weight > 0.

When not ready, the check returns the list of missing requirements. This gates:
- **Both** generate endpoints (sync and async) - they return 400 with the missing-requirements list rather than producing an incomplete document (the BOL metadata snapshot is captured immutably at generation time).
- The **"Generate BOL" button** on the shipment Documents tab (`VNextShipmentDetail`), which greys out and shows the missing requirements inline until the data exists.

A BOL is only ever generated on request, through the two endpoints above. Nothing generates one
automatically.

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
| `broker_agent` | Sales rep / agent | Quotes, margins - no settings/users |
| `dispatcher` | Operational user | Shipments, orders, tendering |
| `finance` | Financial operations | Quotes, invoices, charges, reports |
| `readonly` | Read-only access | All `:read` and `:view` permissions |

**Broker-Specific Permissions:** `margin:view`, `credit:check`, `rate_confirmation:generate`

**Returns:** `returns:read` and `returns:write` guard the RMA routes. `dispatcher` and `readonly` hold `returns:read`, and `broker_admin` holds `returns:*`.

**Seeding:** `POST /api/v1/roles/seed` creates or updates system roles (idempotent). Custom roles can be created via the Roles CRUD API.

**Middleware:** `requirePermission(...perms)` in `jwtAuth.ts` checks JWT permissions. `optionalAuth` sets `req.user` when token present without blocking unauthenticated requests. A token that carries a `scope` claim is refused: those were restricted sessions for the removed warehouse and inventory apps, and nothing issues one any more.

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
- `backend/prisma/schema/core.prisma` - Organization brokerage fields; `schema/tms.prisma` - ShipmentReadModel financial columns
- `backend/src/routes/quotes.ts` - Quick quote + credit check endpoints
- `backend/src/routes/organization.ts` - Organization settings (includes brokerage fields)
- `backend/src/services/CreditCheckService.ts` - Customer credit validation
- `backend/src/services/templates/rateConfirmationTemplate.ts` - Rate confirmation Handlebars template
- `backend/src/services/DocumentGenerationService.ts` - Rate confirmation PDF generation
- `backend/src/commands/quotes/AcceptQuoteCommand.ts` - Quote-to-book with shipment creation
- `backend/src/events/handlers/MarginAlertHandler.ts` - Margin alert event handler
- `backend/src/events/projections/ShipmentProjection.ts` - Financial column denormalization
- `backend/src/events/eventTypes.ts` - margin.alert event type
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

## EDI 940 / 945 (Warehouse Shipping Order + Advice)

The 940/945 pair is the 3PL-to-depositor interchange: a depositor (brand, shipper) sends a 940 saying what to ship, and gets back a 945 confirming what actually shipped. Open TMS handles the transport side of that exchange. An inbound 940 becomes an order, and a delivered shipment sends the 945. It holds no stock and runs no warehouse.

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

## Packaging Types & Palletization

Packaging specs are first-class master data. Every org curates a `PackagingType` catalogue, with a `kind` of pallet, carton, crate, drum, roll, bag, tote, loose or custom. The pallet kinds cover EUR, US GMA, CHEP, Australian, half/quarter and plastic variants. A `TrackableUnit` references a `PackagingType`, so BOL generation, rating and palletization estimates use accurate dimensions and weight limits instead of guessing.

### Schema
`PackagingType` fields: `code` (unique per org), `name`, `description`, `kind`, external dimensions in mm (`lengthMm`, `widthMm`, `heightMm`, which is the deck height for a pallet), `tareWeightGrams`, `maxLoadGrams`, optional `maxStackHeightMm`, `material` (wood / plastic / metal / cardboard / composite), `reusable`, `isoCertified` (ISPM-15 heat treatment for international export), `stackable`, `active`.

`TrackableUnit.packagingTypeId` is nullable, so an ad-hoc unit remains valid. When set, it anchors the unit to a real spec.

### Standard seed
13 standard types covering the common real-world pallets: EUR1 (1200×800), EUR2 (1200×1000), EUR3, EUR6 (half), US GMA (48×40), US 42×42, CHEP 1210, CHEP 48×40, AU 1165, plastic Euro + plastic GMA, one-way export, and quarter display. `POST /api/v1/packaging-types/seed-standards` bulk-adds missing rows (by code uniqueness).

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
| GET | `/api/v1/packaging-types` | List (optionally active-only) |
| GET | `/api/v1/packaging-types/standards` | Preview the standard seed |
| GET | `/api/v1/packaging-types/:id` | Detail |
| POST | `/api/v1/packaging-types` | Create |
| PUT | `/api/v1/packaging-types/:id` | Update |
| DELETE | `/api/v1/packaging-types/:id` | Delete (soft-deactivates if referenced by any TrackableUnit) |
| POST | `/api/v1/packaging-types/seed-standards` | Bulk-add missing standards |
| POST | `/api/v1/packaging-types/:id/plan` | Layer/weight estimate for one pallet type and a carton |
| POST | `/api/v1/packaging-types/recommend` | Rank all active types for a carton |

### UI
- `/packaging-types` - table with kind, code, name, dimensions (cm), tare and max load (kg), badges for reusable / ISPM-15 / stackable. Create/edit modal with the full spec form. One-click "Load standard types" button seeds the standard types.
- Sidebar entry under Operations, in the Network section.

### Key Files
- `backend/prisma/migrations/20260420_add_pallet_types/migration.sql`
- `backend/src/services/palletization/standardPackagingTypes.ts` - canonical seed data
- `backend/src/services/palletization/PalletizationPlanner.ts` - homogeneous planner + recommender
- `backend/src/routes/packagingTypes.ts` - CRUD + seed + plan + recommend
- `frontend/src/vnext-design/VNextPackagingTypes.tsx` - admin UI
- `backend/src/__tests__/services/PalletizationPlanner.test.ts` - 11 tests (orientation, height/weight bounds, utilization, recommendation ranking, ties, inactive filtering)

---

## Cutoff-at-Risk Monitoring

Carriers publish daily handoff cutoff times (e.g. 16:30 for same-day FedEx Ground pickup). Missing one slips the shipment a day. The cutoff-at-risk monitor watches open, carrier-assigned shipments (`draft`, `booked`, `at_pickup`) and fires `shipment.cutoff_at_risk` when a shipment that has not left yet will miss today's cutoff (the Issue Engine raises the Issue from that event).

### CarrierCutoff schema
Per-day-of-week rows per carrier: `dayOfWeek (0-6)`, `cutoffLocalTime (HH:mm)`, `timezone (IANA)`, optional `serviceLevel` and `locationId` override, `active` flag. Multiple rows per carrier are supported; the earliest matching row for today wins.

### Projected ready time
A shipment that has not left yet needs a fixed handling allowance before it can be handed to the carrier. The projected ready time is the time of the scan plus that allowance: `minutesToReady`, 30 minutes by default, configurable per instance of `ShipmentCutoffMonitorService`. Nothing else feeds it.

### Severity bands
The monitor **fires events only** — issue creation/escalation/auto-resolve is owned by the deterministic Issue Engine (`shipment_cutoff_risk`), which consumes these events.

| Buffer (cutoff - projectedReady) | Severity | Action |
|--|--|--|
| ≥ 30 min | `minor` | Dashboard only, no event (recovery emitted if previously flagged) |
| 10 - 29 min | `warning` | Fires `shipment.cutoff_at_risk` → engine raises a high-priority issue |
| < 10 min or past cutoff | `critical` | Fires `shipment.cutoff_at_risk` → engine raises/escalates the issue |

### Dedup
Re-evaluation runs every 5 min. To avoid event spam:
- Same-severity alert won't refire within the dedup window (default 30 min)
- Escalating severity (warning → critical) fires immediately regardless of window
- Issue-level dedup (one open issue per shipment, escalation) is handled by the Issue Engine, not the monitor. The monitor only tracks `Shipment.lastCutoffRiskSeverity` for its own event dedup and to detect the recovery edge.

### Events
- `shipment.cutoff_at_risk` - payload: `{ shipmentId, shipmentReference, carrierId, cutoffAt, projectedReadyAt, bufferMinutes, severity }`
- `shipment.cutoff_cleared` - emitted when a previously-flagged shipment is evaluated again and has a safe buffer. The Issue Engine auto-resolves the open cutoff issue.

A flagged shipment that departs, is cancelled or is archived drops out of the scan, so it is never evaluated again and its cutoff issue stays open until someone resolves it (#399).

### API
- CRUD: `GET/POST /api/v1/carriers/:carrierId/cutoffs`, `PUT/DELETE /api/v1/carrier-cutoffs/:id`
- `GET /api/v1/cutoff-monitor/at-risk?severity=warning|critical` - current at-risk list
- `GET /api/v1/cutoff-monitor/evaluate/:shipmentId` - evaluate a single shipment
- `POST /api/v1/cutoff-monitor/run` - manual full scan of the caller's org (useful for testing + on-demand review)

Every route is guarded by `registerReadWriteGuard(server, 'carriers')`: reads need `carriers:read`, and everything else needs `carriers:write`.

### UI
- `/cutoff-monitor` - the at-risk list, under Operations
- `/carrier-cutoffs` - per-carrier cutoff configuration, under Operations in the Network section

### Worker
`cutoffMonitorWorker` registers a pg-boss cron on the `cutoff-monitor` queue. Default `*/5 * * * *`, override with `CUTOFF_MONITOR_CRON`.

### Key Files
- `backend/prisma/migrations/20260420_add_cutoff_monitoring/migration.sql`
- `backend/src/services/cutoff/ShipmentCutoffMonitorService.ts`
- `backend/src/workers/cutoffMonitorWorker.ts`
- `backend/src/routes/cutoffMonitor.ts`
- `backend/src/auth/readWriteGuard.ts` - the read/write permission guard
- `frontend/src/vnext-design/VNextCutoffDashboard.tsx` - at-risk list with stats
- `frontend/src/vnext-design/VNextCarrierCutoffs.tsx` - per-carrier cutoff configuration
- `backend/src/__tests__/services/ShipmentCutoffMonitorService.test.ts` - 28 tests

---

## Returns / RMA

Full returns lifecycle from customer request through receipt, inspection, disposition, and refund. Open TMS records what was received and what was decided about it. It holds no stock, so it does not track where a returned item is put. See `docs/RETURNS_SPECIFICATION.md` for the complete specification.

The RMA routes are guarded by `registerReadWriteGuard(server, 'returns')`: reads need `returns:read`, and everything else needs `returns:write`.

### Commands
- `rma.create` - Create a new RMA for a customer return. Validates that requested quantities don't exceed order line quantities. Auto-calculates suggested refund from order line prices. Optionally auto-authorizes for CSR-initiated RMAs.
- `rma.authorize` - CSR approves a requested RMA. Moves status from `requested` to `authorized`.
- `rma.reject` - CSR rejects an RMA with reason notes.
- `rma_line.receive` - Record receipt of a returned item: the received quantity, and optionally the `trackableUnitId` of the unit that came back. Moves an `authorized` RMA to `received`, and emits `rma.goods_received` once every line is fully received.
- `rma_line.inspect` - Inspector sets the inspection status, final disposition and notes per line. The RMA moves to `inspecting`, then to `dispositioning` once every line has a disposition.
- `rma.complete` - Finalizes RMA. Finance can override the suggested refund with `actualRefundCents` and adjustment notes. The `rma.completed` payload lists each line's SKU, disposition and received quantity.

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
- `rma.goods_received` - All lines received
- `rma.line_inspected` - Inspector set disposition on a line
- `rma.disposition_set` - All lines on an RMA have dispositions (moves to `dispositioning` status)
- `rma.completed` - RMA closed, ready for credit note issuance
- `rma.refund_adjusted` - Finance overrode the suggested refund amount

### Side Effects
- **A disposition records a decision.** `restock` or `scrap` says what was decided about the item. Nothing in Open TMS moves stock or changes a unit as a result.
- **Finance review queue**: RMAs in `dispositioning` status appear in the refund review queue for finance team approval before completion.
- **Customer webhooks**: `CustomerWebhookHandler` subscribes to `rma.*`, so a customer with a webhook hears about each step.

### Key Files
- `backend/src/commands/rma/` - All RMA command handlers (9 handlers)
- `backend/src/routes/rma.ts` - RMA API endpoints (13 endpoints)
- `backend/src/__tests__/commands/RmaCommands.test.ts` - 17 tests
- `frontend/src/vnext-design/VNextReturns.tsx` - Returns list, at `/returns`
- `frontend/src/vnext-design/VNextCreateReturn.tsx` - Multi-step RMA creation form
- `frontend/src/vnext-design/VNextReturnDetail.tsx` - RMA detail with inline receipt, inspection and completion
- `frontend/src/vnext-design/VNextRefundReview.tsx` - Finance refund approval queue, at `/returns/refund-review`
- `backend/src/routes/customerRmaApi.ts` - Public customer-facing RMA API (ApiKey-authenticated)
- `backend/src/routes/customerPortal.ts` - Customer portal RMA endpoints (JWT-authenticated, list/detail/create/label-download/eligible-orders)
- `frontend/src/pages/customer-portal/CustomerReturns.tsx` - Portal: list my returns
- `frontend/src/pages/customer-portal/CustomerRequestReturn.tsx` - Portal: request a return (multi-step form)
- `frontend/src/pages/customer-portal/CustomerReturnDetail.tsx` - Portal: return detail with status explanation + label download
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
`CustomerWebhookHandler` subscribes to `rma.*`, `order.created|confirmed|delivered|cancelled|status_changed`, `shipment.dispatched|delivered|exception|status_changed`, and `invoice.created|sent|paid`. Each of these carries `payload.customerId`, which is how the handler finds the customer. Finds enabled customer webhooks whose event pattern matches and dispatches each through `CustomerWebhookDeliveryService` concurrently. Failed deliveries are logged to `CustomerWebhookDelivery` and rolled up into per-webhook delivery/failure counters.

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

## Tenancy Enforcement (#314)

`npm run lint:tenancy` fails on any query against tenant data that does not name the org: lookups by
id, lists, counts, aggregates and bulk writes. Its baseline is empty. The few queries that must not
name the org (cron sweeps across every org, lookups by a credential or token hash, the signed-in
principal from its own token, platform-wide unique ids) carry a `// tenancy-exempt:` marker with the
reason. See `.claude/rules/multi-tenancy.md`.

Behaviour that changed with it:

- **Reference numbers are unique per org.** Invoice, credit note, query, quote and order numbers, and
  the shipment and order read-model references, used to be unique across every org, so a second
  org's first quote collided with the first org's. Tender references stay platform-wide, because a
  tender takes its org from its shipment.
- **Notifications** list, count and mark read only the signed-in user's notifications. A `userId` in
  the request is ignored, and another user's notification is a 404.
- **Organisation settings** are the caller's own org. They used to read and write the first
  organisation for everyone.
- **Manual monitor triggers** (ETA check, SLA sweep, cutoff check) cover only the caller's org. The
  cron workers still sweep every org.
- **Portal users:** registering, updating or deactivating a carrier or customer portal user under
  another org's carrier or customer is a 404.
