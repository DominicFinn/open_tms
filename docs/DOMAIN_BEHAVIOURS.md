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

### Commands

| Command | Trigger | Events Emitted |
|---------|---------|----------------|
| `CreateOrderCommand` | `POST /api/v1/orders` | `order.created` |
| `UpdateOrderCommand` | `PUT /api/v1/orders/:id` | `order.updated`, `order.status_changed` (if status changes) |
| `ArchiveOrderCommand` | `DELETE /api/v1/orders/:id` | `order.archived` |

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

### Commands

| Command | Trigger | Events Emitted |
|---------|---------|----------------|
| `CreateLocationCommand` | `POST /api/v1/locations` | `location.created` |
| `UpdateLocationCommand` | `PUT /api/v1/locations/:id` | `location.updated` |

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
