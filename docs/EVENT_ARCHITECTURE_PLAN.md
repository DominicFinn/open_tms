# Event-Driven Architecture Plan for Open TMS

## Overview

This document describes the event-driven architecture that underpins Phase 4 (Notifications, Triage, Live Tracking) and feeds into all later phases (IoT, AI Agents, Route Intelligence). The core idea: every meaningful state change in the system emits a **domain event**. Event handlers subscribe to these events and take action — send emails, create notifications, fire webhooks, auto-create triage issues, write audit logs.

## 1. Domain Event Model

### Event Envelope

Every domain event is wrapped in a standardized envelope:

```typescript
export interface DomainEvent<T = unknown> {
  id: string;                    // UUID v4
  type: string;                  // "shipment.status_changed"
  timestamp: string;             // ISO-8601
  orgId: string;                 // Multi-tenancy scoping
  actorId: string | null;        // User or system that caused the event
  entityType: string;            // "shipment", "order", etc.
  entityId: string;              // Primary key of the entity
  payload: T;                    // Event-specific data
  metadata: {
    correlationId: string;       // Traces a chain of events to a single user action
    causationId?: string;        // The event that directly caused this one
    source: string;              // "api", "worker", "webhook", "system"
    schemaVersion: number;       // For forward-compatible evolution
  };
}
```

### Event Catalog

**Shipments:**
- `shipment.created`, `shipment.updated`, `shipment.status_changed`
- `shipment.carrier_assigned`, `shipment.delivered`, `shipment.exception`
- `shipment.stop_arrived`, `shipment.stop_completed`

**Orders:**
- `order.created`, `order.updated`, `order.status_changed`
- `order.delivery_status_changed`, `order.assigned_to_shipment`
- `order.exception`, `order.exception_resolved`, `order.delivered`

**Carriers/Customers:**
- `carrier.created`, `carrier.updated`, `carrier.archived`
- `customer.created`, `customer.updated`, `customer.archived`

**Triage (Phase 4):**
- `triage.issue_created`, `triage.issue_assigned`, `triage.issue_status_changed`
- `triage.issue_escalated`, `triage.issue_commented`

**Tracking:**
- `tracking.location_received`, `tracking.geofence_entered`, `tracking.eta_updated`

**Integration:**
- `integration.outbound_sent`, `integration.outbound_failed`, `integration.webhook_received`

## 2. Event Bus Interface

### IEventBus

```typescript
export interface IEventBus {
  /** Publish a domain event. Persists to event store, fans out to handler queues. */
  publish<T>(event: DomainEvent<T>): Promise<void>;

  /** Publish multiple events atomically. */
  publishBatch(events: DomainEvent[]): Promise<void>;

  /** Register a named handler for event type patterns. Supports wildcards: "shipment.*", "*" */
  subscribe(
    handlerName: string,
    eventPatterns: string[],
    handler: EventHandler,
    options?: SubscribeOptions
  ): Promise<void>;

  start(): Promise<void>;
  stop(): Promise<void>;
}

export interface SubscribeOptions {
  concurrency?: number;      // pg-boss concurrency for this handler's queue
  priority?: number;         // Higher = processed first
  retryLimit?: number;       // Default: 3
  expireInSeconds?: number;  // Default: 900
}
```

### How It Works (Fan-Out via pg-boss)

1. `publish()` writes the event to a `DomainEventLog` table (immutable event store for audit/replay).
2. The bus checks which handlers match the event type using wildcard pattern matching.
3. For each match, it enqueues the event into that handler's dedicated pg-boss queue (`evt.audit`, `evt.notification.email`, etc.).

Each handler queue is independent — a slow email handler doesn't block the audit handler. pg-boss provides competing consumer semantics (`SELECT ... FOR UPDATE SKIP LOCKED`), so multiple worker instances safely share the same queues.

### Event Store

```prisma
model DomainEventLog {
  id          String   @id
  type        String
  timestamp   String
  orgId       String
  actorId     String?
  entityType  String
  entityId    String
  payload     Json
  metadata    Json
  createdAt   DateTime @default(now())

  @@index([type])
  @@index([entityType, entityId])
  @@index([orgId])
  @@index([timestamp])
}
```

Enables: audit queries per entity, event replay for backfilling new handlers, debugging.

## 3. Event Handlers

### Handler Interface

```typescript
export interface IEventHandler {
  readonly name: string;            // Queue suffix: evt.<name>
  readonly eventPatterns: string[];  // What events to subscribe to
  readonly options?: SubscribeOptions;
  handle(event: DomainEvent): Promise<void>;
}
```

### Initial Handlers

| Handler | Queue | Subscribes To | Priority | Purpose |
|---------|-------|---------------|----------|---------|
| AuditHandler | `evt.audit` | `*` | 10 | Compliance-critical immutable audit log |
| WebhookHandler | `evt.webhook` | `shipment.*`, `order.*` | 8 | Fires outbound webhooks per org rules |
| TriageHandler | `evt.triage` | `*.exception`, `tracking.eta_updated` | 7 | Auto-creates triage issues |
| InAppNotificationHandler | `evt.notification.inapp` | status changes, exceptions, triage | 5 | Bell icon notifications |
| EmailHandler | `evt.notification.email` | same as in-app | 3 | Email with deduplication |

## 4. Resource Isolation & Worker Deployment Strategy

### The Problem

The current `index.ts` runs the API server AND all queue workers in the same process. Adding 5+ event handlers to this process would starve the API of CPU, memory, and database connections.

### The Solution: Separate Worker Process

Create `/backend/src/worker.ts` — a standalone entrypoint that:
- Does NOT start Fastify or listen on any HTTP port
- Creates its own PrismaClient with its own connection pool
- Registers all event handlers and existing operational workers
- Runs in a separate Docker container

The API server (`index.ts`) becomes **publish-only** — it calls `eventBus.publish()` but never processes events. Zero background work competing for API resources.

```
                    ┌──────────────────┐
                    │   API Server     │
                    │   (index.ts)     │
                    │                  │
  HTTP ────────────>│  Fastify + REST  │
                    │  Pool: 10 conn   │
                    │                  │
                    │  eventBus.publish │──────┐
                    └──────────────────┘      │
                                              ▼
                                     ┌──────────────┐
                                     │  PostgreSQL   │
                                     │  + pg-boss    │
                                     │  queues       │
                                     └──────┬───────┘
                                            │
                         ┌──────────────────┼──────────────────┐
                         │                  │                  │
                         ▼                  ▼                  ▼
                  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
                  │  Worker 1    │  │  Worker 2    │  │  Worker 3    │
                  │ (worker.ts)  │  │ (worker.ts)  │  │ (worker.ts)  │
                  │ Pool: 5 conn │  │ Pool: 5 conn │  │ Pool: 5 conn │
                  │              │  │              │  │              │
                  │ evt.audit    │  │ evt.email    │  │ evt.webhook  │
                  │ evt.inapp    │  │ evt.triage   │  │ outbound.*   │
                  └──────────────┘  └──────────────┘  └──────────────┘
```

### Worker Modes

The `WORKER_MODE` environment variable controls what each container processes:

- `all` — runs all event handlers + existing operational workers (simple deployments)
- `events` — only event handlers
- `integrations` — only the existing outbound carrier/tracking/webhook workers

This enables heterogeneous scaling:

```bash
# Simple: 1 API + 1 worker doing everything
docker compose up

# Scaled: 1 API + 2 event workers + 1 integration worker
docker compose up --scale worker-events=2 --scale worker-integrations=1
```

### Docker Compose

```yaml
worker:
  build: ./backend
  environment:
    DATABASE_URL: postgres://tms:tms@db:5432/tms?connection_limit=5
    WORKER_MODE: all
  command: ["node", "dist/worker.js"]
  deploy:
    resources:
      limits:
        memory: 512M
        cpus: '0.5'
  restart: unless-stopped
  depends_on:
    - db
```

### Connection Pool Math

PostgreSQL default limit: 100 connections.

| Component | Instances | Pool Size | Total |
|-----------|-----------|-----------|-------|
| API server (Prisma) | 1 | 10 | 10 |
| API server (pg-boss publish) | 1 | 3 | 3 |
| Worker container | 3 | 5 + 2 (pg-boss) | 21 |
| pg-boss maintenance | 1 | 2 | 2 |
| **Total** | | | **36** |

Plenty of headroom. For larger deployments, add PgBouncer as a connection multiplexer.

### Backpressure Controls

- **pg-boss `localConcurrency`**: Limits how many jobs a single worker processes simultaneously. Audit = 5 (fast writes), Email = 1 (slow network calls).
- **`expireInSeconds`**: Jobs that take too long are expired and retried. Prevents stuck jobs from blocking.
- **`retryLimit` + `retryBackoff`**: Exponential backoff on failure.
- **pg-boss `singletonKey`**: Deduplication — prevents duplicate events from being enqueued within a time window.
- **Graceful shutdown**: Workers listen for SIGTERM, finish in-flight jobs, then exit.

### Comparison with Serverless

| Property | Lambda/Functions | Docker Workers |
|----------|-----------------|----------------|
| Process isolation | Each invocation sandboxed | Each container isolated |
| Independent scaling | Auto-scales per function | `--scale worker=N` |
| Resource bounding | Memory/timeout limits | Docker resource limits |
| No impact on API | Separate infrastructure | Separate container + pool |
| Concurrency control | Reserved concurrency | pg-boss `localConcurrency` |
| Cold start | Yes (can be slow) | No (container stays warm) |
| Cost at idle | Zero | Minimal (idle container) |

**pg-boss + Docker containers gives you the fan-out and isolation of serverless, backed by PostgreSQL you already have, with zero additional infrastructure.**

### Future Migration Path

1. **Now**: Docker Compose with worker service(s)
2. **Later**: Kubernetes with HPA autoscaling per worker deployment
3. **Cloud**: Cloud Run / ECS Fargate with scale-to-zero
4. **Serverless**: Swap `PgBossEventBus` for `CloudEventBus` (SNS/EventBridge/Pub-Sub). The `IEventBus` interface makes this a provider swap, not a rewrite.

## 5. Subscription & Rules System

### Models

```prisma
model EventSubscription {
  id           String   @id @default(uuid())
  orgId        String
  name         String              // "Email on shipment exceptions"
  active       Boolean  @default(true)
  eventPattern String              // "shipment.exception", "order.*"
  handlerType  String              // "email", "inapp", "webhook"
  config       Json                // Handler-specific: template, recipients, URL, etc.
  entityFilter Json?               // Optional: filter by entity properties
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  @@index([orgId, active])
  @@index([eventPattern])
}

model UserNotificationPreference {
  id            String   @id @default(uuid())
  userId        String
  eventCategory String              // "shipment_updates", "exceptions", "triage"
  emailEnabled  Boolean  @default(true)
  inAppEnabled  Boolean  @default(true)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  @@unique([userId, eventCategory])
}
```

### Default Rules (seeded on org creation)

- `shipment.exception` -> email dispatchers + in-app notification
- `order.exception` -> email dispatchers + in-app notification
- `order.delivered` -> in-app notification to all users
- `shipment.status_changed` -> in-app notification
- `*` -> audit log (always on, not configurable)

### Admin UI

**Admin > Event Rules**: Table of rules, add/edit dialog, toggle active, test button.
**User Settings > Notifications**: Matrix of event categories vs. channels with checkboxes.

## 6. Notification Infrastructure

### Notification Model (In-App)

```prisma
model Notification {
  id          String   @id @default(uuid())
  userId      String
  orgId       String
  title       String
  body        String
  category    String              // "shipment_update", "exception", "triage"
  severity    String   @default("info")  // "info", "warning", "error", "success"
  entityType  String?
  entityId    String?
  actionUrl   String?             // Deep link: "/shipments/abc-123"
  eventId     String?
  eventType   String?
  read        Boolean  @default(false)
  readAt      DateTime?
  createdAt   DateTime @default(now())

  @@index([userId, read])
  @@index([userId, createdAt])
}
```

### Email Service

```typescript
export interface IEmailService {
  send(message: EmailMessage): Promise<EmailResult>;
  sendBatch(messages: EmailMessage[]): Promise<EmailResult[]>;
}
```

Pluggable providers via DI: `SmtpEmailService` (nodemailer, default), `SendGridEmailService`, `SesEmailService`, `ConsoleEmailService` (dev). Selected by `EMAIL_PROVIDER` env var.

### Email Templates

Handlebars templates stored as `DocumentTemplate` records with `documentType = 'email'`. Base layout inherits branding from the Theme system (org logo + primary color).

### Deduplication

Email handler uses pg-boss `singletonKey` (`eventType:entityId`) with a 5-minute window to prevent rapid status toggles from flooding inboxes.

## 7. How This Feeds Into Phase 4

- **Triage Centre**: `TriageHandler` auto-creates issues from exception events. Issues themselves emit `triage.issue_created`, triggering notifications.
- **Live Tracking**: Inbound webhook worker publishes `tracking.location_received`. ETA recalculation handler subscribes, updates ETA, emits `tracking.eta_updated` on breach -> TriageHandler creates issue.
- **Control Tower**: A future SSE/WebSocket endpoint streams events to the browser for a real-time dashboard. Just another handler.

## 8. Implementation Order

### Phase A: Foundation (first)
1. `DomainEvent` types + `DomainEventLog` Prisma model + migration
2. `IEventBus` interface + `PgBossEventBus` implementation
3. DI tokens + registry for event bus
4. `worker.ts` entrypoint — move existing workers out of `index.ts`
5. Worker service in `docker-compose.yml`
6. `AuditHandler` as first handler (subscribes to `*`)
7. Instrument 2-3 service methods to publish events (shipment create, status change)

### Phase B: Notifications
8. `Notification` model + API routes
9. `InAppNotificationHandler`
10. `IEmailService` + `SmtpEmailService` + `ConsoleEmailService`
11. `EmailHandler` with deduplication
12. Email templates (base layout + shipment status + exception)
13. Frontend: bell icon, notification dropdown, preferences page

### Phase C: Subscriptions & Rules
14. `EventSubscription` + `UserNotificationPreference` models
15. Update handlers to check subscription rules
16. Admin UI: Event Rules page
17. User Settings: Notification preferences page

### Phase D: Webhook & Triage Integration
18. `WebhookHandler` with delivery logging
19. `TriageHandler` for auto-creating issues from exceptions
20. Instrument remaining service methods to publish events
