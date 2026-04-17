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

## EDI Communication Hub

### Universal Inbound Processing

All inbound EDI is processed through the **universal inbound endpoint** (`POST /api/v1/edi/inbound`). The endpoint auto-detects the transaction type, validates partner support, routes to the correct handler, logs to `EdiTransactionLog`, and auto-generates 997 acknowledgments.

**Flow:** SFTP poll (edi-collector) or API POST → `/api/v1/edi/inbound` → `EdiRouterService` detects type → route to handler → log result → send 997 ack if configured

### Inbound Transaction Types

| Type | Parser | Route | Handler Action |
|------|--------|-------|----------------|
| 850 | `EDI850ParseService` | `/api/v1/orders/import/edi` | Parse PO, create Orders |
| 990 | `EDI990ParseService` | `/api/v1/edi/tender/990` | Parse accept/decline, submit bid or decline offer |
| 997 | `EDI997Service.parse997()` | `/api/v1/edi/997/inbound` | Parse ack, update original outbound log |
| 214 | `EDI214ParseService` | `/api/v1/edi/214/inbound` | Parse status, update Shipment via `ProcessInbound214Command` |
| 210 | `EDI210ParseService` | `/api/v1/edi/210/inbound` | Parse freight invoice, `ReceiveCarrierInvoiceCommand`, three-way match |
| 820 | `EDI820ParseService` | `/api/v1/edi/820/inbound` | Parse remittance, `RecordPaymentCommand` per invoice |

### Outbound Transaction Types

| Type | Generator | Trigger |
|------|-----------|---------|
| 204 | `EDI204Service` | Tender opened (manual via API) |
| 214 | `EDI214Service` | Inbound 214 received → `Edi214ForwardHandler` auto-forwards to customer |
| 810 | `EDI810Service` | Invoice sent → `Edi810AutoSendHandler` sends to customer partner |
| 856 | `EDI856Service` | Shipment delivered → `Edi856AutoSendHandler` sends to customer partner |
| 997 | `EDI997Service` | Any inbound processed → auto-ack if partner config `ack997Required` |

### EDI Events

| Event | Trigger | Side Effects |
|-------|---------|-------------|
| `edi_status.received` | Inbound 214 processed | `Edi214ForwardHandler` auto-forwards to customer partners |
| `edi_status.sent` | Outbound 214 delivered | Logged to `EdiTransactionLog` |
| `edi.file_received` | Any inbound EDI processed | Generic tracking |
| `edi.file_sent` | Any outbound EDI delivered | Generic tracking |
| `edi.file_failed` | Parse or delivery failure | Error logged |
| `shipment.delivered` | Shipment delivery confirmed | `Edi856AutoSendHandler` sends 856 to customer partners |
| `invoice.sent` | Invoice sent to customer | `Edi810AutoSendHandler` sends 810 to customer partners |

### Shared X12 Infrastructure

All EDI generators use `X12EnvelopeBuilder` for ISA/GS/ST/SE/GE/IEA envelope construction. All parsers use `X12EnvelopeParser` for envelope validation and body segment extraction. Generators have `validateAndGenerate()` methods returning `EdiOperationResult<T>` with errors/warnings instead of crashing.

### Logging

All EDI operations log to `EdiTransactionLog` with: transaction type, direction, partner, raw content, file hash (dedup), parse result, created entities, 997 ack status, retry count. The unified log viewer at `/integrations/edi/logs` shows all types in one table.

---

## Trading Partners

### Commands

| Command | Trigger | Events Emitted |
|---------|---------|----------------|
| `CreateTradingPartnerCommand` | `POST /api/v1/trading-partners` | `trading_partner.created` |
| `UpdateTradingPartnerCommand` | `PUT /api/v1/trading-partners/:id` | `trading_partner.updated` |

### Connection Testing

`POST /api/v1/trading-partners/:id/test-connection` tests SFTP (connect + list directory) or HTTP (HEAD request with auth) and returns success/failure with details.

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

## Quality Centre

The Quality Centre provides aggregated quality metrics, CAPA follow-up management, and SOP/GDP audit capabilities.

### Quality Issue Summary (Projection)

The `QualityIssueSummaryProjection` maintains aggregated issue metrics by dimension (carrier, lane, location, customer). On every issue event, it resolves the source shipment's linked carrier, lane, origin/destination locations, and customer, then upserts the corresponding `QualityIssueSummary` rows with updated counts.

### CAPA Follow-Ups

| Command | Trigger | Events Emitted |
|---------|---------|----------------|
| `capa_follow_up.create` | `POST /api/v1/quality/capa-follow-ups` | `capa.follow_up_created` |
| `capa_follow_up.complete` | `PUT /api/v1/quality/capa-follow-ups/:id/complete` | `capa.follow_up_completed` |

Follow-up types: `30_day`, `60_day`, `90_day`, `ad_hoc`, `effectiveness_check`
Outcomes: `on_track`, `needs_attention`, `escalated`, `closed_effective`, `closed_ineffective`

The `POST /api/v1/quality/capa-follow-ups/schedule` endpoint auto-creates 30, 60, and 90-day follow-ups from the CAPA creation date.

### SOP Checklists & Audits

| Command | Trigger | Events Emitted |
|---------|---------|----------------|
| `sop_checklist.create` | `POST /api/v1/quality/sop-checklists` | `sop_checklist.created` |
| `sop_audit.start` | `POST /api/v1/quality/sop-audits` | `sop_audit.started` |
| `sop_audit.complete` | `PUT /api/v1/quality/sop-audits/:id/complete` | `sop_audit.completed` or `sop_audit.failed` |

Audit scoring: pass rate calculated from responses. Critical item failure automatically fails the entire audit. Passing threshold: 80% with no critical failures.

### Side Effects

| Event | What Happens |
|-------|-------------|
| `issue.*` (created/updated/closed/resolved/needs_capa_marked) | `QualityIssueSummaryProjection` rebuilds aggregated metrics for linked carrier/lane/location/customer |
| `capa.follow_up_created` | -- |
| `capa.follow_up_completed` | -- |
| `sop_audit.completed` | Updates checklist `lastCompletedAt` |
| `sop_audit.failed` | Updates checklist `lastCompletedAt` |

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

## Route Deviation Alerts

The route deviation system detects when an in-transit shipment deviates from a planned lane route. Routes are defined per-lane using Google Maps Directions API and stored as encoded polylines with a configurable deviation corridor.

### Lane Route Model

Each lane can have one planned route (`LaneRoute`) containing:
- **encodedPolyline** - Google-encoded polyline string of the planned path
- **waypoints** - JSON array of `{lat, lng}` for quick access
- **distanceMeters / durationSeconds** - Route metadata from Google Maps
- **corridorMeters** - Max distance from route before alerting (default: 5000m)
- **summary** - Google's route summary (e.g., "via I-95 N")

### Route Planning (Frontend)

Users create planned routes on the lane create/edit page:
1. Select origin and destination locations (must have lat/lng coordinates)
2. Add intermediate stops for hub-and-spoke routing (these become waypoints)
3. Google Maps renders a draggable DirectionsRenderer on the map
4. Users can drag the route line to adjust the planned path
5. Distance, duration, and corridor are saved with the lane route

**Requires:** Google Maps API key configured in Admin > Map Settings.

### Deviation Detection

During each ETA monitor cycle, for shipments with a `laneId` that has a `LaneRoute`:
1. Get the shipment's current GPS position from ShipmentReadModel
2. Find the nearest point on the planned route polyline (point-to-segment projection)
3. Calculate haversine distance from current position to nearest route point
4. Compare against the lane route's `corridorMeters` threshold

### Events Emitted

| Condition | Event | Payload |
|-----------|-------|---------|
| Distance > corridor (warning) | `tracking.route_deviation` | `{ shipmentId, shipmentReference, laneId, laneName, currentLat, currentLng, deviationMeters, corridorMeters, severity: "warning", nearestRouteLat, nearestRouteLng }` |
| Distance > 2x corridor (critical) | `tracking.route_deviation` + `shipment.exception` | Same as above with `severity: "critical"` + exception event |

### Side Effects

| Event | What Happens |
|-------|-------------|
| `tracking.route_deviation` | InAppNotificationHandler creates deviation notification; Triage agent evaluates for auto-issue creation |
| `shipment.exception` (route_deviation) | Full exception flow: notification, audit, email, triage agent evaluation |

### API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/lanes/:laneId/route` | Get planned route for a lane |
| PUT | `/api/v1/lanes/:laneId/route` | Save/update planned route |
| DELETE | `/api/v1/lanes/:laneId/route` | Delete planned route |
| POST | `/api/v1/lanes/:laneId/route/calculate` | Preview route via Google Maps (not saved) |
| POST | `/api/v1/lanes/:laneId/route/check-deviation` | Check if a position deviates from route |
| GET | `/api/v1/lanes/:laneId/route/google-maps-status` | Check if Google Maps API key is configured |

### Key Files

- `backend/prisma/schema.prisma` - LaneRoute model
- `backend/src/services/routing/GoogleMapsDirectionsService.ts` - Google Maps Directions API + polyline encode/decode
- `backend/src/services/routing/RouteDeviationService.ts` - Point-to-polyline deviation detection
- `backend/src/services/routing/ShipmentEtaMonitorService.ts` - Integrated deviation checking during ETA monitor runs
- `backend/src/routes/laneRoutes.ts` - Lane route API endpoints
- `frontend/src/components/GoogleMapsRouteEditor.tsx` - Draggable Google Maps route editor
- `frontend/src/vnext-design/VNextCreateLane.tsx` - Lane create/edit with route planning
- `frontend/src/vnext-design/VNextLaneDetail.tsx` - Lane detail with route visualization
- `frontend/src/vnext-design/VNextShipmentDetail.tsx` - Route deviation alert banner on shipment detail

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

---

## Carrier Tracking Integrations

Links carriers to external tracking APIs (FedEx, UPS, DHL, EasyPost, etc.) for automated shipment status updates.

### Commands

| Command | Events | Side Effects |
|---------|--------|-------------|
| `CreateCarrierTrackingIntegration` | `carrier_tracking.integration_created` | None |
| `UpdateCarrierTrackingIntegration` | `carrier_tracking.integration_updated` | None |
| `DeleteCarrierTrackingIntegration` | `carrier_tracking.integration_deleted` | Cascades: deletes related tracking events |
| `RecordCarrierTrackingEvent` | `carrier_tracking.update_received` + conditionally: `carrier_tracking.delivered` or `carrier_tracking.exception` | Writes CarrierTrackingEvent, bridges to shipment lifecycle |

### Provider Interface

`ICarrierTrackingProvider` - provider-agnostic interface (same pattern as `IRoutingProvider`):
- `authenticate(credentials)` - OAuth token management or API key setup
- `pollTracking(trackingNumbers[])` - pull status updates in batch
- `parseWebhook(payload, headers)` - normalize inbound webhook payloads
- `verifyWebhookSignature(body, signature, secret)` - validate webhook authenticity

### Supported Providers

| Provider | Auth | Webhooks | Polling | Batch Size |
|----------|------|----------|---------|------------|
| FedEx | OAuth 2.0 | Yes | Yes | 30 |
| UPS | OAuth 2.0 | Yes | Yes | 1 |
| DHL | API Key | Yes | Yes | 1 |
| EasyPost | API Key | Yes | Yes | 1 |
| EDI 214 | N/A (via TradingPartner) | Push (EDI) | No | N/A |

### Normalized Status Codes

All providers map to 7 standard statuses: `info_received`, `in_transit`, `out_for_delivery`, `delivered`, `exception`, `return_to_sender`, `unknown`.

### Event Handler Side Effects

The `CarrierTrackingHandler` bridges carrier tracking events to the shipment lifecycle:

| Event | Side Effect |
|-------|-------------|
| `carrier_tracking.delivered` | Updates shipment status to `delivered`, emits `shipment.delivered` + `shipment.status_changed` |
| `carrier_tracking.exception` | Updates shipment status to `exception`, emits `shipment.exception` + `shipment.status_changed` |
| `carrier_tracking.update_received` (in_transit) | Advances shipment status forward (draft -> in_transit), emits `shipment.status_changed` |
| `carrier_tracking.integration_error` | Sets integration status to `error`, pauses polling |

Status bridging rules:
- Delivery only applied to shipments in `in_transit`, `dispatched`, or `picked_up` status
- Exception not applied to already-delivered shipments
- Status never regresses (e.g., in_transit will not go back to draft)
- Delivered and exception events from `update_received` are handled by their dedicated handlers

### Polling Worker

`carrierTrackingPollWorker` runs every 5 minutes (configurable via `CARRIER_TRACKING_POLL_CRON`). Polls active integrations that have exceeded their polling interval. Respects per-provider rate limits.

### Key Files
- `backend/src/services/carrierTracking/ICarrierTrackingProvider.ts` - Provider interface
- `backend/src/services/carrierTracking/CarrierTrackingService.ts` - Orchestrator
- `backend/src/services/carrierTracking/ProviderRegistry.ts` - Provider factory
- `backend/src/services/carrierTracking/providers/` - FedEx, UPS, DHL implementations
- `backend/src/repositories/CarrierTrackingIntegrationRepository.ts` - Integration CRUD
- `backend/src/routes/carrierTracking.ts` - API endpoints
- `backend/src/workers/carrierTrackingPollWorker.ts` - Polling cron
- `frontend/src/vnext-design/VNextCarrierTracking.tsx` - Integration list
- `frontend/src/vnext-design/VNextCarrierTrackingSetup.tsx` - Setup wizard
- `frontend/src/vnext-design/VNextCarrierTrackingDetail.tsx` - Integration detail

---

## Brokerage Operations

### Organization Type

The `Organization` model has an `organizationType` field that determines the UI experience and available features. Valid values: `shipper` (default), `broker`, `carrier`, `3pl`.

Broker and 3PL organizations get:
- Load Board in sidebar navigation
- Margin columns on shipment list (on by default)
- Brokerage settings tab in admin (MC number, bond, operating authority, margin alerts)

### Margin Alert

**Event:** `margin.alert`

**Trigger:** `MarginAlertHandler` subscribes to `charge.created` and `charge.approved` events. When a charge is created or approved, it checks the shipment's `ShipmentFinancialSummary` margin against the org's `minMarginPercent` threshold.

**Side Effects:**
- Creates an Issue with category `margin_alert` and priority based on severity (negative margin = critical, low margin = high)
- Deduplicates: will not create a second alert if an open margin_alert issue already exists for the shipment

**Configuration:** Set `marginAlertEnabled = true` and `minMarginPercent` on the Organization model via Settings > Brokerage.

### Load Board

**Endpoint:** `GET /api/v1/loadboard`

Returns shipments where `carrierId IS NULL` and `status IN ('booked', 'confirmed', 'ready', 'pending')`, ordered by pickup date. Includes customer, origin/destination, lane, financial summary, and active tenders.

**Endpoint:** `GET /api/v1/loadboard/:shipmentId/matching-carriers`

Finds carriers with:
1. Lane rates (LaneCarrier records) for the shipment's lane
2. Historical usage (previously assigned to shipments on the same lane)
3. Tender acceptance stats (total bids, accepted bids, acceptance rate %)

**Endpoint:** `POST /api/v1/loadboard/:shipmentId/assign`

Quick-assigns a carrier with a cost rate. In a single transaction:
1. Sets `carrierId` on the shipment
2. Creates an approved cost charge (linehaul) for the agreed rate
3. Updates `ShipmentFinancialSummary` with the new cost

### ShipmentReadModel Financial Columns

The `ShipmentProjection` subscribes to `charge.*` events in addition to `shipment.*` and `tracking.*`. On charge events, it denormalizes the `ShipmentFinancialSummary` fields (expectedRevenueCents, expectedCostCents, expectedMarginCents, actualRevenueCents, actualCostCents, actualMarginCents) into the `ShipmentReadModel` for fast list queries.

### Quick Quote

**Endpoint:** `POST /api/v1/quotes/quick`

Given a `customerId`, `laneId`, and optional `carrierId`/`markupPercent`, auto-populates a quote from `RatingService` lane-carrier rates. Calculates cost (carrier buy rate) and revenue (cost + markup %) line items, then dispatches `CreateQuoteCommand`. Returns the created quote plus a cost/revenue breakdown with margin.

### Quote-to-Book (Broker Flow)

**Endpoint:** `POST /api/v1/quotes/:id/accept` with `{ createShipment: true }`

When `createShipment` is true and the org type is broker or 3PL, the `AcceptQuoteCommand` additionally:
1. Creates a Shipment (status: `booked`, no carrier) from the quote's origin/destination
2. Links Order to Shipment via `OrderShipment`
3. Creates a `ShipmentFinancialSummary` with expected revenue from the quote
4. Copies revenue charges to the shipment
5. Emits `SHIPMENT_CREATED` event (shipment appears on load board for carrier assignment)

The frontend "Accept & Book" button (visible for broker orgs) triggers this flow and navigates to the load board.

### Customer Credit Check

**Endpoint:** `GET /api/v1/customers/:id/credit-status?additionalAmountCents=N`

`CreditCheckService` sums unpaid invoices (draft, approved, sent, overdue, partial) and compares against `Customer.creditLimitCents`. Returns pass/fail with outstanding balance and available credit. Null credit limit = unlimited.

### Rate Confirmation PDF

**Endpoint:** `POST /api/v1/documents/rate-confirmation`

Generates a carrier-facing PDF showing the agreed carrier rate (cost charges only). Does NOT show customer sell rate or broker margin. Uses the same `DocumentGenerationService` + Handlebars template pattern as BOL/customs forms. Stored via `IBinaryStorageProvider` as a `GeneratedDocument` (documentType: `rate_confirmation`).

### Roles & Permissions (RBAC)

**System:** Full RBAC with Role model containing JSON permission arrays. Permissions follow `resource:action` format with wildcard support (`*` for all, `resource:*` for all actions on a resource).

**System Roles:**
| Role | Description | Key Permissions |
|------|-------------|----------------|
| `admin` | Full system access | `*` |
| `broker_admin` | Brokerage administrator | All ops + settings + users |
| `broker_agent` | Sales rep / agent | Loadboard, quotes, margins - no settings/users |
| `dispatcher` | Operational user | Shipments, orders, tendering, loadboard |
| `finance` | Financial operations | Quotes, invoices, charges, reports |
| `warehouse` | Warehouse operator | Shipment read/write, devices |
| `readonly` | Read-only access | All `:read` and `:view` permissions |

**Broker-Specific Permissions:** `loadboard:read`, `loadboard:assign`, `margin:view`, `credit:check`, `rate_confirmation:generate`

**Seeding:** `POST /api/v1/roles/seed` creates or updates system roles (idempotent). Custom roles can be created via the Roles CRUD API.

**Middleware:** `requirePermission(...perms)` in `jwtAuth.ts` checks JWT permissions. `optionalAuth` sets `req.user` when token present without blocking unauthenticated requests.

### Margin Reports

Four report endpoints in `brokerReports.ts`:
- `GET /api/v1/reports/margin/by-customer` - Revenue, cost, margin by customer with target margin variance
- `GET /api/v1/reports/margin/by-carrier` - Revenue, cost, margin by carrier
- `GET /api/v1/reports/margin/by-lane` - Revenue, cost, margin by lane
- `GET /api/v1/reports/margin/over-time` - Margin trends with daily/weekly/monthly granularity

All support `dateFrom`/`dateTo` query parameters. Customer report includes `targetMarginPercent` and `varianceFromTarget` fields.

### Target Margin

- `Customer.targetMarginPercent` - Per-customer target margin (e.g., 15.00%)
- `LaneCarrier.targetMarginPercent` - Per-lane-carrier target margin

Used in margin reports to show variance (actual margin % - target %).

### Commission Tracking

**Model:** `Commission` with `userId` (broker agent), `shipmentId`, `basisType` (margin or revenue), `commissionPercent`, computed `commissionCents`, and lifecycle: accrued -> approved -> paid.

**Endpoints:**
- `GET /api/v1/commissions` - List with filters (userId, shipmentId, status)
- `POST /api/v1/commissions` - Create (auto-computes amount from ShipmentFinancialSummary)
- `POST /api/v1/commissions/:id/approve` - Approve
- `POST /api/v1/commissions/:id/pay` - Mark paid
- `GET /api/v1/commissions/summary` - Totals grouped by agent

### Carrier Quick Pay

**Endpoint:** `POST /api/v1/carrier-invoices/:id/quick-pay`

Requests accelerated payment on a carrier invoice with a discount. Sets `quickPayRequested`, `quickPayDiscountPct`, `quickPayDiscountCents` (computed), and `quickPayDueDate` (today + N days).

### Key Files
- `backend/src/auth/permissions.ts` - Permission constants and system role definitions
- `backend/src/auth/seedRoles.ts` - Role seeding service
- `backend/src/routes/roles.ts` - Roles CRUD API (list, create, update, delete, assign/remove user)
- `backend/src/middleware/jwtAuth.ts` - JWT auth + requirePermission middleware
- `frontend/src/hooks/useCurrentUser.ts` - Frontend role/permission hook
- `frontend/src/vnext-design/VNextRoles.tsx` - Roles management admin page
- `backend/prisma/schema.prisma` - Organization brokerage fields, ShipmentReadModel financial columns
- `backend/src/routes/loadboard.ts` - Load board API (list, matching carriers, quick assign)
- `backend/src/routes/quotes.ts` - Quick quote + credit check endpoints
- `backend/src/routes/organization.ts` - Organization settings (includes brokerage fields)
- `backend/src/services/CreditCheckService.ts` - Customer credit validation
- `backend/src/services/templates/rateConfirmationTemplate.ts` - Rate confirmation Handlebars template
- `backend/src/services/DocumentGenerationService.ts` - Rate confirmation PDF generation
- `backend/src/commands/quotes/AcceptQuoteCommand.ts` - Quote-to-book with shipment creation
- `backend/src/events/handlers/MarginAlertHandler.ts` - Margin alert event handler
- `backend/src/events/projections/ShipmentProjection.ts` - Financial column denormalization
- `backend/src/events/eventTypes.ts` - margin.alert event type
- `frontend/src/vnext-design/VNextLoadBoard.tsx` - Load board page
- `frontend/src/vnext-design/VNextShipments.tsx` - Margin columns on shipment list
- `frontend/src/vnext-design/VNextFinanceQuoteDetail.tsx` - Accept & Book button for brokers
- `frontend/src/vnext-design/VNextShipmentDetail.tsx` - Rate Confirmation button
- `frontend/src/vnext-design/VNextSettings.tsx` - Brokerage settings tab
- `frontend/src/hooks/useOrgContext.ts` - Organization context hook
- `backend/src/__tests__/handlers/MarginAlertHandler.test.ts` - 8 margin alert tests
- `backend/src/__tests__/projections/ShipmentProjectionFinancial.test.ts` - 5 projection tests
- `backend/src/__tests__/services/CreditCheckService.test.ts` - 7 credit check tests
- `backend/src/__tests__/commands/BrokerQuoteToBook.test.ts` - 5 quote-to-book tests
- `backend/src/routes/brokerReports.ts` - Margin reports (by customer/carrier/lane/time)
- `backend/src/routes/commissions.ts` - Commission CRUD + summary
- `backend/src/routes/carrierInvoices.ts` - Quick pay endpoint
- `frontend/src/vnext-design/VNextMarginReports.tsx` - Margin reports page
- `frontend/src/vnext-design/VNextCommissions.tsx` - Commission management page

---

## Warehouse Management System (WMS)

### Domain: Warehouse Zones & Bins

Manages the physical location hierarchy within warehouses: zones (logical areas), aisles, and bins (individual storage locations).

### Commands
- `warehouse_zone.create` - Create a zone within a location (type, temperature, hazmat, capacity)
- `warehouse_zone.update` - Update zone properties
- `warehouse_bin.create` - Create a single bin within a zone
- `warehouse_bin.update` - Update bin properties (label uniqueness enforced on rename)
- `warehouse_bin.bulk_create` - Generate bins from a label pattern ({aisle}-{row}-{level}) with ranges; max 10,000 per batch

### Events
- `warehouse_zone.created`, `warehouse_zone.updated`, `warehouse_zone.archived`
- `warehouse_bin.created`, `warehouse_bin.updated`, `warehouse_bin.archived`, `warehouse_bin.bulk_created`

### Side Effects
- None (pure CRUD, no projections or downstream handlers yet)

---

### Domain: Receiving

Manages inbound goods - dock appointments, receiving tasks, and line-by-line item verification.

### Commands
- `receiving_task.create` - Create a receiving task (ASN-based with expected lines, or blind). Auto-updates linked appointment status.
- `receiving_line.record` - Record a received item against an existing line (ASN) or create a new line (blind). Auto-starts task on first line recorded.
- `receiving_task.complete` - Complete receiving, tally totals, auto-generate putaway tasks for units with trackableUnitIds. Evaluates putaway rules for directed routing, falls back to first available bulk bin.

### Events
- `receiving_appointment.created`, `receiving_appointment.checked_in`
- `receiving_task.created`, `receiving_task.started`, `receiving_task.completed`
- `receiving_line.recorded`, `receiving_line.inspected`
- `putaway_task.created` (emitted by CompleteReceiving for each generated putaway task)

### Side Effects
- CompleteReceiving generates PutawayTasks using PutawayRule evaluation
- Appointment status auto-updated on task creation and completion

---

### Domain: Putaway

Directs received goods to their storage location with scan-to-confirm and constraint validation.

### Commands
- `putaway_task.assign` - Assign a putaway task to a worker
- `putaway_task.complete` - Scan-to-confirm completion:
  1. Resolves scanned bin label to actual bin
  2. Detects deviation (scanned != directed) and records it
  3. Validates bin constraints (temperature compatibility, hazmat certification) - warnings returned but don't block
  4. Updates TrackableUnit.currentBinId and currentZoneId (cascades to child units)
  5. Increments bin capacity counters (currentPalletCount, currentWeightKg)
  6. Creates/updates InventoryRecord + immutable InventoryTransaction

### Events
- `putaway_task.assigned`, `putaway_task.started`, `putaway_task.completed`
- `putaway_task.deviation` - Emitted when scanned bin differs from directed target
- `inventory.received` - Emitted when putaway writes to inventory

### Side Effects
- Putaway completion creates the first InventoryRecord for received goods
- Bin capacity denormalization updated on completion

### Putaway Rule Evaluation
- Rules evaluated in priority order (lower = higher priority), first match wins
- Criteria (all nullable = match any): skuPattern (glob), temperatureRequirement, hazmat, customerId, velocityClass, unitType
- Target types: specific_bin, zone (first available), next_available_in_zone (capacity + level preference)
- Consolidation: when enabled, prefers bins where the same SKU already has inventory
- Fallback: first available bin in any bulk_storage zone

---

### Domain: Inventory

Tracks stock levels across warehouse bins with an immutable transaction ledger.

### Commands
- `inventory.adjust` - Manual stock correction with reason code (damage, expired, recount, scrap, found, return). Validates non-negative result.
- `inventory.transfer` - Move stock between bins. Creates/updates InventoryRecord at target, cleans up empty source records. Two-sided transaction ledger entries.

### Events
- `inventory.adjusted` - Includes sku, quantityChange, reasonCode, previousQuantity, newQuantity
- `inventory.transferred` - Includes sku, quantity, sourceBinId, targetBinId

### Side Effects
- Empty InventoryRecords (zero on-hand, zero allocated, zero hold) are deleted on transfer

---

### Domain: Waves & Picking

Groups orders into pick waves and generates walk-sequence-optimized pick tasks.

### Commands
- `wave.create` - Create a wave from selected order IDs. Auto-generates wave number (W-YYYY-MM-DD-NNN). Counts total line items across orders.
- `wave.release` - Release wave: hard-allocates inventory (FIFO) for each order line, creates PickTasks with walk-sequence-sorted PickLines. Discrete strategy = one task per order, batch = one task for all.
- `pick_line.complete` - Complete a pick line: deducts from InventoryRecord (quantityOnHand + quantityAllocated), creates InventoryTransaction (type: pick). Short pick handling: backorder (keep allocated) or cancel_line (release back to available). Auto-completes task and wave when all lines done.

### Events
- `wave.created`, `wave.released`, `wave.completed`, `wave.cancelled`
- `pick_task.created`, `pick_task.assigned`, `pick_task.completed`
- `pick_line.completed`, `pick_line.short`

### Side Effects
- Wave release hard-allocates inventory (increments quantityAllocated, decrements quantityAvailable)
- Pick line completion decrements quantityOnHand and creates pick transaction
- Short pick with cancel_line releases allocation back to available
- Task auto-completes when all lines done; wave auto-completes when all tasks done

---

### Domain: Packing & Loading

Verifies picked items at pack stations, stages for outbound, and loads onto vehicles.

### Commands
- `pack_task.create` - Create a pack task with lines (typically from completed pick). Links to order and pick task.
- `pack_line.complete` - Verify and pack a line item. Auto-starts task, auto-completes when all lines done.
- `staging_assignment.create` - Stage a packed unit at a dock bin. Moves TrackableUnit to staging bin.
- `loading.complete` - Mark staged assignments as loaded onto vehicle. Clears unit bin/zone (on vehicle now).

### Events
- `pack_task.created`, `pack_line.verified`, `pack_task.completed`
- `staging_assignment.created`, `loading.completed`

### Side Effects
- Staging moves TrackableUnit.currentBinId to the staging bin
- Loading clears TrackableUnit.currentBinId and currentZoneId (unit is on vehicle)

---

### Domain: Cycle Counting

Verifies inventory accuracy by comparing physical bin counts against system records.

### Commands
- `cycle_count.create` - Creates a cycle count from current inventory records. Three types: `full` (all bins), `zone` (specific zone), `random_sample` (~20% random selection). Auto-generates count lines with expected quantities.
- `cycle_count.record_line` - Record a counted quantity for a bin/SKU. Auto-starts count on first recording. Detects variances. On final line: auto-completes count, auto-adjusts inventory for all variances (creates InventoryTransaction with `cycle_count` type), updates `lastCountedAt`.

### Events
- `cycle_count.created`, `cycle_count.started`, `cycle_count.completed`
- `cycle_count.line_recorded`
- `cycle_count.variance_detected` - Emitted for each line where counted != expected

### Side Effects
- On completion: all variance lines auto-adjust InventoryRecord.quantityOnHand to match counted quantity
- InventoryTransaction created for each adjustment (transactionType: `cycle_count`, reasonCode: `recount`)
- All counted InventoryRecords get `lastCountedAt` updated

---

### Domain: Replenishment

Auto-replenishes pick face bins from bulk storage when stock drops below configured minimum levels.

### Commands
- `replenishment_rule.create` - Define a rule: SKU + pick face bin + bulk zone + min/max quantities. Validates min < max, bin and zone exist.
- `replenishment.check` - Evaluates all active rules for a location. For each rule where pick face qty < minQuantity: finds bulk inventory, creates PutawayTask (type: `replenishment`). Skips if already being replenished or no bulk stock available.

### Events
- `replenishment_rule.created`, `replenishment_rule.updated`
- `inventory.below_minimum` - Emitted when a pick face drops below its rule's minQuantity
- `replenishment.triggered` - Emitted when a replenishment putaway task is created

### Side Effects
- CheckReplenishment creates PutawayTask records (putawayType: `replenishment`) that appear in the putaway task queue
- Deduplication: skips if a pending/assigned/in-progress replenishment task already exists for the same target bin

---

### Domain: Wave Templates

Automates wave creation from reusable template definitions with grouping rules, cutoff times, and order constraints.

### Commands
- `wave_template.create` - Define a template: name, pick strategy, grouping rules (JSON), cutoff time (HH:MM), min/max orders, priority, cron schedule, auto-release toggle.
- `wave_template.apply` - Run a template: finds eligible orders (excludes already-waved), applies grouping rules, enforces min/max, generates wave number, creates wave with linked orders. Skips gracefully with reason if below minimum or no eligible orders.

### Events
- `wave.created` (with templateId and templateName in payload when template-driven)

### Side Effects
- ApplyWaveTemplate creates Wave + WaveOrder records
- Eligible orders are those not currently in any active (non-completed, non-cancelled) wave
- Cutoff time resolved from template HH:MM to today's datetime

---

### Domain: Cartonization

Recommends the smallest viable shipping carton for items being packed, reducing dim-weight charges.

### Where it fits in the workflow
Cartonization fires at **pack time** - when a PackTask is opened, the system looks up item dimensions, calculates total volume and weight, and recommends the smallest carton from the catalogue that fits. The worker sees the recommendation on the pack task detail page and can accept or override.

### Dimension lookup chain
1. **ProductUom** - Per-SKU master data (lengthMm, widthMm, heightMm, weightGrams). Most reliable - set once, used forever.
2. **OrderLineItem** - Per-order dimensions (length, width, height in cm; weight in kg). Converted to mm/grams. Used when ProductUom is missing.
3. **Neither available** - Recommendation skipped, missing SKUs flagged.

### Algorithm
First-Fit-Decreasing by volume:
1. Sum item volumes (L x W x H x quantity) and weights across all pack lines
2. Score each carton in the catalogue: volumeUtilization = totalItemVolume / cartonVolume, weightUtilization = totalWeight / maxWeight
3. Pick the smallest carton where both volume and weight utilization <= 100% (highest utilization that still fits)
4. Return recommended carton plus up to 3 alternatives

### Scope
- **Applies to**: Parcel/case-level outbound (B2C e-commerce, small shipments)
- **Does not apply to**: Pallet building (FTL/LTL where cases are loaded onto pallets). Palletization is a separate algorithm (layer-building, weight distribution, stacking constraints) for v2+.

### Key files
- `backend/src/services/CartonizationService.ts` - Recommendation engine with dimension lookup
- `backend/src/routes/cartonization.ts` - `POST /api/v1/cartonization/recommend`
- `backend/src/routes/productUom.ts` - ProductUom CRUD (6 endpoints)
- `backend/src/routes/cartonCatalogue.ts` - CartonCatalogue CRUD (4 endpoints)
- `frontend/src/vnext-design/VNextWmsProductUom.tsx` - Product dimensions management
- `frontend/src/vnext-design/VNextWmsCartonCatalogue.tsx` - Carton catalogue management
- `backend/src/__tests__/services/CartonizationService.test.ts` - 7 tests

---

### WMS Key Files
- `backend/src/commands/warehouse/` - All WMS command handlers (23 handlers)
- `backend/src/repositories/WarehouseZoneRepository.ts` - Zone/aisle/bin CRUD
- `backend/src/repositories/ReceivingRepository.ts` - Appointment/task/line CRUD
- `backend/src/services/PutawayRuleEvaluator.ts` - Rule evaluation with consolidation
- `backend/src/routes/warehouseZones.ts` - Zone & bin API (10 endpoints)
- `backend/src/routes/receiving.ts` - Receiving API (8 endpoints)
- `backend/src/routes/putaway.ts` - Putaway API (6 endpoints)
- `backend/src/routes/inventory.ts` - Inventory API (6 endpoints)
- `backend/src/routes/waves.ts` - Wave & pick API (8 endpoints)
- `backend/src/routes/packing.ts` - Packing & loading API (7 endpoints)
- `backend/src/routes/cycleCounts.ts` - Cycle counting API (4 endpoints)
- `backend/src/routes/replenishment.ts` - Replenishment API (5 endpoints)
- `backend/src/routes/waveTemplates.ts` - Wave template API (6 endpoints)
- `backend/src/routes/wmsDashboard.ts` - Dashboard stats API
- `backend/src/__tests__/commands/WarehouseZoneCommands.test.ts` - 14 tests
- `backend/src/__tests__/commands/ReceivingCommands.test.ts` - 10 tests
- `backend/src/__tests__/commands/PutawayCommands.test.ts` - 9 tests
- `backend/src/__tests__/commands/InventoryCommands.test.ts` - 11 tests
- `backend/src/__tests__/commands/WavePickCommands.test.ts` - 9 tests
- `backend/src/__tests__/commands/PackingLoadingCommands.test.ts` - 9 tests
- `backend/src/__tests__/commands/CycleCountCommands.test.ts` - 5 tests
- `backend/src/__tests__/commands/ReplenishmentCommands.test.ts` - 6 tests
- `backend/src/__tests__/commands/WaveTemplateCommands.test.ts` - 6 tests
- `frontend/src/vnext-design/VNextWms*.tsx` - 24 WMS pages
