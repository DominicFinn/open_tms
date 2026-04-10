# Triage Control Tower Guide

The Triage Centre is a dedicated app within Open TMS for managing transportation exceptions at scale. It surfaces real problems from noisy sensor data, provides Jira-like issue management, and is designed to be driven by automation agents in the future.

## Overview

Access the Triage Centre from the app switcher (the grid icon in the top bar) — it has its own sidebar with:

- **Signal Dashboard** — command-centre landing page
- **All Issues** — kanban/list board
- **Search** — full-text search across all issues
- **Spot Check** — manager review of resolved issues
- **Reports** — metrics and analytics
- **Boards** — saved filter views (custom boards)

## Core Concepts

### Issues

An issue represents a transportation exception that needs attention. Issues have:

| Field | Description |
|-------|-------------|
| `issueNumber` | Auto-incrementing human-readable ID (ISS-001, ISS-002, ...) |
| `status` | Kanban column: `new` → `investigating` → `escalated` → `resolved` → `closed` |
| `severity` | `high`, `medium`, `low` |
| `priority` | 1 (critical) through 5 (trivial) |
| `category` | Delivery Delay, Freight Damage, Equipment, Documentation, Communication, Compliance, Billing, Weather, General |
| `signalScore` | 0–100 confidence score. Higher = more likely a real problem |
| `isNoise` | Auto-dismissed as a false positive |
| `source` | `manual`, `auto_exception`, `auto_tracking`, `auto_sensor` |

Issues link to shipments, orders, carriers, customers, and lanes for full context.

### Signal vs Noise

IoT sensors and exception events generate a flood of alerts. Many are false positives — a brief temperature spike when a reefer door opens, GPS jitter triggering a geofence exit, battery readings during charging cycles.

The triage system actively filters noise:

1. **Signal scoring** — Every issue gets a confidence score (0–100):
   - Single brief sensor spike: **20** (likely false positive)
   - Sustained excursion (5+ readings over 15 min): **85** (real problem)
   - Impact alert: **70** (impacts are rarely false)
   - Shipment/order exceptions: **75** (high confidence)
   - Geofence events: **40** (GPS jitter risk)

2. **Deduplication** — Repeated alerts for the same shipment+category don't create duplicate issues. Instead, the existing issue's `correlatedEvents` count increments and the `signalScore` increases (more corroborating events = higher confidence).

3. **Auto-dismiss** — Issues with `signalScore < 30` that remain untouched for 2 hours get flagged as `isNoise = true`. They're hidden from boards by default but remain searchable.

4. **Dashboard focus** — The Signal Dashboard ranks issues by signal score, not just recency. High-confidence, high-severity issues surface first.

### Custom Boards

Boards are saved filter configurations. A company might create:

- **"Walmart Shipments"** — filtered to `customerId = walmart-uuid`
- **"Cold Chain Alerts"** — filtered to `filterTempControlled = true`
- **"EU Region"** — filtered to `filterRegion = ["GB", "DE", "FR", "NL"]`
- **"Hazmat Team"** — filtered to `filterHazmat = true`
- **"High Priority Only"** — filtered to `filterPriority = [1, 2]`

Boards appear in the sidebar under "Boards" and can be shared with the entire org.

## Auto-Triage from Events

The `TriageHandler` event handler runs in the worker process and subscribes to:

| Event | Source | Default Signal Score |
|-------|--------|---------------------|
| `shipment.exception` | Shipment status changes | 75 |
| `order.exception` | Order delivery exceptions | 75 |
| `sensor.alert_temperature` | IoT temperature breach | 30 (boosted by corroboration) |
| `sensor.alert_impact` | IoT impact/shock detection | 70 |
| `sensor.alert_battery` | IoT battery critical | 60 |
| `sensor.alert_light` | IoT unexpected light exposure | 45 |
| `tracking.geofence_entered` | GPS geofence event | 40 |
| `integration.outbound_failed` | Integration delivery failure | 60 |

When an event fires, the handler:

1. Checks for an existing open issue on the same entity+category (dedup)
2. If duplicate → increments `correlatedEvents`, boosts `signalScore`
3. If new → creates issue with enriched metadata:
   - `priority` mapped from exception type (damage=1, delay=3, weather=4)
   - `region` derived from shipment/order destination country
   - `carrierId`, `customerId`, `laneId` populated from the shipment
   - `tags` set based on shipment characteristics (e.g., `["temperature-controlled", "hazmat", "sensor-alert"]`)

## API Reference

### Issue Endpoints

```
GET    /api/v1/issues                    List issues (rich filtering)
GET    /api/v1/issues/stats              Counts by status, priority, SLA breaches
GET    /api/v1/issues/signal             Signal dashboard aggregation
GET    /api/v1/issues/spot-check         Resolved issues for manager review
GET    /api/v1/issues/actionable         Agent-friendly: unassigned high-signal issues
POST   /api/v1/issues                    Create issue
GET    /api/v1/issues/:id                Get issue with comments + activities
PATCH  /api/v1/issues/:id                Update fields
POST   /api/v1/issues/:id/transition     Move between kanban columns
POST   /api/v1/issues/:id/resolve        Resolve with notes
POST   /api/v1/issues/:id/comments       Add comment
GET    /api/v1/issues/:id/timeline       Activity timeline
GET    /api/v1/issues/:id/context        Rich context (shipment, order, IoT data)
POST   /api/v1/issues/batch/transition   Batch status change
POST   /api/v1/issues/batch/assign       Batch assignment
POST   /api/v1/issues/batch/dismiss-noise Batch noise dismissal
```

### Filtering (GET /api/v1/issues)

| Param | Type | Description |
|-------|------|-------------|
| `search` | string | Full-text search on title, description, issue number |
| `status` | string | Filter by status |
| `severity` | string | `high`, `medium`, `low` |
| `priority` | int | 1–5 |
| `category` | string | Category name |
| `customerId` | uuid | Issues linked to this customer |
| `carrierId` | uuid | Issues linked to this carrier |
| `laneId` | uuid | Issues linked to this lane |
| `region` | string | Country code |
| `isNoise` | boolean | Show noise issues (default: false) |
| `signalScoreMin` | int | Minimum signal score |
| `dateFrom` / `dateTo` | ISO date | Created date range |
| `sortBy` | string | `createdAt`, `priority`, `signalScore`, `severity` |
| `sortOrder` | string | `asc` or `desc` |

### Board Endpoints

```
GET    /api/v1/triage-boards             List saved boards
POST   /api/v1/triage-boards             Create board
GET    /api/v1/triage-boards/:id         Get board config
PATCH  /api/v1/triage-boards/:id         Update board
DELETE /api/v1/triage-boards/:id         Delete board
GET    /api/v1/triage-boards/:id/issues  Issues matching board filters
```

### Agent-Friendly API

The `/actionable` endpoint is designed for future automation agents (N8N, LLM agents):

```bash
# Get the next issues an agent should work on
curl http://localhost:3001/api/v1/issues/actionable

# Agent resolves an issue
curl -X POST http://localhost:3001/api/v1/issues/{id}/resolve \
  -H "Content-Type: application/json" \
  -d '{"resolutionNotes": "Auto-resolved: carrier confirmed delivery"}'

# Agent batch-assigns issues to a human
curl -X POST http://localhost:3001/api/v1/issues/batch/assign \
  -H "Content-Type: application/json" \
  -d '{"issueIds": ["id1", "id2"], "assigneeId": "user-uuid", "assigneeName": "Jane S."}'

# Agent dismisses noise
curl -X POST http://localhost:3001/api/v1/issues/batch/dismiss-noise \
  -H "Content-Type: application/json" \
  -d '{"issueIds": ["id1"], "reason": "Brief temp spike during door-open cycle"}'
```

## Frontend Pages

| Route | Page | Purpose |
|-------|------|---------|
| `/triage` | Signal Dashboard | Exception heatmap, signal/noise ratio, stuck issues |
| `/triage/board` | All Issues | Kanban/list board with rich filters |
| `/triage/board/:boardId` | Custom Board | Board with saved filters applied |
| `/triage/issues/:id` | Issue Detail | Full detail with timeline, IoT context, comments |
| `/triage/search` | Search | Full-text search with advanced filters |
| `/triage/spot-check` | Spot Check | Manager review of resolved issues |
| `/triage/reports` | Reports | Metrics and analytics |
| `/triage/boards/create` | Board Editor | Create saved board |
| `/triage/boards/:id/edit` | Board Editor | Edit saved board |

## Data Model

### Issue

Core fields: `issueNumber`, `title`, `description`, `status`, `severity`, `priority`, `category`, `tags`

Linked entities: `shipmentId`, `orderId`, `carrierId`, `customerId`, `laneId`, `region`

Assignment: `assigneeId`, `assigneeName`, `escalatedAt`, `resolvedAt`, `closedAt`, `resolvedBy`, `resolutionNotes`

Signal processing: `signalScore`, `correlatedEvents`, `isNoise`, `noiseReason`

Metrics: `timeToFirstResponse`, `timeToResolution`, `lastActivityAt`, `activityCount`

Source: `source`, `sourceEventId`, `slaDeadline`, `slaBreach`

### IssueActivity

Every status change, assignment, comment, and signal update is recorded as an `IssueActivity` with: `actorName`, `action`, `details` (JSON with from/to values), `createdAt`.

### TriageBoard

Saved filter configuration with: `name`, `description`, `icon`, filter fields for every dimension (status, severity, priority, category, customer, carrier, lane, region, temp-controlled, hazmat, signal score, noise), display preferences (`viewMode`, `sortBy`, `sortOrder`), and sharing (`isShared`).

## Future: Automation Agents

The triage system is architected to support N8N-style automation agents that:

1. **Poll** `/api/v1/issues/actionable` for work
2. **Investigate** using `/api/v1/issues/:id/context` (IoT data, shipment events)
3. **Act** via batch endpoints (transition, assign, resolve, dismiss noise)
4. **Log** their reasoning as comments via `POST /api/v1/issues/:id/comments`

The `TriageBoard` model's filter configuration is designed to be agent-assignable — in the future, an agent can be pointed at a specific board (e.g., "Temperature Alerts") and work through its backlog autonomously.
