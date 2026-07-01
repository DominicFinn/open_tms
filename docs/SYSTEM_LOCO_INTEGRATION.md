# System Loco (LocoAware) IoT Integration

How Open TMS ingests IoT tracking data from System Loco and binds it to shipments.

## Overview

System Loco delivers **Device Events** (and Device Reports) to a webhook. Each event
carries a device, a location, and sensor data. Open TMS resolves the event to a shipment
via the device assignment, stores telemetry, updates the shipment's live position, and
feeds geofencing / cold-chain monitoring.

We deliberately do **not** consume the System Loco *Shipments* feed — we own the shipment
lifecycle ourselves and only need device telemetry + location.

## Endpoint & ingestion architecture

`POST /api/v1/webhook`

Follows System Loco's recommended pattern — **verify → enqueue → respond fast**:
1. Rate-limit + authenticate (signature or API key).
2. Validate the payload has `device.name`.
3. Write a `WebhookLog` (`status: queued`) and publish to the pg-boss `INBOUND_WEBHOOK`
   queue.
4. Respond **202 Accepted** immediately.
5. `inboundWebhookWorker` drains the queue and does the real work (resolution, telemetry,
   location, geofencing) — scaling independently of the web tier.

If enqueue fails we return 5xx so System Loco retries (it attempts 3× — 1 min then 3 min —
with a 14-day dead-letter queue).

## Authentication

Two paths (checked in this order):
- **HMAC signature (preferred, real System Loco):** `X-LocoAware-Signature` =
  `base64(HMAC-SHA256(rawBody, secret))`, compared timing-safe over the raw bytes. The
  secret lives per-org on the IoT vendor config (`IotVendor.webhookSecret`), set at
  **Settings → IoT Vendors**, falling back to `LOCOAWARE_WEBHOOK_SECRET`. Invalid /
  unverifiable signature → 401. The secret is never returned by the API.
- **API key (existing/manual):** when no signature header is present, the `x-api-key`
  (or `Authorization: Bearer`) key is required.

## Vendor toggle

`IotVendor` is a per-org registry of IoT vendors (System Loco is vendor #1, enabled by
default). When a vendor is **disabled** at Settings → IoT Vendors, its webhooks are logged
as `disabled` and skipped, and the shipment form hides the IoT devices section.

## Device → shipment resolution

`SystemLocoAdapter.resolveAssignment` (unchanged, order matters):
1. Active `DeviceAssignment` for the device id (devices added on the shipment form create
   `Device` + active `DeviceAssignment` — this is the primary path).
2. `device.name` → `Shipment.reference`.
3. `device.name` → `Order.orderNumber`.

Indexes backing fast lookup: `Device.externalId` (`@unique`), `Device.name`,
`DeviceAssignment[deviceId, active]`, `Shipment.reference`, `Order.orderNumber` (`@unique`).

## Idempotency

System Loco may redeliver an event. The worker pre-checks the event `id` against
`DeviceEvent.externalEventId`; if already processed it logs `duplicate` and no-ops.
`SensorReading.sourceReportId` is a unique backstop so concurrent races can't double-write.

## What an event updates (when resolved)

- **Shipment position** — publishes `tracking.location_received`; `ShipmentProjection`
  updates `ShipmentReadModel.currentLat/lng/lastLocationAt` (the map/list dot).
- **Telemetry** — a `SensorReading` (hybrid storage: hot columns + full `rawPayload`):
  temperature, atmosphericPressure, light, battery, impact/tilt, movement, lat/lng,
  `locationType`, `locationAccuracy` (cep). Shown on the shipment **Telemetry** tab.
- **Timeline** — a location-bearing `ShipmentEvent`.
- **Geofencing / arrival** — stop arrival + arrival-criteria evaluation.
- **Cold chain** — temperature readings feed the immutable log + excursion detection.

## Testing locally

Replay a representative event without a live device:

```
npx tsx backend/src/scripts/replay-webhook.ts [--externalId LOCO-123] \
  [--type temperature] [--lat 53.4808 --lon -2.2426] [--temp 6.5]
```

With no `--externalId` it picks a device currently assigned to a shipment. It signs with the
configured secret if present, otherwise uses a throwaway API key.

## Key files

- `backend/src/routes/webhook.ts` — endpoint, signature verification, raw-body capture
- `backend/src/workers/inboundWebhookWorker.ts` — queue worker, vendor gate, dedup, location publish
- `backend/src/integrations/SystemLocoAdapter.ts` — payload parsing, resolution, telemetry
- `backend/src/routes/iotVendors.ts` + `frontend/src/vnext-design/VNextIotVendors.tsx` — vendor toggle + secret
- `backend/src/commands/shipments/reconcileShipmentDevices.ts` — device assignment from the shipment form
- `backend/src/scripts/replay-webhook.ts` — local replay harness
