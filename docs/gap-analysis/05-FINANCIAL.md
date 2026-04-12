# Financial Operations (AR / AP / Audit)

## What's Built

This is one of Open TMS's strongest areas.

### Charges & Rating
- Charge model (revenue + cost, linked to order or shipment)
- Charge types: linehaul, fuel_surcharge, accessorial, discount, adjustment, claim_deduction
- Charge lifecycle: pending, approved, invoiced, disputed, written_off
- Charge source tracking: manual, contract_rate, quote, tender_bid, carrier_invoice, adjustment
- ShipmentFinancialSummary (expected vs actual revenue/cost/margin, billing + payment status)
- Auto-recalculation on every charge mutation
- RatingService for lane-carrier rate lookup with fuel surcharge
- LtlRatingService (class-based, weight breaks, deficit weight, FAK, minimum charge, accessorials)
- Re-weigh / re-class adjustment workflow

### Quotes
- Quote with revision tracking and version chain
- QuoteLineItem with chargeType, freight class, weight, ratePerCwt, accessorial code
- Quote acceptance auto-creates Order with approved revenue charges
- Quote expiration cron (pg-boss, every 30 min)
- Quote revision workflow (supersede + new version)

### Customer Invoicing (AR)
- Invoice model with full lifecycle (draft, approved, sent, partial_paid, paid, overdue, void, disputed)
- InvoiceLineItem linked to charges, shipments, orders
- Auto-invoice on shipment delivery (per customer toggle)
- Invoice consolidation: per_shipment, weekly (Monday), monthly (1st)
- Invoice overdue detection cron (hourly, 7-day reminder)
- Full/partial payment with auto-status transitions
- Void invoice (reverts charges to approved)
- EDI 810 outbound invoice generation
- EDI 820 inbound payment/remittance parsing
- InvoiceReadModel projection

### Carrier Invoices (AP) & Freight Audit
- CarrierInvoice model (received, matched, approved, scheduled, paid, disputed)
- Three-way match: tender rate vs expected charges vs carrier invoice
- Per-line match results (matched/variance/unmatched)
- Auto-approve if no unmatched lines and variance <= 2%
- EDI 210 inbound parsing with auto three-way match
- Carrier payment batch scheduling (group by carrier, schedule future dates, daily auto-execute)
- CarrierInvoice discrepancy event emission

### Financial Queries & Credit Notes
- FinancialQuery model (customer_dispute or carrier_dispute)
- Reason codes: overcharge, service_failure, missing_pod, wrong_rate, damage_claim, missing_items, temperature_excursion
- Auto-created from cargo events (missing_at_stop, misdrop, cold chain quarantine)
- CreditNote model (credit or debit, linked to invoice/customer/carrier)
- ResolveQuery with optional auto-generated credit note

### Reporting
- AR aging report (JSON + CSV, buckets by customer)
- Carrier spend summary (total invoiced/approved/paid per carrier)
- Margin analysis by customer
- CSV exports: invoice register, carrier invoice register, payment ledger, charge detail

## What's Missing

| Feature | Commercial Standard | Impact |
|---------|-------------------|--------|
| **Duplicate billing detection** | Flag when carrier submits an invoice that matches a previous one (same PRO#, amount, date range) | Medium - prevents overpayment |
| **Customer credit limit enforcement** | Block invoicing or order acceptance when customer exceeds credit limit | Medium - financial controls |
| **GL code / cost center allocation** | Map charges to accounting GL codes for ERP export | High - accounting integration |
| **Accrual management** | Record expected costs at tender award, reverse on actual invoice receipt | Medium - financial accuracy |
| **Customer invoice portal** | Customer logs in, views invoices, downloads, initiates disputes online | High - part of customer portal gap |
| **Multi-currency invoicing** | Issue invoices and record payments in customer's currency | High - blocks international |
| **Detention/demurrage billing** | Auto-calculate detention charges based on dwell time vs free time | Medium - common accessorial |
