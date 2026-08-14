# EDI Communication Hub

> Conventions and DO/DON'T rules for this area live in `.claude/rules/domains/edi.md`.
> This document is the architecture reference. For the manual upload / SFTP collector / field
> mapping walkthrough, see `EDI_IMPORT_GUIDE.md`.

## Architecture

The EDI system uses a **unified Trading Partner model** (`TradingPartner`) for all EDI
communication. A single trading partner handles both inbound and outbound directions and multiple
EDI transaction types. All EDI activity is logged to `EdiTransactionLog` with a unified schema.

The system has **shared X12 infrastructure** (`backend/src/services/edi/`) providing envelope
building and parsing utilities used by all EDI services. A **universal inbound endpoint**
(`POST /api/v1/edi/inbound`) auto-detects transaction types, routes to handlers, logs everything,
and auto-generates 997 acknowledgments.

## Key Models

- **TradingPartner** - Represents any entity you exchange EDI with (customer, carrier, 3PL, ERP,
  etc.). Has SFTP + HTTP connection config, inbound polling config, and outbound delivery config.
- **TradingPartnerTransaction** - Registry of which EDI types a partner supports. Each entry has:
  `transactionType` (850, 204, 990, etc.), `direction` (inbound/outbound), `enabled`, `autoProcess`,
  `ack997Required`.
- **EdiTransactionLog** - Unified audit log for ALL inbound/outbound EDI files. Tracks parse
  results, created entities, 997 ack status, retry counts. `partnerId` is nullable for manual
  imports.

## Supported Transaction Types

| Code | Name | Direction | Service |
|------|------|-----------|---------|
| 180 | Return Merchandise Authorization | Both | `EDI180ParseService` / `EDI180Service` |
| 204 | Motor Carrier Load Tender | Outbound | `EDI204Service` |
| 210 | Freight Invoice | Inbound | `EDI210ParseService` |
| 214 | Shipment Status | Both | `EDI214ParseService` / `EDI214Service` |
| 810 | Invoice | Outbound | `EDI810Service` |
| 820 | Payment Order/Remittance | Inbound | `EDI820ParseService` |
| 850 | Purchase Order | Inbound | `EDI850ParseService` |
| 855 | PO Acknowledgment | Outbound | `EDI855Service` |
| 856 | Advance Ship Notice | Outbound | `EDI856Service` |
| 940 | Warehouse Shipping Order | Inbound | `EDI940ParseService` |
| 945 | Warehouse Shipping Advice | Outbound | `EDI945Service` |
| 990 | Response to Load Tender | Inbound | `EDI990ParseService` |
| 997 | Functional Acknowledgment | Both | `EDI997Service` |

### Inbound routing map

`EdiRouterService.TRANSACTION_ROUTES` maps a detected transaction type to its processing endpoint:

| Code | Endpoint | Effect |
|---|---|---|
| 850 | `/api/v1/orders/import/edi` | Create Orders |
| 990 | `/api/v1/edi/tender/990` | Process carrier accept/decline |
| 997 | `/api/v1/edi/997/inbound` | Track ack status |
| 214 | `/api/v1/edi/214/inbound` | Update tracking |
| 210 | `/api/v1/edi/210/inbound` | Create carrier invoice |
| 820 | `/api/v1/edi/820/inbound` | Record payments |
| 180 | `/api/v1/edi/180/inbound` | Create RMA |
| 940 | `/api/v1/edi/940/inbound` | Create order |

Outbound-only types (204, 810, 855, 856, 945) are not in the router; they are generated and
delivered via `OutboundEdiDeliveryService`.

## EDI Flow - How It Works

1. **Inbound (SFTP)**: The `edi-collector` service polls SFTP directories for each TradingPartner
   with `inboundEnabled=true`. It downloads files and POSTs them to the universal inbound endpoint
   (`POST /api/v1/edi/inbound`). The backend auto-detects the type, validates partner support,
   routes to the correct handler, logs to EdiTransactionLog, and auto-generates 997 acknowledgments
   if configured.
2. **Inbound (API)**: Any system can POST EDI content directly to `/api/v1/edi/inbound` or to
   type-specific endpoints (e.g. `/api/v1/edi/214/inbound`).
3. **Outbound**: The `OutboundEdiDeliveryService` writes EDI files to SFTP or POSTs via HTTP. Called
   automatically when tenders are opened (EDI 204) and extensible for other outbound types.
4. **All routes log to EdiTransactionLog** - 990 inbound, 210 inbound, 820 inbound, 810 generate,
   214 inbound/outbound.

## Shared X12 Infrastructure

- `X12EnvelopeBuilder` - Builds ISA/GS/ST/SE/GE/IEA envelopes with fixed-width ISA fields, GS
  functional identifiers, and accurate SE segment counts
- `X12EnvelopeParser` - Parses raw X12 with ISA separator detection, envelope validation, and body
  segment extraction
- `EdiOperationResult<T>` - Standard result type for all EDI operations (success, data, errors,
  warnings)
- `TRANSACTION_TO_GS` / `GS_TO_TRANSACTION` - Bidirectional mapping between transaction types and GS
  functional identifiers
- All generators have `validateAndGenerate()` methods that validate required fields before building

## Adding a New EDI Transaction Type

1. Write a parser service (for inbound) or generator service (for outbound) in
   `backend/src/services/`
2. Use `X12EnvelopeBuilder` / `X12EnvelopeParser` from `backend/src/services/edi/`
3. Add the transaction type to the route map in `EdiRouterService.ts`
4. Register the service in DI (`tokens.ts` + `registry.ts`)
5. Add a backend endpoint for processing, or use the universal inbound endpoint
6. All inbound routes should log to `EdiTransactionLog` via `TradingPartnerRepository`
7. Trading partners can then add the type to their config via the UI

## Legacy Compatibility

The old `EdiPartner` and `OutboundIntegration` models still exist. The migration copies their data
into TradingPartner. The edi-collector's legacy `collectFromPartner()` function is preserved but
deprecated. Old UI pages are preserved as "(Legacy)" in the integrations nav.

## Key Files

### Shared infrastructure
- `backend/src/services/edi/X12EnvelopeBuilder.ts`
- `backend/src/services/edi/X12EnvelopeParser.ts`
- `backend/src/services/edi/types.ts` - EdiOperationResult, X12EnvelopeConfig, etc.
- `backend/src/services/EdiRouterService.ts` - transaction type detection and routing
- `backend/src/services/OutboundEdiDeliveryService.ts` - SFTP/HTTP delivery engine
- `backend/src/repositories/TradingPartnerRepository.ts` - CRUD + log methods
  (findLogsWithPagination, getLogStats)

### Per-transaction services
- `backend/src/services/EDI180ParseService.ts` / `EDI180Service.ts` - RMA
- `backend/src/services/EDI204Service.ts` - Motor Carrier Load Tender
- `backend/src/services/EDI210ParseService.ts` - Freight Invoice
- `backend/src/services/EDI214ParseService.ts` / `EDI214Service.ts` - Shipment Status
- `backend/src/services/edi214StatusMapping.ts` - AT7 status code to internal status mapping
- `backend/src/services/EDI810Service.ts` - Invoice
- `backend/src/services/EDI820ParseService.ts` - Payment/Remittance
- `backend/src/services/EDI850ParseService.ts` - Purchase Order
- `backend/src/services/EDI855Service.ts` - PO Acknowledgment
- `backend/src/services/EDI856Service.ts` - Advance Ship Notice
- `backend/src/services/EDI940ParseService.ts` - Warehouse Shipping Order
- `backend/src/services/EDI945Service.ts` - Warehouse Shipping Advice
- `backend/src/services/EDI990ParseService.ts` - Response to Load Tender
- `backend/src/services/EDI997Service.ts` - Functional Acknowledgment

### Routes
- `backend/src/routes/ediInbound.ts` - universal inbound endpoint (auto-detect, route, log, 997)
- `backend/src/routes/tradingPartners.ts` - partner management + unified EDI log endpoints
- `backend/src/routes/ediTender.ts` - EDI 204 preview and 990 inbound
- `backend/src/routes/edi180.ts`, `edi210.ts`, `edi214.ts`, `edi820.ts`, `edi940.ts`, `edi997.ts`
- `backend/src/routes/ediImport.ts`

### Collector and frontend
- `edi-collector/src/collector.ts` - SFTP polling, sends to universal inbound endpoint
- `frontend/src/vnext-design/VNextEdiDashboard.tsx` - EDI health dashboard
- `frontend/src/vnext-design/VNextTradingPartners.tsx` - partner management
- `frontend/src/vnext-design/VNextEdiTransactionLog.tsx` - unified transaction log viewer

### Tests
- `backend/src/__tests__/services/X12EnvelopeBuilder.test.ts` - 19 builder tests
- `backend/src/__tests__/services/X12EnvelopeParser.test.ts` - 21 parser tests
