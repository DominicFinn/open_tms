---
paths:
  - "backend/src/commands/{orders,shipments,carriers}/{Archive,Unarchive,SoftDelete}*.ts"
  - "backend/src/events/projections/{Order,Shipment,Carrier}Projection.ts"
  - "backend/src/services/OrderAutoArchiveService.ts"
  - "backend/src/routes/{orders,shipments,carriers,customerPortal,map}.ts"
  - "backend/src/repositories/{Orders,Carriers}Repository.ts"
  - "frontend/src/vnext-design/VNext{Archives,Orders,Shipments,Carriers,OrderDetail,ShipmentDetail}.tsx"
---

# Archival Policy (Orders, Shipments, Carriers) — Rules

Full rationale, mechanics per entity, and file map: `docs/ARCHIVAL_POLICY.md`

## Archiving never removes the row from its read model

This is the core invariant. `OrderProjection.onOrderArchived` /
`ShipmentProjection.onShipmentArchived` **update** the read model's `status` field in place — they
do not delete the row. `CarrierProjection` is the original reference implementation of this pattern.

Archived items stay visible on their normal list page with `'archived'` as just another filterable
status value alongside the real lifecycle statuses. There is no "archive = disappear from the list."

## Capture the prior status

Archiving an Order or Shipment sets `archived = true`, `archivedAt`, `status = 'archived'`, and
captures the previous value in `statusBeforeArchive`, so unarchive restores it exactly instead of
guessing a default. Unarchiving restores `status` from `statusBeforeArchive` and clears it.

## New read-model consumers must make an explicit call

`GET /api/v1/{orders,shipments,carriers}` all support `?includeArchived=true`.

- VNext list pages always pass it and do client-side stat-card/tab filtering
- Other callers (customer portal, fleet map) do **not** pass it, so their queries explicitly exclude
  `status: 'archived'`

Any new consumer of `OrderReadModel` / `ShipmentReadModel` should make the same call deliberately:
opt in to archived rows only if that surface is meant to show them.

## Archive vs soft-delete are different things

- **Archive** — recoverable, visible in lists as a status, unarchivable from the detail page
- **Soft-delete** — `POST /api/v1/{orders,shipments}/:id/soft-delete`, admin-only, sets
  `deletedAt`/`deletedBy`, hides the row from **every** view including the Archives page, and is
  not recoverable from the UI

`GET /api/v1/orders/:id` / `GET /api/v1/shipments/:id` load archived rows (but not soft-deleted
ones) so the detail page can show the archived banner and Unarchive action.

## Auto-archive is Orders only

Only Orders auto-archive on a timer (`OrderAutoArchiveService`, daily 02:00 UTC cron, default 30-day
retention). Shipments and Carriers are archived purely by manual action.

Cancellation lives only on `Order.status` — `deliveryStatus` can never be `'cancelled'`, so there is
no second branch for it.
