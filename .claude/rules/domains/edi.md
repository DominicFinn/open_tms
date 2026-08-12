---
paths:
  - "backend/src/services/edi/**"
  - "backend/src/services/{EDI,Edi,X12}*.ts"
  - "backend/src/routes/{edi,tradingPartners}*.ts"
  - "backend/src/repositories/TradingPartnerRepository.ts"
  - "edi-collector/**"
  - "frontend/src/vnext-design/VNext{Edi,TradingPartner}*.tsx"
---

# EDI Communication Hub — Rules

Architecture, models, transaction types and file map: `docs/EDI_HUB.md`

## Use the shared X12 infrastructure

Never hand-roll envelope handling. `backend/src/services/edi/` provides:

- `X12EnvelopeBuilder` — builds ISA/GS/ST/SE/GE/IEA envelopes with fixed-width ISA fields, GS
  functional identifiers, and accurate SE segment counts
- `X12EnvelopeParser` — parses raw X12 with ISA separator detection, envelope validation, and body
  segment extraction
- `EdiOperationResult<T>` — standard result type for all EDI operations
- `TRANSACTION_TO_GS` / `GS_TO_TRANSACTION` — bidirectional transaction-type ↔ GS mapping

All generators expose `validateAndGenerate()`, which validates required fields before building.

## Adding a New EDI Transaction Type

1. Write a parser service (inbound) or generator service (outbound) in `backend/src/services/`
2. Use `X12EnvelopeBuilder` / `X12EnvelopeParser` from `backend/src/services/edi/`
3. Add the transaction type to the route map in `EdiRouterService.ts`
4. Register the service in DI (`tokens.ts` + `registry.ts`)
5. Add a backend endpoint for processing, or use the universal inbound endpoint
6. **All inbound routes must log to `EdiTransactionLog`** via `TradingPartnerRepository`
7. Trading partners can then add the type to their config via the UI

## Unified partner model

Use `TradingPartner` for all new EDI work. The legacy `EdiPartner` and `OutboundIntegration` models
still exist and the migration copies their data across, but they are deprecated — as is the
edi-collector's legacy `collectFromPartner()` function. Old UI pages are preserved as "(Legacy)" in
the integrations nav.

## Org scoping

EDI routes serve a mix of authed admins and unauthed webhook ingest. Register
`await registerOrgScopeForEdi(server)` at the top of the plugin — see the multi-tenancy rule.
