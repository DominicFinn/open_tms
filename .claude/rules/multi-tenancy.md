---
paths:
  - "backend/src/**/*.ts"
---

# Multi-tenancy (`orgId` + `req.orgId`)

- Every Prisma model that holds tenant data carries `orgId String` (NOT NULL), like `Customer`,
  `Carrier`, `Order`, `Shipment` and `Location`. That includes child tables unless they are declared
  as inheriting (see below). A nullable `orgId` is not a scope.
- **Every authenticated route already runs inside a tenant.** `index.ts` registers
  `registerStrictOrgScope` on the authenticated block, which resolves `req.orgId` and refuses the
  request with 401 when there is none. Public plugins (anything registered outside that block) must
  register their own helper from the table below.
- A token without `organizationId` resolves to the sole Organization only when exactly one exists
  (#239). With two or more it resolves to null and the request is refused. Never add a fallback that
  guesses.
- Handlers MUST pass `req.orgId!` into every repo read (`findById(id, req.orgId)`, `all(req.orgId)`,
  etc.) and onto `commandBus.dispatch({ orgId: req.orgId!, ... })`. Cross-tenant ID guesses return
  404, not 403, so existence stays opaque.
- **No lookup by id alone on tenant data.** `findUnique({ where: { id } })` compiles, passes tests,
  and returns another tenant's row. Put the org in the where: `{ id, orgId }` works in `findUnique`,
  `update`, `delete` and `upsert` on Prisma 5. Do it on writes too, even after a scoped read.
- **Every query on tenant data names the org**, including lists, counts, aggregates, bulk writes and
  lookups by a parent id or a reference. Scoping the parent earlier in the function is not enough.
- **A cron or queue sweep may read every org**, but every follow-up read and write uses the org of the
  row it found. A route never calls a sweep; give the method an `orgId` and pass `req.orgId!`.
- **Routes read `req.orgId`, never `req.user.organizationId`.** Only the scope hooks in `auth/` read the
  token, because that is where the sole-org rule lives.
- **Never take `orgId` from a request body or command payload.** It comes from the token via
  `req.orgId`, and from `command.orgId` inside a handler.
- **NEVER call `prisma.organization.findFirst()` without an org predicate.** It picks whichever org
  sorts first, for every caller. Key the lookup on the caller's org.
- **Never write `(req as any).orgId`, never fall back to `?? ''`, and never write a `'default-org'`
  or `'default'` org literal.** The cast defeats the type system, and a literal is not an org id, so
  whatever it writes belongs to nobody.

## Child tables

A child table may skip its own `orgId` when it has a **required** relation to a parent that has one
(`ShipmentStop` through `shipment`, `OrderLineItem` through `order`). Declare it in
`backend/src/tooling/tenancy/policy.ts` under `INHERITED_MODELS`, and the check confirms the chain.

Inheriting only works if the query honours it. Any lookup that starts from the child's own id must
also check the parent's org (`where: { id, shipment: { orgId } }`), or resolve the parent under the
org first and return 404 on a miss. If the child is listed or queried on its own (scans,
discrepancies, documents), give it its own `orgId` instead.

## The tenancy check

`npm run lint:tenancy` runs in CI next to `lint:boundaries`. It fails on:

- a model with no org column that is neither global nor inheriting, or a nullable org column
- a public route plugin that registers no scope helper, or a route file no module registers
- an `(x as any).orgId`, an `orgId ?? ''` / `|| 'literal'` fallback, or an `orgId: 'default'` literal
- an `organization.findFirst` with no org predicate
- a route reading the org straight off the token (`req.user.organizationId`)
- `id-only-lookup`: a find, update, delete or upsert on tenant data whose where starts with `id` and
  never names the org
- `unscoped-query`: any other query on tenant data whose where never names the org, or that has no
  where at all

The baseline in `backend/src/tooling/tenancy/baseline.json` is empty since #314, and it stays that
way: fix the code, or record a considered decision in `policy.ts` with its reason.

A query that genuinely must not name the org carries a marker on the line directly above it:

```ts
// tenancy-exempt: the magic link token hash is the credential that establishes the tenant
```

Only four reasons qualify: a lookup by a secret or token hash that establishes the tenant, the
signed-in principal looked up by the id in its own verified token, a cron or queue sweep (see
above), and a check on an id that is unique across the whole platform. Anything driven by request
input is never exempt. Reviewers read every new marker.

The check reads object literals, so a where held in a variable or built with a spread is invisible
to it. Those are still on you and the reviewer.

## A scope that resolves to nothing is not a scope

`req.orgId!` is a lie the compiler believes. If the hook that populates it was never registered,
`req.orgId` is `undefined`, and **Prisma reads `where: { orgId: undefined }` as no filter at all**,
so the query returns every tenant's rows while the source looks correct.

That is not hypothetical. No WMS route registered the org scope until #238, so ten repositories,
21 command-handler fixes and a whole `scopedWhere` helper were all filtering on `undefined`. It
passed typecheck, ~1980 unit tests and CI, and leaked across tenants against a real database. The
cargo tracking routes (#295) had the same bug.

**Two things follow.** Register the scope where it cannot be forgotten, which is why the
authenticated block now does it for every route and `registerWmsGuard` does it for WMS. And when you
change anything tenancy-related, **start the server, seed a second organization, and call the
endpoint.** Unit tests mock Prisma, so they never see this class of bug.

## Per-surface scope helpers

| Surface | Auth | Register at top of plugin |
|---|---|---|
| Admin app | `authenticateJWT` | `registerOrgScope(server)` |
| Customer portal | `authenticateCustomerJWT` + `req.customerUser` | `attachOrgScopeFromCustomerUserHook(server.prisma)` — walks `customerUser.customerId → Customer.orgId` |
| Carrier portal | `authenticateCarrierJWT` + `req.carrierUser` | `attachOrgScopeFromCarrierUserHook(server.prisma)` — walks `carrierUser.carrierId → Carrier.orgId` |
| Warehouse PWA | `authenticateJWT` (same JWT shape as admin login, plus `scope: 'warehouse'` which restricts the token to warehouse/WMS task routes) | `registerOrgScope(server)` |
| EDI | `authenticateJWT` (admin UI) or `x-api-key` (EDI collector) | `await registerOrgScopeForEdi(server)` |

**Warehouse PWA:** the magic-link validate and password login endpoints both return a session JWT
alongside the user payload. Every operational route requires the JWT via a plugin-level preHandler
that skips the three login endpoints. `req.user.organizationId` then drives `req.orgId` through the
standard `registerOrgScope` chain — no warehouse-specific scope helper needed.

**EDI routes** (`tradingPartners.ts` and every `edi*.ts`) are called by the admin UI with a JWT and
by the EDI collector with an API key. `registerOrgScopeForEdi` takes the org from whichever
credential authenticated and refuses anything else with 401. A trading partner id is not a secret, so
it never selects the tenant (#314): a `partnerId` in the body or path only picks a partner inside the
caller's org, and the routes look it up with that org, so a foreign id is a 404.
