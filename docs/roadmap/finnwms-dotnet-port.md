# FinnWMS port to .NET

The plan for moving the `wms` and `inventory` modules into `services/wms/`, tracked by epic #355.
[ADR 0004](../adr/0004-port-to-csharp-starting-with-finnwms.md) records why we're porting and
[ADR 0005](../adr/0005-wms-table-handover-in-one-move.md) records how the tables change hands.

## Scope

Measured on 2026-10-21, after the walking skeleton (#352):

| | Count |
|---|---|
| Tables (`wms.prisma` + `inventory.prisma`) | 32 at the start; 36 after #357 added `HandlingUnit` and `HandlingUnitLine` and #359 moved the two manifest tables from TMS |
| Endpoints in scope | 91, across 18 route files |
| Command handlers | 42 |
| Node files that touch these tables | 65 in wms/inventory, 9 outside them |
| WMS files that touch TMS or core tables | 6, plus the `TrackableUnit` writes #357 removes |
| Foreign keys crossing the boundary | 13 (11 out, 2 in) |
| Workers and event handlers to port | `waveAutoReleaseWorker`, `AutoReplenishmentHandler` |

**Out of scope:** `routes/warehouse.ts` and `WarehouseService`. Despite the name, that is the dock
app's shipment preparation (shipments, tracking devices, magic-link login) and touches no WMS
table. It stays in Node with TMS. Its manifest entry should say `tms`, which the lint issue (#356)
can fix in passing.

## Stages

Every stage before 4 can be rolled back by unsetting `WMS_SERVICE_URL`. Stage 4 can't.

### Stage 0: cut the last links (TypeScript)

| Issue | Work |
|---|---|
| #356 | Lint that a module's tables are only touched from that module. Imports are checked today; Prisma access isn't |
| #357 | Split `TrackableUnit`: WMS handling units move to a new `HandlingUnit` (split step 2b) |
| #358 | `Allocation` references demand by `(demandType, demandId)` (split step 2c) |
| #297 | `InventoryRecord` gets a facility; the `Location` and `Customer` FKs from inventory go |
| #359 | The 9 files outside WMS that reach in, and the 6 WMS files that reach out to TMS and core tables, move onto ports and events |

The foreign keys these cut:

| From | To | Cut by |
|---|---|---|
| `PackLine`, `PickLine`, `PutawayTask`, `ReceivingLine`, `StagingAssignment`, `InventoryTransaction`, `Allocation` | `TrackableUnit` | #357 |
| `TrackableUnit.currentBin`, `TrackableUnit.currentZone` | `WarehouseBin`, `WarehouseZone` | #357 |
| `Allocation.orderLineItem` | `OrderLineItem` | #358 |
| `InventoryRecord.location`, `InventoryObservation.location` | `Location` | #297 |
| `InventoryRecord.ownerCustomer` | `Customer` | #297 |

Stage 0 is TypeScript work in a module being ported, which the language rule normally rules out.
It's the exception because the handover can't happen without it, and none of it is new behaviour.

**Done when:** no foreign key crosses the boundary, and the ownership lint's baseline has no WMS or
inventory entries. From here the WMS Prisma schema is frozen (ADR 0005).

**Progress (2026-10-22):** #356, #358 and #359 are done. #357 steps 1 and 2 are done, and #297's
first two parts: what's left of both is dropping columns (`TrackableUnit`'s warehouse fields and
the warehouse tables' `trackableUnitId`; inventory's `locationId`), which waits for a soak. The
burn-down holds the seed script's accesses (#372) and `resolveFacility`'s Location read (#297).
Along the way the warehouse gained `HandlingUnit` and `HandlingUnitLine`, and took over the two
manifest tables, so the handover now moves 36 tables.

### Stage 1: event bridge

| Issue | Work |
|---|---|
| #360 | Outbox in the `wms` schema, a relay onto the Node event bus, a .NET consumer for the Node events WMS needs, and contracts as JSON Schema |

**Recommendation:** use Postgres for both directions (outbox tables, polled), with no broker, while
both stacks share a database server. ADR 0004 left the broker open, and the split roadmap's
"what not to do" list warns against adding one speculatively. A broker earns its place when the
databases separate.

### Stages 2 and 3: port by cluster

Each cluster ports its reads, then its writes. Clusters can overlap, but a cluster's writes go
together because its commands share transactions.

| Cluster | Node route files | Reads | Writes |
|---|---|---|---|
| Topology and catalogues | `facilities.ts` (reads done), `warehouseZones.ts`, `cartonCatalogue.ts`, `cartonization.ts` | #361 | #362 |
| Inventory | `inventory.ts`, `inventoryObservations.ts`, `productUom.ts` | #363 | #364 |
| Inbound | `receiving.ts`, `putaway.ts` | #365 | #366 |
| Outbound | `waves.ts`, `waveTemplates.ts`, `packing.ts`, `packAudit.ts`, `loadPlans.ts` | #367 | #368 |
| Counts, replenishment, dashboards | `cycleCounts.ts`, `replenishment.ts`, `wmsDashboard.ts`, `warehouseOperationsDashboard.ts` | #369 | #370 |

Every cluster follows the pattern #352 set:

- Transitional views over Prisma's tables, filtered on `app.org_id`, listed in the service README.
  Writes go through the same views, made updatable `WITH LOCAL CHECK OPTION`.
- .NET sets ids and `updatedAt` itself until the handover, because Prisma fills them client-side.
- The Node response shape is kept exactly. Each cluster finishes with an identical-response check
  against the Node implementation on real data.
- Scoped sessions keep exactly the access they have on Node.
- The cluster's routes go into `PORTED_ROUTES`, and its frontend pages move onto generated types.

### Stage 4: the handover

| Issue | Work |
|---|---|
| #371 | Rehearse on a copy of acceptance data, time it, write the runbook |
| #372 | Prisma migration moves the tables with `SET SCHEMA`; .NET migration adopts them; the Node WMS code is deleted |

The mechanism is in ADR 0005. The short version: no data is copied, the Prisma migration runs
first and the .NET one second in the same deploy, and the rollback is a restore from backup.

## While the port runs

- **New warehouse features** go on the .NET side once their cluster has ported. Until then they
  wait. Changing the WMS Prisma schema needs a matching view migration in the same PR.
- **Bugs** in a cluster that hasn't ported yet get fixed in Node as normal.
- `docs/roadmap/finnwms.md` stays the list of warehouse product work. This document is the port.
