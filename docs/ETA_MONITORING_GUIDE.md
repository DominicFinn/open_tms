# ETA Monitoring Service

## Overview

The ETA Monitoring Service is a cron-driven background engine that checks in-transit shipments against traffic-aware routing APIs and raises alerts when shipments are running late. It detects delays by comparing real-time traffic-aware route calculations against scheduled arrival times and publishes domain events that flow through the existing notification system.

## Why This Approach

### The Problem

Shipments have scheduled ETAs but no way to know if they'll actually arrive on time. Traffic, road closures, weather, and driver routing decisions all affect real-world arrival times. Without active monitoring, delays are only discovered when a customer calls to ask where their freight is.

### Technology Decision: External Routing APIs

We evaluated multiple approaches for ETA calculation and chose a **hybrid architecture** using commercial routing APIs for traffic-aware ETAs combined with optional self-hosted routing for cost reduction.

#### Options Evaluated

| Provider | Truck Routing | Real-Time Traffic | Cost per 1K requests | Free Tier |
|----------|:------------:|:----------------:|--------------------:|----------:|
| **Google Routes API** | No | Yes (best quality) | $10.00 (Advanced) | 5K/month |
| **HERE Routing API** | Yes (full) | Yes (very good) | $2.50 | 5K/month |
| **TomTom Routing API** | Yes (full) | Yes (good) | $0.50 | ~75K/month |
| **Mapbox Directions** | No | Yes (good) | $2.00 (after 100K free) | 100K/month |
| **Valhalla (self-hosted)** | Yes (basic) | No | $0 (infra only) | Unlimited |
| **OSRM (self-hosted)** | No | No | $0 (infra only) | Unlimited |
| **OpenRouteService** | Yes (basic) | No | $0 (self-hosted) | 2K/day hosted |

#### Why NOT Google Maps

Despite having the best traffic data, Google Maps was ruled out because:
1. **No truck routing** — Google treats trucks like cars. Height, weight, length, and hazmat restrictions are ignored. This is a fundamental problem for freight.
2. **4-20x more expensive** — $10/1K requests (traffic-aware) vs $2.50 (HERE) or $0.50 (TomTom).
3. **No route deviation detection** built in.

#### Why HERE or TomTom

Both offer **native truck routing** with vehicle dimension constraints (height, width, length, weight, axle count, hazmat classes, tunnel restrictions). This is critical for a TMS because your carriers are driving trucks, not cars.

- **HERE** ($2.50/1K) — Industry standard for logistics. Excellent probe data from automotive OEMs (Audi, BMW, Mercedes fleets). Best choice if budget allows.
- **TomTom** ($0.50/1K) — 5x cheaper than HERE with comparable truck features. Best value for cost-sensitive deployments.

#### Why Valhalla as a Free Tier

Valhalla is an open-source routing engine with a built-in truck costing model. It has **no real-time traffic data** (uses static OSM speed profiles), so ETAs are less accurate. But it's free and unlimited, making it useful for:
- Baseline route calculation at shipment creation
- Bulk rough ETA estimates
- Development/testing without API costs

#### Recommended Hybrid Strategy

For production deployments, we recommend:

1. **Self-hosted Valhalla** (free) for baseline route calculations and rough ETAs on shipment creation.
2. **TomTom or HERE** (paid) for traffic-aware ETA checks on in-transit shipments with adaptive polling.
3. Use the **adaptive polling** built into the service to only call the paid API when it matters (near delivery, GPS active, truck moving).

### Cost Estimates with Adaptive Polling

The service uses adaptive polling to dramatically reduce API calls:
- Shipments >8 hours from delivery: checked every ~40 minutes
- Shipments 2-8 hours from delivery: checked every ~20 minutes
- Shipments <2 hours from delivery: checked every run (10 min)
- Shipments with stale GPS (>60 min): skipped entirely
- Shipments with no GPS data: skipped

| Scale | Shipments/day | Estimated API calls/month | TomTom cost | HERE cost |
|-------|:------------:|:------------------------:|:-----------:|:---------:|
| Small | 100 | ~50K | ~$25/mo | ~$113/mo |
| Medium | 500 | ~250K | ~$125/mo | ~$619/mo |
| Large | 2,000 | ~800K | ~$400/mo | ~$1,994/mo |

---

## Architecture

```
  pg-boss cron (every 10 min, configurable)
      │
      ▼
  ETA Monitor Worker
      │
      ▼
  ShipmentEtaMonitorService.runEtaCheck()
      │
      ├── Query in-transit shipments + GPS positions (from ShipmentReadModel)
      │
      ├── For each shipment (adaptive polling filters applied):
      │     │
      │     ├── Get current GPS position + next pending stop
      │     ├── Call IRoutingProvider.computeRoute() (traffic-aware)
      │     ├── Compare new ETA vs scheduled estimatedArrival
      │     ├── Update ShipmentStop.estimatedArrival
      │     │
      │     └── If delay detected:
      │           ├── Publish tracking.eta_updated event
      │           └── If critical (60m+): publish shipment.exception event
      │
      └── Events flow through existing system:
            ├── InAppNotificationHandler → bell icon alerts
            ├── EmailHandler → email notifications
            ├── AuditHandler → immutable audit log
            └── ShipmentProjection → read model update
```

## How to Enable

### 1. Choose a routing provider

Add the following to your `.env` file:

```bash
# Required: choose one provider
ROUTING_PROVIDER=tomtom   # Options: "here", "tomtom", "valhalla"
```

### 2. Configure provider credentials

**For TomTom** (recommended, cheapest with truck routing):
```bash
ROUTING_PROVIDER=tomtom
TOMTOM_API_KEY=your-tomtom-api-key
# Get a key at: https://developer.tomtom.com/
# Free tier: 2,500 requests/day (~75K/month)
```

**For HERE** (industry standard for logistics):
```bash
ROUTING_PROVIDER=here
HERE_API_KEY=your-here-api-key
# Get a key at: https://developer.here.com/
# Free tier: 5,000 requests/month
```

**For Valhalla** (self-hosted, free, no traffic data):
```bash
ROUTING_PROVIDER=valhalla
VALHALLA_BASE_URL=http://localhost:8002

# Run Valhalla locally via Docker:
# docker run -p 8002:8002 -v /path/to/tiles:/data/valhalla ghcr.io/valhalla/valhalla:latest
```

### 3. Optional: tune monitoring thresholds

```bash
# Cron schedule (default: every 10 minutes)
ETA_MONITOR_CRON="*/10 * * * *"

# Delay thresholds (minutes) - when to raise alerts
ETA_DELAY_THRESHOLD_MINUTES=15     # Minor delay (info notification)
ETA_WARNING_THRESHOLD_MINUTES=30   # Warning (warning notification)
ETA_CRITICAL_THRESHOLD_MINUTES=60  # Critical (error notification + shipment exception)

# Skip shipments with GPS data older than this (minutes)
ETA_STALE_GPS_THRESHOLD_MINUTES=60

# Route deviation distance (meters) - future use
ETA_ROUTE_DEVIATION_METERS=5000
```

### 4. Restart the server

The ETA monitor worker automatically registers when the server starts with a configured `ROUTING_PROVIDER`.

---

## API Endpoints

### GET /api/v1/eta-monitor/status

Returns the current ETA monitor configuration and routing provider info.

```json
{
  "data": {
    "enabled": true,
    "provider": "tomtom",
    "supportsTruckRouting": true,
    "supportsTraffic": true,
    "cronExpression": "*/10 * * * *",
    "config": {
      "delayThresholdMinutes": 15,
      "warningThresholdMinutes": 30,
      "criticalThresholdMinutes": 60,
      "routeDeviationMeters": 5000,
      "staleGpsThresholdMinutes": 60
    }
  },
  "error": null
}
```

### POST /api/v1/eta-monitor/run

Manually triggers a full ETA monitoring cycle. Returns a summary of all checks.

```json
{
  "data": {
    "runId": "abc-123",
    "startedAt": "2026-04-11T10:00:00.000Z",
    "completedAt": "2026-04-11T10:00:12.000Z",
    "shipmentsChecked": 15,
    "shipmentsSkipped": 3,
    "delaysDetected": 2,
    "errorsEncountered": 0,
    "results": [
      {
        "shipmentId": "ship-001",
        "shipmentReference": "SH-0001",
        "status": "warning",
        "previousEta": "2026-04-11T14:00:00.000Z",
        "newEta": "2026-04-11T14:45:00.000Z",
        "delayMinutes": 45,
        "nextStopName": "Chicago Distribution Center"
      }
    ]
  },
  "error": null
}
```

### POST /api/v1/eta-monitor/check/:shipmentId

Check ETA for a single shipment on demand.

---

## Events Emitted

### tracking.eta_updated

Published when a delay is detected (any severity level above the minimum threshold).

```typescript
{
  shipmentId: string;
  shipmentReference: string;
  previousEta: string;        // ISO-8601
  newEta: string;             // ISO-8601
  delayMinutes: number;
  severity: 'minor_delay' | 'warning' | 'critical';
  nextStopId: string;
  nextStopName: string;
  trafficDelaySeconds: number; // Traffic contribution to delay
  provider: string;            // Which routing provider was used
}
```

### shipment.exception (for critical delays)

Published when delay exceeds the critical threshold (default: 60 minutes).

```typescript
{
  shipmentReference: string;
  exceptionType: 'eta_critical_delay';
  description: string;        // Human-readable delay description
}
```

## Notifications

ETA alerts flow through the existing notification system:

| Severity | Delay | Notification Severity | Example |
|----------|------:|:---------------------:|---------|
| Minor | 15-29 min | info | "Minor delay: SH-0001" |
| Warning | 30-59 min | warning | "Delay warning: SH-0001" |
| Critical | 60+ min | error | "CRITICAL DELAY: SH-0001" |

Notifications appear in the bell icon and are sent via email (if configured via EventSubscription rules).

---

## Key Files

| File | Purpose |
|------|---------|
| `backend/src/services/routing/IRoutingProvider.ts` | Provider-agnostic interface with DTOs |
| `backend/src/services/routing/HereRoutingProvider.ts` | HERE Routing API implementation |
| `backend/src/services/routing/TomTomRoutingProvider.ts` | TomTom Routing API implementation |
| `backend/src/services/routing/ValhallaRoutingProvider.ts` | Self-hosted Valhalla implementation |
| `backend/src/services/routing/ShipmentEtaMonitorService.ts` | Core monitoring engine |
| `backend/src/workers/etaMonitorWorker.ts` | pg-boss cron worker |
| `backend/src/routes/etaMonitor.ts` | API routes |
| `backend/src/__tests__/services/ShipmentEtaMonitorService.test.ts` | Unit tests |

---

## Adding a New Routing Provider

1. Create a class implementing `IRoutingProvider` in `backend/src/services/routing/`
2. Add env-based selection logic in `backend/src/di/registry.ts`
3. Export from the barrel `backend/src/services/routing/index.ts`
4. The rest of the system (ETA monitor, events, notifications) works unchanged
