# Financial Operations

> Conventions and DO/DON'T rules for this area live in `.claude/rules/domains/financials.md`.
> This document is the architecture reference.

## Overview

The financial layer covers the full money lifecycle: rating shipments, quoting customers, invoicing
(AR), receiving carrier invoices (AP), freight audit, financial queries/disputes, credit notes, and
LTL-specific billing. All monetary values are stored as **integer cents** (`amountCents`,
`totalPriceCents`, `priceCents`) to avoid floating-point rounding errors.

## Key Models

- **Charge** - Revenue or cost line item on a shipment/order. Categories: `revenue` (customer pays
  us) and `cost` (we pay carrier). Types: linehaul, fuel_surcharge, accessorial, adjustment, etc.
  Lifecycle: pending → approved → invoiced.
- **ShipmentFinancialSummary** - Denormalized per-shipment snapshot of expected/actual revenue,
  cost, margin, billing status, and carrier payment status. Auto-recalculated on every charge
  mutation.
- **Quote / QuoteLineItem** - Customer price quote with revision tracking. Acceptance auto-creates
  an Order with approved revenue charges.
- **Invoice / InvoiceLineItem / Payment** - Customer-facing AR invoice. Supports full/partial
  payment, void, overdue detection, and consolidation.
- **CarrierInvoice / CarrierInvoiceLineItem** - Carrier AP invoice with automatic three-way freight
  audit match.
- **FinancialQuery** - Dispute/claim record. Can be auto-created from cargo events or raised
  manually.
- **CreditNote** - Generated when a query is resolved with a financial adjustment.

## Invoice Consolidation Modes

Customer billing supports three consolidation modes (set per customer):

1. **per_shipment** - One invoice per delivered shipment (default)
2. **weekly** - Batches all ready-to-invoice shipments every Monday (pg-boss cron)
3. **monthly** - Batches all ready-to-invoice shipments on the 1st of each month (pg-boss cron)

Manual consolidation trigger: `POST /api/v1/invoices/consolidate`

## LTL Rating

The `LtlRatingService` provides class-based LTL rating with:

- NMFC freight class lookup and density-based class calculation
- Weight break matrix pricing with deficit weight optimization
- FAK (Freight All Kinds) override support
- Minimum charge thresholds
- LTL accessorial codes: liftgate, residential, inside delivery, notification, limited access
- Re-weigh / re-class adjustment workflow (creates cost + revenue adjustment charges)
- Multi-order LTL consolidation billing (`ConsolidationBillingService`, pro-rate by weight)

## EDI Financial Transaction Types

| Code | Name | Direction | Service |
|------|------|-----------|---------|
| 210 | Freight Invoice | Inbound | `EDI210ParseService` - parses carrier invoice, triggers three-way match |
| 810 | Invoice | Outbound | `EDI810Service` - generates customer invoice in X12 format |
| 820 | Payment Order/Remittance | Inbound | `EDI820ParseService` - parses customer payment, applies to invoices |

## Key Files

### Services
- `backend/src/services/ChargeService.ts` - Charge CRUD, financial summary recalculation
- `backend/src/services/RatingService.ts` - Lane-carrier rate lookup, fuel surcharge calculation
- `backend/src/services/LtlRatingService.ts` - LTL class-based rating, weight breaks, deficit weight
- `backend/src/services/InvoicingService.ts` - Invoice generation, ready-to-invoice queries
- `backend/src/services/FreightAuditService.ts` - Three-way match: tender rate vs expected charges vs
  carrier invoice
- `backend/src/services/ConsolidationBillingService.ts` - Multi-order LTL consolidation, pro-rate by
  weight

### Repositories
- `backend/src/repositories/QuoteRepository.ts` - Quote CRUD with revision tracking
- `backend/src/repositories/InvoiceRepository.ts` - Invoice + payment repository
- `backend/src/repositories/CarrierInvoiceRepository.ts`
- `backend/src/repositories/FinancialQueryRepository.ts` - Financial query + credit note repository

### Commands
- `backend/src/commands/charges/` - CreateCharge, ApproveCharge, ReweighAdjustment
- `backend/src/commands/quotes/` - CreateQuote, AcceptQuote, DeclineQuote, ReviseQuote
- `backend/src/commands/invoices/` - CreateInvoice, ApproveInvoice, SendInvoice, RecordPayment,
  VoidInvoice
- `backend/src/commands/carrierInvoices/` - ReceiveCarrierInvoice, ApproveCarrierInvoice,
  RecordCarrierPayment
- `backend/src/commands/queries/` - RaiseQuery, ResolveQuery

### Event handlers and projections
- `backend/src/events/handlers/TenderAwardFinancialHandler.ts` - auto-creates cost charge on tender
  award
- `backend/src/events/handlers/BillingTriggerHandler.ts` - shipment delivered → ready to invoice,
  auto-draft
- `backend/src/events/handlers/FinancialImpactHandler.ts` - cargo/cold-chain events → auto-raise
  financial queries
- `backend/src/events/projections/InvoiceProjection.ts` - InvoiceReadModel maintenance

### Routes
- `backend/src/routes/charges.ts` - Charge REST API
- `backend/src/routes/quotes.ts` - Quote REST API + LTL rate endpoints
- `backend/src/routes/invoices.ts` - Invoice REST API (AR)
- `backend/src/routes/carrierInvoices.ts` - Carrier invoice REST API (AP)
- `backend/src/routes/financialQueries.ts` - Financial queries + credit notes API
- `backend/src/routes/financialReports.ts` - AR aging, carrier spend, margin analysis, CSV exports
- `backend/src/routes/edi820.ts` - EDI 820 inbound endpoint
