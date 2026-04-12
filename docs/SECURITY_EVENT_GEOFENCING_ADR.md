# Security Event Geofencing — Architecture Decision Record

## Context

The SLA system includes security event rules (`light_event`, `seal_event`) that detect when a sensor reading or seal break occurs **outside any known location**. This requires "inverse geofencing": given a GPS point from an IoT device, determine whether it falls within ANY of an organization's geofenced locations.

This document records the design decisions, trade-offs, and future direction for this capability.

---

## Decision 1: Cron-Based Evaluation, Not Real-Time

**Decision**: Security event SLA evaluation runs on the SLA monitor cron (every 2 minutes), not as a real-time reaction to every sensor reading.

**Rationale (CAP Theorem)**:

In the CAP theorem framework, a distributed system can provide at most two of: Consistency, Availability, and Partition tolerance. For security event detection:

- **Real-time evaluation** (every sensor reading triggers an inverse geofence query) prioritises **Consistency** — the system's knowledge of "is this event suspicious?" is always up to date. But under load (high-frequency IoT telemetry across many shipments), this degrades **Availability** — the system spends so much time evaluating that it can't keep up with the event stream. The geofence check becomes a bottleneck in the hot path.

- **Cron-based evaluation** prioritises **Availability** and **Partition tolerance** — the event ingestion pipeline stays fast and decoupled from the geofence evaluation. The trade-off is **eventual consistency**: there is a 0–2 minute window where a suspicious event has been recorded but not yet flagged. For security events in logistics, this latency is acceptable — a 2-minute delay before alerting on a potential tampering event does not meaningfully change the response.

This mirrors the existing ETA monitor pattern: the ETA monitoring service also uses cron-based evaluation (every 10 minutes) rather than re-routing on every GPS fix. The SLA monitor is more aggressive at 2-minute intervals, which provides a good balance between responsiveness and resource efficiency.

**What this means in practice**:
- Sensor readings and device events are ingested at full speed via the existing webhook/telemetry pipeline
- The SLA monitor worker picks up unprocessed security-relevant readings in its next sweep
- Suspicious events (outside known locations) trigger SLA breaches, which auto-create triage issues
- The worst-case detection latency is 2 minutes, not minutes/hours

---

## Decision 2: Spatial Indexing via PostGIS (Recommended Default)

**Decision**: Use PostGIS `ST_DWithin` for inverse geofence queries. PostGIS is the recommended default; Tile38 is a supported alternative for large-scale deployments.

### Options Evaluated

| Solution | Type | Query Capability | Performance (1K fences) | Deployment | License |
|----------|------|-----------------|------------------------|------------|---------|
| **PostGIS** | Postgres extension | `ST_DWithin(geom, point, radius)` with spatial index | Excellent (indexed, O(log n)) | `CREATE EXTENSION postgis` on existing PG | PostgreSQL/MIT |
| **H3 (Uber)** | Postgres extension | Hex-cell containment, integer lookups | Excellent for aggregation | `h3-pg` extension alongside PostGIS | Apache 2.0 |
| **Tile38** | Standalone geospatial DB | NEARBY, WITHIN, INTERSECTS + webhook pub/sub | Sub-millisecond, in-memory | Separate Docker container | MIT |
| **Redis GEOSEARCH** | In-memory cache | Point-in-radius | Fast for single radius, poor for "check all fences" | Separate container | BSD |
| **Turf.js** | In-process JS library | `booleanPointInCircle()` brute-force | ~1-5ms for 1K fences (no index) | None (Node.js runtime) | MIT |

### Recommendation: PostGIS as Default

PostGIS is the pragmatic choice for Open TMS because:

1. **No new infrastructure** — it's a PostgreSQL extension, added to the existing database with `CREATE EXTENSION postgis`. No additional Docker containers or data synchronisation.
2. **Proven at scale** — `ST_DWithin` with a GiST spatial index handles thousands of geofences efficiently.
3. **Rich ecosystem** — well-documented, mature, widely understood.
4. **Future-proof** — supports complex geometries (polygon geofences), route corridors, and spatial joins if we move beyond simple radius checks.

### Implementation Sketch

```sql
-- Add PostGIS to the existing database
CREATE EXTENSION IF NOT EXISTS postgis;

-- Add a geography column to Location (or a materialised view)
ALTER TABLE "Location" ADD COLUMN geog geography(Point, 4326);

-- Populate from existing lat/lng
UPDATE "Location" SET geog = ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography
WHERE lat IS NOT NULL AND lng IS NOT NULL;

-- Create spatial index
CREATE INDEX idx_location_geog ON "Location" USING GIST (geog);

-- Inverse geofence query: "is this point inside any known location's geofence?"
SELECT l.id, l.name, ac."geofenceRadiusMeters"
FROM "Location" l
JOIN "ArrivalCriteria" ac ON ac."locationId" = l.id
WHERE ST_DWithin(
  l.geog,
  ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography,
  COALESCE(ac."geofenceRadiusMeters", 200)
)
LIMIT 1;
-- Returns rows if the point is inside ANY geofence. Empty = outside all fences.
```

### Alternative: Tile38 for Large-Scale Deployments

For organisations with thousands of locations and high-frequency sensor telemetry, **Tile38** is a dedicated geospatial database designed for exactly this use case:

- Runs as a separate Docker container (`docker run -p 9851:9851 tile38/tile38`)
- In-memory spatial index with sub-millisecond queries
- Built-in geofence webhook support (can notify on entry/exit events)
- Data synced from PostgreSQL on location create/update

This is the path for implementers who need real-time geofencing at scale. The `ISpatialIndexProvider` interface (see below) abstracts the choice.

---

## Decision 3: Provider-Agnostic Interface

**Decision**: The geofence evaluation capability is behind a provider interface (`ISpatialIndexProvider`) so it can be swapped between PostGIS, Tile38, or external services.

```typescript
interface ISpatialIndexProvider {
  /** Check if a point is inside any known location's geofence */
  isInsideAnyGeofence(orgId: string, lat: number, lng: number): Promise<GeofenceMatch | null>;
  
  /** Sync a location to the spatial index (called on location create/update) */
  syncLocation(location: { id: string; lat: number; lng: number; radiusMeters: number }): Promise<void>;
}

interface GeofenceMatch {
  locationId: string;
  locationName: string;
  distanceMeters: number;
}
```

This is consistent with the existing provider pattern in Open TMS:
- `IRoutingProvider` abstracts TomTom/HERE/Valhalla
- `IBinaryStorageProvider` abstracts S3/database
- `IEmailService` abstracts SMTP/SendGrid/SES/console

---

## Decision 4: Open TMS Does Not Depend on Specific IoT Providers

Open TMS is an open-source project and must not be tied to any specific IoT platform. However, it's worth noting that commercial IoT providers often have superior geofencing capabilities:

### Commercial Alternatives for Implementers

| Provider | What They Offer | Consideration |
|----------|----------------|---------------|
| **System Loco** | IoT platform with built-in geofencing, device management, and event webhooks. Already integrated for sensor telemetry. | Ties deployment to System Loco. Acceptable for commercial implementers who already use the platform, but not for the open-source default. |
| **Shippeo** | Supply chain visibility platform with ETA prediction, geofencing, and carrier integrations. | Enterprise-grade; replaces much of the ETA/tracking pipeline. Could feed events into Open TMS via webhooks. |
| **project44** | Multi-modal visibility with carrier tracking, ETA, and exception management. | Similar to Shippeo; broader carrier network. Would require an adapter to map p44 events to Open TMS domain events. |
| **FourKites** | Real-time supply chain visibility with predictive ETAs and geofencing. | Enterprise logistics focus; strong carrier integration. |

**Recommendation for implementers**: If you're using an IoT provider like System Loco that already does geofencing well, consider having that provider push geofence events into Open TMS via the existing webhook/telemetry API, and skip the built-in spatial evaluation entirely. The SLA system will still track the evaluations — it just won't need to compute the geofence check itself.

This is configured by setting the `light_event` and `seal_event` SLA rules to be "externally evaluated" — the external provider raises the event, and Open TMS just tracks the SLA against it.

---

## Implementation Sequence

1. **Phase 1 (current)**: SLA rules for `light_event` and `seal_event` exist in the schema. The cron worker detects breaches based on time thresholds. Geofence evaluation is **not yet implemented** — this ADR documents the planned approach.

2. **Phase 2**: Add PostGIS extension + geography column to Location. Implement `PostgisSpatialIndexProvider`. Wire into the SLA monitor worker's security event sweep.

3. **Phase 3 (optional)**: Add Tile38 adapter behind `ISpatialIndexProvider` for deployments that need real-time geofencing. Tile38 Docker container added to docker-compose as an optional service.

4. **Phase 4 (optional)**: External provider adapters — System Loco, Shippeo, project44 push geofence events that skip the built-in spatial evaluation entirely.

---

## Related Files

- `backend/src/services/SlaEvaluationService.ts` — core SLA evaluation logic
- `backend/src/workers/slaMonitorWorker.ts` — cron-driven breach detection
- `backend/src/services/ArrivalCriteriaEvaluationService.ts` — existing geofence matching (arrival detection)
- `backend/prisma/schema.prisma` — SlaRule `ruleType: "light_event" | "seal_event"`
- `docs/ETA_MONITORING_GUIDE.md` — related: ETA monitor also uses cron-based evaluation
