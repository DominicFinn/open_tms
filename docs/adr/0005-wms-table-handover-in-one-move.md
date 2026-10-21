# ADR 0005: Hand the WMS tables over from Prisma in one move

- **Status:** Accepted
- **Date:** 2026-10-21
- **Supersedes:** the "Database and the handover from Prisma" section of
  [ADR 0004](0004-port-to-csharp-starting-with-finnwms.md)
- **Issues:** #355 (epic), #371 (rehearsal), #372 (handover)

## Context

ADR 0004 said tables would leave Prisma one at a time: a .NET baseline migration recreates a table,
the data moves into the `wms` schema, and the model leaves the Prisma schema.

The walking skeleton (#352) showed that can't work table by table. The 32 WMS and inventory tables
are joined by foreign keys among themselves, so `Facility` can't move while `WarehouseZone`,
`WarehouseBin` and the rest still point at it from Prisma's side. Any partial move leaves Prisma
managing a foreign key into a table it no longer owns, or .NET managing one into Prisma's.

That leaves two options:

1. **Move everything in one handover**, after all the Node code that touches these tables has been
   ported or cut off. Until then .NET reads and writes the tables where they are.
2. **Move tables as they port**, with .NET writing to Prisma-owned tables for a while and both tools
   holding foreign keys into each other's tables. Rejected: two owners of the same DDL is the thing
   ADR 0004 set out to avoid, and every cross-owner foreign key would need unwinding later.

Copying data into new tables was also considered and rejected. `ALTER TABLE ... SET SCHEMA` moves a
table, with its rows, indexes and constraints, as a metadata change.

## Decision

**All 32 WMS and inventory tables leave Prisma in a single handover, at the end of the port. Until
then, Prisma keeps sole ownership of their DDL, and .NET works on them only through views.**

### Before the handover

- Prisma owns the tables' structure and migrations, exactly as today. **Their Prisma schema is
  frozen** once stage 0 finishes, except for a change made together with the matching view
  migration on the .NET side, because a view blocks dropping or retyping a column it reads.
- .NET reads through views in the `wms` schema that filter on `app.org_id` (#352 set the pattern).
- .NET writes through the same views. A simple single-table view is automatically updatable in
  Postgres, and `WITH LOCAL CHECK OPTION` refuses an insert or update whose row the view would not
  show, so a write can't land in another org. .NET only ever runs DML on these tables, never DDL.
- Prisma fills ids (`@default(uuid())`) and `@updatedAt` in its client, so the columns have no
  database default. Until the handover, .NET sets both itself.
- Every route moves behind `WMS_SERVICE_URL`, so any stage up to here is rolled back by unsetting it.

### What has to be true first

- **No foreign key crosses the boundary**, in either direction. Today 13 do, nearly all through
  `TrackableUnit`. The split programme's steps 2b and 2c and #297 cut them.
- **No code outside `wms` and `inventory` touches their tables.** Nine files do today. They move to
  ports and events, and a new lint check keeps it that way.
- Every WMS and inventory route, command, handler and worker is served by .NET.

### The handover

1. A **Prisma migration** moves each table with `ALTER TABLE ... SET SCHEMA wms` and removes the
   models from `wms.prisma` and `inventory.prisma`. Prisma's own history then ends with the tables
   leaving, so a shadow database replays cleanly and `prisma migrate diff` stays empty.
2. A **.NET migration** adopts them: renames columns to snake_case, adds database defaults for ids
   and timestamps, enables and forces row-level security with a policy per table, and drops the
   transitional views. Repository SQL already uses the view column names, which are the final ones.
3. The Node WMS and inventory code is deleted, and the proxy forwards by path prefix.

Prisma's migration runs first, then .NET's, in the same deploy. It is rehearsed on a copy of real
data before it runs anywhere that matters, and the rollback is a restore from backup.

## Consequences

- **Easier:** no data is copied, so the handover is quick and holds its locks briefly; each table
  has one owner at every point; every stage before the handover can be rolled back with a
  config change.
- **Harder:** the WMS Prisma schema is frozen for the length of the port, so new warehouse features
  wait or are built on the .NET side. Every write path needs its view to be updatable, which rules
  out joins in a view that is written to. Stage 0 work lands in TypeScript that is later deleted.
- **Given up:** moving tables early to reach the final RLS shape sooner. Until the handover, the
  view's org filter stands in for each table's policy.
