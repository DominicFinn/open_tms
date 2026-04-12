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

### Smart Event Selection

UpdateIssueCommand emits different events based on what changed:
- Status → `resolved`: emits `issue.resolved`
- Status → anything else: emits `issue.status_changed`
- Assignee changed: emits `issue.assigned`
- Other fields only: emits `issue.updated`

### Side Effects

| Event | Projection | Notification |
|-------|-----------|--------------|
| `issue.created` | IssueReadModel inserted | In-app (if high/critical priority) |
| `issue.assigned` | IssueReadModel.assigneeName updated | In-app to assignee |
| `issue.escalated` | IssueReadModel.escalatedTo set, priority → critical | In-app + email to escalation target |
| `issue.resolved` | IssueReadModel.resolvedAt set | In-app |

### Status Lifecycle

```
open → in_progress → resolved → closed
         ↑
    (escalated: auto-set to in_progress, priority → critical)
```

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

<<<<<<< HEAD
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
3. If not found, creates a new `Location` record
4. Default geofence arrival criteria are created for new locations (via `LocationResolutionService`)

### Workers

| Worker | Queue | Schedule | What It Does |
|--------|-------|----------|-------------|
| SLA Monitor | `sla-monitor` | Every 2 min (configurable via `SLA_MONITOR_CRON`) | Sweeps active evaluations, transitions to warning/breached, auto-creates issues |
