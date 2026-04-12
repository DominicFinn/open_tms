# Carrier Management & Procurement

## What Open TMS Has (Built)

- Carrier CRUD with full model (name, MC#, DOT#, SCAC, contact, address)
- Validation tier tracking (tier1/tier2/tier3)
- Compliance checklist (registration, insurance received/verified, identity, compliance) with notes and attribution
- Payment terms (Net 30/45/etc), remit-to address, currency
- Lane-carrier assignments with pricing (cents)
- Contract rate fields (rateType, contract dates, fuel surcharge %, accessorial rates)
- Carrier portal with separate JWT auth
- Carrier user management (admin creates users, activate/deactivate, password reset)
- Account lockout after 5 failed login attempts
- CarrierReadModel with vehicle/driver/lane counts
- Carrier spend reports (total invoiced/approved/paid)

## What's Partially Built

- **Carrier compliance tracking**: Basic checklist exists but no automated insurance expiry monitoring, no FMCSA integration, no automatic tender blocking on expired insurance

## What's Planned (On Roadmap)

| Feature | Roadmap Phase | Notes |
|---------|--------------|-------|
| Carrier performance monitoring (on-time %, tender acceptance, damage rate) | Phase 8c | Nothing built yet |
| Carrier risk scoring (FMCSA, insurance monitoring, safety rating) | Phase 8c | Nothing built yet |
| Carrier onboarding workflow (self-registration, doc collection, approval) | Phase 8c | Nothing built yet |
| Carrier reporting (spend analysis, capacity, rate benchmarking) | Phase 8c | Spend summary exists, rest not built |

## What's Missing (Not on Roadmap)

| Feature | Commercial Standard | Impact |
|---------|-------------------|--------|
| **Annual RFP/bid management** | Run carrier procurement events, collect rates by lane, compare and award | High - core procurement function |
| **Digital freight marketplace / spot bid board** | Post loads to a marketplace for carrier bidding beyond known carriers | Medium - extends carrier reach |
| **Do-not-use list** | Block specific carriers from being tendered with reason tracking | Medium - compliance/risk |
| **Carrier contract repository** | Version-controlled contract documents with effective dates and terms | Medium - audit trail |
| **Insurance certificate expiry alerts** | Automated monitoring with email alerts N days before expiry | High - risk management |
| **Carrier communication hub** | Unified inbox for carrier messages across email, EDI, portal | Low - nice to have |
| **FMCSA SAFER API integration** | Auto-validate MC/DOT on carrier creation, pull safety ratings | High - fraud prevention |
