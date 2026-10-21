---
paths:
  - "services/**"
---

# .NET services

How C# is written under `services/`. ADR 0004 records the decisions; `services/wms/README.md` has
the layout, commands and the lists of transitional views and ported routes, which you keep current.

## Layering

Endpoint → handler (writes) → repository → database. The same thin-route rule as the Node side:
an endpoint parses input, gets the session, calls a repository or handler, and shapes the
envelope. Business rules live in handlers.

- One folder per feature inside its module project (`FinnWms.Wms/Facilities/`).
- `FinnWms.Platform` holds plumbing only. No business rule goes in it.
- Modules reference `Platform`, never each other, except along the DAG in the module-boundaries
  rule. `tms` and `wms` never reference each other.

## SQL

- **SQL lives only in repository classes**, written by hand, run through Dapper.
- Always parameterised. Never interpolate a runtime value into SQL. Interpolating a `const` column
  list is fine.
- Every repository method takes the `TenantSession` and an explicit `orgId`, and filters on
  `org_id` even though RLS would catch it.
- Columns are snake_case; `MatchNamesWithUnderscores` maps them to PascalCase properties.
- Reuse a query before writing a near-duplicate, as on the Node side.

## Tenancy

- **All database access goes through a `TenantSession`**, normally from the scoped `TenantDb`. Never
  open a raw connection from the data source in feature code.
- Every tenant table in the `wms` schema gets `ENABLE ROW LEVEL SECURITY`, `FORCE ROW LEVEL
  SECURITY` and a policy on `org_id = current_setting('app.org_id', true)`, plus grants to
  `wms_app`. A view over a Prisma table filters on the same setting instead.
- Cross-tenant ids return 404, never 403.

## Migrations

- Forward-only `.sql` files in `services/<name>/migrations/`, named `NNNN_what_it_does.sql`. One
  concern per file.
- **Never edit a migration that has run anywhere.** Fix forward with a new one.
- Never touch a table Prisma owns. Moving a table out of Prisma follows the handover in ADR 0004.
- `prisma migrate diff` must stay empty after a .NET migration.

## API

- `{ data, error }` envelope, `{ data, meta, error }` for lists, built from `Platform/Http`.
- Paginate every list. Validate input before touching the database and return a 400 envelope.
- Every endpoint declares a policy (`Policies.*`), a tag, a summary and its `Produces` types, so
  the OpenAPI document is complete. Commit `openapi/*.json` and the regenerated frontend types
  together.
- A ported route keeps the Node response shape exactly, and gets an entry in the proxy's
  `PORTED_ROUTES` and the service README.

## Errors and logging

- try/catch only at the edges. Throw specific exception types. The exception handler turns
  anything unhandled into a 500 envelope with no detail.
- `ILogger` with `[LoggerMessage]` source-generated methods. Structured fields, IDs only, no PII,
  no tokens.

## Tests

- **Every repository method has an integration test against real Postgres** (Testcontainers via
  `DatabaseFixture`). There is no compile-time check on SQL, so these are the safety net.
- Every tenant-scoped query has a test proving another org's rows are invisible.
- Endpoint tests use `WmsApiFactory` and `TestTokens`, which mints tokens the way Node does.
- Run `dotnet test` in the service folder. Docker must be running.

## Build

`TreatWarningsAsErrors` and the recommended analysers are on. Fix the warning rather than
suppressing it; a suppression goes in `.editorconfig` with a comment saying why.
