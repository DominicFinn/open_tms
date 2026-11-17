---
paths:
  - "backend/src/**/*.ts"
---

# Module Boundaries

The backend is one deployable, organised into four modules. The warehouse and inventory modules
were removed in November 2026, which is recorded in
[ADR 0007](../../docs/adr/0007-tms-only-in-typescript.md). This rule is the part you have to obey
while writing code.

## The dependency DAG

| Module | May import |
|---|---|
| `core` | nothing but itself |
| `finance` | core |
| `quality` | core |
| `tms` | core, finance |

**`finance` and `quality` never import `tms`.** Transport is the top of the graph. Billing and
quality sit below it so they can be reasoned about, tested and changed without the shipment and
order code in the way.

Nothing has physically moved into `modules/`, so a file's module comes from its path. The map
lives in `backend/src/tooling/moduleBoundaries/manifest.ts`.

The schema follows the same map: `backend/prisma/schema/<module>.prisma`. The file a model sits in
is the record of which module owns it.

## Crossing a boundary

Two sanctioned ways, in order of preference:

1. **A domain event.** The far side subscribes. Consumers must be idempotent, since events are
   redelivered. This is the default.
2. **A DI-resolved interface.** An interface the calling module depends on, implemented by the
   other one and registered in the container under a token. Use this only when the call has to be
   synchronous and return a value. The interface lives with the module that calls it, or in core
   when the implementing module may not import the caller.

Direct imports across a disallowed edge are out.

**A command never calls across a boundary synchronously.** A command runs inside a transaction
(see the transactions rule), and what it needs from another module should already be in the event
that triggered it or in its own tables.

## Running the check

```bash
npm run lint:boundaries          # from the repo root
```

It runs in CI on every PR and as part of the backend test suite. It fails on three things: an edge
the DAG disallows, a file no manifest rule covers, and an exception that is no longer needed.

The check reads imports only. A `tms` file reading a `core` or `finance` table through the shared
Prisma client goes unremarked, so table ownership is on you and the reviewer.

## The exception list is a burn-down, not a parking space

`backend/src/tooling/moduleBoundaries/exceptions.json` holds the leaks that existed when the check
was introduced. Each entry says what should replace it. The list only ever gets shorter.

**Do not add an entry to make a new import pass.** If your change needs a new exception, the design
is wrong. Use an event or a DI-resolved interface. The only legitimate reason to add one is a leak
that predates the check and was somehow missed.

When you fix a leak, delete its exception in the same PR. The check tells you which ones have gone
stale.

## Registering a module

A module registers itself in two places, both named after it:

- `backend/src/di/modules/<module>.ts`: `register<Module>Dependencies(prisma)` and
  `register<Module>CommandHandlers(bus, deps)`
- `backend/src/routes/modules/<module>.ts`: `register<Module>PublicRoutes(server)` for routes that
  authenticate themselves, and `register<Module>AuthenticatedRoutes(app)` for routes inside the JWT
  scope

`di/registry.ts` and `index.ts` are the composition roots: they call these and own nothing else.

Put a new binding or route in its module's file. Anything that ends up in a composition root is a
sign the design has a cross-module dependency that wants an event or an interface instead.

## Composition roots and exemptions

`index.ts`, `worker.ts`, `di/registry.ts`, `commands/index.ts` and `events/registerHandlers.ts`
wire every module together, which is their job, so the check skips them. The per-module DI and
route files are not exempt: each is checked against its own module's dependencies. Tests and
`scripts/` are exempt too.
