# Queue-Based Integration System

Open TMS uses a queue-based architecture for all integration processing. This ensures reliable, scalable handling of outbound carrier notifications, tracking platform registrations, and inbound webhook events.

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Queue Design](#queue-design)
- [Queues](#queues)
- [Outbound Carrier Integrations](#outbound-carrier-integrations)
- [Outbound Tracking Integrations](#outbound-tracking-integrations)
- [Inbound Webhook Processing](#inbound-webhook-processing)
- [Authentication](#authentication)
- [Adapter Interfaces](#adapter-interfaces)
- [Cloud-Native Queue Alternatives](#cloud-native-queue-alternatives)
- [Configuration](#configuration)
- [Troubleshooting](#troubleshooting)

## Architecture Overview

```
                     +-----------------+
                     |   Fastify API   |
                     +--------+--------+
                              |
              publish events to queues
                              |
              +---------------+---------------+
              |               |               |
     +--------v------+ +-----v-------+ +-----v--------+
     | outbound.     | | outbound.   | | inbound.     |
     | carrier       | | tracking    | | webhook      |
     +--------+------+ +-----+-------+ +-----+--------+
              |               |               |
     +--------v------+ +-----v-------+ +-----v--------+
     | Carrier       | | Tracking    | | Webhook      |
     | Worker        | | Worker      | | Worker       |
     +--------+------+ +-----+-------+ +-----+--------+
              |               |               |
       select adapter    call adapter    process event
     (EDI 856 / JSON)   (HTTP POST)    (match shipment)
              |               |               |
     +--------v------+ +-----v-------+ +-----v--------+
     | DHL, FedEx,   | | Project44,  | | Create event,|
     | UPS, etc.     | | SystemLoco  | | geofence chk |
     +--------------+  +-------------+ +--------------+
```

## Queue Design

### Why Queues?

Direct HTTP calls from API request handlers create several problems at scale:

1. **Latency** - Outbound HTTP calls add seconds to API response times
2. **Reliability** - If a carrier API is down, the shipment creation fails
3. **Throughput** - 1000 shipments/hour with 3 integrations each = 3000 synchronous HTTP calls
4. **Retry** - No automatic retry of failed external calls

Queue-based processing solves all of these:

- API endpoints return immediately (201 Created / 202 Accepted)
- Workers process messages asynchronously with automatic retries
- Failed messages get exponential backoff (30s, 60s, 120s, 240s...)
- Each queue processes independently - a carrier API outage doesn't block tracking

### Default Engine: pg-boss

We use [pg-boss](https://github.com/timgit/pg-boss) as the default queue engine because:

- **Zero new infrastructure** - Uses your existing PostgreSQL database
- **Transactional safety** - Jobs are stored in PostgreSQL with ACID guarantees
- **Built-in retry** - Configurable retry limits, backoff, and dead-letter queues
- **Monitoring** - Jobs are queryable SQL rows, not ephemeral messages
- **Simplicity** - Single `npm install`, no Redis/RabbitMQ/Kafka to manage

pg-boss creates its own tables (`pgboss.job`, `pgboss.queue`, etc.) in a `pgboss` schema. Jobs are just rows — you can query them directly for debugging.

### Design Decision: In-Process Workers

Workers run inside the Fastify backend process (not as separate services). This was chosen because:

- **Simpler deployment** - One container, not four
- **Lower resource usage** - No inter-process communication overhead
- **Good enough** - pg-boss handles concurrency within a single process
- **Easy to split later** - Workers are standalone functions, easily extractable

If you need to scale workers independently, extract them into a separate entry point that imports the same worker functions.

## Queues

| Queue Name | Purpose | Triggered By | Worker |
|---|---|---|---|
| `outbound.carrier` | Send shipment data to carrier systems | Shipment created/updated | `outboundCarrierWorker` |
| `outbound.tracking` | Register shipments with tracking platforms | Shipment created/updated | `outboundTrackingWorker` |
| `inbound.webhook` | Process incoming IoT/tracking webhooks | POST /api/v1/webhook | `inboundWebhookWorker` |

### Queue Configuration

Each queue is created with these defaults:

| Setting | Value | Description |
|---|---|---|
| `retryLimit` | 3 | Max retry attempts before failing |
| `retryBackoff` | true | Exponential backoff between retries |
| `retryDelay` | 30s | Initial delay before first retry |
| `expireInSeconds` | 900 | Job timeout (15 minutes) |
| `deleteAfterSeconds` | 604800 | Clean up completed jobs after 7 days |

## Outbound Carrier Integrations

When a shipment is created, the API publishes a `ShipmentEvent` to the `outbound.carrier` queue. The carrier worker:

1. Loads the full shipment with customer, origin, destination, carrier, and orders
2. Finds all active `OutboundIntegration` records where `integrationType = 'carrier'`
3. Filters by `carrierMatch` pattern (e.g., `FedEx*` only matches FedEx shipments)
4. Selects the appropriate adapter based on `payloadFormat`:
   - `edi_856` — Generates X12 856 (Advance Ship Notice) via `GenericEdiCarrierAdapter`
   - `json` — Sends structured JSON payload via `GenericJsonCarrierAdapter`
5. Sends the payload to the integration URL with configured authentication
6. Logs the result to `OutboundIntegrationLog`

### Carrier Match Patterns

The `carrierMatch` field on an OutboundIntegration supports glob-style matching:

| Pattern | Matches |
|---|---|
| _(blank)_ | All carriers (and shipments with no carrier) |
| `FedEx*` | FedEx, FedEx Ground, FedEx Express |
| `DHL` | Exact match: DHL only |
| `UPS*` | UPS, UPS Ground, UPS Next Day |

### Payload Formats

**EDI 856 (X12 ASN)**

Generates a standard X12 856 Advance Ship Notice document. Uses `senderId`, `receiverId`, and `interchangeControlNumber` from the integration config for ISA envelope fields.

**JSON**

Sends a structured JSON payload:

```json
{
  "event": "shipment.created",
  "shipment": {
    "id": "uuid",
    "reference": "SHIP-001",
    "customer": { "name": "Acme Corp" },
    "origin": { "city": "Chicago", "state": "IL", ... },
    "destination": { "city": "New York", "state": "NY", ... },
    "carrier": { "name": "FedEx" },
    "orders": [
      { "orderNumber": "PO-001", "items": [...] }
    ]
  },
  "timestamp": "2025-01-01T00:00:00Z"
}
```

## Outbound Tracking Integrations

When a shipment is created, a `ShipmentEvent` is also published to the `outbound.tracking` queue. The tracking worker:

1. Loads the shipment with origin, destination, carrier, and customer
2. Finds active integrations where `integrationType = 'tracking'`
3. Calls `registerShipment()` on the `GenericWebhookTrackingAdapter`
4. Sends a registration payload to the tracking platform (e.g., Project44, System Loco)

This registers the shipment for tracking — the tracking platform then sends updates back via the inbound webhook.

## Inbound Webhook Processing

The `POST /api/v1/webhook` endpoint:

1. Authenticates the request (API key required)
2. Validates the payload structure
3. Creates a `WebhookLog` entry with status `queued`
4. Publishes a `WebhookEvent` to the `inbound.webhook` queue
5. Returns **202 Accepted** immediately

The webhook worker then:

1. Extracts `device.name` from the payload
2. Matches it to a shipment reference
3. Creates a `ShipmentEvent` with location data (lat/lng)
4. Triggers geofence checks for order delivery status updates
5. Updates the `WebhookLog` with the processing result

This means webhook endpoints never block on shipment lookups or geofence calculations — important when receiving high-frequency IoT data.

## Authentication

All outbound integrations support four authentication methods:

| Type | Header | Value Format |
|---|---|---|
| `none` | _(none)_ | No authentication |
| `basic` | `Authorization: Basic <base64>` | `username:password` (base64-encoded) |
| `bearer` | `Authorization: Bearer <token>` | Token string |
| `api_key` | Custom header (e.g., `X-API-Key`) | Key string |

Authentication is configured per-integration. The shared `buildAuthHeaders()` function in `backend/src/integrations/authHelpers.ts` constructs headers for all adapter types.

For inbound webhooks, authentication uses the API Key system (see [Customer API Guide](./CUSTOMER_API_GUIDE.md)).

## Adapter Interfaces

The system is designed around interfaces that allow swapping implementations without changing worker logic.

### IQueueAdapter

```typescript
interface IQueueAdapter {
  start(): Promise<void>;
  stop(): Promise<void>;
  publish(queueName: string, message: QueueMessage): Promise<string>;
  subscribe(queueName: string, handler: (msg: QueueMessage) => Promise<void>): Promise<void>;
}
```

Default implementation: `PgBossQueueAdapter`

### ICarrierAdapter

```typescript
interface ICarrierAdapter {
  readonly carrierType: string;
  sendShipment(shipment: CarrierShipmentData, config: CarrierIntegrationConfig): Promise<CarrierResponse>;
}
```

Implementations: `GenericEdiCarrierAdapter`, `GenericJsonCarrierAdapter`

### ITrackingAdapter

```typescript
interface ITrackingAdapter {
  readonly providerType: string;
  registerShipment(shipment: TrackingShipmentData, config: TrackingIntegrationConfig): Promise<TrackingResponse>;
}
```

Implementation: `GenericWebhookTrackingAdapter`

## Cloud-Native Queue Alternatives

The `IQueueAdapter` interface is designed to be swapped for cloud-native alternatives. Here's how to implement each:

### AWS SQS

```typescript
// backend/src/queue/SqsQueueAdapter.ts
import { SQSClient, SendMessageCommand, ReceiveMessageCommand, DeleteMessageCommand } from '@aws-sdk/client-sqs';

export class SqsQueueAdapter implements IQueueAdapter {
  private client: SQSClient;
  private queueUrls: Map<string, string>; // queue name -> SQS URL

  constructor(region: string, queueUrls: Record<string, string>) {
    this.client = new SQSClient({ region });
    this.queueUrls = new Map(Object.entries(queueUrls));
  }

  async publish(queueName: string, message: QueueMessage): Promise<string> {
    const result = await this.client.send(new SendMessageCommand({
      QueueUrl: this.queueUrls.get(queueName),
      MessageBody: JSON.stringify(message),
      MessageGroupId: message.payload.shipmentId, // FIFO ordering
    }));
    return result.MessageId!;
  }

  async subscribe(queueName: string, handler: (msg: QueueMessage) => Promise<void>): Promise<void> {
    // Long-poll loop with ReceiveMessageCommand
    // Delete message after successful handler execution
  }
}
```

**SQS Configuration:**
- Use FIFO queues (`.fifo` suffix) for ordered processing
- Set `VisibilityTimeout` to 900s (matches our expireInSeconds)
- Configure dead-letter queue with `maxReceiveCount: 3`
- Use `MessageGroupId` = shipmentId for per-shipment ordering

### Google Cloud Pub/Sub

```typescript
// backend/src/queue/PubSubQueueAdapter.ts
import { PubSub } from '@google-cloud/pubsub';

export class PubSubQueueAdapter implements IQueueAdapter {
  private pubsub: PubSub;

  constructor(projectId: string) {
    this.pubsub = new PubSub({ projectId });
  }

  async publish(queueName: string, message: QueueMessage): Promise<string> {
    const topic = this.pubsub.topic(queueName);
    const messageId = await topic.publishMessage({
      data: Buffer.from(JSON.stringify(message)),
      attributes: { type: message.type },
    });
    return messageId;
  }

  async subscribe(queueName: string, handler: (msg: QueueMessage) => Promise<void>): Promise<void> {
    const subscription = this.pubsub.subscription(`${queueName}-sub`);
    subscription.on('message', async (msg) => {
      try {
        await handler(JSON.parse(msg.data.toString()));
        msg.ack();
      } catch {
        msg.nack(); // Triggers retry via Pub/Sub dead-letter policy
      }
    });
  }
}
```

**Pub/Sub Configuration:**
- Create topics: `outbound.carrier`, `outbound.tracking`, `inbound.webhook`
- Create subscriptions with `ackDeadlineSeconds: 600`
- Set retry policy: min backoff 30s, max backoff 600s
- Configure dead-letter topic with `maxDeliveryAttempts: 3`

### Azure Service Bus

```typescript
// backend/src/queue/ServiceBusQueueAdapter.ts
import { ServiceBusClient } from '@azure/service-bus';

export class ServiceBusQueueAdapter implements IQueueAdapter {
  private client: ServiceBusClient;

  constructor(connectionString: string) {
    this.client = new ServiceBusClient(connectionString);
  }

  async publish(queueName: string, message: QueueMessage): Promise<string> {
    const sender = this.client.createSender(queueName);
    await sender.sendMessages({
      body: message,
      messageId: message.id || crypto.randomUUID(),
      sessionId: message.payload.shipmentId, // Session-based ordering
    });
    return message.id!;
  }

  async subscribe(queueName: string, handler: (msg: QueueMessage) => Promise<void>): Promise<void> {
    const receiver = this.client.createReceiver(queueName);
    receiver.subscribe({
      processMessage: async (msg) => {
        await handler(msg.body as QueueMessage);
        await receiver.completeMessage(msg);
      },
      processError: async (err) => {
        console.error(`[ServiceBus] Error on ${queueName}:`, err.error);
      },
    });
  }
}
```

**Service Bus Configuration:**
- Create queues with `maxDeliveryCount: 3`
- Set `lockDuration: PT15M` (15 minutes, matches expireInSeconds)
- Enable dead-letter queue (automatic)
- Use sessions if per-shipment ordering is required

### Switching Queue Adapters

To swap the queue engine, update `backend/src/di/registry.ts`:

```typescript
// Option 1: pg-boss (default - no extra infrastructure)
container.singleton(TOKENS.IQueueAdapter).toFactory(() => {
  return new PgBossQueueAdapter(process.env.DATABASE_URL || '');
});

// Option 2: AWS SQS
container.singleton(TOKENS.IQueueAdapter).toFactory(() => {
  return new SqsQueueAdapter(process.env.AWS_REGION!, {
    'outbound.carrier': process.env.SQS_CARRIER_QUEUE_URL!,
    'outbound.tracking': process.env.SQS_TRACKING_QUEUE_URL!,
    'inbound.webhook': process.env.SQS_WEBHOOK_QUEUE_URL!,
  });
});

// Option 3: Google Cloud Pub/Sub
container.singleton(TOKENS.IQueueAdapter).toFactory(() => {
  return new PubSubQueueAdapter(process.env.GCP_PROJECT_ID!);
});

// Option 4: Azure Service Bus
container.singleton(TOKENS.IQueueAdapter).toFactory(() => {
  return new ServiceBusQueueAdapter(process.env.AZURE_SERVICEBUS_CONNECTION!);
});
```

### Comparison

| Feature | pg-boss | AWS SQS | GCP Pub/Sub | Azure Service Bus |
|---|---|---|---|---|
| Infrastructure | None (PostgreSQL) | AWS account | GCP account | Azure account |
| Ordering | Per-queue | FIFO queues | Ordering keys | Sessions |
| Max message size | ~1GB (JSON column) | 256KB | 10MB | 256KB (Standard) |
| Retry | Built-in | Dead-letter queue | Retry policy | maxDeliveryCount |
| Monitoring | SQL queries | CloudWatch | Cloud Monitoring | Azure Monitor |
| Cost | Free (uses your DB) | Per-request | Per-message | Per-operation |
| Best for | Single-node, dev, small-medium | AWS-native deployments | GCP-native deployments | Azure-native deployments |

### When to Switch from pg-boss

pg-boss is the right choice when:
- You're running a single backend instance
- Message volume is under ~10,000/hour
- You want zero additional infrastructure
- You're in development or small-medium production

Consider switching to a cloud-native queue when:
- You need multi-region message routing
- Message volume exceeds what PostgreSQL should handle
- You need sub-second message delivery guarantees
- You're already running on a cloud platform with managed queues
- You need to fan out to multiple independent consumers

## Configuration

### Environment Variables

| Variable | Default | Description |
|---|---|---|
| `DATABASE_URL` | _(required)_ | PostgreSQL connection string (used by pg-boss) |

For cloud queue adapters, additional variables are needed:

| Variable | Queue Engine | Description |
|---|---|---|
| `AWS_REGION` | SQS | AWS region |
| `SQS_CARRIER_QUEUE_URL` | SQS | SQS queue URL for carrier messages |
| `SQS_TRACKING_QUEUE_URL` | SQS | SQS queue URL for tracking messages |
| `SQS_WEBHOOK_QUEUE_URL` | SQS | SQS queue URL for webhook messages |
| `GCP_PROJECT_ID` | Pub/Sub | Google Cloud project ID |
| `AZURE_SERVICEBUS_CONNECTION` | Service Bus | Azure Service Bus connection string |

## Troubleshooting

### Queue Not Starting

If you see "Queue adapter failed to start, running without queue processing":
- Check that `DATABASE_URL` is set and the database is reachable
- pg-boss needs CREATE SCHEMA permissions for the `pgboss` schema
- Ensure PostgreSQL version is 12+ (pg-boss requirement)

The backend will continue to function without queue processing — API endpoints still work, but outbound integrations and async webhook processing will be disabled.

### Messages Stuck in Queue

Query pg-boss tables directly:

```sql
-- Check pending jobs
SELECT name, state, createdon, retrylimit, retrycount
FROM pgboss.job
WHERE state = 'created'
ORDER BY createdon DESC;

-- Check failed jobs
SELECT name, state, output, completedon
FROM pgboss.job
WHERE state = 'failed'
ORDER BY completedon DESC;
```

### Outbound Integration Not Firing

1. Check the integration is `active: true`
2. Verify `integrationType` matches the queue (`carrier` or `tracking`)
3. Check `carrierMatch` pattern — blank matches all, `FedEx*` only matches FedEx carriers
4. Look at `OutboundIntegrationLog` for error details
5. Check pg-boss job state for the queue
