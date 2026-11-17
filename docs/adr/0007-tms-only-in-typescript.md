# ADR 0007: Open TMS is a TMS only, and stays on TypeScript

- **Status:** Accepted
- **Date:** 2026-11-17
- **Supersedes:** [ADR 0002](0002-modular-monolith-product-composition.md) (the FinnTMS / FinnWMS
  product split), [ADR 0004](0004-port-to-csharp-starting-with-finnwms.md) (the port to C#),
  [ADR 0005](0005-wms-table-handover-in-one-move.md) and
  [ADR 0006](0006-event-bridge-over-postgres.md)
- **Issues:** #392 (epic), #393, #394, #395, #396
- **Relates to:** the `open-tms-back-to-tms` article (`www/src/content/articles.ts`)

## Context

ADR 0002 set out to compose two products, FinnTMS and FinnWMS, from modules over a shared core.
ADR 0004 then decided to port the whole backend to C#, starting with the warehouse and inventory
modules as one .NET service, and ADRs 0005 and 0006 covered how that service would take over its
tables and exchange events with Node.

By November 2026 the repository carried a TMS, a WMS, an inventory module, two floor apps and the
first slice of a .NET service. That is three products and two stacks, and the maintainers could
not finish any of them at that width. The transport side was the most complete. The warehouse side
was the least, and it was also where most of the split and port machinery lived: the tms/wms
dependency rule, the ports between the two, the sealed table groups, the dual-written handling
units and the event bridge.

### Alternatives considered and rejected

1. **Carry on with the split and the port.** Rejected on effort. Stage 0 of the port alone had
   taken dozens of pull requests, and the handover of 36 tables was still ahead.
2. **Keep the WMS in TypeScript and drop only the port.** This removes the second stack but keeps
   the second and third products, which is the larger cost.
3. **Freeze the WMS in place, unmaintained.** Code that is present but not maintained still has to
   compile, pass tenancy checks and migrate. It also tells a reader the feature is supported.

## Decision

Open TMS is a transport management system only. It keeps its name, and its backend stays on
TypeScript, Fastify, Prisma and PostgreSQL.

Removed from the repository:

- the `wms` and `inventory` backend modules, with their tables
- the warehouse app, the inventory app and the dock app, with magic-link login and the scoped
  warehouse and inventory sessions
- `services/wms`, the .NET service, with the proxy plugin and the event bridge
- the ports between TMS and WMS, the sealed table check, and the dual-written `HandlingUnit`

Kept: orders, shipments, consolidations, carriers and tendering, EDI, tracking, the issue engine
and triage, quality (CAPA and SOP checklists), finance, and the customer and carrier portals.

Four things that sat under the Warehouse menu were transport features and stay: packaging types,
carrier cutoffs, the cutoff-at-risk monitor and returns (RMAs).

The removed code stays in the git history. The last commit that carries it is tagged
`last-with-wms`.

## Consequences

**Easier**

- One product and one stack to build, test, deploy and document.
- The module map shrinks to `core`, `finance`, `quality` and `tms`. The import check stays, because
  it still keeps finance and quality from reaching into transport code.
- `TrackableUnit` is a transport unit again, with no warehouse state on it.

**Harder, or given up**

- There is no warehouse execution in the product. Anyone who needs it stays on `last-with-wms`
  or integrates an external WMS.
- Upgrading past the tag drops the warehouse and inventory tables and the data in them.
- A returned item can be received and inspected against its RMA, but nothing puts it back into
  stock.
- The cutoff monitor no longer knows how much picking and packing is outstanding. It allows a
  fixed handling time per open shipment instead.
- Devices are assigned to shipments from the admin app. There is no floor app for it.
- The work spent on the split and the port (ADRs 0002, 0004, 0005 and 0006) is written off here.
  Those ADRs stay in this directory as the record of what was tried.
