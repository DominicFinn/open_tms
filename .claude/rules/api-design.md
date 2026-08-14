---
paths:
  - "backend/src/routes/**"
  - "auth-service/**/*.ts"
---

# API Design (STRICT)

## RESTful and versioned

- Versioned under `/api/v1/...`
- Resource-shaped paths, HTTP verbs carry the intent: `GET /shipments`, `POST /shipments`,
  `GET /shipments/:id`, `POST /shipments/:id/unarchive`
- **Never make a breaking change to an existing API version.** Add `v2` and give consumers time to
  migrate before retiring `v1`.

## Consistent response envelope

Every endpoint returns `{ data, error }` — never a bare object, never a raw Prisma model.

List endpoints add pagination metadata:

```jsonc
{ "data": [ ... ], "meta": { "page": 1, "perPage": 50, "total": 1284 }, "error": null }
```

**Shape the response deliberately.** Reshape flat read-model fields into the nested shape the UI
expects, and select only the fields the consumer needs. Returning the model as it came out of Prisma
leaks columns and turns every schema change into an accidental API change.

## Pagination on all list endpoints

No unbounded list endpoint. Every collection takes `page`/`perPage` (or cursor) with an enforced
maximum page size, and returns the total. An endpoint that can return the whole table is an
availability incident waiting for the table to grow.

## Use HTTP status codes — returning 200 with an error is a cardinal sin

The status code is part of the contract. Clients, proxies, retries and monitoring all read it.

| Code | Use |
|---|---|
| 200 | Successful read/update |
| 201 | Resource created |
| 202 | Accepted — queued for async processing (see the queues rule) |
| 204 | Success, no body |
| 400 | Malformed request / failed validation |
| 401 | Not authenticated |
| 403 | Authenticated but not permitted |
| 404 | Not found — **also used for cross-tenant id guesses**, so existence stays opaque |
| 409 | Conflict — duplicate, version mismatch, invalid state transition |
| 422 | Semantically invalid (well-formed but unprocessable) |
| 429 | Rate limited |
| 5xx | Our fault |

`return reply.send({ data: null, error: 'Not found' })` with an implicit 200 is **forbidden**. Set
the code.

Error bodies must not leak stack traces, SQL, or internal paths.

## Validate in the schema, not in the handler

Every endpoint carries a Fastify `schema` block. Validation happens there — body, params, query,
and response — **before** the handler runs.

Do not hand-roll `if (!req.body.foo) return 400` chains inside handlers; that's how handlers turn
noisy and how validation drifts between endpoints. If a rule can be expressed in the schema, it
belongs in the schema.

Authorization checks (permission, ownership) belong in a preHandler, not scattered through the body
of the handler.

## Swagger/OpenAPI on every endpoint

The `schema` block is also the documentation — add `tags` for grouping, and describe the response
shapes. A new endpoint without a schema block is incomplete.

## Rate limiting

Rate limit endpoints, and be aggressive on authentication and any endpoint that can be used to
enumerate or brute-force. Apply exponential backoff on repeated auth failures.
