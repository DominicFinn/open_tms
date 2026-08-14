---
paths:
  - "backend/src/services/routing/**"
  - "backend/src/services/carrierTracking/**"
  - "backend/src/commands/carrierTracking/**"
  - "backend/src/events/handlers/CarrierTrackingHandler.ts"
  - "backend/src/workers/{etaMonitorWorker,carrierTrackingPollWorker}.ts"
  - "backend/src/routes/{etaMonitor,laneRoutes,carrierTracking}.ts"
  - "frontend/src/components/GoogleMapsRouteEditor.tsx"
  - "frontend/src/vnext-design/VNext{CarrierTracking,CreateLane,LaneDetail}*.tsx"
---

# ETA Monitoring, Route Deviation & Carrier Tracking — Rules

Full guides:
- ETA monitoring, adaptive polling, cost model, route deviation: `docs/ETA_MONITORING_GUIDE.md`
- Carrier API integration and landscape: `docs/CARRIER_INTEGRATIONS.md`

## Both subsystems are provider-agnostic — code to the interface

- Routing: `IRoutingProvider` (`backend/src/services/routing/IRoutingProvider.ts`). Implementations:
  TomTom, HERE, Valhalla. Selected via `ROUTING_PROVIDER=tomtom|here|valhalla` plus the provider's
  API key/URL.
- Carrier tracking: `ICarrierTrackingProvider`. Implementations: FedEx, UPS, DHL, built by
  `ProviderRegistry` and selected per-carrier via the setup wizard in the Integrations app.

Never call a vendor SDK directly from a service, worker, or route. Add a provider implementation
behind the interface instead — see "Adding a New Routing Provider" in the ETA guide.

## Carrier status bridging never regresses a shipment

`CarrierTrackingHandler` bridges carrier tracking events onto the shipment lifecycle, which is
`draft → ready → in_progress → complete`. There is no `delivered` or `exception` shipment status.

| Carrier status | Effect |
|---|---|
| `delivered` | shipment status → `complete` + sets `deliveryDate`, **only if currently `in_progress`**. Emits `SHIPMENT_DELIVERED` + `SHIPMENT_STATUS_CHANGED` |
| `in_transit` / `out_for_delivery` | advances status **forward only** along `statusOrder`; a target at or behind the current index is ignored |
| `exception` | emits `SHIPMENT_EXCEPTION` and flags the shipment. Skipped entirely if the shipment is already `complete` |

**Exceptions are orthogonal to the lifecycle status.** Do not clobber
`draft`/`ready`/`in_progress`/`complete` with an exception state — the `SHIPMENT_EXCEPTION` event is
what drives triage, notifications, and the Issue Engine.

## Respect the polling budget

Adaptive polling exists to control API cost. Don't add unconditional polling.

- ETA monitor: >8h from delivery ≈ every 40 min; 2-8h ≈ every 20 min; <2h ≈ every 10 min.
  Stale GPS (>60 min) or no GPS is **skipped entirely**.
- Carrier tracking poll worker runs every 5 minutes (`CARRIER_TRACKING_POLL_CRON`) and respects
  per-provider rate limits and polling intervals.

## Route deviation degrades gracefully

Deviation detection compares GPS against the lane's `LaneRoute` encoded polyline (default corridor
5000m; >corridor = warning, >2x corridor = critical + `shipment.exception`).

It **requires a Google Maps API key** in organization settings. Without one, the route planning UI
must show a warning and deviation detection is skipped — never let a missing key throw.
