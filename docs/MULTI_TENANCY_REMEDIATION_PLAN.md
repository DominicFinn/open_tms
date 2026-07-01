# Multi-Tenancy Remediation Plan

## TL;DR

Open TMS has **structural multi-tenancy gaps**. The `Organization` model exists, JWTs carry `organizationId`, and 22+ tables (read models, financials, issues, agent infra) have an `orgId` column that's enforced. But **7 core entities have no `orgId` column at all** — `Customer`, `Carrier`, `Shipment`, `TradingPartner`, `ApiKey`, `Order`, `Rma` — and several routes either don't filter on `orgId` even when the column exists, or fall back to `prisma.organization.findFirst()` instead of using the JWT.

The result is a system that's **mid-migration to multi-tenancy**, with real cross-tenant data leaks today. This document inventories the gaps and proposes a phased fix.

## Verdict

**The system is not effectively single-tenant.** Multiple Organization rows exist, JWTs carry `organizationId`, the read-model tier is org-scoped — but a meaningful fraction of routes and several core tables don't enforce org boundaries. Treat this as a partially-completed migration that needs finishing, not as "we'll add multi-tenancy later".

## Schema inventory

### Tables with `orgId` enforced
`Quote`, `Tender` (via `Shipment.orgId` join), `Invoice`, `Charge`, `Issue`, `AgentConfig`, `AutomationRule`, `AgentDecision`, `CAPAReport`, `EmailTemplate`, `ShipmentFinancialSummary`, `CarrierInvoice`, `Payment`, plus all `*ReadModel` tables (`CustomerReadModel`, `CarrierReadModel`, `ShipmentReadModel`, `OrderReadModel`, `InvoiceReadModel`, `LaneReadModel`, `IssueReadModel`, `AgentDecisionReadModel`).

### Tables WITHOUT `orgId` (the gap)
`Customer`, `Carrier`, `Shipment`, `TradingPartner`, `ApiKey`, `Order`, `Rma`. These are the source-of-truth tables that the read models project from. The denormalized read models pick up `orgId` somewhere along the way; the live tables can't filter on it.

### Implicitly shared today
`Location`, `Lane`, `Driver`, `Vehicle`, `Device`, `Load`. No `orgId`. If two orgs use the same physical locations/lanes that may be intentional, but it's currently silent.

## Top cross-tenant leak risks

These are real, exploitable today by any authenticated user from any org:

| # | File:Line | Description | Severity |
|---|---|---|---|
| 1 | [routes/shipments.ts:81](backend/src/routes/shipments.ts) (FIXED) | `shipmentReadModel.findMany` ran without an `orgId` filter — listed all shipments across every tenant | CRITICAL |
| 2 | [routes/charges.ts:54](backend/src/routes/charges.ts) (FIXED) | `chargeRepo.findById(id)` had no orgId guard; ID-guessing leaked any charge | CRITICAL |
| 3 | [routes/charges.ts:36](backend/src/routes/charges.ts) (FIXED) | `getCharges` filter didn't pass `orgId` through to the repo | CRITICAL |
| 4 | [routes/customers.ts](backend/src/routes/customers.ts) | `Customer.findMany()` returns rows from every tenant; `Customer` has no `orgId` column | CRITICAL — needs schema change |
| 5 | [routes/carriers.ts](backend/src/routes/carriers.ts) | `Carrier.findById(id)` has no `orgId`; cross-tenant ID enumeration | CRITICAL — needs schema change |
| 6 | [routes/distance.ts](backend/src/routes/distance.ts) | `Location.findUnique({ id })` reveals coords from any org's locations | HIGH |
| 7 | [routes/lanes.ts](backend/src/routes/lanes.ts) | Lane CRUD references `Location.findUnique` without `orgId` | HIGH |
| 8 | Routes that fall back to `prisma.organization.findFirst()` | If JWT lacks orgId in test/seed environments, all users see org-1's data | MEDIUM |
| 9 | [routes/orders.ts](backend/src/routes/orders.ts) | `Order.findMany/findById` — no `orgId` column, scope only via implicit Customer relation | MEDIUM-HIGH |
| 10 | [routes/rma.ts](backend/src/routes/rma.ts) | `Rma.findMany()` — same as orders | MEDIUM-HIGH |

## Phased remediation

### Phase 1 — Stop active leaks (1-2 weeks)

Goal: every authenticated route filters by `orgId` from the JWT. Where the source table has `orgId`, use it. Where it doesn't, gate on the relation that does (e.g. `Order.customerId → Customer.users → User.organizationId`) until phase 2 lands the column.

Concrete tasks:

1. **Add `orgId` columns** (nullable initially, with a backfill migration):
   - `Customer` — every `Customer` belongs to one or more `User`s with an `organizationId`; backfill via `User.organizationId` of the first attached user, or "default org" for orphans.
   - `Carrier` — backfill via the org that owns the most shipments tendered to that carrier, or "default org".
   - `Order` — backfill via `Customer.orgId` once Customer has it.
   - `Rma` — same path as Order.
   - `TradingPartner` — backfill via `customer.orgId` or `carrier.orgId`.
   - `ApiKey` — backfill via `customerId → customer.orgId`; nullable orgId for global "system" keys.
2. **Update routes to filter on `orgId`** for every `findMany` / `findById` / `findFirst` / `count` on these tables. Reject by 404 (not 403) on cross-tenant access so you don't leak existence.
3. **Replace every `prisma.organization.findFirst()` fallback** with `req.user.organizationId`. Where the JWT genuinely doesn't have an org (system jobs, seed scripts), make that explicit and hard-coded — not a silent default.
4. **Add an integration test suite** for cross-tenant isolation. Two users from different orgs; for every list endpoint and every detail endpoint, assert that user A cannot see / fetch / mutate user B's resources.

Deliverable: leaks 1-3 are already fixed in this branch. Leaks 4-7 close once the schema columns land. Leaks 8-10 close in tandem.

### Phase 2 — Normalise the schema and read paths (2-3 weeks)

1. **Tighten the new `orgId` columns to NOT NULL** once backfills are verified.
2. **Audit every repository** — for `findAll`/`findMany`/`findFirst`, accept `orgId` as a required parameter. Repositories that silently allow cross-tenant reads are a footgun even with discipline at the route layer.
3. **Standardise a `resolveOrgId(req)` helper** that always pulls from the JWT, never from `findFirst()`, and throws on missing JWT in production.
4. **Add an org-scope middleware** that asserts every authenticated route has `req.user.organizationId` set. Routes that genuinely don't need scope opt out explicitly.
5. **`EdiTransactionLog.orgId`** — already added as nullable in [migrations/20260507_edi_log_orgid](backend/prisma/migrations/20260507_edi_log_orgid). Once Phase 1 lands, all new writes will populate it; backfill can chain through the new `Customer.orgId` / `Carrier.orgId` to fill historic rows.

### Phase 3 — Decide org scope for "shared" tables (3-4 weeks)

`Location`, `Lane`, `Driver`, `Vehicle`, `Device` currently have no `orgId`. For each, decide:

- **Per-org** — each org has its own private set. Add `orgId`, backfill, scope every query.
- **Shared catalogue** — every org sees the same set (probably correct for `Location` if locations are physical addresses common across logistics partners, but probably wrong for `Driver` and `Vehicle`).
- **Per-customer / per-carrier** — scoped via the entity that owns them. Document explicitly.

This is the phase that needs a product decision, not just a code change. Document the answer in [CLAUDE.md](CLAUDE.md) so future authors don't drift.

## Existing infrastructure to lean on

- [middleware/jwtAuth.ts](backend/src/middleware/jwtAuth.ts) extracts `req.user.organizationId` from the JWT today.
- The repository pattern in [AgentDecisionRepository](backend/src/repositories/AgentDecisionRepository.ts), [IssueRepository](backend/src/repositories/IssueRepository.ts), [ChargeRepository](backend/src/repositories/ChargeRepository.ts) already takes `orgId` as a filter — copy this shape for the rest.
- All `*ReadModel` tables already have `orgId` and prove the pattern works. The code that queries them just doesn't always remember to use it.

## Surprises worth flagging

- **Read models are org-scoped, source tables aren't.** The denormalisation predates the rest of the multi-tenancy work, and the live tables never caught up. This is backwards from the typical pattern.
- **`prisma.organization.findFirst()` appears in 9+ routes.** In a single-org dev environment this looks fine; in a real multi-tenant deployment it silently picks one org for everyone.
- **`ApiKey.customerId` is nullable**, meaning a "global" key with no customer scope exists as a possibility. It's not clear by reading the code whether this is intentional (system-level key) or a bug. Document or remove.

## What's already done in this branch

As part of the remediation work that produced this document:

### Pre-phase-1 fixes
- `EdiTransactionLog.orgId` column added with composite indexes ([migration](backend/prisma/migrations/20260507_edi_log_orgid)). Read endpoints in [tradingPartners.ts](backend/src/routes/tradingPartners.ts) now scope by orgId.
- `/api/v1/shipments` list endpoint scoped to `req.user.organizationId` (was leaking all orgs' shipments).
- `/api/v1/charges` list and detail endpoints scoped to `req.user.organizationId`.
- `/api/v1/edi-logs/:id` and `/api/v1/edi-logs/:id/retry` reject cross-tenant access.

### Phase 1 (this round)
- **Schema**: added nullable `orgId` columns to `Customer`, `Carrier`, `Order`, `ApiKey`, `TradingPartner` ([migration](backend/prisma/migrations/20260507_core_entity_orgid)). `Rma` already had `orgId`; `Shipment` is deferred to Phase 2. The migration backfills via:
  - `Customer.orgId` ← `User.organizationId` (any attached user; default Organization otherwise)
  - `Carrier.orgId` ← most-frequent `Customer.orgId` of attached shipments
  - `Order.orgId` ← `Customer.orgId`
  - `ApiKey.orgId` ← `Customer.orgId` (when scoped) or first Organization
  - `TradingPartner.orgId` ← `Customer.orgId` preferred, else `Carrier.orgId`
- **Repositories**: `CustomersRepository`, `CarriersRepository`, `OrdersRepository` now accept an optional `orgId` filter on `all()`, `findById()`, `findByCustomerId()`, `findByOrderNumber()`. Omitting `orgId` preserves legacy/admin behaviour; supplying it gives strict tenant scope. Cross-tenant ID guesses return null (404 at the route).
- **Routes (leaks #4, #5, #9, #10 closed)**: [customers.ts](backend/src/routes/customers.ts), [carriers.ts](backend/src/routes/carriers.ts), [orders.ts](backend/src/routes/orders.ts), [rma.ts](backend/src/routes/rma.ts) all switched from `prisma.organization.findFirst()` (which silently picked org-1 for everyone) to a `resolveOrgId(req)` helper that reads `req.user.organizationId` first. The 14 `ordersRepo.findById` call sites all pass the resolved orgId now. Update and Delete paths in each gate on the row's orgId before dispatching the command — no command runs against a row the requester can't see.
- **RMA hidden bug**: [rma.ts](backend/src/routes/rma.ts) previously read `(req as any).orgId`, which was never populated by any middleware. Every RMA query was silently scoping to the literal string `'default-org'`. Now reads from the JWT via `resolveOrgId`. Also added the missing orgId filter to `/api/v1/rmas/:id` (was `findUnique` with no tenant check).
- **Commands**: `CreateCustomerCommand`, `CreateCarrierCommand`, `CreateOrderCommand` now thread `orgId` from the payload (or fallback to `command.orgId`) onto the new row. Empty-string is treated as missing so we never write a truthy-but-meaningless string.
- **Tests** (+18): `CustomersRepository.orgIdScoping.test.ts`, `CreateOrgScopedCommands.test.ts` pin the desired behaviour — passing orgId always scopes, omitting it never does, and the payload-vs-command precedence is exercised.

### Phase 2 (this round)
- **Shared `resolveOrgId` helper** ([auth/orgScope.ts](backend/src/auth/orgScope.ts)) — reads from JWT first, caches the dev fallback (Organization.findFirst) for 60s so the unauth path isn't a per-request DB hit. The 4 phase-1 routes plus shipments/loadboard/locationOps/map now all use it; no more route-local `prisma.organization.findFirst()` copies.
- **`Shipment.orgId` column** ([migration](backend/prisma/migrations/20260508_shipment_orgid)) with backfill via `Customer.orgId`. Three composite indexes added: `(orgId)`, `(orgId, status)`, `(orgId, archived, status)`.
- **ShipmentsRepository** — `all()` and `findById()` now accept optional `orgId`; passing it scopes strictly, omitting it preserves legacy/admin reach. `CreateShipmentDTO.orgId` now required (string, NOT NULL).
- **Query-site sweep** for `prisma.shipment` in route files: [shipments.ts](backend/src/routes/shipments.ts), [loadboard.ts](backend/src/routes/loadboard.ts), [locationOps.ts](backend/src/routes/locationOps.ts), [map.ts](backend/src/routes/map.ts) all now scope by orgId on every find and add a tenant-scoped pre-check before UPDATE/DELETE dispatch. Workers/projections/handlers still touch `prisma.shipment` directly — they operate in an already-scoped event context so they're lower priority and tracked under "what's left".
- **NOT NULL tightening** ([migration](backend/prisma/migrations/20260508_tighten_orgid_not_null)) for `Customer`, `Carrier`, `Order`, `ApiKey`, `TradingPartner`, `Shipment`. The migration aborts with a clear error if any NULL rows remain so an operator can run the relevant phase-1 backfill before retrying. `EdiTransactionLog` deliberately stays nullable — its backfill was best-effort (manual imports have no relation chain back to an org).
- **Create-path enforcement**: every Create*Command that writes one of the tightened entities now throws "orgId is required to create an X" rather than dispatching a half-built row. `CreateCustomerCommand`, `CreateCarrierCommand`, `CreateOrderCommand`, `CreateShipmentCommand`, `CreateApiKeyCommand` all updated. `AcceptQuoteCommand` copies orgId from the source Quote onto the new Order + Shipment. Services that previously created entities without orgId (`CSVImportService`, `EdiImportService`, `OrderConversionService`, `ShipmentAssignmentService`) either take orgId as a required arg or derive it from the source customer.
- **Tests**: 8 new for the [`orgScope` helper](backend/src/__tests__/auth/orgScope.test.ts) (JWT precedence, fallback caching, missing-Organization handling, actorId resolution), 13 new for [cross-tenant isolation](backend/src/__tests__/integration/crossTenantIsolation.test.ts) covering Customer/Carrier/Order/Shipment ID-guessing attacks across both directions, plus the defence-in-depth contract that empty-string orgId behaves like omitted.

### Phase 3 (this round)
- **Product decision recorded**: `Location`, `Lane`, `Driver`, `Vehicle`, `Device` are all **per-org**. A shared logistics catalogue can be added as a future feature on top of this baseline; the current shape is per-tenant operational data.
- **Schema**: nullable `orgId` added to all 5 entities ([phase-3 migration](backend/prisma/migrations/20260509_phase3_orgid)). Backfill chains via the closest related entity that already carries orgId:
  - `Driver.orgId ← Carrier.orgId`
  - `Vehicle.orgId ← Carrier.orgId`
  - `Lane.orgId ← most-common Customer.orgId of attached Shipments` (fall back to default Organization)
  - `Location.orgId ← most-common Customer.orgId of Shipments using the location as origin or destination` (fall back to default Organization)
  - `Device.orgId ← most-common Customer.orgId via DeviceAssignment → Shipment` (fall back to default Organization)
- **Repositories**: `LocationsRepository` and `LanesRepository` now accept optional `orgId` on every public read (`all`, `findById`, `findByIdUnique`, `findByIdSimple`, `findByIdWithOriginDestination`, `search`, `findManyByIds`, `findMany`). Same contract as phase 1/2: passing it scopes strictly, omitting it preserves legacy reach.
- **Routes swept**:
  - `locations.ts` — list, create, get-by-id, update, search, delete all tenant-scoped. Publishes `LOCATION_*` events with the JWT's orgId instead of `prisma.organization.findFirst()`.
  - `lanes.ts` — list, create, get-by-id, update, delete tenant-scoped. Location lookups inside the create/update validators now scope by orgId so a malicious payload can't reference another tenant's locations.
  - `devices.ts` — list, get-by-id, create, update, assign, unassign, readings all tenant-scoped with 404-not-403 guards before any write.
  - `distance.ts` — `/distance/calculate` no longer leaks Location lat/lng across tenants (the survey's leak #6 finally closed at the database boundary as well as the route).
  - `locationOps.ts` — finishing the prisma.location.findUnique→findFirst swap from phase 2.
- **Services threaded with orgId**: `LocationResolutionService.resolveOrCreate` now takes an optional `orgId` on its input and scopes both the existence check and the create. `CreateShipmentCommand`'s inline Location creates also pass the resolved tenant orgId so auto-created origins/destinations land in the right place. `customerPortal.ts` Location resolution scopes by the portal user's resolved orgId so portal A can't reuse portal B's locations.
- **`SystemLocoAdapter` (external IoT webhook)**: documented limitation — external IoT webhooks have no JWT, so adapter-created Devices fall back to the first Organization. Future work: have the webhook config carry an explicit org hint.
- **NOT NULL tightening** ([migration](backend/prisma/migrations/20260509_tighten_phase3_not_null)) for all 5 entities, gated on the same NULL-check assertion as phase 2 so an operator gets a clear error message if the backfill missed any rows.
- **Create-path enforcement**: `CreateLaneCommand`, `CreateLocationCommand`, `LocationsRepository.create`/`createMany`, and the inline Location creates in `CreateShipmentCommand` all throw "orgId is required" rather than writing a half-built row. `seed.ts` and `scripts/comprehensive-seed.ts` thread orgId through to every Location/Lane/Driver/Vehicle/Device create (no more silent NULL-orgId rows from the seed path).
- **Tests** (+10 new in [crossTenantIsolationPhase3.test.ts](backend/src/__tests__/integration/crossTenantIsolationPhase3.test.ts)): Location.findById/findByIdUnique/search/all/create across two orgs, Lane.findById/findByIdSimple/all across two orgs, defence-in-depth contract for empty-string orgId.

### Phase 4 (this round) — per-org middleware
- **New module**: [auth/orgScopeMiddleware.ts](backend/src/auth/orgScopeMiddleware.ts). Augments `FastifyRequest` with `orgId?: string | null` and ships two hooks:
  - `attachOrgScopeHook(prisma)` — preHandler that populates `req.orgId` from the JWT (or falls back to the first Organization). Idempotent: skips when `req.orgId` is already set.
  - `requireOrgScope` — preHandler that returns 401 if `req.orgId` is null. Use on routes that must fail closed.
- **Convenience wrapper**: `await registerOrgScope(server)` at the top of a route plugin attaches the soft hook to every route in that plugin.
- **13 routes swept**: `customers.ts`, `carriers.ts`, `orders.ts`, `rma.ts`, `shipments.ts`, `charges.ts`, `lanes.ts`, `locations.ts`, `devices.ts`, `distance.ts`, `loadboard.ts`, `locationOps.ts`, `map.ts`. Each one dropped its per-route `resolveOrgId` helper and now reads `req.orgId!` directly. New routes get tenant scope by default just by registering with the middleware — no per-handler boilerplate.
- **CLAUDE.md** documents the contract under "Multi-tenancy (`orgId` + `req.orgId`)" so future authors know to follow the pattern.
- **Tests** (+8 in [orgScopeMiddleware.test.ts](backend/src/__tests__/auth/orgScopeMiddleware.test.ts)) cover JWT precedence, default-Organization fallback, default-org literal when no Org exists, idempotence, defensive null on DB error, requireOrgScope 401 paths.

### Phase 5 (this round) — non-JWT auth middleware
- **New helpers** in [auth/orgScopeMiddleware.ts](backend/src/auth/orgScopeMiddleware.ts):
  - `attachOrgScopeFromCustomerUserHook(prisma)` — resolves `req.orgId` by walking `req.customerUser.customerId → Customer.orgId`. Same idempotence + defensive-null contract as the JWT version.
  - `attachOrgScopeFromCarrierUserHook(prisma)` — same shape for `req.carrierUser.carrierId → Carrier.orgId`.
- **Customer portal swept** ([customerPortal.ts](backend/src/routes/customerPortal.ts)) — hook registered at the top so every authed route (25+ of them) sees `req.orgId` without per-handler boilerplate. The inline `prisma.organization.findFirst()` calls used by Order/RMA dispatches were silently picking the first Organization for every portal request — so a customer attached to org-B would have created Orders/RMAs in org-A. Both fixed.
- **Carrier portal swept** ([carrierPortal.ts](backend/src/routes/carrierPortal.ts)) — hook registered. Carrier portal had no inline `findFirst` today, but the middleware is now in place for any future routes (tender bid acceptance, carrier-side shipment updates) that need to dispatch commands.
- **Warehouse PWA** ([warehouse.ts](backend/src/routes/warehouse.ts)) — wired up with the standard `registerOrgScope` because warehouse has no auth preHandlers today. Replaced two `prisma.organization.findFirst()` calls (settings GET/PUT) with `req.orgId` lookups, and added a cross-tenant guard on the warehouse Shipment-create endpoint: a warehouse operative in tenant A cannot create a shipment under tenant B's customer (the gap isn't exploitable until warehouse PWA gets per-tenant auth, but the guard catches regressions when it does).
- **Tests** (+8 in [orgScopeMiddleware.test.ts](backend/src/__tests__/auth/orgScopeMiddleware.test.ts)) cover the customer-user and carrier-user hooks: positive lookups, missing user, missing relation row, idempotence, defensive null on DB error.
- **CLAUDE.md** documents which hook each auth model uses so future portal routes follow the right pattern.

### Phase 6 (this round) — EDI hybrid middleware
- **New hook** `attachOrgScopeFromPartnerHook(prisma)` in [auth/orgScopeMiddleware.ts](backend/src/auth/orgScopeMiddleware.ts). Resolution order:
  1. `req.user.organizationId` (JWT — admin always wins)
  2. `body.partnerId` → `partner.customer.orgId` (preferred) → `partner.carrier.orgId` (webhook ingest path)
  3. URL `params.partnerId` or `params.id` (for `/trading-partners/:id/...` routes)
  4. Otherwise leaves `req.orgId` undefined so a chained fallback hook can run

  Importantly, the partner hook **leaves orgId undefined** (not null) when it can't resolve. That lets routes chain it with a downstream fallback. This is a deliberate departure from the customer/carrier portal hooks (which lock to null) — there's no point falling through for portal routes, but the EDI inbound endpoints absolutely need a final default-Organization landing pad for unauthed seed flows and webhook ingest with malformed partner references.
- **Convenience wrapper** `registerOrgScopeForEdi(server)` chains the partner hook with the standard `attachOrgScopeHook`. One call covers the full resolution ladder.
- **10 EDI route files swept**: [tradingPartners.ts](backend/src/routes/tradingPartners.ts), [ediInbound.ts](backend/src/routes/ediInbound.ts), [edi210.ts](backend/src/routes/edi210.ts), [edi214.ts](backend/src/routes/edi214.ts), [edi820.ts](backend/src/routes/edi820.ts), [edi997.ts](backend/src/routes/edi997.ts), [ediTender.ts](backend/src/routes/ediTender.ts), [ediImport.ts](backend/src/routes/ediImport.ts), [edi940.ts](backend/src/routes/edi940.ts), [edi180.ts](backend/src/routes/edi180.ts). Each one:
  - Registers `registerOrgScopeForEdi(server)` at the top of its plugin
  - Drops every `req.user?.organizationId ?? null` and `(req as any).orgId || prisma.organization.findFirst()` pattern in favour of `req.orgId!`
  - Replaces the actor pattern `(req as any).userId || 'edi-XXX-inbound'` with `req.user?.sub ?? 'edi-XXX-inbound'` so authed calls actually record the admin's identity instead of always saying 'edi-XXX-inbound'
  - `edi214` is special: it had `(shipment as any).orgId ?? req.user?.organizationId ?? 'default-org'`. Since `Shipment.orgId` is NOT NULL post phase 2, the shipment is now the authoritative source and `req.orgId!` is the explicit fallback path.
- **Tests** (+10 in [orgScopeMiddleware.test.ts](backend/src/__tests__/auth/orgScopeMiddleware.test.ts)) cover the hybrid hook end-to-end: JWT-wins precedence, body partnerId walk via customer, fallback via carrier, URL `params.partnerId` and `params.id`, idempotence, non-string partnerId safety, DB error → leave undefined (not null) so the fallback hook fires, plus an end-to-end chain test showing partner-hook → fallback-hook → default Organization.

### Phase 7 (this round) — warehouse PWA per-tenant auth
- **Root cause confirmed**: `WarehouseService.validateMagicLink` and `passwordLogin` returned a `user` payload but **no session token at all**. Every operational warehouse route was running unauthenticated, and the standard `registerOrgScope` was silently picking the default Organization for whoever happened to call.
- **Shared JWT helper** [auth/internalJWT.ts](backend/src/auth/internalJWT.ts) — `signInternalJWT(claims, ttlHours?)` produces tokens with the same shape as `AuthService.generateToken` (HS256, `open-tms-auth` issuer). The existing `authenticateJWT` middleware accepts them as-is — no new verifier needed.
- **Warehouse login flows now mint a session token** ([WarehouseService.ts](backend/src/services/WarehouseService.ts)) — both `validateMagicLink` and `passwordLogin` return `{ token, user }`. `LoginResult.token` is documented as the value to send in the `Authorization: Bearer …` header on every subsequent warehouse request.
- **Warehouse plugin preHandler** ([warehouse.ts](backend/src/routes/warehouse.ts)) — a single plugin-level hook runs `authenticateJWT` on every route except an allow-list of three login endpoints (`/auth/magic-link/generate`, `/auth/magic-link/validate`, `/auth/login`). After auth fires, `req.user.organizationId` flows through the standard `registerOrgScope` chain that was already wired up, so `req.orgId` is now driven by the JWT instead of falling back to the default Organization on every call.
- **Tests** (+13):
  - 7 in [internalJWT.test.ts](backend/src/__tests__/auth/internalJWT.test.ts) cover the JWT shape — 3 segments, HS256 header, every claim makes it into the payload, iat/exp/iss correctness, custom TTL, signature verifies against `JWT_SECRET`, optional claims are correctly omitted.
  - 2 added to [WarehouseService.test.ts](backend/src/__tests__/services/WarehouseService.test.ts) assert both login paths return a valid `open-tms-auth` JWT whose payload includes the right sub, organizationId, and roles.

### What's left (Phase 8+)
- **Admin role check on `/warehouse/auth/magic-link/generate`** — left allow-listed (unauthed) in this round for back-compat. Should require an admin-role JWT before the next deploy.
- **`prisma.shipment` direct queries in workers / handlers / projections** — operate inside event-scoped context where orgId is already known, so the cross-tenant risk is lower; still worth a sweep for consistency.
- **`EdiTransactionLog.orgId` tightening** — once a Phase 2.5 backfill exists for the manual-import rows.
- **Live-DB integration tests** — the cross-tenant unit suites lock the WHERE-clause shape. A small `pg-mem` or Docker-postgres suite would catch any Prisma behaviour drift.
- **`SystemLocoAdapter` multi-tenant routing** — accept an org hint from the webhook config rather than falling back to the first Organization.
- **Migrate `AuthService.generateToken` to use the shared `signInternalJWT`** — would dedupe the HMAC plumbing; safe but cosmetic.
- **Shared logistics catalogue** (future product feature) — if we want some Locations or Lanes to be cross-tenant reference data, add an `isShared` flag and update the repo to OR (`{ orgId: requestingOrg } OR { isShared: true }`) on reads.
