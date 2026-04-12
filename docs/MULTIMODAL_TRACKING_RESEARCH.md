# Multimodal Tracking Research Report

## Context

Open TMS currently supports road freight (FTL + LTL) with GPS-based tracking (System Loco IoT), carrier API polling (FedEx/UPS/DHL), and EDI 214 status messages. The roadmap (Phase 12) calls for multimodal transport support - shipment legs across road, ocean, air, and rail - but no work has been done yet. This report researches what's available for tracking across those modes, both open/free and paid, to inform the implementation approach.

---

## Part 1: Current State in Open TMS

### What Exists Today

| Capability | Status | Key Files |
|-----------|--------|-----------|
| FTL/LTL road tracking | Built | `ShipmentEtaMonitorService.ts`, `IRoutingProvider.ts` |
| GPS telemetry (IoT) | Built | `SystemLocoAdapter.ts`, `ShipmentEvent` model |
| Carrier tracking (FedEx/UPS/DHL) | Built | `ICarrierTrackingProvider.ts`, `CarrierTrackingService.ts` |
| EDI 214 inbound/outbound | Built | `EDI214ParseService.ts`, `EDI214Service.ts` |
| ETA monitoring (3 routing providers) | Built | `TomTom`, `HERE`, `Valhalla` providers |
| Route deviation detection | Built | `RouteDeviationService.ts` |
| Multi-stop routes | Built | `ShipmentStop` model with per-stop status lifecycle |
| Transport mode enum | **Not built** | No `transportMode` field anywhere |
| Shipment legs model | **Not built** | No `ShipmentLeg` model |
| Ocean/air/rail tracking | **Not built** | No mode-specific tracking providers |

### Architecture That Can Be Reused

The existing **provider-agnostic interface pattern** is the key building block:

- `ICarrierTrackingProvider` - polling + webhook pattern, normalized status codes, rate limiting, credential storage. Already has FedEx/UPS/DHL implementations and a `ProviderRegistry` factory.
- `IRoutingProvider` - env-var-based provider selection, DI registration, supports multiple providers.
- `CarrierTrackingIntegration` Prisma model - stores per-carrier credentials (JSON), webhook config, polling config, rate limits. This model can be extended or mirrored for mode-specific integrations.

### What the Roadmap Says (Phase 12)

- Add `transportMode` enum: `road | air | ocean | rail | intermodal`
- `ShipmentLeg` model with mode-specific fields per leg
- Leg-level status lifecycle with handoff events between modes
- Mode-specific tracking integration points feeding from "Phase 9c data providers"
- UI: shipment detail shows leg-by-leg timeline with mode icons

---

## Part 2: Can We Rely on Carrier APIs?

**Short answer: Partially, and it depends on the mode.**

### Road - Yes, largely solved
Carriers like FedEx, UPS, DHL already provide tracking APIs that the system polls. For FTL carriers, the GPS comes from IoT devices (System Loco) or ELD/telematics. EDI 214 pushes status updates from carriers who support it.

### Ocean - Carriers are increasingly API-friendly
Major ocean carriers now provide free tracking APIs:
- **Maersk** - Best-in-class developer portal (`developer.maersk.com`), DCSA-compliant, free
- **Hapag-Lloyd** - Developer portal with container tracking, DCSA-compliant, free
- **CMA CGM** - Developer portal, free tier
- **ZIM** - Developer portal, strong API documentation, DCSA-compliant
- **MSC** - APIs through myMSC platform, requires business relationship
- **ONE (Ocean Network Express)** - Developer portal available

The **DCSA (Digital Container Shipping Association)** Track & Trace standard is the key: build one DCSA adapter and connect to any compliant carrier. DCSA defines standard event types: transport events (vessel departure/arrival), equipment events (gate in/out, load/discharge), and shipment events (booking confirmed, etc.).

**Limitation:** Carrier APIs give you container/booking-level milestones, NOT real-time vessel position. For vessel position you need AIS data (MarineTraffic/VesselFinder).

### Air - Carriers mostly do NOT offer cargo tracking APIs
Airlines are behind ocean carriers on APIs. Exceptions:
- **Lufthansa Cargo** - Has a developer API with AWB tracking
- **FedEx/UPS/DHL** - Track their own express/air shipments, not general air cargo

For most air cargo, you track the **flight** (not the cargo) using a flight tracking API, then map the flight status to shipment milestones. The user needs to know the flight number (from their air waybill/booking).

**IATA ONE Record** is an emerging standard for air cargo data sharing - still in pilot stage as of 2025, not production-ready for broad use.

### Rail - No public APIs exist
No Class I railroad (BNSF, UP, CSX, NS, CPKC) offers a public REST API. Tracking is via:
- **EDI 214** (which we already parse) - railroads push status updates to contracted shippers
- Customer portals (web-based, not API-accessible)
- Visibility platforms (project44/FourKites) that have direct railroad integrations

**Bottom line:** For rail, we lean on EDI 214 (already built) or unified visibility platforms.

---

## Part 3: External Tracking Options

### Air Freight Tracking

| Provider | Type | Pricing | Tracks | Best For |
|----------|------|---------|--------|----------|
| **FlightAware AeroAPI** | Paid (freemium) | Free tier (~10-15 flights/mo); Standard ~$0.005-0.01/request; Business $200-400/mo | Flights by number/tail, real-time position (lat/lon), ETA | **Best option** - most complete commercial flight tracking API |
| **AviationStack** | Paid (freemium) | Free: 100 req/mo; Basic $50/mo (10K req); Pro $150/mo (50K req) | Flight status, departure/arrival times, delays | Budget alternative, less positional data |
| **OpenSky Network** | Free (research) | Free for non-commercial; rate-limited (100 req/day anon, 4000 registered) | Raw ADS-B positions (lat/lon/alt/velocity) | Research/hobby only - no SLA, uncertain sustainability |
| **FlightRadar24** | N/A | No public API | N/A | **Not viable** for integration |

**Key limitation across all air APIs:** They track **flights**, not **cargo**. You get aircraft position/ETA but no visibility into which cargo is on which flight. The workflow is: user provides flight number (from AWB) -> TMS tracks the flight -> maps to shipment milestones.

**Cargo-specific APIs** (CargoAI, CHAMP Cargosystems) are B2B platforms for freight forwarders, not API-first services suitable for bring-your-own-key.

### Ocean Tracking

| Provider | Type | Pricing | Tracks | Best For |
|----------|------|---------|--------|----------|
| **Terminal49** | Paid (freemium) | Free: ~50 containers; $99/mo (200 containers); scales up | Container milestones across 85+ carriers | **Best option** for container tracking - most TMS-friendly |
| **Vizion API** | Paid (freemium) | Free trial; ~$0.10-0.50/container/month at volume | Container tracking across many carriers | Alternative to Terminal49 |
| **Direct carrier APIs (DCSA)** | Free | Free with registration per carrier | Container milestones per carrier | Free but requires per-carrier integration |
| **MarineTraffic** | Paid | From ~$150-200/mo; ~$0.01-0.05/request | Real-time vessel AIS position, port calls, ETA | Vessel-level tracking (not container) |
| **VesselFinder** | Paid | From ~$80-100/mo; ~$0.01-0.03/request | Vessel AIS position, port info, ETA | Budget vessel tracking |
| **Searoutes** | Paid (freemium) | Free: ~100/mo; Paid from $49/mo | Sea route distances, transit times, CO2 | Route **planning**, not tracking |

**No free/open-source option exists** for production ocean tracking. Free AIS sources (AISHub) are community-based, require contributing a receiver, and lack reliability.

### Rail Tracking

| Provider | Type | Pricing | Tracks | Best For |
|----------|------|---------|--------|----------|
| **EDI 214 from railroads** | Free (infra cost) | Already built in Open TMS | Rail shipment milestones | **Primary method** - push-based from carrier |
| **project44 / FourKites** | Enterprise | $50K+/year contracts | Rail + all modes | Enterprise users with existing subscriptions |

**No standalone rail tracking API exists.** The options are EDI 214 (already supported), manual milestone entry, or unified visibility platforms.

### Unified Visibility Platforms

| Platform | Coverage | Pricing | Suitable for Open TMS? |
|----------|----------|---------|----------------------|
| **project44** | All modes, 100s of carriers | Enterprise: ~$2-10/shipment, $50K+/year min | Only for large deployments that already subscribe |
| **FourKites** | All modes, strong road | Enterprise: similar to project44 | Same - enterprise only |
| **Shippeo** | European focus, all modes | Enterprise SaaS | European enterprise deployments |

**No open-source visibility platform exists.** This is actually a differentiating opportunity for Open TMS.

---

## Part 4: Cost Reality for Users

For a mid-size deployment (~500 multimodal shipments/month):

| Service | Purpose | Monthly Cost |
|---------|---------|-------------|
| FlightAware AeroAPI | Air flight tracking | ~$50-100 |
| Terminal49 or Vizion | Ocean container tracking | ~$99-200 |
| VesselFinder (optional) | Vessel position tracking | ~$80-150 |
| Direct carrier DCSA APIs | Ocean container milestones | Free |
| EDI 214 | Rail status updates | Free (already built) |
| FedEx/UPS/DHL APIs | Parcel/express tracking | Free (already built) |
| **Total** | | **~$200-400/month** |

This is very reasonable. Enterprise users wanting project44/FourKites would pay significantly more but get broader coverage.

---

## Part 5: Recommended Architecture

### Provider Interface Pattern

Extend the existing `ICarrierTrackingProvider` pattern with mode-specific providers:

```
IMultimodalTrackingProvider (extends/mirrors ICarrierTrackingProvider)
  |
  +-- Air
  |   +-- FlightAwareProvider (paid, best)
  |   +-- AviationStackProvider (paid, budget)
  |   +-- OpenSkyProvider (free, research-grade)
  |
  +-- Ocean (Vessel)
  |   +-- MarineTrafficProvider (paid, premium)
  |   +-- VesselFinderProvider (paid, budget)
  |
  +-- Ocean (Container)
  |   +-- Terminal49Provider (paid, aggregator)
  |   +-- VizionProvider (paid, aggregator)
  |   +-- DCSACarrierProvider (free, per-carrier: Maersk, Hapag-Lloyd, ZIM, etc.)
  |
  +-- Rail
  |   +-- EDI214Provider (already built -- reuse existing EDI 214 infrastructure)
  |
  +-- Unified Platform
  |   +-- Project44Provider (enterprise)
  |   +-- FourKitesProvider (enterprise)
  |
  +-- Road (existing)
      +-- FedExProvider, UPSProvider, DHLProvider (already built)
      +-- IoT/GPS (SystemLoco -- already built)
```

### Data Model Changes Needed

1. **`ShipmentLeg` model** - each leg of a multimodal shipment with:
   - `transportMode`: road | air | ocean | rail | intermodal
   - `sequenceNumber`: ordering within the shipment
   - `status`: own lifecycle (pending, booked, in_transit, arrived, completed)
   - Mode-specific fields (flight number, vessel/IMO, container number, rail car, etc.)
   - Origin/destination locations for the leg
   - Carrier assignment per leg

2. **`transportMode` enum** on Shipment (for simple single-mode shipments) and on ShipmentLeg (for multi-leg)

3. **Tracking events linked to legs** - extend `CarrierTrackingEvent` or create `LegTrackingEvent` to associate tracking data with specific legs

4. **Provider configuration** - extend `CarrierTrackingIntegration` or create new integration model for mode-specific providers, with API key storage and provider selection

### Implementation Priority

**Phase 1 (Highest ROI, lowest effort):**
- Add `transportMode` to Shipment model (simple enum, no legs yet)
- Integrate FlightAware AeroAPI for air tracking (user provides flight number)
- Integrate Terminal49 or DCSA direct carrier APIs for ocean container tracking
- Rail: already covered by EDI 214

**Phase 2 (Multi-leg support):**
- Add `ShipmentLeg` model
- Leg-level status tracking and handoff events
- UI: leg-by-leg timeline on shipment detail
- Vessel-level tracking (MarineTraffic/VesselFinder) for ocean legs

**Phase 3 (Enterprise):**
- project44/FourKites adapter for organizations with existing subscriptions
- DCSA multi-carrier adapter
- Mode recommendation engine

### Key Standard to Adopt

**DCSA Track & Trace** for ocean is the single most important external standard. Building the data model around DCSA event types (transport events, equipment events, shipment events) will future-proof ocean tracking and make it easy to connect to any DCSA-compliant carrier for free.

---

## Part 6: Key Findings Summary

1. **Carrier APIs alone are NOT sufficient for full multimodal tracking.** Ocean carriers are getting there (DCSA), but airlines and railroads lag behind. We need a mix of carrier APIs + third-party tracking providers + EDI.

2. **There is NO open-source multimodal tracking platform.** This is a genuine differentiator for Open TMS if we build it well.

3. **The existing provider-agnostic pattern is excellent.** `ICarrierTrackingProvider` + `ProviderRegistry` + `CarrierTrackingIntegration` give us the blueprint. We extend, not reinvent.

4. **The most realistic free options are:**
   - Ocean: Direct DCSA-compliant carrier APIs (Maersk, Hapag-Lloyd, ZIM, etc.)
   - Air: OpenSky Network (limited, no SLA) - realistically, FlightAware at ~$50-100/mo is needed
   - Rail: EDI 214 (already built)

5. **The best paid options (bring-your-own-key friendly) are:**
   - Air: FlightAware AeroAPI (~$50-100/mo)
   - Ocean containers: Terminal49 (~$99/mo) or Vizion
   - Ocean vessels: VesselFinder (~$80/mo)
   - All modes: project44/FourKites (enterprise only, $50K+/year)

6. **Total cost for a mid-size deployment is ~$200-400/month** for air + ocean tracking, which is very reasonable.

7. **The ShipmentLeg model is the critical schema change** that unlocks everything else. Without it, we can't track a container through truck -> ocean -> truck transitions.

---

## Files to Modify (When Implementation Begins)

- `backend/prisma/schema.prisma` - Add ShipmentLeg model, transportMode enum
- `backend/src/services/carrierTracking/ICarrierTrackingProvider.ts` - Extend or create parallel interface for multimodal
- `backend/src/services/carrierTracking/ProviderRegistry.ts` - Register new providers
- `backend/src/di/registry.ts` - DI registration for new providers
- `backend/src/events/eventTypes.ts` - Leg lifecycle events
- `backend/src/commands/shipments/` - Leg CRUD commands
- `backend/src/routes/` - New routes for leg management and tracking
- `frontend/src/vnext-design/` - Leg timeline UI on shipment detail
- `roadmap.md` - Update Phase 12 status
- `docs/gap-analysis/10-MULTIMODAL-INTL.md` - Update gap status
