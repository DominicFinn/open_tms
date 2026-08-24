---
paths:
  - "backend/src/**/*.ts"
---

# Multi-tenancy (`orgId` + `req.orgId`)

- Every tenant-scoped Prisma model carries `orgId String` (NOT NULL) — see `Customer`, `Carrier`,
  `Order`, `Shipment`, `Location`, `Lane`, `Driver`, `Vehicle`, `Device`, etc. New entities that
  hold tenant data MUST have one.
- Route plugins register the org-scope hook at the top:
  ```ts
  import { registerOrgScope } from '../auth/orgScopeMiddleware.js';
  await registerOrgScope(server);
  ```
  After this, every handler in the plugin can read `req.orgId!` and rely on it being populated
  (from JWT in production, default Organization in dev/seed).
- Handlers MUST pass `req.orgId!` into every repo read (`findById(id, req.orgId)`, `all(req.orgId)`,
  etc.) and onto `commandBus.dispatch({ orgId: req.orgId!, ... })`. Cross-tenant ID guesses return
  404, not 403, so existence stays opaque.
- For routes that must fail closed if no tenant context exists (rare — usually only worth it on
  highly-sensitive endpoints), chain `requireOrgScope` after `attachOrgScopeHook`. Use sparingly
  because the soft fallback covers dev/seed flows.
- **NEVER call `prisma.organization.findFirst()` inline in a route** — it silently picks org-1 for
  everyone when multiple Organizations exist. Use the helper instead.
- The shared `resolveOrgId`/`resolveActorId` functions in `backend/src/auth/orgScope.ts` are now
  mostly internal; new routes should consume `req.orgId` via the middleware.

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
