# FinnWMS service

The .NET service that WMS and inventory are being ported into. [ADR 0004](../../docs/adr/0004-port-to-csharp-starting-with-finnwms.md)
records why and how. Conventions live in `.claude/rules/dotnet.md`.

## Layout

| Path | What it holds |
|---|---|
| `src/FinnWms.Host` | Entry point: configuration, middleware, the `migrate` command |
| `src/FinnWms.Platform` | Plumbing with no business rules: tenant sessions, migrations, auth, envelope, observability |
| `src/FinnWms.Wms` | The WMS module: repositories and endpoints, one folder per feature |
| `migrations/` | Forward-only SQL, run in name order by DbUp, journalled in `wms.schema_versions` |
| `openapi/finnwms.json` | Written on every build and committed. The frontend generates its types from it |
| `tests/FinnWms.Tests` | xUnit, against a real Postgres in Testcontainers |

## Running it

Prisma's migrations have to have run first, because the transitional views read Prisma's tables.

```bash
cd services/wms
dotnet run --project src/FinnWms.Host        # http://localhost:5080, migrates on start in Development
dotnet run --project src/FinnWms.Host -- migrate   # migrations only, as a deploy step
dotnet test                                   # needs Docker running
```

To have the Node backend send the ported routes here, set `WMS_SERVICE_URL=http://localhost:5080`
in `backend/.env`. Unset it and Node serves them again. `docker compose up` wires this already.

After changing an endpoint, build, then regenerate the frontend types and commit both:

```bash
dotnet build && npm run generate:wms-api -w frontend
```

## Configuration

| Setting | Notes |
|---|---|
| `ConnectionStrings__Wms` | Required. The login role must be a member of `wms_app` |
| `ConnectionStrings__WmsMigrations` | Optional, for running migrations as a different role |
| `JWT_SECRET` | Same value as the Node backend. Required in production, at least 32 bytes |
| `Wms__MigrateOnStartup` | `true` in Development. In production run `migrate` as a deploy step: it takes no lock |
| `Wms__RateLimitPerMinute` | Per caller, default 600 |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | Optional. Sends traces and metrics to a collector |

`/metrics` (Prometheus) and `/health` are unauthenticated and carry no tenant data. Keep them off
the public network at the proxy.

## Tenancy

Every query runs inside a `TenantSession`, which sets `app.org_id` and switches to the `wms_app`
role for the transaction. `wms_app` owns nothing, so row-level security always applies to it. The
organisation comes from the token's `organizationId`; a token without one is refused with a 401.
The Node backend falls back to the sole organisation for such tokens, and this service
deliberately doesn't.

## Transitional views

Tables Prisma still owns are read through views in the `wms` schema that filter on `app.org_id`.
Each is replaced by a real table with an RLS policy when its data moves.

| View | Reads | Added |
|---|---|---|
| `wms.facility` | `public."Facility"` | #352 |

## Ported routes

The Node backend forwards these when `WMS_SERVICE_URL` is set (`backend/src/plugins/wmsServiceProxy.ts`):

| Route | Issue |
|---|---|
| `GET /api/v1/facilities`, `GET /api/v1/facilities/:id` | #352. The inventory app's session may read these too (#297) |
