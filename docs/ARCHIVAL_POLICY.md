# Archival Policy (Orders, Shipments, Carriers)

> Conventions and DO/DON'T rules for this area live in `.claude/rules/domains/archival.md`.
> This document is the architecture reference and rationale.

## The shared pattern

Orders, Shipments, and Carriers share one archiving pattern, modeled on how Carriers originally did
it: archiving is recoverable and **never removes the row from its read model**. Archived items stay
visible on their normal list page (Orders, Shipments, Carriers) with `'archived'` as just another
filterable status value alongside the real lifecycle statuses (`pending/verified/assigned/issue/
cancelled` for orders, `draft/ready/in_progress/complete` for shipments) - there's no more
"archive = disappear from the list."

The Archives admin page (`/settings/archives`, `VNextArchives.tsx`) is a separate admin-only surface
with three tabs - Orders, Shipments, Carriers - for bulk oversight and restore.

## Mechanics

### Order and Shipment

Archiving sets `archived = true`, `archivedAt`, `status = 'archived'`, and captures the prior value
in `statusBeforeArchive` (so unarchive restores it exactly instead of guessing a default).
`OrderProjection.onOrderArchived` / `ShipmentProjection.onShipmentArchived` **update** the read
model's `status` field in place - they no longer delete the row. Unarchiving restores `status` from
`statusBeforeArchive` and clears it.

### Carrier

Unchanged - archiving sets `archived = true`/`archivedAt`, `CarrierProjection` updates
`CarrierReadModel.status` to `'active'`/`'archived'`, and portal users are deactivated/reactivated
alongside it. This was the reference implementation the other two entities were brought in line
with.

## List pages default to including archived rows

`GET /api/v1/{orders,shipments,carriers}` all support `?includeArchived=true`. The VNext list pages
(`VNextOrders.tsx`, `VNextShipments.tsx`, `VNextCarriers.tsx`) always pass it and do client-side
stat-card/tab filtering - the same pattern Carriers used originally.

Other callers (customer portal, fleet map) do **not** pass it, so their queries explicitly exclude
`status: 'archived'` by default - see `backend/src/routes/customerPortal.ts` and
`backend/src/routes/map.ts`. Any new consumer of `OrderReadModel`/`ShipmentReadModel` should make
the same call: opt in to archived rows only if that surface is meant to show them.

## Manual archive

### Customer portal

Customers can archive any of their own orders from the order detail page
(`DELETE /api/v1/customer-portal/orders/:id`). No status restriction - customers may have created an
order by accident or no longer need it. Already-archived orders return 400. The customer portal has
no "Archived" view of its own, so its order/shipment list and dashboard activity feed explicitly
filter out `status: 'archived'`.

### Admin app

`DELETE /api/v1/orders/:id` / `DELETE /api/v1/shipments/:id`, gated on `{orders,shipments}:write`.
`POST /api/v1/carriers/:id/archive` gated on `carriers:write`.

## Manual delete and unarchive (admin app)

`POST /api/v1/{orders,shipments}/:id/soft-delete` (admin-only, `{orders,shipments}:delete`) sets
`deletedAt`/`deletedBy` and hides the row from every view (list, detail, customer portal, Archives
page) - distinct from archive, and not recoverable from the UI.

`POST /api/v1/{orders,shipments,carriers}/:id/unarchive` restores it.

`GET /api/v1/orders/:id` / `GET /api/v1/shipments/:id` load archived rows (not soft-deleted ones) so
the detail page can show the archived banner + Unarchive action.

## Dedicated `/archived` endpoints

`GET /api/v1/{orders,shipments,carriers}/archived` (admin-only, `*:delete` or `carriers:write`) back
the Archives page's three tabs. They read the live table directly (not the read model) so they can
show `statusBeforeArchive` in a dedicated column for Orders/Shipments.

## Auto-archive (Orders only)

Delivered or cancelled orders are auto-archived after a retention window (default 30 days).
`OrderAutoArchiveService` is invoked by the `order-auto-archive` pg-boss cron worker daily at 02:00
UTC. Eligibility:

- `deliveryStatus = 'delivered' AND deliveredAt < now - retentionDays`, OR
- `status = 'cancelled' AND updatedAt < now - retentionDays`

Cancellation lives only on `Order.status` - `deliveryStatus` can never be `'cancelled'`, so there's
no second branch for it.

Configurable via `ORDER_AUTO_ARCHIVE_DAYS` (default 30) and `ORDER_AUTO_ARCHIVE_CRON` (default
`0 2 * * *`).

## Why keep archived rows in the list instead of a fixed retention window everywhere?

Only Orders auto-archive on a timer; Shipments and Carriers are archived purely by manual action.
Keeping the row visible (as a status, not a removal) means an operator browsing the Shipments or
Orders list never loses track of something that got archived by mistake or automation - they can
find it, see it's archived, and unarchive it right there, instead of having to know to check a
separate admin page.

## Key Files

- `backend/src/commands/orders/ArchiveOrderCommand.ts` / `UnarchiveOrderCommand.ts` -
  `ARCHIVE_ORDER` / `UNARCHIVE_ORDER`, capture + restore `statusBeforeArchive`
- `backend/src/commands/shipments/ArchiveShipmentCommand.ts` / `UnarchiveShipmentCommand.ts` - same
  pattern, mirrors Order
- `backend/src/commands/carriers/ArchiveCarrierCommand.ts` / `UnarchiveCarrierCommand.ts` - also
  deactivates/reactivates `CarrierUser` portal users
- `backend/src/commands/orders/SoftDeleteOrderCommand.ts` /
  `backend/src/commands/shipments/SoftDeleteShipmentCommand.ts` - admin-only, idempotent, distinct
  from archive
- `backend/src/services/OrderAutoArchiveService.ts` - finds eligible orders and dispatches archive
  commands (Orders only)
- `backend/src/events/projections/OrderProjection.ts` / `ShipmentProjection.ts` -
  `onOrderArchived`/`onShipmentArchived` update `status` in the read model in place (no delete);
  `CarrierProjection.ts` is the original reference implementation of this pattern
- `backend/src/repositories/OrdersRepository.ts` / `CarriersRepository.ts` -
  `all(orgId, { includeArchived })` and `findArchived(orgId)`; the Shipments list route queries
  `ShipmentReadModel` inline (see `routes/shipments.ts`) rather than through a repository, with the
  same `includeArchived` param
- `backend/src/routes/customerPortal.ts` - customer-facing archive endpoints; explicitly excludes
  `status: 'archived'` from its own list/dashboard queries
- `backend/src/routes/map.ts` - fleet map excludes `status: 'archived'` by default so an archived
  shipment's last known GPS position doesn't linger as a pin
- `backend/src/routes/{orders,shipments,carriers}.ts` - admin-facing archive/soft-delete/unarchive +
  `/archived` endpoints
- `frontend/src/vnext-design/VNextArchives.tsx` - Archives admin page, three tabs
- `frontend/src/vnext-design/VNextOrderDetail.tsx` / `VNextShipmentDetail.tsx` - Archive/Delete
  buttons, archived banner, Unarchive, delete confirmation dialog
- `frontend/src/pages/customer-portal/CustomerOrderDetail.tsx` - Archive button
