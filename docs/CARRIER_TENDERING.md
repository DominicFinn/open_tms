# Carrier Tendering & Carrier Portal

> Conventions and DO/DON'T rules for this area live in `.claude/rules/domains/tendering.md`.
> This document is the architecture reference.

## Architecture

The tendering system supports **broadcast** (all carriers simultaneously) and **waterfall**
(sequential, auto-progress on timeout/decline) strategies.

## Key Models

- **Tender** - Linked to a Shipment. Has strategy, status lifecycle (draft → open → evaluating →
  awarded), configurable duration, target rate.
- **TenderOffer** - One per carrier in a tender. Tracks sent/viewed/expired status and waterfall
  sequence.
- **TenderBid** - Carrier's rate submission. Can come from the web portal (`sourceType: "portal"`)
  or EDI 990 (`sourceType: "edi_990"`).
- **CarrierUser** - Separate auth model for carrier portal login (not the internal User model).

## Carrier Portal

- Separate app at `/carrier-portal/` with its own layout and JWT auth (`iss: "open-tms-carrier"`)
- Pages: login, dashboard, tender view with bid form, tender history with win/loss tracking, bid
  history, profile with password change
- Auth middleware: `authenticateCarrierJWT` in `backend/src/middleware/jwtAuth.ts`
- Org scope: `attachOrgScopeFromCarrierUserHook` walks `carrierUser.carrierId → Carrier.orgId`

## Carrier User Management

- Admin manages carrier portal users on the carrier edit page (`CarrierUserManagement` component)
- Password strength validation: 8+ chars, uppercase, lowercase, number
- Account lockout: 5 failed attempts → 15 minute lockout
- Admin password reset available (no old password required)
- Archiving a Carrier deactivates its portal users; unarchiving reactivates them (see
  `ARCHIVAL_POLICY.md`)

## EDI Integration

Opening a tender triggers outbound EDI 204 (Motor Carrier Load Tender) via
`OutboundEdiDeliveryService`. Carrier responses arrive as inbound EDI 990 and are recorded as
`TenderBid` rows with `sourceType: "edi_990"`. See `EDI_HUB.md`.

## Key Files

- `backend/src/services/TenderService.ts` - core lifecycle: create, open, bid, award, cancel,
  waterfall progression
- `backend/src/services/CarrierAuthService.ts` - carrier JWT auth with lockout
- `backend/src/routes/tenders.ts` - admin tender CRUD and lifecycle actions
- `backend/src/routes/carrierPortal.ts` - carrier-facing: login, tenders, bids, history, profile
- `backend/src/routes/carrierUsers.ts` - admin carrier user management
- `frontend/src/pages/Tenders.tsx` - tender list with carrier/status filters
- `frontend/src/pages/TenderDetail.tsx` - bid comparison and award workflow
- `frontend/src/pages/CreateTender.tsx` - 5-step tender creation wizard
- `frontend/src/pages/carrier-portal/` - all carrier portal pages
- `frontend/src/carrier-portal-layout.tsx` - carrier portal layout
