---
paths:
  - "backend/src/services/{Charge,Rating,LtlRating,Invoicing,FreightAudit,ConsolidationBilling,CreditCheck}*.ts"
  - "backend/src/commands/{charges,quotes,invoices,carrierInvoices,queries}/**"
  - "backend/src/repositories/{Quote,Invoice,CarrierInvoice,FinancialQuery}Repository.ts"
  - "backend/src/routes/{charges,quotes,invoices,carrierInvoices,financialQueries,financialReports}.ts"
  - "backend/src/events/handlers/{TenderAwardFinancial,BillingTrigger,FinancialImpact}Handler.ts"
  - "backend/src/events/projections/InvoiceProjection.ts"
---

# Financial Operations — Rules

Architecture, models, LTL rating and file map: `docs/FINANCIAL_OPERATIONS.md`

## Money is always integer cents

All monetary values are stored as **integer cents** (`amountCents`, `totalPriceCents`,
`priceCents`) to avoid floating-point rounding errors. Never introduce a float or decimal money
field, and never do money arithmetic in floats before converting.

## Charge lifecycle

`Charge` is the revenue or cost line item on a shipment/order.

- Categories: `revenue` (customer pays us) and `cost` (we pay carrier)
- Lifecycle: `pending` → `approved` → `invoiced`
- `ShipmentFinancialSummary` is a denormalized per-shipment snapshot and is
  **auto-recalculated on every charge mutation** — go through `ChargeService`, don't mutate charges
  and leave the summary stale.

## Invoice consolidation

Customer billing supports three consolidation modes, set per customer:

| Mode | Behaviour |
|---|---|
| `per_shipment` | One invoice per delivered shipment (default) |
| `weekly` | Batches all ready-to-invoice shipments every Monday (pg-boss cron) |
| `monthly` | Batches all ready-to-invoice shipments on the 1st of each month (pg-boss cron) |

Manual trigger: `POST /api/v1/invoices/consolidate`
