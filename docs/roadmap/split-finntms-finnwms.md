# Split Programme: FinnTMS / FinnWMS over a Shared Core

The sequenced plan for separating WMS from TMS so each can ship as its own product, per
[ADR 0002](../adr/0002-modular-monolith-product-composition.md) (modular monolith, build-time
product composition). Announced in the `open-tms-is-changing` article.

**Governing rule: the product runs and ships at the end of every PR.** All schema work is
expand then contract. Sizing: 1 chunk = one focused PR (one GitHub issue, one worktree).

## Why (short version)

- FinnTMS and FinnWMS become separable products. At least one prospect wants WMS + Inventory +
  Issues only, so standalone WMS installs must be possible.
- Three conflated models block it today: `Location` (geo node vs facility root), `TrackableUnit`
  (stock can't exist without a TMS order), and `Allocation` (hard FK from stock to demand).
- Clean seams already exist: a contiguous WMS schema block, ~55 WMS event types with zero
  cross-domain subscribers, and soft string ids across most of the seam.

## Phase 0: pay now regardless ✅ (shipped Aug 2026: #130, #131, #132, #133, #134, #135, plus #142 roles UI found along the way; #137 PWA token bug filed as follow-up)

These were live bugs. Done ahead of any split work.

| Item | Detail | Size |
|---|---|---|
| Tenancy leak | `GET /api/v1/warehouse/locations` (`backend/src/routes/warehouse.ts:714`) has no `orgId` filter and returns every tenant's locations. Route through `registerOrgScope`/`req.orgId`; audit sibling handlers | S |
| Pack-audit issue bypass | `RecordPackAuditCommand` does a raw `tx.issue.create` with invalid `category: 'quality'`, bypassing the issue engine, so these issues never reach `IssueReadModel`/triage. Route through the issue command path; backfill orphans | S-M |
| qualityCentre org scope | Replace forbidden `prisma.organization.findFirst()` with `req.orgId` | S |
| Triage accepts WMS issues | `IssueEngineHandler` hardcodes `sourceEntityType: 'shipment'`; `TriageAgentHandler` patterns exclude WMS events. Fix both. This is one of the end-state requirements and it can be done now | M |
| WMS permissions | None exist: `/api/v1/wms*` is open to any authenticated user. Add a `wms.*` permission family; grant permissively to existing roles, tighten later | M |
| Magic-link scoping | Warehouse PWA magic links mint full internal JWTs. Mint warehouse-scoped tokens; accept both during transition | M |

## Phase 1: draw the boundary in code (~10-13 chunks, zero schema changes)

Order: lint, then schema file split, then DI/routes split, then projection, then load-plan seam.

1. **Boundary lint** ✅ (#159) `npm run lint:boundaries` walks backend imports against the ADR 0002
   DAG, plus `.claude/rules/module-boundaries.md`. Seven known leaks seeded into
   `backend/src/tooling/moduleBoundaries/exceptions.json` as the burn-down: charges to rating,
   cold chain to CAPA, load plans to document generation, two on the Location conflation, and
   manifest ingest to receiving. Import-graph only for now; Prisma model ownership comes with the
   schema file split below. (S)
2. **Prisma multi-file schema split** ✅ (#161) `prisma/schema/` under the `prismaSchemaFolder`
   preview feature, one file per module rather than the three originally planned, so the schema
   matches the map the boundary lint enforces in code: core 35 models, tms 66, wms 24, finance 11,
   quality 7, inventory 4. `prisma migrate diff` empty in both directions, 56 migrations still
   resolve. Also produced the cross-boundary FK list below. (S-M)
3. **Split DI registration** ✅ (#164) `di/registry.ts` into `di/modules/<module>.ts`, one per
   module, each registering its own bindings and command handlers. The registry is now a 55-line
   composition root. The per-module files are checked by the boundary lint rather than exempt.
   Verified by diffing the 87 container bindings and 152 registered command types before and
   after. (M)
4. **Split route registration** ✅ (#166) `index.ts` into `routes/modules/<module>.ts`, each
   exporting its public and its JWT-scoped registrations. index.ts drops from 570 to 375 lines and
   keeps only the server lifecycle. Verified by booting the server and diffing the full route
   table: 717 routes, identical. (S)
5. **`WmsFulfilmentOrder` projection** (first WMS read model) fed by TMS order events, with a
   backfill; switch the wave commands off direct `tx.order` reads. Establishes the decoupling
   pattern. (L)
6. **Load-plan seam**: `ShipmentStopPort` for `CreateLoadPlanCommand`; `CompleteLoadPlanCommand`
   emits `wms.load_plan.completed` and a TMS subscriber creates the BOL (first deliberate
   cross-domain event subscriber, idempotent). (M)

## Phase 2: data model untangling (~18-26 chunks)

This is the phase that makes standalone WMS possible.

### The foreign keys that have to go

Taken from the schema folder on 2026-09-01, after the split in #161. Every FK crossing the tms/wms
boundary runs through `TrackableUnit`, which is exactly the model 2b splits:

| Edge | Count | Where they are |
|---|---|---|
| wms to tms | 5 | `PackLine`, `PickLine`, `PutawayTask`, `ReceivingLine`, `StagingAssignment`, all to `TrackableUnit` |
| tms to wms | 2 | `TrackableUnit.currentBin`, `TrackableUnit.currentZone` |
| wms to core | 12 | every warehouse root pointing at `Location`, which 2a re-points at `Facility` |
| inventory to tms | 3 | `Allocation.orderLineItem` (2c), plus two `TrackableUnit` refs |
| finance to tms | 6 | charges, commissions and carrier invoices reaching shipments, orders and carriers |
| core to tms | 1 | `AuditLog.order`, which is a stray and should be a soft id |

Seven FKs and one model stand between the two products.

- **2a. Location to Facility (XL, 6-9):** add `Facility`, backfill one per WMS-referenced
  Location, add nullable `facilityId` to the 17 WMS models (batched by subdomain), dual-write,
  switch reads to an org-scoped `/api/v1/facilities`, migrate the 19 WMS frontend files off
  unfiltered `/api/v1/locations`, then contract after soak. Highest-risk item; batching is the
  mitigation.
- **2b. TrackableUnit split (L-XL, 5-7):** new WMS `HandlingUnit` (standalone LPN with soft
  order/shipment refs), backfill and dual-write, switch receiving/putaway/inventory, then drop the
  WMS FKs to TrackableUnit. **Split it; don't make `orderId` nullable as a shortcut.** The cascade
  delete on stock-referenced rows is the real hazard. TrackableUnit keeps its name and stays TMS.
- **2c. Allocation soft demand ref (M, 2-3):** `(demandType, demandId)` replaces the
  `orderLineItemId` FK. Dual-write, switch, drop the FK, keep an index.
- **2d. Carton cleanup (M, 2-3, parallelizable):** `CartonCatalogue` (WMS box master) and
  `PackagingType` (TMS rating/palletisation) stay separate models. Rename the two cartonization
  services honestly, move the PackagingType UI out of `/wms/` nav, and add the missing FK on
  CartonCatalogue.
- **2e. `OrgWmsSettings` carve-out (M, 2-3):** move `magicLinksEnabled`, `warehouseScanMode`,
  `trackableUnitType`, etc. out of `Organization`. No full god-model split.

## Phase 3: app shell, entitlements, package seams (~8-11 chunks, interleaves with Phase 2)

1. Env-driven module composition: `ENABLED_MODULES=core,tms,wms` gating DI/route registration
   (default all-on, no behaviour change)
2. `OrgApp` entitlements table, a `requireApp()` decorator, and `GET /api/v1/apps`; the hardcoded
   frontend `APPS` array becomes a render of that response
3. `packages/shared` becomes `packages/contracts` with `{core,tms,wms}` subpaths
4. Warehouse PWA split into a shell plus per-domain screen registries (TMS shipment-launch vs WMS
   tasks)
5. Delete the dormant `auth-service/`
6. Frontend per-product builds: `frontend/src/apps/*` with lazy imports; `VITE_PRODUCT` selects
   manifests and brand tokens; replace the `authFetch.ts` monkey-patch with an explicit `apiClient`

## Phase 4: standalone WMS install (~5 chunks on the recommended fork)

- **Fork A (recommended): modular monolith.** Same binary, `ENABLED_MODULES=core,inventory,wms`,
  FinnWMS-branded frontend, full migrations with dormant TMS tables (Tier 1). WMS-only
  docker-compose profile, seed, and an e2e smoke running receive, putaway, pick, pack.
- **Fork B: separate repos/DBs/broker.** Only if a customer or scale forces it (+15-25 chunks and
  permanent 2x ops load). Phases 1-3 make it possible later without rework. Do not take it
  speculatively.
- Tier 2 (a composed WMS-only schema profile with zero TMS tables) only when contractually
  demanded.
- **Demand intake for standalone installs (new item, found 2026-08-16):** EDI 940, the customer
  API, and manifest upload all create demand via the TMS `CREATE_ORDER` command today. A WMS-only
  install has no TMS order pipeline, so these intakes must be able to write WMS fulfilment orders
  directly. Without this, the Phase 4 smoke test has nothing to pick. (M)

## Phase 5: inventory separability / FinnIMS (~4-6 chunks, deliberately last)

Needs 2a, 2b, 2c and 3.1. Inventory models move to their own fragment and `register.ts`; introduce
the `Product` SKU master (today `sku` is a bare string everywhere); WMS consumes availability via
ports and events. Don't design this in detail yet; Phase 2 outcomes will reshape it.

## What NOT to do

1. No Fork B preemptively (separate repos/DBs/brokers/outbox)
2. Don't resurrect `auth-service/`; delete it
3. Don't split the whole Organization table; carve `OrgWmsSettings` only
4. Don't make `TrackableUnit.orderId` nullable as a shortcut
5. Don't build read models/subscribers speculatively; the unused WMS event types can stay unused
   until something actually consumes them
6. Don't big-bang rename models for purity
7. Don't rewrite the warehouse PWA; split it
8. Don't add a feature-flag framework; module flags plus `OrgApp` entitlements suffice

## Totals

Working standalone FinnWMS on Fork A: roughly **50-65 focused PR-chunks**. About 10 of them
(Phase 0) are correctness and security fixes worth doing immediately regardless.
