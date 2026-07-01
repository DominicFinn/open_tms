# Carrier Integrations

How Open TMS integrates with carriers for **shipment tracking**, the carrier landscape,
and how to choose which to add. Testing (sandboxes + ngrok) is in
[`CARRIER_TESTING.md`](./CARRIER_TESTING.md).

## Scope

Today the carrier integration is **tracking only** — pulling status, location, ETA, and
proof-of-delivery, either by polling or webhooks, and bridging carrier milestones to the
shipment lifecycle (`draft → ready → in_progress → complete`). Rating, label/BOL
generation, and booking/manifest are **not** carrier-API-backed yet (there is a separate
lane-based `RatingService`). Adding those is a larger, separate effort (a new provider
interface) — see _Future_ below.

## Architecture

Provider-agnostic. Each carrier/aggregator implements `ICarrierTrackingProvider`
(`backend/src/services/carrierTracking/ICarrierTrackingProvider.ts`):

```
authenticate(credentials)                     // OAuth2 client-credentials or API key
pollTracking(request) -> TrackingPollResult[] // batch or single tracking lookups
parseWebhook?(payload, headers)               // normalise inbound webhook events
verifyWebhookSignature?(payload, headers, secret)  // HMAC verification
```

- A `CarrierTrackingIntegration` row (per carrier, per org) holds `providerType`,
  `credentials`, webhook + polling config, rate limits, and status.
- Providers are registered in `ProviderRegistry` / DI (`backend/src/di/registry.ts`).
- `carrierTrackingPollWorker` (cron, default every 5 min) polls active integrations,
  respecting each integration's interval and per-provider rate limits.
- Inbound webhooks: `POST /api/v1/carrier-tracking/webhook/:providerType` →
  `parseWebhook` → normalised `CarrierTrackingEvent`s.
- `CarrierTrackingHandler` bridges normalised events to shipment status
  (`in_transit`/`out_for_delivery` → `in_progress`, `delivered` → `complete`,
  `exception` → shipment exception flag).
- Normalised statuses: `info_received, in_transit, out_for_delivery, delivered,
  exception, return_to_sender, unknown`.

## Supported today

| Provider | Type | Auth | Poll | Webhook | Sandbox | Status |
|----------|------|------|:----:|:-------:|:-------:|--------|
| **FedEx** | Direct | OAuth2 (client credentials) | batch (30) | HMAC-SHA256 | `apis-sandbox.fedex.com` | ✅ Real |
| **UPS** | Direct | OAuth2 | single | HMAC-SHA256 | `wwwcie.ups.com` | ✅ Real |
| **DHL** | Direct | API key | single | HMAC-SHA256 | `api-test.dhl.com` | ✅ Real |
| **EasyPost** | Aggregator | API key (test/prod key) | single (Tracker) | HMAC-SHA256 | test API key | 🔨 Adding |
| **AfterShip** | Aggregator | API key | single | HMAC-SHA256 | test/free tier | 🔨 Adding |
| EDI 214 | Standard | — | — | — | — | ⬜ Scaffold |
| Manual | — | — | — | — | — | ⬜ Scaffold |

## Carrier landscape

### Direct carrier APIs (first-party depth, one integration each)
- **FedEx** — OAuth2; full sandbox with documented test tracking numbers. ✅ done.
- **UPS** — OAuth2; CIE sandbox (`wwwcie.ups.com`). ✅ done.
- **DHL** — Express/eCommerce APIs, API key; test host. ✅ done.
- **USPS** — new USPS APIs (OAuth2) with a test environment; good US coverage. Candidate.

### Aggregators (carrier "pooling" — one integration → many carriers)
Preferred for breadth and testability: one credential, one sandbox, dozens of carriers.

- **EasyPost** *(parcel; rate + label + track)* — API key with **test mode** (test keys),
  HMAC-signed webhooks, `EZ*`-prefixed test tracking numbers that simulate lifecycles.
  Excellent DX. **Leading pick.**
- **Shippo** *(parcel; rate + label + track)* — API key, test mode, webhooks. Alternative to EasyPost.
- **ShipEngine** (ShipStation) *(parcel)* — API key, sandbox carriers.
- **AfterShip** *(tracking only; 900+ carriers)* — API key, HMAC webhooks
  (`aftership-hmac-sha256`). Broadest tracking coverage; complements a parcel aggregator.
- **TrackingMore / Ship24** — tracking-only alternatives to AfterShip.
- **project44 / FourKites / Descartes MacroPoint** *(freight/LTL/FTL visibility)* — the
  serious freight-visibility networks. Powerful but enterprise: contracts and limited
  self-serve sandboxes. Deferred.

## Recommendation

1. **Lead with aggregators** so one integration unlocks many carriers: **EasyPost**
   (parcel + tracking, best sandbox, already scaffolded in our setup UI) and **AfterShip**
   (tracking across 900+ carriers).
2. Keep **FedEx/UPS/DHL** direct providers for first-party depth where customers want it.
3. Add **USPS** direct next if US parcel coverage is needed beyond the aggregators.
4. Consider **project44/FourKites** only for enterprise freight-visibility deals.

All of the above (except the freight networks) are **sandbox-testable via ngrok** without
hosting the app — see [`CARRIER_TESTING.md`](./CARRIER_TESTING.md).

## Future (out of scope for the tracking pass)

- **Rating** — live rate quotes via an aggregator (EasyPost/Shippo `/rates`).
- **Labels / BOL** — buy + store shipping labels (needs label storage + UI).
- **Booking / manifest / pickup** — create shipments and end-of-day manifests via carrier APIs.

These need a new provider interface (e.g. `ICarrierShippingProvider`) alongside the
tracking one; the aggregators already expose all of it under the same account, so the same
credentials/sandbox carry over.

## Key files

- `backend/src/services/carrierTracking/ICarrierTrackingProvider.ts` — provider interface
- `backend/src/services/carrierTracking/providers/*` — FedEx, UPS, DHL, EasyPost, AfterShip
- `backend/src/services/carrierTracking/CarrierTrackingService.ts` — orchestration/polling
- `backend/src/events/handlers/CarrierTrackingHandler.ts` — event → shipment status bridge
- `backend/src/routes/carrierTracking.ts` — CRUD, test, poll, webhook endpoints
- `frontend/src/vnext-design/VNextCarrierTrackingSetup.tsx` — setup wizard
