---
paths:
  - "backend/src/**/*.ts"
---

# Module Boundaries

Open TMS is becoming two products, FinnTMS and FinnWMS, composed from modules over a shared core.
[ADR 0002](../../docs/adr/0002-modular-monolith-product-composition.md) sets the structure and
[docs/roadmap/split-finntms-finnwms.md](../../docs/roadmap/split-finntms-finnwms.md) sequences the
work. This rule is the part you have to obey while writing code.

## The dependency DAG

| Module | May import |
|---|---|
| `core` | nothing but itself |
| `finance` | core |
| `inventory` | core |
| `quality` | core |
| `tms` | core, finance, inventory |
| `wms` | core, finance, inventory |

**`tms` and `wms` never import each other.** That is the rule the whole split rests on. Finance is
in core's tier rather than inside tms because 3PL billing is a FinnWMS revenue feature and bills
through the same charge and invoice pipeline.

Nothing has physically moved into `modules/` yet, so a file's module comes from its path. The map
lives in `backend/src/tooling/moduleBoundaries/manifest.ts`.

The schema follows the same map: `backend/prisma/schema/<module>.prisma`. The file a model sits in
is the record of which module owns it.

## Crossing a boundary

Two sanctioned ways, in order of preference:

1. **A domain event.** The far side subscribes. Consumers must be idempotent, since events are
   redelivered. This is the default.
2. **A DI-resolved port.** An interface the calling module depends on, implemented by the other one
   and registered in the container. Use this only when the call has to be synchronous and return a
   value.

   Port interfaces live in `backend/src/ports/`, which is core. They cannot sit in the calling
   module, because the implementing side would then have to import it, and tms may not import wms
   in either direction. `IFulfilmentDemandSource` is the worked example: WMS calls it, TMS
   implements it over `Order`, and a standalone FinnWMS registers something else entirely.

Direct imports across a disallowed edge, and reaching into another module's Prisma models, are both
out. No FK crosses the tms/wms boundary either. References there are soft string ids.

## Running the check

```bash
npm run lint:boundaries          # from the repo root
```

It runs in CI on every PR and as part of the backend test suite. It fails on three things: an edge
the DAG disallows, a file no manifest rule covers, and an exception that is no longer needed.

## Table ownership

The same command runs a second check, because the Prisma client is shared and an import check
can't see a file reaching another module's tables through it. The `wms` and `inventory` tables are
leaving Prisma for the .NET service (ADR 0005), so they form a sealed group in
`SEALED_TABLE_GROUPS`:

- Code outside the group never touches the group's tables through Prisma, not even to read.
- Code inside the group never touches anyone else's tables. Use a port or an event instead.
- `wms` and `inventory` may share tables with each other: they move together.

The check reads delegate calls (`prisma.<model>.<method>` or `tx.<model>.<method>`) and, in files
that run raw SQL, quoted table names. Scripts are checked too. Only tests are left out. Its
burn-down list is `ownership-exceptions.json`, and the same rules apply to it as to the import one.

## The exception list is a burn-down, not a parking space

`backend/src/tooling/moduleBoundaries/exceptions.json` holds the leaks that existed when the check
was introduced. Each entry says what should replace it. The list only ever gets shorter.

**Do not add an entry to make a new import pass.** If your change needs a new exception, the design
is wrong. Use an event or a port. The only legitimate reason to add one is a leak that predates the
check and was somehow missed.

When you fix a leak, delete its exception in the same PR. The check tells you which ones have gone
stale.

## Registering a module

A module registers itself in two places, both named after it:

- `backend/src/di/modules/<module>.ts` — `register<Module>Dependencies(prisma)` and
  `register<Module>CommandHandlers(bus, deps)`
- `backend/src/routes/modules/<module>.ts` — `register<Module>PublicRoutes(server)` for routes that
  authenticate themselves, and `register<Module>AuthenticatedRoutes(app)` for routes inside the JWT
  scope

`di/registry.ts` and `index.ts` are the composition roots: they call these and own nothing else.

Put a new binding or route in its module's file. Anything that ends up in a composition root is a
sign the design has a cross-module dependency that wants an event or a port instead.

## Composition roots and exemptions

`index.ts`, `worker.ts`, `di/registry.ts`, `commands/index.ts` and `events/registerHandlers.ts`
wire every module together, which is their job, so the check skips them. The per-module DI and
route files are not exempt: each is checked against its own module's dependencies. Tests and
`scripts/` are exempt too.

## What the checks do not catch yet

The table ownership check reads delegate calls, not relations. A `tms` query that `include`s a WMS
relation, or filters through one, reads WMS data without a delegate call on a WMS model. Those
relations go as stage 0 of the FinnWMS port cuts the foreign keys behind them, after which Prisma
won't compile the query. Until then, treat an include across the sealed group as the same leak.

Modules outside the sealed group are only checked for imports, so a `tms` file reading a `core`
table goes unremarked, as before.
