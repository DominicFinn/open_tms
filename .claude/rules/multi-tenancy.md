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
  and returns another tenant's row. Use `findFirst({ where: { id, orgId } })`, or check the owning
  parent's org first.
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

Today's gaps are in `backend/src/tooling/tenancy/baseline.json`. **The baseline may only shrink.**
The check fails on a new gap, and also on a baseline entry that is no longer a gap, so delete the
entry in the same change that fixes it. Never add to it; fix the code, or record a considered
decision in `policy.ts` with its reason.

The check cannot see a lookup by id alone, so that one is still on you and the reviewer.

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
| EDI inbound | mixed authed admin + unauthed webhook | `await registerOrgScopeForEdi(server)` |

**Warehouse PWA:** the magic-link validate and password login endpoints both return a session JWT
alongside the user payload. Every operational route requires the JWT via a plugin-level preHandler
that skips the three login endpoints. `req.user.organizationId` then drives `req.orgId` through the
standard `registerOrgScope` chain — no warehouse-specific scope helper needed.

**EDI inbound routes** (anything dealing with trading partners — `tradingPartners.ts`, every
`edi*.ts`) serve a mix of authed admins AND unauthed webhook ingest from carriers/3PLs/SFTP
collectors. `registerOrgScopeForEdi` chains the partner-aware hook with the standard fallback so:
authed admin → JWT; webhook with `body.partnerId` (or `params.partnerId` / `params.id`) → walk
through `partner.customer.orgId` (preferred) or `partner.carrier.orgId`; otherwise default
Organization. Inside handlers just read `req.orgId!` like any other route.
