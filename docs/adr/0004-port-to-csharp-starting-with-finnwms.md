# ADR 0004: Port to C#, starting with FinnWMS

- **Status:** Accepted. The "Database and the handover from Prisma" section is superseded by
  [ADR 0005](0005-wms-table-handover-in-one-move.md)
- **Date:** 2026-10-21
- **Partly supersedes:** [ADR 0002](0002-modular-monolith-product-composition.md), the rejection of
  separate services "now" (alternative 3) and the TypeScript-only assumption behind it
- **Issues:** #351 (this ADR), #352 (walking skeleton)

## Context

Open TMS is about 233k lines of TypeScript: a Fastify, Prisma and PostgreSQL backend and a React
SPA, maintained by one person with heavy AI-assisted development. ADR 0002 split it into modules
(`core`, `finance`, `inventory`, `quality`, `tms`, `wms`) with a lint-enforced DAG, and the split
programme has since cut most of the hard links between TMS and WMS.

We want to move the backend to C# and .NET. The reasons:

- **Performance.** A compiled runtime with a mature JIT, real threads for background work, and
  direct control over database access.
- **Perception.** Warehouse and 3PL customers, integrators and hires expect .NET in this space.
- **Depth of knowledge.** The maintainer knows C# and .NET far better than the Node ecosystem, so
  design judgement and debugging are better on the .NET side.
- **Monitoring.** .NET has first-class OpenTelemetry, runtime metrics and diagnostics, which make
  the running system easier to watch.

The cost of a port grows with every feature added in TypeScript, so if we are going to do it, the
time to start is now.

Inventory was the obvious first candidate because it is the smallest module (5 models, about 1.5k
lines). It is a poor one. It sits in the middle of the DAG, and about nine WMS commands (putaway,
pick, transfer, adjust, cycle count, wave release, replenishment) plus RMA completion change stock
in the same database transaction as their own rows. Moving inventory into a separate process on
its own would turn each of those into a distributed transaction.

### Alternatives considered and rejected

1. **Stay on TypeScript.** Keeps one stack, but leaves every reason above unaddressed, and the
   port only gets more expensive.
2. **Inventory first, as a ledger service.** A .NET service owning stock, with idempotent movement
   commands that the TypeScript WMS calls through a port. A smaller first step, but it needs
   reservation and compensation logic that becomes throwaway once WMS follows it into .NET.
3. **Big-bang rewrite.** Freezes the product for many months and has no point at which the new
   system is proven in production. Not survivable for a solo maintainer with live users.
4. **Entity Framework Core.** The obvious .NET data layer. Rejected because the CQRS write path
   already makes every change explicit, so the change tracker adds little; read models are flat
   tables that suit plain SQL; generated migrations and model snapshots are a recurring source of
   friction; and LINQ translation sits between the code and the SQL we want to see and trace.

## Decision

**We port the whole backend to C# and .NET incrementally. The first service is FinnWMS: the `wms`
and `inventory` modules together, as one .NET service.**

### Shape of the port

- The port runs as a strangler. The .NET and TypeScript backends run side by side, and the
  TypeScript side shrinks module by module. The order after FinnWMS is decided in later ADRs.
- WMS and inventory move together because stock movements and the warehouse operations that cause
  them form one consistency boundary. Inside the .NET service a pick still decrements stock in a
  single local transaction.
- The .NET code lives in this monorepo under `services/`, starting with `services/wms/`, so the
  whole system and `.claude/rules/` stay visible in one place. ADR 0002's reasons for one repo
  still hold.
- Target framework is .NET 10 (LTS). ASP.NET Core minimal APIs for HTTP.

### Data access

- **Npgsql and Dapper, with hand-written SQL.** SQL lives only in repository classes, is always
  parameterised, and is never built by concatenating runtime values. The architecture rule carries
  over unchanged in spirit.
- **Migrations are forward-only, numbered `.sql` files run by DbUp.** No generated migrations, no
  model snapshot.
- **Tenancy is enforced by Postgres row-level security.** Every tenant table has `org_id` and an
  RLS policy against `current_setting('app.org_id')`. Each unit of work opens a transaction and
  runs `SET LOCAL app.org_id` from the authenticated principal before any query. Repository
  methods still take `orgId` explicitly, so the intent is visible in the code; RLS is the backstop
  that refuses a leak even when the code is wrong. The service connects as a role that is subject
  to RLS, never as the table owner.
- **Repository tests run against a real Postgres** via Testcontainers. With no compile-time check
  on SQL, every repository method gets at least one integration test.

### Database and the handover from Prisma

- Same Postgres server, separate schema: `wms`. Only the .NET migrations touch it.
- Tables move in this order: the first .NET migration is a baseline that recreates exactly what
  Prisma built for the WMS and inventory models; the data moves into the `wms` schema; the models
  are removed from `backend/prisma/schema/wms.prisma` and `inventory.prisma`. We confirm
  `prisma migrate diff` is empty afterwards. No table is ever owned by both tools.
- References from `wms` to data that stays in TypeScript (organisation, users, customers, orders)
  are soft ids with no foreign key, as ADR 0002 already requires across module boundaries.
- Reference data the .NET side needs from core is held in local projections fed by events. Until
  the event bridge exists, read-only views in a `core_ref` schema are allowed as a temporary
  measure. Each view is listed in the service README and removed when its projection lands.

### Between the two stacks

- **Events** go through a transactional outbox on each side, relayed to a message broker. The
  broker is chosen in the issue that builds the bridge (NATS and RabbitMQ are the candidates).
  pg-boss stays the TypeScript job queue; it is not used for cross-stack messaging.
- **Event contracts** are defined once as JSON Schema and generated into both TypeScript and C#.
  Consumers stay idempotent, as today.
- **Synchronous calls** use HTTP behind the existing port interfaces. `IFulfilmentDemandSource` is
  the first: the TypeScript implementation over `Order` becomes an HTTP endpoint the .NET service
  calls.
- **Auth.** Core auth stays the identity provider until core is ported. The .NET service validates
  the existing internal JWTs (HS256, `open-tms-auth` issuer, shared `JWT_SECRET`), checks the
  issuer as well as the signature, and takes `orgId` from the token. Portal and API-key principals
  follow the same pattern when their WMS routes move.

### Frontend

- One React SPA, unchanged in style: shadcn/ui and the same tokens.
- The .NET service publishes an OpenAPI document. A TypeScript client is generated from it, and
  WMS pages call that client.
- A reverse proxy routes the WMS and inventory API paths to the .NET service and everything else
  to Node, so the frontend sees one origin.

### Operations

- `/health` and `/metrics` from the first commit. `/metrics` is in Prometheus format. (Corrected
  2026-10-21: the original text said this matched the Node side, but Node's `/metrics` is
  tenant-scoped JSON.)
- OpenTelemetry traces for HTTP, Npgsql and the outbox relay.
- The service ships as its own container and joins `docker-compose.yml`.

### Rules

`.claude/rules/language-and-tooling.md` changes to allow C# under `services/`. Each existing rule
that names Prisma, Fastify or Jest gets a C# equivalent as the matching code lands, rather than all
at once. The module DAG carries over: inside .NET it is enforced by project references, and
`tms` and `wms` still never depend on each other.

## Consequences

- **Easier:** performance work and diagnostics on the warehouse side; tenancy enforced by the
  database rather than by discipline alone; migrations that read exactly as they run; a standalone
  FinnWMS deployment that is a real separate service; working in the stack the maintainer knows
  best.
- **Harder:** two stacks, two build and test paths and two sets of conventions for as long as the
  port runs, which will be a long time. A cross-stack event bridge and generated contracts to build
  and maintain. No compile-time checking of SQL, so the repository test suite carries more weight.
  One more container to run in every environment, including local development.
- **Given up:** shared TypeScript types between frontend and backend for ported modules (replaced
  by OpenAPI generation); `lint:tenancy` and `lint:boundaries` for ported code (replaced by RLS and
  project references); a single database transaction spanning WMS and the rest of the system,
  which ADR 0002's soft ids had already mostly given up.
