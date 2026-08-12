---
paths:
  - "backend/src/services/{Tender,CarrierAuth}Service.ts"
  - "backend/src/commands/{tenders,carrierUsers}/**"
  - "backend/src/routes/{tenders,carrierPortal,carrierUsers}.ts"
  - "frontend/src/pages/{Tenders,TenderDetail,CreateTender}.tsx"
  - "frontend/src/pages/carrier-portal/**"
  - "frontend/src/carrier-portal-layout.tsx"
---

# Carrier Tendering & Carrier Portal — Rules

Architecture, models, lifecycle and file map: `docs/CARRIER_TENDERING.md`

## Two strategies, one lifecycle

Tenders support **broadcast** (all carriers simultaneously) and **waterfall** (sequential,
auto-progress on timeout/decline). Lifecycle: `draft` → `open` → `evaluating` → `awarded`.

Bids arrive from two sources and both must be handled: the web portal (`sourceType: "portal"`) and
EDI 990 (`sourceType: "edi_990"`). Don't write portal-only logic in the bid path.

Opening a tender triggers outbound EDI 204 via `OutboundEdiDeliveryService`.

## Carrier auth is a separate identity system

`CarrierUser` is **not** the internal `User` model. The carrier portal is a separate app at
`/carrier-portal/` with its own layout and JWT (`iss: "open-tms-carrier"`), authenticated by
`authenticateCarrierJWT` in `backend/src/middleware/jwtAuth.ts`.

- Org scope comes from `attachOrgScopeFromCarrierUserHook` — see the multi-tenancy rule
- Password strength: 8+ chars, uppercase, lowercase, number
- Account lockout: 5 failed attempts → 15 minute lockout
- Admin password reset requires no old password
- Archiving a Carrier deactivates its portal users; unarchiving reactivates them
