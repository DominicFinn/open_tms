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
2. **A DI-resolved port.** An interface owned by the *calling* module, implemented by the other one
   and registered in the container. Use this only when the call has to be synchronous and return a
   value.

Direct imports across a disallowed edge, and reaching into another module's Prisma models, are both
out. No FK crosses the tms/wms boundary either. References there are soft string ids.

## Running the check

```bash
npm run lint:boundaries          # from the repo root
```

It runs in CI on every PR and as part of the backend test suite. It fails on three things: an edge
the DAG disallows, a file no manifest rule covers, and an exception that is no longer needed.

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

## What the check does not catch yet

It reads import statements only. A wms file reading `tx.order` through the shared Prisma client is
just as much a leak and goes undetected. The schema folder now records who owns each model, so
teaching the check to read Prisma model access is the next chunk.

Until then, that one is on you: if you are writing warehouse code and you find yourself touching a
TMS model, stop and read from a WMS read model instead.
