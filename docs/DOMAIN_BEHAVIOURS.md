# Domain Behaviours — Open TMS

Every write operation in Open TMS flows through a **domain command**. Commands execute inside a database transaction, emit domain events, and those events trigger side effects (read model updates, notifications, audit logs, integrations).

This document is the authoritative reference for what happens when state changes.

---

## How It Works

```
API Request → Validate (Zod) → Dispatch Command → Execute in Transaction
                                                        ↓
                                                   Emit Events
                                                        ↓
                                                 Commit Transaction
                                                        ↓
                                              Publish to Event Bus
                                                        ↓
                                    ┌──────────┬──────────┬──────────┐
                                    ↓          ↓          ↓          ↓
                               Projection  AuditLog   Email    Notification
                              (read model) (immutable) (SMTP)   (in-app)
```

Every event is persisted to the immutable `DomainEventLog` before handler fan-out. Events can be replayed, exported for data warehouses, or consumed by ML pipelines.

---

## Orders

### Commands (CQRS)

| Command | Trigger | Events Emitted |
|---------|---------|----------------|
| `CreateOrderCommand` | `POST /api/v1/orders` | `order.created` |
| `UpdateOrderCommand` | `PUT /api/v1/orders/:id` | `order.updated`, `order.status_changed` (if status changes) |
| `ArchiveOrderCommand` | `DELETE /api/v1/orders/:id` | `order.archived` |

### Sub-Entity Operations (Repository)

These operate on order sub-entities (line items, trackable units). They currently use repositories directly — events are not yet emitted for these granular mutations.

| Operation | Trigger | What It Does |
|-----------|---------|-------------|
| Add line item | `POST /api/v1/orders/:id/line-items` | Creates OrderLineItem on order |
| Remove line item | `DELETE /api/v1/orders/:orderId/line-items/:itemId` | Deletes OrderLineItem |
| Add trackable unit | `POST /api/v1/orders/:id/trackable-units` | Creates TrackableUnit with line items, assigns sequence number |
| Update trackable unit | `PUT /api/v1/orders/:orderId/trackable-units/:unitId` | Updates identifier, notes, barcode |
| Remove trackable unit | `DELETE /api/v1/orders/:orderId/trackable-units/:unitId` | Cascade deletes unit + line items |
| Add line item to unit | `POST /api/v1/orders/:orderId/trackable-units/:unitId/line-items` | Creates OrderLineItem linked to unit |
| Move line item | `PUT /api/v1/orders/:orderId/line-items/:itemId/move` | Reassigns line item to different trackable unit |
| Generate barcode | `POST /api/v1/orders/:orderId/trackable-units/:unitId/generate-barcode` | Sets barcode = `TU-{unitId}-{timestamp}` |
| Merge units | `POST /api/v1/orders/:orderId/trackable-units/merge` | Moves all line items from source to target unit, deletes source |
| Split unit | `POST /api/v1/orders/:orderId/trackable-units/:unitId/split` | Creates new unit, moves specified line items to it |
| Validate location | `POST /api/v1/orders/:id/validate-location` | Creates Location if needed, sets originId/destinationId |

### Service Operations (Domain Services)

These call domain services with complex orchestration logic. They currently create AuditLog records but do not yet publish domain events through the event bus.

| Operation | Trigger | Service | What It Does |
|-----------|---------|---------|-------------|
| Assign to shipment | `POST /api/v1/orders/:id/assign-to-shipment` | ShipmentAssignmentService | Matches lane, creates/reuses shipment, creates stop, updates order status |
| Update delivery status | `POST /api/v1/orders/:id/delivery-status` | OrderDeliveryService | Updates deliveryStatus, creates audit log |
| Mark delivered | `POST /api/v1/orders/:id/mark-delivered` | OrderDeliveryService | Sets deliveryStatus=delivered, deliveredAt=now |
| Create exception | `POST /api/v1/orders/:id/delivery-exception` | OrderDeliveryService | Sets deliveryStatus=exception, records type/notes |
| Resolve exception | `POST /api/v1/orders/:id/resolve-exception` | OrderDeliveryService | Sets deliveryStatus=in_transit, records resolution |
| Update orders for stop | `POST /api/v1/shipment-stops/:id/update-orders` | OrderDeliveryService | Bulk updates all orders at a shipment stop |
| Geofence check | `POST /api/v1/shipments/:id/geofence-check` | OrderDeliveryService | Calculates distance to stops, auto-updates if within radius |
| Convert to shipment | `POST /api/v1/orders/:id/convert-to-shipment` | OrdersRepository | Creates shipment + stop + junction, updates order status (uses transaction) |
| Batch convert | `POST /api/v1/orders/batch-convert` | OrderConversionService | Individual or combined mode, compatibility checks |
| Split to shipments | `POST /api/v1/orders/:id/split-to-shipments` | OrderConversionService | Splits order items into multiple shipments |
| Check compatibility | `POST /api/v1/orders/check-compatibility` | OrderConversionService | Validates orders can be combined (read-only) |
| CSV import | `POST /api/v1/orders/import/csv` | CSVImportService | Bulk creates orders from CSV content |

### Side Effects

| Event | Projection | Notification | Other |
|-------|-----------|--------------|-------|
| `order.created` | OrderReadModel inserted (denormalized customer, origin, destination, counts) | — | CustomerReadModel.totalOrderCount incremented |
| `order.updated` | OrderReadModel fields updated | — | — |
| `order.status_changed` | OrderReadModel.status updated | In-app notification | — |
| `order.delivery_status_changed` | OrderReadModel.deliveryStatus updated | In-app + email (if exception) | — |
| `order.assigned_to_shipment` | OrderReadModel.shipmentId/Reference set | — | — |
| `order.delivered` | OrderReadModel.deliveredAt set | In-app notification | — |
| `order.exception` | OrderReadModel.exceptionType set | In-app + email | — |
| `order.exception_resolved` | OrderReadModel.exceptionType cleared | — | — |
| `order.archived` | — | — | Audit log |

### Status Lifecycle

```
pending → validated → converted/assigned → cancelled/archived
                   ↘ location_error (raw location data, needs resolution)
```

### Delivery Status Lifecycle

```
unassigned → assigned → in_transit → delivered
                              ↘ exception → (resolved) → in_transit
```

---

## Shipments

### Commands

| Command | Trigger | Events Emitted |
|---------|---------|----------------|
| `CreateShipmentCommand` | `POST /api/v1/shipments` | `shipment.created` |
| `UpdateShipmentCommand` | `PUT /api/v1/shipments/:id` | `shipment.updated`, `shipment.status_changed`, `shipment.carrier_assigned` |
| `ArchiveShipmentCommand` | `DELETE /api/v1/shipments/:id` | `shipment.archived` |
| `ProcessInbound214Command` | `POST /api/v1/edi/214/inbound` | `edi_214.received`, `shipment.status_changed`, `shipment.stop_arrived`, `shipment.stop_completed`, `shipment.exception`, `shipment.delivered` |

### Side Effects

| Event | Projection | Notification | Integration |
|-------|-----------|--------------|-------------|
| `shipment.created` | ShipmentReadModel inserted | — | Outbound carrier queue (EDI 856), outbound tracking queue |
| `shipment.status_changed` | ShipmentReadModel.status updated | In-app + email | — |
| `shipment.carrier_assigned` | ShipmentReadModel.carrierName updated | — | — |
| `shipment.delivered` | ShipmentReadModel.status = 'delivered' | In-app + email | — |
| `shipment.exception` | — | In-app + email | — |
| `shipment.stop_arrived` | ShipmentReadModel.stopCount updated | In-app | Orders at stop → delivery_status_changed |
| `shipment.stop_completed` | ShipmentReadModel.stopCount updated | In-app | Orders at stop → delivered |
| `edi_214.received` | — | — | Auto-forward outbound 214 to customer trading partners |
| `edi_214.sent` | — | — | — |

### Tracking (IoT)

| Event | Source | Side Effects |
|-------|--------|-------------|
| `tracking.location_received` | Inbound webhook worker | ShipmentReadModel.currentLat/Lng updated, geofence check |
| `tracking.geofence_entered` | Geofence calculation | ShipmentStop marked arrived, orders updated |
| `tracking.eta_updated` | ETA recalculation | — |

---

## Carriers

### Commands

| Command | Trigger | Events Emitted |
|---------|---------|----------------|
| `CreateCarrierCommand` | `POST /api/v1/carriers` | `carrier.created` |
| `UpdateCarrierCommand` | `PUT /api/v1/carriers/:id` | `carrier.updated` |
| `ArchiveCarrierCommand` | `DELETE /api/v1/carriers/:id` | `carrier.archived` |

### Side Effects

| Event | Projection |
|-------|-----------|
| `carrier.created` | CarrierReadModel inserted (vehicle/driver/lane counts) |
| `carrier.updated` | CarrierReadModel fields updated |
| `carrier.archived` | CarrierReadModel.status = 'archived' |

---

## Customers

### Commands

| Command | Trigger | Events Emitted |
|---------|---------|----------------|
| `CreateCustomerCommand` | `POST /api/v1/customers` | `customer.created` |
| `UpdateCustomerCommand` | `PUT /api/v1/customers/:id` | `customer.updated` |
| `ArchiveCustomerCommand` | `DELETE /api/v1/customers/:id` | `customer.archived` |

### Side Effects

| Event | Projection |
|-------|-----------|
| `customer.created` | CustomerReadModel inserted |
| `customer.updated` | CustomerReadModel fields updated |
| `customer.archived` | CustomerReadModel deleted |
| `order.created` | CustomerReadModel.activeOrderCount + totalOrderCount incremented |

---

## Locations

### Location Metadata

Locations can be classified by type (`warehouse`, `distribution_centre`, `cross_dock`, `terminal`, `port`, `rail_yard`, `customer`, `store`, `manufacturing`) and enriched with facility capabilities, operating details, and contact information. This metadata supports hub-and-spoke routing, cross-dock planning, and appointment scheduling.

**Facility Capabilities** (JSON): `crossDockCapable`, `hasColdStorage`, `hasHazmatCert`, `hasBondedStorage`

**Operating Details**: `appointmentRequired`, `dockCount`, `maxTrailerLengthFt`, `operatingHours` (per-day open/close schedule)

**Contact**: `contactName`, `contactPhone`, `contactEmail`

### Commands

| Command | Trigger | Events Emitted | Side Effects |
|---------|---------|----------------|-------------|
| `CreateLocationCommand` | `POST /api/v1/locations` | `location.created` | Event payload includes `locationType` |
| `UpdateLocationCommand` | `PUT /api/v1/locations/:id` | `location.updated` | Event payload includes changed field names |
| `CreateShipmentCommand` (resolution) | Shipment with `originData`/`destinationData` | `location.created` | `source: 'shipment_resolution'` in payload |
| `LocationResolutionService` | Order creation, EDI import | `location.created` | `source: 'resolution'` in payload |

---

## Lanes

### Commands

| Command | Trigger | Events Emitted |
|---------|---------|----------------|
| `CreateLaneCommand` | `POST /api/v1/lanes` | `lane.created` |
| `UpdateLaneCommand` | `PUT /api/v1/lanes/:id` | `lane.updated` |
| `ArchiveLaneCommand` | `DELETE /api/v1/lanes/:id` | `lane.archived` |

### Side Effects

| Event | Projection |
|-------|-----------|
| `lane.created` | LaneReadModel inserted (origin/destination names, carrier count) |
| `lane.updated` | LaneReadModel fields updated |
| `lane.archived` | LaneReadModel.status = 'archived' |

---

## Issues / Triage

Issues track operational problems — exceptions, delays, damage, compliance failures. They can be created manually or auto-created from domain events.

### Commands

| Command | Trigger | Events Emitted |
|---------|---------|----------------|
| `CreateIssueCommand` | API or auto-triage handler | `issue.created` |
| `UpdateIssueCommand` | `PUT /api/v1/issues/:id` | `issue.updated`, `issue.status_changed`, `issue.assigned`, or `issue.resolved` |
| `EscalateIssueCommand` | Escalation action | `issue.escalated` |

UpdateIssueCommand also handles these lifecycle operations:

| Operation | Fields Set | Event Emitted |
|-----------|-----------|---------------|
| Snooze Issue | snoozedUntil, snoozedBy, snoozedReason | `issue.snoozed` |
| Unsnooze Issue | clears snoozedUntil, snoozedBy, snoozedReason | `issue.unsnoozed` |
| Close Issue | status=closed, closedAt, closedBy | `issue.closed` |
| Reopen Issue | status=open, clears closedAt | `issue.reopened` |
| Toggle NeedsCapa | sets needsCapa boolean | `issue.needs_capa_marked` |
| Add Label | creates IssueLabelAssignment | `issue.label_added` |
| Remove Label | deletes IssueLabelAssignment | `issue.label_removed` |

### Smart Event Selection

UpdateIssueCommand emits different events based on what changed:
- Status -> `resolved`: emits `issue.resolved`
- Status -> `closed`: emits `issue.closed`
- Status -> `open` (from closed): emits `issue.reopened`
- Status -> anything else: emits `issue.status_changed`
- Assignee changed: emits `issue.assigned`
- Snooze set: emits `issue.snoozed`
- Snooze cleared: emits `issue.unsnoozed`
- needsCapa toggled: emits `issue.needs_capa_marked`
- Label added: emits `issue.label_added`
- Label removed: emits `issue.label_removed`
- Other fields only: emits `issue.updated`

### Side Effects

| Event | Projection | Notification | Other |
|-------|-----------|--------------|-------|
| `issue.created` | IssueReadModel inserted | In-app (if high/critical priority) | -- |
| `issue.assigned` | IssueReadModel.assigneeName updated | In-app to assignee | -- |
| `issue.escalated` | IssueReadModel.escalatedTo set, priority -> critical | In-app + email to escalation target | -- |
| `issue.resolved` | IssueReadModel.resolvedAt set | In-app | -- |
| `issue.snoozed` | IssueReadModel.snoozedUntil set | In-app | Auto-wake on snoozedUntil expiry |
| `issue.unsnoozed` | IssueReadModel.snoozedUntil cleared | In-app | -- |
| `issue.closed` | IssueReadModel.closedAt, status=closed | In-app | IssueClosureReportHandler generates PDF |
| `issue.reopened` | IssueReadModel.closedAt cleared, status=open | In-app | -- |
| `issue.needs_capa_marked` | IssueReadModel.needsCapa updated | In-app | -- |
| `issue.label_added` | IssueReadModel label associations updated | -- | -- |
| `issue.label_removed` | IssueReadModel label associations updated | -- | -- |

### Status Lifecycle

```
open -> in_progress -> resolved -> closed
         |                           |
         ↑                           v (reopen)
    (escalated: auto-set to        open
     in_progress, priority
     -> critical)

Any status can be snoozed (snoozedUntil set). Auto-wakes when time expires.
```

### Issue Closure Report

When an issue is closed (`issue.closed` event), the `IssueClosureReportHandler` automatically generates a PDF closure report:
- **Trigger:** `issue.closed` event
- **Handler:** `IssueClosureReportHandler`
- **Output:** PDF stored via `IBinaryStorageProvider` as a `GeneratedDocument` (documentType: `issue_closure_report`)
- **Content:** issue summary, triggering event, shipment/order context, temperature telemetry, SLA evaluations, activity timeline, CAPA reports

---

## Comments (Polymorphic)

Comments are a generic, polymorphic entity that can be attached to issues, shipments, or orders. The `entityType` + `entityId` fields link a comment to its parent.

### Commands

| Command | Trigger | Events Emitted |
|---------|---------|----------------|
| `AddCommentCommand` | `POST /api/v1/comments` | `comment.added` |
| `UpdateCommentCommand` | `PUT /api/v1/comments/:id` | `comment.updated` |
| `DeleteCommentCommand` | `DELETE /api/v1/comments/:id` | `comment.deleted` |

### Side Effects

| Event | Projection | Notification |
|-------|-----------|--------------|
| `comment.added` | IssueProjection increments commentCount | InAppNotificationHandler creates bell notification |
| `comment.updated` | -- | -- |
| `comment.deleted` | IssueProjection decrements commentCount | -- |

---

## Tenders

### Commands

| Command | Trigger | Events Emitted |
|---------|---------|----------------|
| `CreateTenderCommand` | `POST /api/v1/tenders` | `tender.created` |
| `OpenTenderCommand` | `POST /api/v1/tenders/:id/open` | `tender.published` |
| `AwardTenderCommand` | `POST /api/v1/tenders/:id/award` | `tender.awarded` |
| `CancelTenderCommand` | `POST /api/v1/tenders/:id/cancel` | `tender.cancelled` |

### Status Lifecycle

```
draft → open → evaluating → awarded
                          → cancelled
```

### Side Effects

| Event | What Happens |
|-------|-------------|
| `tender.created` | Tender + TenderOffer records created per carrier |
| `tender.published` | All offers marked 'sent', carriers notified, EDI 204 sent if trading partner configured |
| `tender.awarded` | Winning bid recorded, carrier assigned to shipment |
| `tender.response_received` | Bid recorded or offer declined, waterfall auto-progresses |
| `tender.awarded` | **Financial side effect:** `TenderAwardFinancialHandler` creates a `Charge` (category=cost, type=linehaul, source=tender_bid) on the shipment from the winning bid rate. Recalculates `ShipmentFinancialSummary`. |

---

## Charges (Financial)

### Commands (CQRS)

| Command | Trigger | Events Emitted |
|---------|---------|----------------|
| `CreateChargeCommand` | `POST /api/v1/charges` | `charge.created` |
| `ApproveChargeCommand` | `POST /api/v1/charges/:id/approve` | `charge.approved` |

### Service Operations

| Operation | Trigger | What It Does |
|-----------|---------|-------------|
| Get shipment financials | `GET /api/v1/shipments/:id/financials` | Returns charges, expected vs actual revenue/cost/margin |
| Calculate rate | `POST /api/v1/rates/calculate` | Looks up LaneCarrier rates, computes linehaul + fuel surcharge breakdown |
| Delete charge | `DELETE /api/v1/charges/:id` | Removes a pending charge, recalculates summary |

### Side Effects

| Event | What Happens |
|-------|-------------|
| `charge.created` | `ShipmentFinancialSummary` upserted with recalculated totals |
| `charge.approved` | `ShipmentFinancialSummary` actual figures updated |
| `tender.awarded` | `TenderAwardFinancialHandler` auto-creates cost charge from winning bid |

### Charge Lifecycle

```
pending → approved → invoiced
              ↘ disputed → (resolved)
pending → written_off
```

### Charge Categories

- **revenue**: What the customer pays us (linehaul, fuel surcharge, accessorials)
- **cost**: What we pay the carrier (linehaul, fuel surcharge, detention, adjustments)

### ShipmentFinancialSummary

Denormalized financial snapshot per shipment. Automatically recalculated whenever charges are created, approved, or deleted. Tracks:
- Expected revenue/cost/margin (all non-written-off charges)
- Actual revenue/cost/margin (only approved/invoiced charges)
- Billing status: `not_ready` → `ready_to_invoice` → `invoiced` → `paid`
- Carrier payment status: `not_ready` → `invoice_received` → `approved` → `paid`

---

## Invoices (Customer — Accounts Receivable)

### Commands (CQRS)

| Command | Trigger | Events Emitted |
|---------|---------|----------------|
| `CreateInvoiceCommand` | `POST /api/v1/invoices` | `invoice.created` |
| `ApproveInvoiceCommand` | `POST /api/v1/invoices/:id/approve` | `invoice.approved` |
| `SendInvoiceCommand` | `POST /api/v1/invoices/:id/send` | `invoice.sent` |
| `RecordPaymentCommand` | `POST /api/v1/invoices/:id/payments` | `invoice.payment_received`, `invoice.paid` (if fully paid) |
| `VoidInvoiceCommand` | `POST /api/v1/invoices/:id/void` | `invoice.voided` |

### Service Operations

| Operation | Trigger | What It Does |
|-----------|---------|-------------|
| Ready to invoice | `GET /api/v1/invoices/ready-to-invoice` | Lists shipments with approved revenue charges and billing_status=ready_to_invoice |
| List invoices | `GET /api/v1/invoices` | Filterable by customer, status |

### Side Effects

| Event | What Happens |
|-------|-------------|
| `shipment.delivered` | `BillingTriggerHandler`: marks shipment ready_to_invoice. If customer.autoInvoice=true, auto-creates draft invoice from approved revenue charges |
| `invoice.created` | `InvoiceProjection`: InvoiceReadModel inserted. Charges marked as invoiced. ShipmentFinancialSummary.billingStatus → invoiced |
| `invoice.payment_received` | `InvoiceProjection`: paidCents, balanceCents, daysPastDue updated |
| `invoice.paid` | ShipmentFinancialSummary.billingStatus → paid |
| `invoice.voided` | Charges reverted to approved. ShipmentFinancialSummary.billingStatus → ready_to_invoice |

### Invoice Lifecycle

```
draft → approved → sent → partial_paid → paid
                      ↘ overdue (detected by cron)
draft/approved → void (only if no payments)
sent/partial_paid → disputed
```

### Auto-Invoice (Per Customer)

If `Customer.autoInvoice = true`, when a shipment is delivered:
1. BillingTriggerHandler checks for approved revenue charges
2. If found, creates a draft invoice automatically
3. Staff reviews and approves/sends (invoice still needs manual approval)

---

## Carrier Invoices (Accounts Payable)

### Commands (CQRS)

| Command | Trigger | Events Emitted |
|---------|---------|----------------|
| `ReceiveCarrierInvoiceCommand` | `POST /api/v1/carrier-invoices` | `carrier_invoice.received`, `carrier_invoice.discrepancy` (if mismatch) |
| `ApproveCarrierInvoiceCommand` | `POST /api/v1/carrier-invoices/:id/approve` | `carrier_invoice.approved` |
| `RecordCarrierPaymentCommand` | `POST /api/v1/carrier-invoices/:id/pay` | `carrier_invoice.paid` |

### Three-Way Match (Freight Audit)

When a carrier invoice is received, `ReceiveCarrierInvoiceCommand` automatically performs a three-way match:

1. For each line item, finds expected cost `Charge` records on the referenced shipment
2. Compares invoiced amount vs expected amount per charge type
3. Calculates variance per line and overall
4. Line match statuses: `matched` (exact) | `variance` (amount differs) | `unmatched` (no expected charge)
5. Overall: `matched` | `partial_match` (variance only) | `mismatch` (has unmatched lines)
6. **Auto-approve**: If no unmatched lines AND variance <= 2%, invoice is auto-approved

### Carrier Invoice Lifecycle

```
received → matched/discrepancy → approved → scheduled → paid
                    ↘ disputed
```

### Side Effects

| Event | What Happens |
|-------|-------------|
| `carrier_invoice.received` | ShipmentFinancialSummary.carrierPaymentStatus → invoice_received (or approved if auto) |
| `carrier_invoice.approved` | ShipmentFinancialSummary.carrierPaymentStatus → approved |
| `carrier_invoice.scheduled` | scheduledPayDate set, status → scheduled |
| `carrier_invoice.paid` | ShipmentFinancialSummary.carrierPaymentStatus → paid |

### Payment Batching

The `CarrierPaymentBatchService` groups approved carrier invoices by carrier for batch payment scheduling:

- **GET /api/v1/carrier-invoices/payment-batches** - View approved invoices grouped by carrier (filterable by carrierId, dueBefore)
- **GET /api/v1/carrier-invoices/payment-batches/scheduled** - View scheduled payments grouped by date
- **POST /api/v1/carrier-invoices/payment-batches/schedule** - Schedule invoices for payment on a future date (by specific IDs, carrier, or due date filter)
- **POST /api/v1/carrier-invoices/payment-batches/execute** - Execute all scheduled payments due on or before today

A daily pg-boss cron job (`carrier-payment-batch`, 7am UTC) auto-executes scheduled payments that are due.

---

## Quotes

Quotes let operations staff price a potential shipment for a customer before it becomes a live order. A quote can be revised multiple times; accepting a quote auto-creates an order with pre-populated revenue charges.

### Commands (CQRS)

| Command | Trigger | Events Emitted |
|---------|---------|----------------|
| `CreateQuoteCommand` | `POST /api/v1/quotes` | `quote.created` |
| `AcceptQuoteCommand` | `POST /api/v1/quotes/:id/accept` | `quote.accepted` |
| `DeclineQuoteCommand` | `POST /api/v1/quotes/:id/decline` | `quote.declined` |
| `ReviseQuoteCommand` | `POST /api/v1/quotes/:id/revise` | `quote.revised` |

### Side Effects

| Event | What Happens |
|-------|-------------|
| `quote.created` | Quote + QuoteLineItem records created. Validity period starts (configurable, default from org settings) |
| `quote.accepted` | Order auto-created from quote data. Approved revenue charges added to order from quote line items. Quote marked accepted |
| `quote.declined` | Quote marked declined. No further action |
| `quote.revised` | Original quote status → superseded. New quote version created with `parentQuoteId` linking to original. Revision number incremented |
| (cron) | Quote expiration cron (pg-boss, every 30 min) marks expired quotes past their validity date |

### Quote Lifecycle

```
draft → sent → accepted
             → declined
             → expired (cron-detected)
             → superseded (when revised)
```

---

## Financial Queries & Credit Notes

Financial queries track disputes, discrepancies, and cargo-related claims. They can be raised manually or auto-created by the `FinancialImpactHandler` when cargo events occur. Resolving a query can optionally generate a credit note.

### Commands (CQRS)

| Command | Trigger | Events Emitted |
|---------|---------|----------------|
| `RaiseQueryCommand` | `POST /api/v1/financial-queries` | `financial_query.raised` |
| `ResolveQueryCommand` | `POST /api/v1/financial-queries/:id/resolve` | `financial_query.resolved`, `credit_note.created` (if adjustment) |

### Auto-Created Queries (FinancialImpactHandler)

The `FinancialImpactHandler` listens to cargo and cold-chain events and automatically raises financial queries:

| Source Event | Query Created |
|-------------|---------------|
| `cargo.missing_at_stop` | Query for missing cargo at delivery stop — potential claim for undelivered goods |
| `cargo.misdrop_detected` | Query for cargo delivered to wrong stop — investigation needed for mis-delivery |
| `cold_chain.disposition_changed` (quarantined) | Query for quarantined goods — cold chain excursion rendered cargo unsaleable |

### Side Effects

| Event | What Happens |
|-------|-------------|
| `financial_query.raised` | Query record created with status=raised, linked to shipment/order |
| `financial_query.resolved` | Query status updated. If resolution=resolved_adjusted, a CreditNote is auto-generated with the adjustment amount |
| `credit_note.created` | Credit note linked to query and customer. Can offset future invoices |

### Query Lifecycle

```
raised → investigating → resolved_adjusted (credit note generated)
                       → resolved_upheld (no financial adjustment)
```

---

## EDI Financial Transactions

### EDI 210 — Freight Invoice (Inbound)

Carrier sends an EDI 210 freight invoice. The `EDI210ParseService` parses B3/N1/LX/L5/L0/L1/L3 segments and creates a `CarrierInvoice` with line items. The `ReceiveCarrierInvoiceCommand` then performs the automatic three-way match (see Carrier Invoices section above).

**Flow:** SFTP poll → edi-collector detects 210 → `POST /api/v1/edi/210/inbound` → `EDI210ParseService` → `ReceiveCarrierInvoiceCommand` → three-way match → auto-approve or flag discrepancy

### EDI 810 — Invoice (Outbound)

TMS generates an EDI 810 invoice for the customer. The `EDI810Service` produces the full X12 envelope (ISA/GS/ST) with BIG (invoice header), N1 (name/address), ITD (payment terms), IT1 (line items), TDS (total), and CTT (transaction count) segments.

**Flow:** Invoice approved + customer has TradingPartner with outbound 810 enabled → `EDI810Service.generate()` → `OutboundEdiDeliveryService` delivers via SFTP or HTTP

### EDI 820 — Payment Order/Remittance (Inbound)

Customer sends an EDI 820 remittance advice. The `EDI820ParseService` parses payment details and matches to outstanding invoices via invoice number.

**Flow:** SFTP poll → edi-collector detects 820 → `POST /api/v1/edi/820/inbound` → `EDI820ParseService` → `RecordPaymentCommand` → invoice payment applied

---

## Trading Partners

### Commands

| Command | Trigger | Events Emitted |
|---------|---------|----------------|
| `CreateTradingPartnerCommand` | `POST /api/v1/trading-partners` | `trading_partner.created` |
| `UpdateTradingPartnerCommand` | `PUT /api/v1/trading-partners/:id` | `trading_partner.updated` |

---

## Devices (IoT)

### Commands

| Command | Trigger | Events Emitted |
|---------|---------|----------------|
| `CreateDeviceCommand` | `POST /api/v1/devices` | `device.created` |
| `UpdateDeviceCommand` | `PUT /api/v1/devices/:id` | `device.updated` |
| `AssignDeviceCommand` | `POST /api/v1/devices/:id/assign` | `device.assigned` |

### Side Effects

| Event | What Happens |
|-------|-------------|
| `device.assigned` | Previous assignment deactivated, new assignment created |
| `device.unassigned` | Assignment deactivated |

---

## Cargo Tracking

### Commands

| Command | Trigger | Events Emitted |
|---------|---------|----------------|
| `RecordCargoScanCommand` | `POST /api/v1/cargo-scans` | `cargo.scan_recorded` |

### Auto-Generated Events (from CargoReconciliationService)

| Event | Trigger |
|-------|---------|
| `cargo.misdrop_detected` | Scan at wrong stop |
| `cargo.missing_at_stop` | Expected unit not scanned at stop |
| `cargo.left_on_vehicle` | Unit not delivered after final stop |
| `cargo.discrepancy_resolved` | Manual resolution of discrepancy |

---

## Carrier Users

### Commands

| Command | Trigger | Events Emitted |
|---------|---------|----------------|
| `CreateCarrierUserCommand` | `POST /api/v1/carriers/:carrierId/users` | `carrier_user.created` |

---

## Read Models

Read models are flat, denormalized tables optimized for list queries with zero joins.

| Read Model | Source Events | Key Denormalized Fields |
|-----------|--------------|------------------------|
| `OrderReadModel` | `order.*` | customerName, originCity, destinationCity, shipmentReference, trackableUnitCount, totalWeight |
| `ShipmentReadModel` | `shipment.*`, `tracking.*` | customerName, originCity, destinationCity, carrierName, currentLat/Lng, orderCount, stopCount |
| `CarrierReadModel` | `carrier.*` | vehicleCount, driverCount, activeLaneCount, validationTier |
| `CustomerReadModel` | `customer.*`, `order.created` | activeOrderCount, totalOrderCount |
| `LaneReadModel` | `lane.*` | originName/City, destinationName/City, carrierCount, activeShipmentCount |
| `IssueReadModel` | `issue.*` | assigneeName, escalatedTo, resolvedAt |

### Backfill

After deploying new read models, run:
```bash
npx tsx backend/src/scripts/backfill-read-models.ts
```
This populates read models from existing write model data. After backfill, projections keep them in sync via events.

---

## Event Envelope

Every event follows this structure:

```typescript
{
  id: "uuid",                        // Unique event ID
  type: "shipment.status_changed",   // entity.action format
  timestamp: "ISO-8601",
  orgId: "uuid",                     // Multi-tenant scope
  actorId: "uuid | null",            // Who caused it
  entityType: "shipment",
  entityId: "uuid",
  payload: { ... },                  // Event-specific data
  metadata: {
    correlationId: "uuid",           // Traces chain of related events
    causationId: "uuid",             // Which event caused this one
    source: "api | worker | webhook",
    schemaVersion: 1
  }
}
```

### Event Export

All events are queryable via the API:
- `GET /api/v1/events?type=shipment.*&since=2026-01-01T00:00:00Z`
- `GET /api/v1/events?afterId=<cursor>&limit=1000` (for warehouse pulls)
- `GET /api/v1/events/stats?since=<timestamp>` (counts by type)
- `GET /api/v1/events/:entityType/:entityId` (entity history)

---

## Monitoring

### Metrics Endpoint

`GET /metrics` returns:
- **Event throughput**: total events, events in last hour, breakdown by type
- **Read model lag**: write model count vs read model count per entity
- **Projection checkpoints**: last processed event per projection
- **Queue depths**: per-handler queue stats

### Configurable Concurrency

Scale handler throughput via environment variables:

| Variable | Default | Affects |
|----------|---------|---------|
| `PROJECTION_CONCURRENCY` | 3 | All 6 projection handlers |
| `AUDIT_CONCURRENCY` | 5 | AuditHandler |
| `EMAIL_CONCURRENCY` | 2 | EmailHandler |

---

## Cold Chain Profile

Cold chain profiles define allowable temperature and humidity bands for shipments carrying temperature-sensitive cargo.

### Commands

| Command | Trigger | Events Emitted |
|---------|---------|----------------|
| `cold_chain_profile.create` | `POST /api/v1/cold-chain-profiles` | `cold_chain_profile.created` |
| `cold_chain_profile.update` | `PUT /api/v1/cold-chain-profiles/:id` | `cold_chain_profile.updated` |

### Side Effects

| Event | What Happens |
|-------|-------------|
| `cold_chain_profile.created` | — |
| `cold_chain_profile.updated` | — |
| `cold_chain_profile.deactivated` | — |

---

## Cold Chain Monitoring

Monitors temperature telemetry on shipments, detects excursions, and manages the cold chain disposition lifecycle.

### Commands

| Command | Trigger | Events Emitted |
|---------|---------|----------------|
| `cold_chain.set_disposition` | `POST /api/v1/shipments/:id/cold-chain/disposition` | `cold_chain.disposition_changed` |

### Auto-Generated Events

| Event | Trigger |
|-------|---------|
| `cold_chain.temperature_logged` | IoT sensor telemetry ingested |
| `cold_chain.excursion_detected` | Temperature reading outside profile alert range |
| `cold_chain.excursion_acknowledged` | User acknowledges an active excursion |
| `cold_chain.excursion_resolved` | Temperature returns to acceptable range or manual resolution |

### Side Effects

| Event | What Happens |
|-------|-------------|
| `cold_chain.excursion_detected` | Auto-creates triage issue for critical severity excursions |
| `cold_chain.disposition_changed` | — |
| Shipment delivered | Compliance report PDF auto-generated on shipment delivered |

### Disposition Lifecycle

```
monitoring → pending_review → released
                            → quarantined
```

---

## Device Calibration

Tracks calibration records for IoT temperature/humidity devices used in cold chain monitoring.

### Commands

| Command | Trigger | Events Emitted |
|---------|---------|----------------|
| `device.record_calibration` | `POST /api/v1/devices/:id/calibrations` | `device.calibration_recorded` |

### Auto-Generated Events

| Event | Trigger |
|-------|---------|
| `device.calibration_expired` | Calibration expiry date reached |

### Side Effects

| Event | What Happens |
|-------|-------------|
| `device.calibration_recorded` | — |
| `device.calibration_expired` | — |

---

## CAPA Report

Corrective and Preventive Action reports for documenting and resolving cold chain quality incidents.

### Commands

| Command | Trigger | Events Emitted |
|---------|---------|----------------|
| `capa.create` | `POST /api/v1/capa-reports` | `capa.created` |
| `capa.update` | `PUT /api/v1/capa-reports/:id` | `capa.updated` |

### Smart Event Selection

UpdateCapaCommand emits different events based on what changed:
- Status changed: emits `capa.status_changed`
- Status → approved: emits `capa.approved`
- Status → verified: emits `capa.verified`
- Other fields only: emits `capa.updated`

### Side Effects

| Event | What Happens |
|-------|-------------|
| `capa.created` | — |
| `capa.updated` | — |
| `capa.status_changed` | — |
| `capa.approved` | — |
| `capa.verified` | — |

---

## ETA Monitoring

The ETA monitor is a cron-driven background service (not a CQRS command) that checks in-transit shipments against traffic-aware routing APIs. It runs via pg-boss schedule and publishes events through the standard event bus.

### Trigger

pg-boss cron schedule (default: every 10 minutes). Can also be triggered manually via `POST /api/v1/eta-monitor/run`.

### Process

1. Query all in-transit shipments (status: `in_transit`, `dispatched`, `picked_up`, `at_stop`)
2. Apply adaptive polling filter (skip stale GPS, parked trucks, distant shipments based on time-to-delivery)
3. For each qualifying shipment:
   - Get current GPS position from ShipmentReadModel
   - Get next pending stop's location coordinates
   - Call routing provider (TomTom/HERE/Valhalla) with traffic-aware ETA request
   - Compare new ETA against scheduled `ShipmentStop.estimatedArrival`
   - Update `ShipmentStop.estimatedArrival` with routing-based ETA

### Events Emitted

| Condition | Event | Payload |
|-----------|-------|---------|
| Delay >= 15 min | `tracking.eta_updated` | `{ shipmentId, shipmentReference, previousEta, newEta, delayMinutes, severity, nextStopName, trafficDelaySeconds, provider }` |
| Delay >= 60 min (critical) | `shipment.exception` | `{ shipmentReference, exceptionType: "eta_critical_delay", description }` |

### Side Effects

| Event | What Happens |
|-------|-------------|
| `tracking.eta_updated` | InAppNotificationHandler creates severity-based notifications (info/warning/error) for all org users |
| `shipment.exception` | InAppNotificationHandler creates error notification; EmailHandler sends exception email (if configured); AuditHandler logs to immutable audit trail |

### Configuration (env vars)

| Variable | Default | Description |
|----------|---------|-------------|
| `ROUTING_PROVIDER` | `none` | Provider: `here`, `tomtom`, `valhalla` |
| `ETA_MONITOR_CRON` | `*/10 * * * *` | Cron schedule |
| `ETA_DELAY_THRESHOLD_MINUTES` | `15` | Minor delay threshold |
| `ETA_WARNING_THRESHOLD_MINUTES` | `30` | Warning threshold |
| `ETA_CRITICAL_THRESHOLD_MINUTES` | `60` | Critical threshold (triggers shipment.exception) |
| `ETA_STALE_GPS_THRESHOLD_MINUTES` | `60` | Skip shipments with GPS older than this |

---

## Warehouse App

The warehouse app is a mobile-first sub-application for warehouse operatives to "launch" shipments — preparing them for dispatch by assigning IoT trackers, accessories, and verifying details.

### Auth: Magic Links

Magic links are persistent, reusable tokens encoded in QR codes for wall-mounting in warehouses.

| Action | API | What Happens |
|--------|-----|-------------|
| Generate Magic Link | `POST /api/v1/warehouse/auth/magic-link/generate` | Creates SHA-256 hashed token, deactivates previous links for user |
| Validate Magic Link | `POST /api/v1/warehouse/auth/magic-link/validate` | Verifies hash, checks expiry, logs to LoginAuditLog, returns user data |
| Password Login | `POST /api/v1/warehouse/auth/login` | Standard login with lockout (5 attempts → 15 min), logs to LoginAuditLog |
| Revoke Magic Links | `DELETE /api/v1/warehouse/auth/magic-link/:userId` | Deactivates all active magic links for user |

### Login Audit Log

Every login attempt (success or failure) is recorded in `LoginAuditLog` with:
- `method`: password, magic_link, oauth_google, oauth_microsoft
- `success`: boolean
- `failReason`: user_not_found, invalid_password, locked, expired_link, inactive_link
- `ipAddress`, `userAgent`: client metadata

### Shipment Launch Workflow

```
Shipment (draft) → Warehouse Operative opens detail
                  → Step 1: Assign IoT trackers (scan barcode → device lookup → assign)
                  → Step 2: Add accessories (temp sensors, door seals)
                  → Step 3: Pair trackable units with IoT devices
                  → Step 4: Review & Launch
                  → Shipment marked as launched (launchedAt, launchedBy set)
                  → Status transitions from "draft" to "ready"
                  → Geofence exit will later transition to "in_transit"
```

### Shipment Flags

Users cannot edit shipment details — they flag issues instead.

| Action | API | What Happens |
|--------|-----|-------------|
| Flag Issue | `POST /api/v1/warehouse/shipments/:id/flag` | Creates ShipmentFlag record with reason, user info |
| Resolve Flag | `PUT /api/v1/warehouse/shipments/:shipmentId/flags/:flagId/resolve` | Marks flag resolved, records resolver |
| Launch Check | `POST /api/v1/warehouse/shipments/:id/launch` | Blocks launch if unresolved flags exist |

### Device Assignment (Scanning)

| Action | API | What Happens |
|--------|-----|-------------|
| Lookup Device | `GET /api/v1/warehouse/devices/lookup?barcode=X` | Finds by externalId, displayId, or name |
| Assign to Shipment | `POST /api/v1/warehouse/shipments/:id/assign-device` | Deactivates previous assignment, creates new |
| Assign to Unit | Same endpoint with `trackableUnitId` | Links device to specific pallet/tote |
| Remove Device | `DELETE /api/v1/warehouse/shipments/:id/devices/:deviceId` | Soft-deactivates assignment |

### Accessories

Accessories are physical items attached to shipments (BLE sensors, door seals).

Types: `temp_sensor_front`, `temp_sensor_middle`, `temp_sensor_back`, `door_sensor`, `door_seal`, `ble_tracker`

| Action | API | What Happens |
|--------|-----|-------------|
| Add Accessory | `POST /api/v1/warehouse/shipments/:id/accessories` | Creates ShipmentAccessory record |
| Remove Accessory | `DELETE /api/v1/warehouse/shipments/:id/accessories/:id` | Hard deletes record |

### WiFi Connectivity Monitoring

`POST /api/v1/warehouse/connectivity` — Logs `wifi_lost`, `wifi_restored`, `slow_connection` events. Fire-and-forget from the frontend when `navigator.onLine` changes. Used for operational diagnostics.

### Shipment Lifecycle (Warehouse Perspective)

```
draft ──(warehouse launch)──→ ready ──(geofence exit)──→ in_transit ──→ delivered
  │                             │
  └──(idle >2 days)──→ archive  └──(warehouse app shows as "launched")
```

Launched shipments drop off the active list. Stale shipments (>2 days in draft without launch) appear on the archive screen.

---

## SLA (Service Level Agreements)

### Commands

| Command | Type String | What It Does |
|---------|-------------|--------------|
| CreateSlaPolicyCommand | `sla_policy.create` | Creates a policy with nested rules. Scoped to org (default) or customer (override). |
| UpdateSlaPolicyCommand | `sla_policy.update` | Updates policy fields and replaces rules wholesale. |
| DeactivateSlaPolicyCommand | `sla_policy.deactivate` | Sets `active = false`. Existing evaluations continue but no new ones are created. |

### Events

| Event | When It Fires | Side Effects |
|-------|---------------|--------------|
| `sla_policy.created` | Policy created | Audit log |
| `sla_policy.updated` | Policy or rules changed | Audit log |
| `sla_policy.deactivated` | Policy deactivated | Audit log |
| `sla.evaluation_created` | New SLA evaluation started for a shipment or issue | In-app notification |
| `sla.warning` | Evaluation reaches warning threshold | In-app notification, email |
| `sla.breached` | Evaluation exceeds due date | In-app notification, email, auto-create issue (if configured) |
| `sla.met` | SLA satisfied before breach | In-app notification |

### SLA Evaluation Lifecycle

```
[entity created] ──→ SlaEvaluation(active) ──→ [warning threshold] ──→ warning
                                                                         ↓
                                              [due date passed] ──→ breached ──→ auto-create Issue
                                                                         
[entity resolved/delivered] ──→ met (SLA satisfied)
[entity cancelled] ──→ cancelled
```

### Policy Resolution (Two-Tier)

1. Look for `SlaPolicy` where `orgId = X AND customerId = entity.customerId AND active = true`
2. If not found, fall back to `SlaPolicy` where `orgId = X AND customerId IS NULL AND active = true`
3. If neither exists, no SLA enforcement for this entity

### Rule Types

| ruleType | Applies To | Clock Starts | Met When | Breach Threshold |
|----------|-----------|--------------|----------|-----------------|
| `eta_delivery` | Shipments | pickupDate | `shipment.delivered` | `maxDeliveryMinutes` |
| `issue_response` | Issues | issue.createdAt | `issue.assigned` / status → in_progress | `breachThresholdMinutes` |
| `issue_resolution` | Issues | issue.createdAt | `issue.resolved` | `breachThresholdMinutes` |
| `dwell_time` | Shipments | stop.actualArrival | stop completed (shipment departs) | `maxDwellMinutes` |
| `dock_turnaround` | Shipment Stops | stop.actualArrival | stop completed | `maxDwellMinutes` + `locationType` filter |
| `sort_to_dispatch` | Shipment Stops | stop.actualArrival (at cross-dock) | stop completed | `breachThresholdMinutes` + `locationType: cross_dock` |
| `facility_dwell` | Shipment Stops | stop.actualArrival | stop completed | `maxDwellMinutes` + `locationType` filter |
| `light_event` | Shipments | sensor reading | N/A (occurrence-based) | `maxOccurrences` |
| `seal_event` | Shipments | device event | N/A (occurrence-based) | `maxOccurrences` |
| `temperature_excursion` | Shipments | excursion.startedAt | excursion resolved | `maxExcursionMinutes` |
| `temperature_out_of_range` | Shipments | first out-of-range reading | N/A (cumulative) | `maxExcursionMinutes` |

### Breach → Issue Pipeline

When `autoCreateIssue = true` on the rule:
1. Creates an Issue with `category: 'compliance'`, priority from `issuePriorityOnBreach`
2. Links to source entity via `sourceEntityType` / `sourceEntityId`
3. Title: "SLA Breach: {ruleName} on {entityReference}"
4. Links back to the SlaEvaluation via `issueId`

### Event-Driven Automation (Phase 3b)

| Handler | Listens To | What It Does |
|---------|-----------|-------------|
| `AutoTenderHandler` | `shipment.created` | If org.autoTenderEnabled and shipment has no lane/carrier, creates a broadcast tender to all active carriers |
| `ShipmentCompletionHandler` | `shipment.stop_arrived`, `tracking.geofence_entered` | When destination stop arrives, auto-transitions shipment to 'delivered' and publishes shipment.delivered event |

### Location Auto-Resolution

When `CreateShipmentCommand` receives `originData`/`destinationData` (raw address objects) instead of explicit location IDs:
1. Searches for existing location by `name + city` (case-insensitive)
2. If found, reuses the existing location
3. If not found, creates a new `Location` record and emits `location.created` with `source: 'shipment_resolution'`
4. Default geofence arrival criteria are created for new locations (via `LocationResolutionService`)

When `LocationResolutionService.resolveOrCreate()` creates a new location (used by order creation, EDI import):
- Emits `location.created` with `source: 'resolution'` and the actor's ID
- Event is best-effort (location creation succeeds even if event publishing fails)
- The `AuditHandler` records the source in the audit log description

### Workers

| Worker | Queue | Schedule | What It Does |
|--------|-------|----------|-------------|
| SLA Monitor | `sla-monitor` | Every 2 min (configurable via `SLA_MONITOR_CRON`) | Sweeps active evaluations, transitions to warning/breached, auto-creates issues |

---

## Agent Decisions

Agent Decisions provide the compliance and audit layer for AI agent actions. Every decision made by an AI agent is logged with full context, and outcomes can be recorded after the fact. Decisions can also be promoted to serve as training examples or policy references.

### Commands

| Command | Type | Trigger | Events Emitted |
|---------|------|---------|----------------|
| `CreateAgentDecisionCommand` | `agent_decision.create` | `POST /api/v1/agent-decisions` | `agent_decision.created` |
| `RecordDecisionOutcomeCommand` | `agent_decision.record_outcome` | `PUT /api/v1/agent-decisions/:id/outcome` | `agent_decision.outcome_recorded` |
| `PromoteDecisionCommand` | `agent_decision.promote` | `POST /api/v1/agent-decisions/:id/promote` | `agent_decision.promoted` |

### Side Effects

| Event | Projection | Notification | Other |
|-------|-----------|--------------|-------|
| `agent_decision.created` | AgentDecisionReadModel upsert | -- | Audit log |
| `agent_decision.outcome_recorded` | AgentDecisionReadModel outcome update | -- | Audit log |
| `agent_decision.promoted` | AgentDecisionReadModel promotion flag | -- | Audit log |

### Triage Agent

The Triage Agent is an AI event handler (`TriageAgentHandler`) that subscribes to exception events and uses Claude to decide what action to take. It runs as a pg-boss worker job within the event handler infrastructure.

**Subscribed events:** `shipment.exception`, `sla.breached`, `cargo.misdrop_detected`, `cargo.missing_at_stop`, `cargo.left_on_vehicle`, `cold_chain.excursion_detected`

**Flow:**
1. Event arrives via pg-boss queue
2. Handler gathers context (shipment details, open issues, SLA evaluations)
3. Checks for recent duplicate decisions (30-min debounce window)
4. Calls Claude with structured prompt + context
5. Parses structured JSON response
6. Executes action: `create_issue`, `escalate_issue`, `contact_driver`, or `no_action`
7. Logs the full decision via `CreateAgentDecisionCommand`

**contact_driver action:** Gathers driver info from Shipment -> Load -> Driver. Creates or finds the related issue, then posts an agent comment with driver contact details (name, phone, email). Falls back to a "no driver assigned" message if no driver is linked to the shipment's load.

**Configuration:** Set `ANTHROPIC_API_KEY` env var to enable. Optionally set `ANTHROPIC_MODEL` (default: `claude-sonnet-4-20250514`) and `AGENT_TRIAGE_CONCURRENCY` (default: 2).

### Configurable Agent Prompts

Agent behaviour is configurable per-org via `AgentConfig` + versioned prompts (`AgentConfigVersion`). Each prompt change creates an immutable version linked to decisions via `promptVersionId`.

| Setting | Type | Default |
|---------|------|---------|
| System prompt | Text with `{{template}}` vars | Hardcoded triage prompt |
| Subscribed events | String[] | 6 exception events |
| Temperature | Float 0-1 | 0.2 |
| Max tokens | Int | 512 |
| Confidence threshold | Float 0-1 | 0 (accept all) |
| Deduplication window | Int (minutes) | 30 |

### Automation Rules

Deterministic rules promoted from agent decisions or created manually. Uses the same unified condition format as agent-extracted conditions.

| API | Method | Purpose |
|-----|--------|---------|
| `/api/v1/automation-rules` | GET | List rules |
| `/api/v1/automation-rules` | POST | Create rule |
| `/api/v1/automation-rules/:id` | PUT | Update rule |
| `/api/v1/automation-rules/:id/toggle` | POST | Enable/disable |
| `/api/v1/automation-rules/:id/test` | POST | Dry-run against sample event |
| `/api/v1/automation-rules/from-decision/:id` | POST | Create rule from promoted decision |

**Condition format:** `[{ field: "payload.delayMinutes", operator: "greaterThan", value: 60 }]`

**Operators:** equals, notEquals, contains, in, greaterThan, lessThan, greaterThanOrEqual, lessThanOrEqual, exists, notExists

**Rule suppresses agent:** When a rule matches, it writes an AgentDecision marker that prevents the triage agent from processing the same event (deduplication).

### Skills System

Extensible action framework for automation rules and skill chains.

**Built-in skills:**

| Skill | Category | Config Required | Fields |
|-------|----------|----------------|--------|
| `create_issue` | triage | No | title, description, priority, category |
| `escalate_issue` | triage | No | issueId, escalatedTo, reason |
| `add_comment` | triage | No | entityType, entityId, body |
| `contact_driver` | triage | No | shipmentId |
| `send_email` | communication | Yes (SMTP) | to, subject, body |
| `call_webhook` | integration | Yes (URL+auth) | body |

**Skill chains:** Ordered sequences of skill steps with question branching. Question nodes evaluate conditions and follow matched/unmatched branches. Steps support `{{template}}` variable syntax.

**Skill config:** Org-level configuration for skills needing API keys or webhook URLs. Managed via `SkillConfig` model and `/settings/skills` admin page.
