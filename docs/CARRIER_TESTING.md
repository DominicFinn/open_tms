# Testing Carrier Integrations (sandboxes + ngrok)

How to test carrier tracking end-to-end **without hosting the app** — run the backend
locally, point a carrier **sandbox** at it, and (for webhooks) expose the local endpoint
with **ngrok**. See [`CARRIER_INTEGRATIONS.md`](./CARRIER_INTEGRATIONS.md) for the
architecture and provider list.

> Prefer carriers/aggregators with a real sandbox: **EasyPost** and **AfterShip**
> (aggregators), and **FedEx / UPS / DHL** (direct) all support test environments.

## Prerequisites

- Backend running locally: `cd backend && npm run dev` (listens on `http://localhost:3001`).
- A sandbox/test API credential for the carrier (see per-provider notes below).
- For webhook tests: [ngrok](https://ngrok.com/) (`brew install ngrok` or download).
- An admin JWT for the API calls below (or use the Integrations UI at `/integrations/carrier-tracking`).

## The two flows

Carrier tracking updates arrive **two ways** — test whichever the provider supports:

- **Polling** — we call the carrier API on a schedule (or on demand). No ngrok needed.
- **Webhooks** — the carrier pushes updates to us. Needs a public URL → **ngrok**.

## ngrok setup (for webhooks)

```bash
ngrok http 3001
# → Forwarding  https://<random>.ngrok-free.app -> http://localhost:3001
```

Our inbound webhook endpoint is:

```
POST https://<random>.ngrok-free.app/api/v1/carrier-tracking/webhook/<providerType>
#    providerType = fedex | ups | dhl | easypost | aftership
```

Register **that URL** in the carrier's sandbox dashboard as the webhook/notification
target, and set the **same secret** there and on the integration (`webhookSecret`) so the
HMAC signature verifies.

## Step-by-step (polling)

1. **Create the integration** (or use the setup wizard UI). `credentials` is provider-specific:

   ```bash
   curl -s http://localhost:3001/api/v1/carrier-tracking/integrations \
     -H "Authorization: Bearer $JWT" -H 'Content-Type: application/json' \
     -d '{
       "carrierId": "<a carrier id in your org>",
       "providerType": "easypost",
       "credentials": { "apiKey": "EZTK_your_test_key" },
       "pollingEnabled": true,
       "pollingIntervalSeconds": 900
     }'
   ```

2. **Test the connection:** `POST /api/v1/carrier-tracking/integrations/:id/test`.

3. **Give a shipment a tracking number** so the poller picks it up. The poller selects
   shipments where `carrierId` matches, `status = in_progress`, and `trackingNumber` is set:
   - Assign the carrier + a (test) tracking number on the shipment.
   - Move the shipment to **In Progress** (draft → ready → in_progress).

4. **Trigger a poll** (don't wait for the 5-min cron):
   ```bash
   curl -s -X POST http://localhost:3001/api/v1/carrier-tracking/integrations/<id>/poll \
     -H "Authorization: Bearer $JWT"
   # or a single shipment:
   curl -s -X POST http://localhost:3001/api/v1/shipments/<shipmentId>/carrier-tracking/poll \
     -H "Authorization: Bearer $JWT"
   ```

5. **Verify:** `GET /api/v1/shipments/:id/carrier-tracking` shows the `CarrierTrackingEvent`s;
   a `delivered` event moves the shipment to **complete**; an `exception` sets its exception flag.

## Step-by-step (webhooks)

1. Start ngrok (above). Create the integration with `webhookEnabled: true` and a
   `webhookSecret`.
2. In the carrier sandbox dashboard, add the webhook URL
   `https://<ngrok>/api/v1/carrier-tracking/webhook/<providerType>` and the same secret.
3. Trigger an event in the sandbox (create/advance a test tracker, or use the dashboard's
   "send test webhook").
4. We verify the HMAC signature, normalise the event, and update the shipment. Check
   `GET /api/v1/shipments/:id/carrier-tracking` and the shipment status.

## Per-provider sandbox notes

### EasyPost (aggregator — recommended first)
- Free account → **Test API key** (`EZTK…`) at easypost.com/account. The base URL is the
  same; the key selects test mode.
- **Test tracking codes** simulate a lifecycle when used with a test key — EasyPost
  documents a set (e.g. `EZ1000000001` = pre-transit … `EZ4000000004` = delivered). See
  https://docs.easypost.com/docs/trackers#test-trackers. Use one as the shipment's
  `trackingNumber`.
- Webhooks: add the ngrok URL under **Webhooks** in the test dashboard with a secret;
  creating/advancing a test tracker fires `tracker.updated` events (`X-Hmac-Signature`).

### AfterShip (aggregator)
- Free account → API key at admin.aftership.com/settings/api-keys.
- Create a tracking via our poll flow (we call `POST /trackings`); the dashboard's
  **"Send test"** webhook posts a sample `tracking_update` to the ngrok URL
  (`aftership-hmac-sha256`, base64). 900+ carriers supported.

### FedEx (direct)
- developer.fedex.com → sandbox project → OAuth `clientId`/`clientSecret`. Set the
  integration's `credentials` to `{ clientId, clientSecret, sandbox: true }`.
- Use FedEx's documented **sandbox test tracking numbers** for each status.

### UPS (direct)
- developer.ups.com → sandbox app → OAuth `clientId`/`clientSecret` (`{ ..., sandbox: true }`),
  which routes to `wwwcie.ups.com`. Use UPS CIE test tracking numbers.

### DHL (direct)
- developer.dhl.com → API key. Set `credentials` to `{ apiKey, sandbox: true }` → routes
  to `api-test.dhl.com`.

## Tips

- Watch the backend logs while polling — providers log HTTP status and rate-limit hits.
- `POST /api/v1/carrier-tracking/integrations/:id/test` is the quickest credential check.
- Rate limits are enforced per integration (`rateLimitCallsToday`); the aggregators are
  generous, the direct carriers less so (DHL 250/day).
- If a poll returns "no shipments," confirm the shipment is **In Progress**, has the
  matching `carrierId`, and a `trackingNumber`.
