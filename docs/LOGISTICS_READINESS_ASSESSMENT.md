# Open TMS — Logistics Readiness Assessment

## Context

This assessment evaluates Open TMS readiness for three target customer profiles:
1. **Profile A: Global 3PL/4PL Provider** — Warehousing, hub-and-spoke distribution, multi-modal freight, control tower services, white-label logistics-as-a-service
2. **Profile B: Enterprise Shipper (In-House Control Tower)** — Large manufacturers/brands wanting end-to-end supply chain visibility brought in-house
3. **Profile C: Control Tower as a Service / Security Visibility Provider** — GPS/BLE tracking, managed monitoring, temperature compliance, multi-customer platform

## Scoring System

| Score | Label | Definition |
|-------|-------|------------|
| 5 | Production-Ready | Feature exists, tested, UI complete |
| 4 | Substantially Built | Core exists, needs minor extension (<2 weeks) |
| 3 | Foundation Exists | Models/services in place, needs significant build-out (2-8 weeks) |
| 2 | On Roadmap | Planned with defined scope, no code yet (2-4 months) |
| 1 | Not on Roadmap | Not planned, requires new domain modeling (4+ months) |

**Weight**: Critical (3x) | Important (2x) | Nice-to-Have (1x)

---

## Executive Summary

| Profile | Readiness | Critical Gaps | Roadmap Coverage |
|---------|-----------|---------------|------------------|
| A: 3PL/4PL Provider | ~28/100 | 6 | 40% |
| B: Enterprise Shipper | ~35/100 | 5 | 55% |
| C: Visibility/Security Service | ~32/100 | 5 | 35% |

**Key Finding**: Open TMS has strong transactional foundations (orders, shipments, carriers, EDI, tendering, cold chain, IoT) but lacks the **platform-level capabilities** all three profiles need: multi-client architecture, control tower dashboard, SLA management, and real-time push notifications.

---

## Part 1: What Exists Today (Strengths)

These capabilities are production-ready (score 4-5) and represent genuine competitive advantages:

### Order Management — Score: 5/5
- Manual creation, EDI 850 import, CSV bulk import
- Order-to-shipment conversion with lane matching
- Full status lifecycle with delivery exception tracking
- Trackable units (pallet/tote/box) with barcodes and cargo scanning
- Custom line items with SKU, quantity, weight, dimensions

### Shipment & Routing — Score: 4/5
- Multi-stop routes with sequence ordering
- Geofencing with auto-arrival detection (GPS, WiFi, BLE)
- Proof of delivery (signature, photos, notes)
- Lane-based consolidation (LTL) and FTL support
- Cargo reconciliation with misdrop/left-on-vehicle detection

### Carrier Management & Tendering — Score: 5/5
- Carrier CRUD with validation tiers, SCAC codes, vehicles, drivers
- Broadcast and waterfall tendering strategies
- Carrier portal with JWT auth, bid submission, win/loss history
- EDI 204 (Load Tender) auto-delivery and 990 (Response) parsing
- 5-step tender creation wizard with target rate setting

### EDI Integration — Score: 4/5
- X12 850 (PO), 856 (ASN), 204 (Tender), 990 (Response), 997 (Ack)
- SFTP polling via edi-collector + HTTP delivery
- Unified Trading Partner model with per-transaction-type config
- Field mapping customization per partner
- Transaction audit logs with direction tracking

### Cold Chain Compliance — Score: 5/5
- CFR 21 Part 11 compliant immutable temperature logs (SHA-256 integrity)
- Cold chain profiles with temp/humidity alert thresholds
- Automatic excursion detection with severity classification
- CAPA reports linked to excursions and issues
- Device calibration tracking with certificate storage
- Auto-generated compliance report PDFs

### IoT & Device Management — Score: 4/5
- Device registry with assignment lifecycle (shipment/order/unit)
- Sensor readings: temperature, humidity, light, impact, tilt, movement
- Webhook ingestion for real-time GPS and sensor data
- Arrival criteria evaluation (geofence, WiFi SSID, BLE beacon RSSI)
- Telemetry time-series API with summary statistics

### Platform & Architecture — Score: 5/5
- CQRS event-driven architecture with 20+ command handlers
- Domain event log with immutable audit trail
- 6 denormalized read models for fast queries
- REST API with Swagger/OpenAPI (41 route modules)
- White-label theming (CSS variables, logo upload)
- Versioned custom fields per entity type
- Docker/Terraform/CloudFormation deployment options

---

## Part 2: Capability Gap Matrix

### Domain 1: Multi-Tenant / Multi-Client Architecture

| Capability | Status | Score | A | B | C |
|------------|--------|-------|---|---|---|
| Single-organization model | EXISTS | 5 | - | - | - |
| User roles & permissions (RBAC) | EXISTS | 5 | - | - | - |
| Multi-client within single deployment | NOT ON ROADMAP | 1 | Critical | N/H | Critical |
| Client-specific branding within platform | NOT ON ROADMAP | 1 | Critical | N/H | Critical |
| Customer/shipper portal | ON ROADMAP (Phase 8) | 2 | Important | Important | N/H |
| Data isolation between clients | NOT ON ROADMAP | 1 | Critical | N/H | Critical |

**Assessment**: The single-Organization model works for a shipper running their own instance. It fundamentally cannot support a 3PL serving multiple clients or a visibility provider serving multiple customers on one platform. The `Customer` model exists but is a lightweight reference entity, not a tenant isolation boundary.

### Domain 2: Shipment — Advanced Capabilities

| Capability | Status | Score | A | B | C |
|------------|--------|-------|---|---|---|
| Multi-modal transport legs (air/ocean/rail) | NOT ON ROADMAP | 1 | Critical | Important | N/H |
| Consolidation / deconsolidation | ON ROADMAP (Phase 11) | 2 | Critical | N/H | N/H |
| Appointment scheduling / dock management | ON ROADMAP (Phase 11) | 2 | Important | N/H | N/H |
| Driver mobile app for POD capture | ON ROADMAP (Phase 4) | 2 | Important | N/H | N/H |

**Assessment**: No `transportMode` field exists anywhere in the schema. Everything assumes road freight. A 3PL needs air, ocean, rail, and intermodal legs within a single shipment.

### Domain 3: Tracking & Visibility

| Capability | Status | Score | A | B | C |
|------------|--------|-------|---|---|---|
| GPS location tracking (webhook) | EXISTS | 5 | - | - | - |
| Cargo tracking & misdrop detection | EXISTS | 5 | - | - | - |
| End-to-end PO-to-delivery milestones | PARTIAL | 3 | Important | Critical | N/H |
| Multi-carrier tracking aggregation | ON ROADMAP (Phase 4) | 2 | Important | Critical | N/H |
| Control tower / command center dashboard | NOT ON ROADMAP | 1 | Critical | Critical | Critical |
| Live tracking map with geofence viz | ON ROADMAP (Phase 5) | 2 | Important | Important | Critical |
| Predictive ETA | ON ROADMAP (Phase 9) | 2 | Important | Critical | Important |

**Assessment**: The biggest gap across all profiles. The existing dashboard shows basic KPI cards. A control tower needs live maps, alert streams, SLA gauges, multi-client views, and drill-down. This is the central value proposition for all three profiles.

### Domain 4: Route & Network Management

| Capability | Status | Score | A | B | C |
|------------|--------|-------|---|---|---|
| Lane CRUD with carrier assignment | EXISTS | 5 | - | - | - |
| Hub-and-spoke network modeling | NOT ON ROADMAP | 1 | Critical | N/H | N/H |
| Route optimization (TSP solver) | ON ROADMAP (Phase 9) | 2 | Important | N/H | N/H |
| Live ETA engine | ON ROADMAP (Phase 9) | 2 | Important | Critical | Important |
| Traffic-aware routing | ON ROADMAP (Phase 9) | 2 | N/H | Important | N/H |

**Assessment**: Lanes are point-to-point. No hub node classification, spoke assignment, cross-dock transfer logic, or network optimization. This is fundamental to a 3PL's distribution model.

### Domain 5: Exception & SLA Management

| Capability | Status | Score | A | B | C |
|------------|--------|-------|---|---|---|
| Issue model with lifecycle | EXISTS | 5 | - | - | - |
| Kanban board UI | PARTIAL (Phase 4) | 2 | Important | Important | Important |
| Auto-triage from events | ON ROADMAP (Phase 4) | 2 | Important | Critical | Important |
| SLA tracking and breach alerts | NOT ON ROADMAP | 1 | Critical | Critical | Critical |
| AI triage agent | ON ROADMAP (Phase 9b) | 2 | N/H | Important | N/H |

**Assessment**: The Issue model is solid but there is no SLA framework at all — no SLA definitions, no target times, no breach detection, no SLA dashboard. Every profile needs this.

### Domain 6: Financial & Commercial

| Capability | Status | Score | A | B | C |
|------------|--------|-------|---|---|---|
| Basic rate fields on lane-carrier | PARTIAL | 3 | - | - | - |
| Rate management engine | ON ROADMAP (Phase 7) | 2 | Critical | Important | N/H |
| Quoting engine | ON ROADMAP (Phase 7) | 2 | Important | N/H | N/H |
| Invoicing | ON ROADMAP (Phase 7) | 2 | Critical | N/H | N/H |
| Freight audit | ON ROADMAP (Phase 7) | 2 | Important | Important | N/H |
| Client-specific SLA billing | NOT ON ROADMAP | 1 | Critical | N/H | N/H |

### Domain 7: Security & Monitoring

| Capability | Status | Score | A | B | C |
|------------|--------|-------|---|---|---|
| Tamper detection alerts | NOT ON ROADMAP | 1 | N/H | N/H | Critical |
| Theft / unauthorized movement detection | NOT ON ROADMAP | 1 | N/H | N/H | Critical |
| Corridor geofence breach alerts | ON ROADMAP (Phase 9) | 2 | N/H | N/H | Critical |
| Security command center dashboard | NOT ON ROADMAP | 1 | N/H | N/H | Critical |
| Temperature compliance monitoring | EXISTS | 5 | - | - | - |

### Domain 8: Warehouse Management

| Capability | Status | Score | A | B | C |
|------------|--------|-------|---|---|---|
| Inventory management | NOT ON ROADMAP | 1 | Critical | N/H | N/A |
| Warehouse operations (pick/pack/ship) | NOT ON ROADMAP | 1 | Critical | N/H | N/A |
| Yard management | ON ROADMAP (Phase 11) | 2 | Important | N/H | N/A |

### Domain 9: Analytics & Intelligence

| Capability | Status | Score | A | B | C |
|------------|--------|-------|---|---|---|
| Basic dashboard KPIs | PARTIAL | 3 | - | - | - |
| Operational reporting | ON ROADMAP (Phase 7) | 2 | Important | Critical | Important |
| Predictive analytics / ML | NOT ON ROADMAP | 1 | N/H | Critical | N/H |
| Event export API | EXISTS | 5 | - | - | - |

### Domain 10: Notifications & Real-Time

| Capability | Status | Score | A | B | C |
|------------|--------|-------|---|---|---|
| Email notifications (SMTP) | EXISTS | 5 | - | - | - |
| In-app notification centre | EXISTS | 5 | - | - | - |
| Real-time push (WebSocket/SSE) | NOT ON ROADMAP | 1 | Important | Critical | Critical |

---

## Part 3: Profile-Specific Analysis

### Profile A: Global 3PL/4PL Provider — Readiness ~28/100

**What works today**: Order ingestion (EDI 850, CSV), shipment management, carrier tendering, EDI 204/990 for carrier communication, document generation (BOL, labels), white-label theming, cold chain compliance. A 3PL could use these for road freight operations today.

**Show-stopper gaps (score 1, weight Critical):**

1. **Multi-client architecture** — Cannot serve multiple branded clients on one platform. Each client (e.g., a pharma company, a retailer) needs isolated data, separate SLAs, separate billing, and potentially separate branding. Current single-org model requires separate deployments per client.

2. **Warehouse Management** — No inventory model, no pick/pack/ship workflow, no warehouse operations. A 3PL's core business is warehousing + distribution. Recommendation: integrate with external WMS rather than build from scratch.

3. **Hub-and-spoke network** — Lanes are point-to-point corridors. No hub classification, spoke routing, cross-dock logic, or network optimization. This is how 3PLs structure their entire distribution network.

4. **Multi-modal transport** — Schema is road-only. No air/ocean/rail leg concept. A global 3PL moves freight across all modes, often within a single shipment (truck to port, ocean, truck from port).

5. **Control tower dashboard** — The existing dashboard is basic KPIs. A 3PL control tower needs 24/7 live maps, alert streams across all clients, SLA gauges, and drill-down to any shipment.

6. **Client-specific billing/SLAs** — No SLA model, no billing engine, no client-specific pricing rules.

**What's closest on roadmap**: Phase 7 (financials), Phase 8b (EDI expansion), Phase 11 (yard management, load planning).

### Profile B: Enterprise Shipper Control Tower — Readiness ~35/100

**What works today**: Order lifecycle tracking, shipment visibility with GPS, carrier management and tendering, EDI integration for supplier/carrier communication, issue tracking, event-driven architecture with export API, cold chain monitoring.

**Show-stopper gaps:**

1. **Control tower command center** (score 1) — The core requirement. Needs: live shipment map with status color-coding, multi-carrier tracking aggregation, exception drill-down, SLA dashboard with breach alerts, predictive alerts. Nothing close to this exists.

2. **Predictive/prescriptive analytics** (score 1) — Core value proposition: predict delays before they happen, recommend carrier selection, forecast disruptions. No ML pipeline, no predictive models.

3. **Multi-carrier tracking aggregation** (score 2) — Ships with dozens of carriers. Needs unified tracking across all via carrier API integration. Phase 4 plans this but nothing is built.

4. **SLA management** (score 1) — Must define targets per lane/carrier/customer and get breach alerts. No SLA model exists.

5. **Real-time push** (score 1) — Control tower dashboards need live updates via WebSocket/SSE. Current architecture is pull-based.

**What's closest on roadmap**: Phase 4 (carrier API, triage), Phase 9 (ETA engine, route intelligence), Phase 9b (AI triage, analytics), Phase 9c (external data feeds).

### Profile C: Visibility/Security Service — Readiness ~32/100

**What works today**: IoT device management is the strongest fit — device registry, sensor readings (temp, humidity, light, impact, tilt, GPS), webhook ingestion, geofence/WiFi/BLE arrival detection, cold chain compliance with immutable audit trail. The raw data pipeline is excellent.

**Show-stopper gaps:**

1. **Security intelligence layer** (score 1) — Raw sensor data exists but no security rules on top. Need: tamper detection (light sensor = door open, impact > threshold = potential theft), unauthorized movement detection (GPS movement while status = stationary), configurable alert rules per device/shipment.

2. **Multi-customer platform** (score 1) — Must serve multiple enterprise customers on one platform with per-customer branding, data isolation, and user management. Same multi-tenant gap as Profile A.

3. **Security command center** (score 1) — Purpose-built dashboard: live device map with color-coded status, alert queue with severity filtering, customer-filtered views, quick-action buttons (acknowledge, escalate, dispatch).

4. **Real-time alerting** (score 1) — Security monitoring requires sub-second alert delivery. Current architecture is pull-based notifications + email. WebSocket/SSE is essential.

5. **Corridor geofencing** (score 2) — Route corridor geofences (not just point-radius) to detect deviations in real-time. On roadmap (Phase 9) but critical for security.

**Strongest foundation**: The IoT pipeline (8 sub-capabilities at score 5) is the best starting point of any profile. The gap is the intelligence/alerting layer on top, not the data collection.

---

## Part 4: Gaps Not Covered by Current Roadmap

These capabilities are needed by one or more profiles but appear **nowhere** in `roadmap.md`:

| Gap | Profiles | Impact |
|-----|----------|--------|
| Multi-client/multi-tenant architecture | A (Critical), C (Critical) | Deepest architectural change. Affects data model, API, auth, UI, deployment |
| WMS / warehouse operations | A (Critical) | Entire separate domain. Recommend integration over build |
| Hub-and-spoke network modeling | A (Critical) | New domain concepts: hub nodes, spoke connections, cross-dock, network optimization |
| SLA management framework | All three (Critical) | SLA model, monitoring engine, breach detection, dashboard |
| Control tower / command center dashboard | All three (Critical) | Purpose-built real-time operational dashboard |
| Real-time push (WebSocket/SSE) | B (Critical), C (Critical) | Server-push for live dashboards and immediate alerts |
| Security intelligence rules engine | C (Critical) | Tamper, theft, corridor breach detection rules |
| Predictive analytics / ML pipeline | B (Critical) | Delay prediction, demand forecasting, recommendation engine |

---

## Part 5: Recommendations

### Platform-Wide Investments (Benefit All Profiles)

| Priority | Recommendation | Effort | Profiles |
|----------|---------------|--------|----------|
| P0 | **Multi-tenant/multi-client architecture** — Add `Client` entity within `Organization`, data scoping, client-specific config, client-scoped access. Unlocks 3PL and visibility service models | 8-12 weeks | A, C |
| P0 | **Control tower dashboard framework** — Configurable real-time dashboard: live map, alert stream, KPI gauges, entity drill-down. Each profile customizes differently | 6-8 weeks | All |
| P0 | **SLA management framework** — SLA model (metrics, targets, thresholds per lane/carrier/customer), monitoring engine, breach detection, dashboard | 4-6 weeks | All |
| P1 | **Multi-modal transport support** — `transportMode` enum on shipment legs, mode-specific fields, mode-specific tracking integration | 4-6 weeks | A, B |
| P1 | **Real-time push (WebSocket/SSE)** — Server-sent events for live dashboards, alert notifications. Build on existing event bus | 3-4 weeks | B, C |
| P1 | **Complete Phase 4 triage centre** — Kanban, auto-triage, comments. Foundation for all exception management | 3-4 weeks | All |
| P2 | **Complete Phase 7 financials** — Rates, quoting, invoicing, freight audit | 8-12 weeks | A, B |

### Profile A-Specific

| Priority | Recommendation | Effort |
|----------|---------------|--------|
| P0 | Integrate with external WMS (define integration interface: receiving events, inventory sync, pick/pack/ship triggers) | 6-8 weeks |
| P0 | Build hub-and-spoke network model: hub Location type, spoke lanes, cross-dock logic | 6-8 weeks |
| P1 | Client-specific billing engine on multi-tenant framework | 6-8 weeks |
| P1 | Accelerate Phase 8b (EDI Hub): AS2, EDI 214/210, SAP mapping | 8-12 weeks |

### Profile B-Specific

| Priority | Recommendation | Effort |
|----------|---------------|--------|
| P0 | PO-to-delivery milestone tracking: milestone model, supplier/retailer integration | 6-8 weeks |
| P0 | Multi-carrier tracking: carrier API adapters, pluggable interface | 8-12 weeks |
| P1 | Predictive analytics: delay prediction from historical data, rule-based first, evolve to ML | 8-12 weeks |
| P1 | Customer portal (Phase 8): self-service visibility for internal teams | 4-6 weeks |

### Profile C-Specific

| Priority | Recommendation | Effort |
|----------|---------------|--------|
| P0 | Security intelligence layer: tamper rules (light/impact sensors), unauthorized movement detection, configurable alert rules | 4-6 weeks |
| P0 | Corridor geofencing: polyline/corridor geofences for routes, real-time breach detection | 4-6 weeks |
| P1 | Security command center: live device map, alert queue, customer-filtered views | 4-6 weeks |
| P1 | Multi-device provider support: adapters beyond System Loco | 4-6 weeks |

---

## Part 6: Roadmap Adjustment Proposal

### Current Phase Order vs Proposed

Insert three new phases to address the cross-cutting gaps:

1. **Phase 4** (keep, current priority) — Triage centre, carrier API, driver mobile
2. **NEW Phase 4.5: Multi-Tenant & SLA** — Client model, data scoping, SLA definitions, breach detection
3. **NEW Phase 4.6: Control Tower Dashboard** — Real-time dashboard, live map, alert stream, WebSocket/SSE
4. **Phase 5** (keep) — IoT linking, telemetry — enhance with security alerting rules
5. **NEW Phase 5.5: Multi-Modal Transport** — Transport mode on shipments, air/ocean/rail tracking, carrier API aggregation
6. **Phase 7** (keep) — Financial module
7. **Phase 8b** (keep, accelerate for Profile A) — EDI Communication Hub
8. **Phase 8c** (keep) — Carrier Intelligence
9. **Phase 9+** (keep) — Routes, AI, data feeds, observability, advanced ops

### Roadmap Coverage After Adjustments

| Profile | Current Coverage | After Adjustments |
|---------|-----------------|-------------------|
| A: 3PL/4PL | 40% | ~70% (WMS still requires external integration) |
| B: Enterprise Shipper | 55% | ~80% (ML/predictive still long-term) |
| C: Visibility/Security | 35% | ~75% (multi-device ecosystem still growing) |

---

## Part 7: Strategic Positioning Assessment

### What Open TMS Gets Right
- **Event-driven CQRS architecture** is the correct foundation for a control tower. Domain events + read models + event export API = the right pattern for real-time visibility and analytics
- **IoT pipeline** is production-grade and directly applicable to all three profiles
- **Cold chain compliance** (CFR 21 Part 11) is a genuine differentiator — most open-source TMS products don't have this
- **EDI X12 support** with unified Trading Partner model is enterprise-grade
- **Carrier tendering** with broadcast/waterfall + portal is a complete workflow
- **White-label theming** is a good start for the "as-a-service" model

### What Needs the Biggest Mindset Shift
The software was originally designed for **a single shipper managing their own logistics**. The three target profiles all need **platform capabilities** — serving multiple parties, aggregating across carriers/clients, providing real-time command centers. The transition from "single-company tool" to "multi-party platform" is the biggest architectural evolution needed.

### Honest Assessment
- **Profile C (Visibility/Security)** is the fastest path to readiness — the IoT foundation is strong, and the gaps (security rules, multi-tenant, command center) are well-scoped additions on top of existing infrastructure
- **Profile B (Enterprise Shipper)** is the most natural fit for the current architecture — it's closest to the original "shipper managing logistics" design, just needs the control tower dashboard and carrier aggregation layers
- **Profile A (3PL/4PL)** is the biggest stretch — WMS, hub-and-spoke, multi-modal, and multi-client billing are each substantial domains. The 3PL play likely requires a companion WMS product

### Digital Twin Vision
The existing `TrackableUnit` + `Device` + `DeviceAssignment` + `SensorReading` + `DeviceEvent` models are the embryo of a digital twin framework. Each physical asset (pallet, container, vehicle) has a digital representation with real-time sensor state. Extending this to warehouse inventory and fleet assets is architecturally natural — the event-driven backbone and IoT pipeline carry over directly.
