---
paths:
  - "backend/src/**/*.ts"
  - "auth-service/**/*.ts"
---

# Backend Conventions

Fastify + TypeScript + Prisma + PostgreSQL, port 3001.

## API Response Envelope

All endpoints return `{ data, error }` — never a bare object.

## Dependency Injection

- DI container in `backend/src/di/` with Symbol-based tokens (`TOKENS`)
- Register new services/repos in `backend/src/di/registry.ts`
- Routes resolve dependencies via `container.resolve<Interface>(TOKENS.Token)`

## Repository Pattern

- Interface + DTO + Implementation per entity
- All DB access goes through repositories, never raw Prisma in routes

## Routes

- Register in `backend/src/index.ts`
- Add Swagger/OpenAPI `schema` blocks to every endpoint
- Use `tags` for grouping in Swagger UI
- Nullable JSON fields must use `Prisma.JsonNull`, not `null`

## Read Models on List Endpoints

- List endpoints **should use the denormalized read model** (e.g. `ShipmentReadModel`) for
  performance. Projections maintain these tables.
- Projections are wired through pg-boss. The worker polls every **0.5 seconds** (set via
  `pollingIntervalSeconds: 0.5` in `backend/src/queue/PgBossQueueAdapter.ts`), so a fresh write
  is reflected in the read model within roughly half a second of the transaction committing.
  That's "timely enough" that POST-then-navigate-to-list works.
- When a list endpoint reads from a `*ReadModel`, reshape the flat denormalized fields into the
  nested relation shape the UI expects (e.g. expose `s.customer.name`, `s.origin.city`, not just
  `s.customerName`, `s.originCity`). `GET /api/v1/shipments` in `backend/src/routes/shipments.ts`
  is the canonical example.
- If the projection ever appears stuck, check the `evt.projection.<name>` queue stats and the
  dead-letter queue rather than papering over it by switching to a live read.

## File Storage

- Storage keys are opaque: `files/{uuid}` — no entity info, filenames, or customer data
- All file ops go through `IBinaryStorageProvider` (S3 or DB fallback)
- Default retention: 10 years
