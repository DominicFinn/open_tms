# CLAUDE.md — Project Conventions for Open TMS

## Project Structure

- **Monorepo** with `backend/`, `frontend/`, `edi-collector/`, `packages/shared/`
- Root `package.json` has hoisted `node_modules`; run `npm install` from root
- Backend: Fastify + TypeScript + Prisma + PostgreSQL (port 3001)
- Frontend: React 18 + TypeScript + Vite (port 5173)

## Backend Conventions

### API Response Envelope
All endpoints return `{ data, error }` — never a bare object.

### Dependency Injection
- DI container in `backend/src/di/` with Symbol-based tokens (`TOKENS`)
- Register new services/repos in `backend/src/di/registry.ts`
- Routes resolve dependencies via `container.resolve<Interface>(TOKENS.Token)`

### Repository Pattern
- Interface + DTO + Implementation per entity
- All DB access goes through repositories, never raw Prisma in routes

### Routes
- Register in `backend/src/index.ts`
- Add Swagger/OpenAPI `schema` blocks to every endpoint
- Use `tags` for grouping in Swagger UI
- Nullable JSON fields must use `Prisma.JsonNull`, not `null`

### File Storage
- Storage keys are opaque: `files/{uuid}` — no entity info, filenames, or customer data
- All file ops go through `IBinaryStorageProvider` (S3 or DB fallback)
- Default retention: 10 years

## Frontend Conventions

### Theming — CRITICAL
- **All colors** come from CSS custom properties defined in `frontend/src/theme.css`
- **NEVER hardcode colors** in components — no hex values, no `rgb()`, no named colors in inline styles or component code
- Use `var(--token-name)` for all color references
- For modal overlays: `var(--overlay-bg)`
- For modal shadows: `var(--modal-shadow)`
- For map markers: `var(--marker-origin)`, `var(--marker-destination)`, `var(--marker-stop)`, `var(--marker-default)`
- For status colors: `var(--color-success)`, `var(--color-error)`, `var(--color-warning)`, `var(--color-info)`
- If you need a new color, add it to `theme.css` first

### Theme System
- `ThemeProvider.tsx` loads theme config from the backend API and applies CSS overrides
- Theme is cached in `sessionStorage` with `themeUpdatedAt` for invalidation
- `useTheme()` hook provides `hasLogo`, `logoUrl`, `reloadTheme()`
- The entire app is wrapped in `<ThemeProvider>` in `main.tsx`

### CSS Classes
Reference the canonical class list at the top of `theme.css`:
- Layout: `.card`, `.page-header`
- Buttons: `.button`, `.button-outline`, `.button-success`, `.button-danger`, `.icon-btn`
- Forms: `.text-field`, `.field-error`, `.field-hint`, `.form-grid`, `.form-actions`
- Tables: `.data-table` inside `.table-container`
- Status: `.chip .chip-{success|warning|error|info|primary|secondary}`
- Feedback: `.alert .alert-{error|success|info|warning}`, `.loading-spinner`
- Modal: `.modal-backdrop > .modal-card`

### Multi-App Layout
- Three apps: Operations (`/`), Integrations (`/integrations`), Admin (`/admin`)
- Each has its own layout: `layout.tsx`, `integrations-layout.tsx`, `admin-layout.tsx`
- AppSwitcher component in the AppBar switches between apps
- Settings, document templates, custom fields, and theme management live under `/admin`

### Component Patterns
- Pages go in `frontend/src/pages/`
- Reusable components go in `frontend/src/components/`
- API base URL from `frontend/src/api.ts` (`API_URL`)
- No styled-components or CSS-in-JS libraries — use theme.css classes + inline styles with CSS variables

### VNext Design System — PREFERRED FOR NEW WORK
- VNext is the new design system at `/vnext`, defined in `frontend/src/vnext-design/vnext.css`
- **All VNext CSS classes use the `vn-` prefix** (e.g., `vn-card`, `vn-btn`, `vn-chip-success`)
- VNext uses the SAME CSS custom properties from `theme.css` — never hardcode colors
- Layout: Fixed sidebar (`vn-sidebar`) + sticky topbar (`vn-topbar`) via `vnext-layout.tsx`
- Reusable React components in `frontend/src/vnext-design/components/` — import from barrel `index.ts`
- Full documentation: `frontend/src/vnext-design/DESIGN_SYSTEM.md`
- **Forms:** Use `vn-field` > `vn-field-label` + `vn-input` (top labels, NOT floating)
- **Form layout:** `vn-form-grid` (2-col desktop, 1-col mobile), `vn-form-section` for grouping
- **Modals:** `vn-modal-backdrop` > `vn-modal` with `vn-modal-header` / `vn-modal-body` / `vn-modal-footer`
- **Alerts:** `vn-alert vn-alert-{success|error|warning|info}`
- **Tables:** `vn-table-wrap` > `vn-table`, with `vn-table-id` and `vn-table-secondary` for cell content
- **Filters:** `vn-filters` with `vn-filter-input` and `vn-filter-select`
- **Tabs:** `vn-tabs` > `vn-tab` buttons with `.active` class
- **Detail pages:** `vn-detail-grid` with `vn-detail-main` + `vn-detail-sidebar` (sticky)
- **Stats:** `vn-stats` > `vn-stat` with icon variants (primary, success, warning, error, info)
- VNext pages go in `frontend/src/vnext-design/VNext*.tsx`
- When building new features, **prefer vnext patterns** unless specifically told to use the old system

## ETA Monitoring & Route Tracking

### Architecture
The ETA monitoring system runs as a pg-boss cron job that checks in-transit shipments against traffic-aware routing APIs. It uses a **provider-agnostic interface** (`IRoutingProvider`) so the routing backend can be swapped via environment config.

### Routing Providers
- **TomTom** — Cheapest truck routing ($0.50/1K requests), full vehicle dimension support
- **HERE** — Industry standard for logistics ($2.50/1K), best truck routing data
- **Valhalla** — Self-hosted, free, truck costing model but no real-time traffic

Provider selection: set `ROUTING_PROVIDER=tomtom|here|valhalla` plus the provider's API key/URL.

### Adaptive Polling
The monitor uses adaptive polling to minimize API costs:
- >8 hours from delivery: checked every ~40 min
- 2-8 hours from delivery: checked every ~20 min
- <2 hours from delivery: checked every ~10 min
- Stale GPS (>60 min) or no GPS: skipped entirely

### Delay Severity Levels
| Severity | Default Threshold | Event | Notification |
|----------|:-----------------:|-------|:------------:|
| Minor | 15 min | `tracking.eta_updated` | info |
| Warning | 30 min | `tracking.eta_updated` | warning |
| Critical | 60 min | `tracking.eta_updated` + `shipment.exception` | error |

### Key Files
- `backend/src/services/routing/IRoutingProvider.ts` — Provider interface and DTOs
- `backend/src/services/routing/HereRoutingProvider.ts` — HERE implementation
- `backend/src/services/routing/TomTomRoutingProvider.ts` — TomTom implementation
- `backend/src/services/routing/ValhallaRoutingProvider.ts` — Valhalla implementation
- `backend/src/services/routing/ShipmentEtaMonitorService.ts` — Core monitoring engine
- `backend/src/workers/etaMonitorWorker.ts` — pg-boss cron worker
- `backend/src/routes/etaMonitor.ts` — API routes (status, manual run, single-shipment check)
- Full documentation: `docs/ETA_MONITORING_GUIDE.md`

### Route Deviation Alerts
The ETA monitor also checks for route deviations on shipments with a lane that has a planned route (`LaneRoute`). During each cycle, it compares the shipment's GPS position against the lane route's encoded polyline using point-to-segment distance calculation.

**LaneRoute model** stores per-lane planned routes with:
- Google-encoded polyline string of the planned path
- Decoded waypoints JSON for quick access
- Distance/duration metadata from Google Maps Directions API
- Configurable corridor (default: 5000m) for deviation threshold

**Route Planning** is done on the lane create/edit page (`VNextCreateLane.tsx`) using a Google Maps DirectionsRenderer with drag support. Users auto-fill from origin/destination, add hub-and-spoke stops as waypoints, and drag the route to adjust.

**Requires:** Google Maps API key configured in organization settings. Without it, the route planning UI shows a warning and route deviation detection is skipped.

#### Deviation Events
| Severity | Condition | Event |
|----------|-----------|-------|
| Warning | Distance > corridor | `tracking.route_deviation` |
| Critical | Distance > 2x corridor | `tracking.route_deviation` + `shipment.exception` (type: `route_deviation`) |

#### Key Files (Route Deviation)
- `backend/src/services/routing/GoogleMapsDirectionsService.ts` - Google Maps API + polyline encode/decode
- `backend/src/services/routing/RouteDeviationService.ts` - Point-to-polyline deviation detection
- `backend/src/routes/laneRoutes.ts` - Lane route CRUD + calculate + check-deviation API
- `frontend/src/components/GoogleMapsRouteEditor.tsx` - Draggable Google Maps route editor
- `frontend/src/vnext-design/VNextCreateLane.tsx` - Lane form with integrated route planning
- `frontend/src/vnext-design/VNextLaneDetail.tsx` - Lane detail with route visualization
- `backend/src/__tests__/services/RouteDeviationService.test.ts` - 15 tests (deviation detection, polyline, haversine)

## Carrier API Integration (FedEx, UPS, DHL)

### Architecture
The carrier tracking system provides automatic shipment status updates from carrier APIs. It uses a **provider-agnostic interface** (`ICarrierTrackingProvider`) so the tracking backend can be swapped or extended. Each carrier gets a `CarrierTrackingIntegration` record with credentials, polling/webhook config, and rate limits.

### Providers
- **FedEx** - OAuth 2.0, batch polling (up to 30), webhooks, 10K/day rate limit
- **UPS** - OAuth 2.0, single-tracking polling, Track Alert webhooks, 5K/day rate limit
- **DHL** - API key, single-tracking polling, webhooks, 250/day rate limit

Provider selection is per-carrier via the setup wizard in the Integrations app.

### Status Bridging
The `CarrierTrackingHandler` automatically bridges carrier tracking events to shipment lifecycle:
- **Delivery**: carrier `delivered` -> shipment status `delivered`, emits `shipment.delivered`
- **Exception**: carrier `exception` -> shipment status `exception`, emits `shipment.exception`
- **In-transit milestones**: carrier `in_transit` -> advances shipment status forward (never regresses)

### Polling Worker
`carrierTrackingPollWorker` runs every 5 minutes (configurable via `CARRIER_TRACKING_POLL_CRON`). Respects per-provider rate limits and polling intervals.

### Key Files
- `backend/src/services/carrierTracking/ICarrierTrackingProvider.ts` - Provider interface
- `backend/src/services/carrierTracking/CarrierTrackingService.ts` - Orchestrator
- `backend/src/services/carrierTracking/ProviderRegistry.ts` - Provider factory
- `backend/src/services/carrierTracking/providers/FedExTrackingProvider.ts` - FedEx implementation
- `backend/src/services/carrierTracking/providers/UPSTrackingProvider.ts` - UPS implementation
- `backend/src/services/carrierTracking/providers/DHLTrackingProvider.ts` - DHL implementation
- `backend/src/events/handlers/CarrierTrackingHandler.ts` - Status bridging handler
- `backend/src/repositories/CarrierTrackingIntegrationRepository.ts` - Integration CRUD
- `backend/src/routes/carrierTracking.ts` - API endpoints (CRUD, test, poll, webhook, events)
- `backend/src/workers/carrierTrackingPollWorker.ts` - Polling cron worker
- `backend/src/commands/carrierTracking/` - Command handlers
- `frontend/src/vnext-design/VNextCarrierTracking.tsx` - Integration list page
- `frontend/src/vnext-design/VNextCarrierTrackingSetup.tsx` - Setup wizard
- `frontend/src/vnext-design/VNextCarrierTrackingDetail.tsx` - Integration detail page
- `backend/src/__tests__/handlers/CarrierTrackingHandler.test.ts` - 16 handler tests
- `backend/src/__tests__/commands/CarrierTrackingCommands.test.ts` - 14 command tests

## EDI Communication Hub

### Architecture
The EDI system uses a **unified Trading Partner model** (`TradingPartner`) for all EDI communication. A single trading partner handles both inbound and outbound directions and multiple EDI transaction types. All EDI activity is logged to `EdiTransactionLog` with a unified schema.

The system has **shared X12 infrastructure** (`backend/src/services/edi/`) providing envelope building and parsing utilities used by all EDI services. A **universal inbound endpoint** (`POST /api/v1/edi/inbound`) auto-detects transaction types, routes to handlers, logs everything, and auto-generates 997 acknowledgments.

### Key Models
- **TradingPartner** — Represents any entity you exchange EDI with (customer, carrier, 3PL, ERP, etc.). Has SFTP + HTTP connection config, inbound polling config, and outbound delivery config.
- **TradingPartnerTransaction** — Registry of which EDI types a partner supports. Each entry has: `transactionType` (850, 204, 990, etc.), `direction` (inbound/outbound), `enabled`, `autoProcess`, `ack997Required`.
- **EdiTransactionLog** — Unified audit log for ALL inbound/outbound EDI files. Tracks parse results, created entities, 997 ack status, retry counts. `partnerId` is nullable for manual imports.

### Supported Transaction Types
| Code | Name | Direction | Status |
|------|------|-----------|--------|
| 850 | Purchase Order | Inbound | Active |
| 855 | PO Acknowledgment | Outbound | Active |
| 856 | Advance Ship Notice | Outbound | Active |
| 204 | Motor Carrier Load Tender | Outbound | Active |
| 990 | Response to Load Tender | Inbound | Active |
| 997 | Functional Acknowledgment | Both | Active |
| 214 | Shipment Status | Both | Active |
| 210 | Freight Invoice | Inbound | Active |
| 810 | Invoice | Outbound | Active |
| 820 | Payment Order/Remittance | Inbound | Active |

### EDI Flow - How It Works
1. **Inbound (SFTP)**: The `edi-collector` service polls SFTP directories for each TradingPartner with `inboundEnabled=true`. It downloads files and POSTs them to the **universal inbound endpoint** (`POST /api/v1/edi/inbound`). The backend auto-detects the type, validates partner support, routes to the correct handler, logs to EdiTransactionLog, and auto-generates 997 acknowledgments if configured.
2. **Inbound (API)**: Any system can POST EDI content directly to `/api/v1/edi/inbound` or to type-specific endpoints (e.g., `/api/v1/edi/214/inbound`).
3. **Outbound**: The `OutboundEdiDeliveryService` writes EDI files to SFTP or POSTs via HTTP. Called automatically when tenders are opened (EDI 204) and extensible for other outbound types.
4. **All routes log to EdiTransactionLog** - 990 inbound, 210 inbound, 820 inbound, 810 generate, 214 inbound/outbound.

### Shared X12 Infrastructure
- `X12EnvelopeBuilder` - Builds ISA/GS/ST/SE/GE/IEA envelopes with fixed-width ISA fields, GS functional identifiers, and accurate SE segment counts
- `X12EnvelopeParser` - Parses raw X12 with ISA separator detection, envelope validation, and body segment extraction
- `EdiOperationResult<T>` - Standard result type for all EDI operations (success, data, errors, warnings)
- `TRANSACTION_TO_GS` / `GS_TO_TRANSACTION` - Bidirectional mapping between transaction types and GS functional identifiers
- All generators have `validateAndGenerate()` methods that validate required fields before building

### Adding a New EDI Transaction Type
1. Write a parser service (for inbound) or generator service (for outbound) in `backend/src/services/`
2. Use `X12EnvelopeBuilder` / `X12EnvelopeParser` from `backend/src/services/edi/`
3. Add the transaction type to the route map in `EdiRouterService.ts`
4. Register the service in DI (`tokens.ts` + `registry.ts`)
5. Add a backend endpoint for processing, or use the universal inbound endpoint
6. All inbound routes should log to `EdiTransactionLog` via `TradingPartnerRepository`
7. Trading partners can then add the type to their config via the UI

### Key Files
- `backend/src/services/edi/X12EnvelopeBuilder.ts` — Shared X12 envelope builder (ISA/GS/ST/SE)
- `backend/src/services/edi/X12EnvelopeParser.ts` — Shared X12 envelope parser with validation
- `backend/src/services/edi/types.ts` — Shared types (EdiOperationResult, X12EnvelopeConfig, etc.)
- `backend/src/repositories/TradingPartnerRepository.ts` — CRUD + log methods (findLogsWithPagination, getLogStats)
- `backend/src/services/EdiRouterService.ts` — Transaction type detection and routing
- `backend/src/services/OutboundEdiDeliveryService.ts` — SFTP/HTTP delivery engine
- `backend/src/services/EDI204Service.ts` — EDI 204 Motor Carrier Load Tender generator
- `backend/src/services/EDI210ParseService.ts` — EDI 210 Freight Invoice parser (inbound)
- `backend/src/services/EDI214ParseService.ts` — EDI 214 Shipment Status parser (inbound)
- `backend/src/services/EDI214Service.ts` — EDI 214 Shipment Status generator (outbound)
- `backend/src/services/EDI810Service.ts` — EDI 810 Invoice generator (outbound)
- `backend/src/services/EDI820ParseService.ts` — EDI 820 Payment/Remittance parser (inbound)
- `backend/src/services/EDI850ParseService.ts` — Purchase Order parser
- `backend/src/services/EDI855Service.ts` — EDI 855 PO Acknowledgment generator (outbound)
- `backend/src/services/EDI856Service.ts` — Advance Ship Notice generator
- `backend/src/services/EDI990ParseService.ts` — EDI 990 Response to Load Tender parser
- `backend/src/services/EDI997Service.ts` — Functional Acknowledgment generator
- `backend/src/services/edi214StatusMapping.ts` — AT7 status code to internal status mapping
- `backend/src/routes/ediInbound.ts` — Universal inbound endpoint (auto-detect, route, log, 997)
- `backend/src/routes/tradingPartners.ts` — Partner management + unified EDI log endpoints
- `backend/src/routes/ediTender.ts` — EDI 204 preview and 990 inbound endpoints
- `backend/src/routes/edi214.ts` — EDI 214 inbound, generate, and preview endpoints
- `backend/src/routes/edi210.ts` — EDI 210 inbound, preview, and 810 generate
- `backend/src/routes/edi820.ts` — EDI 820 inbound and preview
- `edi-collector/src/collector.ts` — SFTP polling, sends to universal inbound endpoint
- `frontend/src/vnext-design/VNextEdiDashboard.tsx` — EDI health dashboard
- `frontend/src/vnext-design/VNextTradingPartners.tsx` — Partner management (VNext)
- `frontend/src/vnext-design/VNextEdiTransactionLog.tsx` — Unified transaction log viewer
- `backend/src/__tests__/services/X12EnvelopeBuilder.test.ts` — 19 builder tests
- `backend/src/__tests__/services/X12EnvelopeParser.test.ts` — 21 parser tests

### Legacy Compatibility
The old `EdiPartner` and `OutboundIntegration` models still exist. The migration copies their data into TradingPartner. The edi-collector's legacy `collectFromPartner()` function is preserved but deprecated. Old UI pages are preserved as "(Legacy)" in the integrations nav.

## Agent Decision Logging (AI Compliance & Audit)

### Architecture
Every AI agent decision is logged through a dedicated "decision endpoint" for compliance and automation discovery. The system captures: what was decided, why (reasoning), what context the agent had, what action was taken, and the outcome (recorded later via human review).

### Key Concepts
- **Decision** — A logged judgment call by an AI agent, including full reasoning chain and context snapshot
- **Outcome** — Human review of whether the decision was correct/incorrect/partially correct
- **Promotion** — "Graduating" a proven decision pattern into a deterministic automation rule (no AI needed)

### Decision Flow
1. Agent receives trigger (domain event, schedule, manual)
2. Agent gathers context, calls LLM, produces decision
3. Decision logged via `POST /api/v1/agent-decisions` (the "decision endpoint")
4. Human reviews and records outcome via `PUT /api/v1/agent-decisions/:id/outcome`
5. Proven patterns promoted to automation via `POST /api/v1/agent-decisions/:id/promote`

### Triage Agent
The first agent implementation (`TriageAgentHandler`) subscribes to exception events and uses Claude to triage them. It can create issues, escalate existing ones, or take no action. Every decision is logged for compliance.

**Enable:** Set `ANTHROPIC_API_KEY` env var. Optionally `ANTHROPIC_MODEL` (default: `claude-sonnet-4-20250514`).

**Subscribed events:** `shipment.exception`, `sla.breached`, `cargo.misdrop_detected`, `cargo.missing_at_stop`, `cargo.left_on_vehicle`, `cold_chain.excursion_detected`

### Configurable Agent Prompts
Agent behaviour is configurable per-org via `AgentConfig` + versioned prompts (`AgentConfigVersion`). The handler subscribes broadly to wildcard event patterns and filters against config at runtime (no worker restart needed).

**Configurable:** system prompt (with `{{event}}`, `{{shipment}}`, `{{issues}}`, `{{sla_status}}` template variables), subscribed events (checkboxes), temperature, max tokens, confidence threshold, deduplication window, enabled toggle.

**Prompt versioning:** Every prompt change creates an immutable version. Each `AgentDecision` links to the version that produced it via `promptVersionId`. Rollback by activating any previous version.

**Auto-seed:** Default config with hardcoded prompt is created on first worker startup if none exists.

### Key Files
- `backend/src/commands/agentDecisions/` — Create, RecordOutcome, Promote command handlers
- `backend/src/repositories/AgentDecisionRepository.ts` — Repository with filtering and stats
- `backend/src/events/projections/AgentDecisionProjection.ts` — Read model projection
- `backend/src/routes/agentDecisions.ts` — API routes (6 endpoints)
- `backend/src/services/llm/ILlmProvider.ts` — Provider-agnostic LLM interface
- `backend/src/services/llm/AnthropicLlmProvider.ts` — Claude implementation
- `backend/src/events/handlers/TriageAgentHandler.ts` — AI triage agent event handler
- `backend/src/__tests__/handlers/TriageAgentHandler.test.ts` — Triage agent tests
- `backend/src/routes/agentConfig.ts` — Agent config CRUD + prompt versioning API
- `backend/src/__tests__/handlers/TriageAgentHandler.test.ts` — Triage agent tests (12 tests)
- `backend/src/__tests__/commands/AgentDecisionCommands.test.ts` — Command handler tests
- `backend/src/__tests__/projections/AgentDecisionProjection.test.ts` — Projection tests

### Automation Rule Engine
Deterministic rules promoted from agent decisions. Rules use the same unified condition format (`{field, operator, value}`) as agent-extracted conditions. When a rule matches an event, it executes instantly without an LLM call. Rules suppress the triage agent for matched events via deduplication markers.

**Condition evaluation:** `ConditionEvaluator` supports operators: `equals`, `notEquals`, `contains`, `in`, `greaterThan`, `lessThan`, `greaterThanOrEqual`, `lessThanOrEqual`, `exists`, `notExists`. Handles nested field paths (`payload.delayMinutes`, `context.shipment.status`).

**Rule priority:** Rules are evaluated in priority order (1-100, lower first). First matching rule executes, remaining are skipped.

**Promote flow:** When a user promotes an agent decision, the `matchedConditions` from the LLM response are extracted and pre-fill the automation rule. The `POST /api/v1/automation-rules/from-decision/:id` endpoint handles this.

### Skills System
Extensible action framework. Skills are discrete, configurable action units with templated fields.

**ISkill interface:** Each skill has a `definition` (fields, configSchema, requiresConfig), `validateConfig()`, and `execute()` method. New skills are registered in the `SkillRegistry`.

**Built-in skills:** `create_issue`, `escalate_issue`, `add_comment`, `contact_driver`, `send_email` (requires email config), `call_webhook` (requires URL config).

**Template resolver:** All skill fields support `{{field.path}}` syntax resolved against event + context data. Same variable format as agent prompts.

**Skill chains:** Ordered sequences of skills with question branching. Question nodes evaluate conditions (same `RuleCondition` format) and follow matched/unmatched branches. `SkillChainExecutor` walks the chain.

**Skill config:** Org-level configuration for skills that need API keys, webhook URLs, etc. Managed via `/settings/skills` admin page.

### Key Files (Automation & Skills)
- `backend/src/services/automation/ConditionEvaluator.ts` — Condition evaluation engine
- `backend/src/events/handlers/AutomationRuleHandler.ts` — Rule evaluation + skill dispatch
- `backend/src/routes/automationRules.ts` — Automation rules CRUD + promote + test
- `backend/src/services/skills/ISkill.ts` — Skill interfaces and chain step types
- `backend/src/services/skills/SkillRegistry.ts` — Skill catalog singleton
- `backend/src/services/skills/SkillChainExecutor.ts` — Chain execution with branching
- `backend/src/services/skills/TemplateResolver.ts` — `{{field.path}}` template resolution
- `backend/src/services/skills/CreateIssueSkill.ts` — Create issue skill
- `backend/src/services/skills/AddCommentSkill.ts` — Add comment skill
- `backend/src/services/skills/ContactDriverSkill.ts` — Contact driver skill
- `backend/src/services/skills/SendEmailSkill.ts` — Send email skill
- `backend/src/services/skills/CallWebhookSkill.ts` — Webhook skill
- `backend/src/routes/skills.ts` — Skills catalog + config + chains API
- `backend/src/__tests__/services/ConditionEvaluator.test.ts` — 18 evaluator tests
- `backend/src/__tests__/services/SkillChainExecutor.test.ts` — 13 chain executor tests

## Issue / Triage Centre

### Architecture
The Triage Centre provides a drag-and-drop kanban board for managing operational issues (exceptions, delays, damage, compliance failures). Issues can be created manually, auto-created from domain events, or created by the AI triage agent. The system supports a full issue lifecycle with collaborative comments, labels, snooze/wake, and automatic PDF closure reports.

### Key Models
- **Issue** - Operational problem linked to a source entity (shipment, order, carrier). Fields include status, priority, category, assigneeId, escalatedTo, snoozedUntil, snoozedBy, snoozedReason, needsCapa, closedAt, closedBy, and label associations.
- **Comment** (polymorphic) - Attached to issues, shipments, or orders via `entityType` + `entityId`. Supports user and agent-authored comments.
- **IssueLabel** - Org-scoped labels for categorizing issues (name + color).
- **IssueLabelAssignment** - Join table linking issues to labels.
- **KanbanView** - Saved filter/sort configurations for the kanban board (per user or shared).

### API Routes
- **Issues:** `/api/v1/issues` - list, create, detail, update, status changes, assign, escalate, snooze, unsnooze, close, reopen, add/remove labels, activity timeline, closure report download
- **Comments:** `/api/v1/comments` - list by entity, create, update, delete
- **Issue Labels:** `/api/v1/issue-labels` - CRUD for org-scoped labels
- **Kanban Views:** `/api/v1/kanban-views` - CRUD for saved board views

### Issue Lifecycle
```
open -> in_progress -> resolved -> closed
         |                           |
         ^                           v (reopen)
    (escalated: auto-set to        open
     in_progress, priority
     -> critical)

Any status can be snoozed (snoozedUntil set). Auto-wakes when time expires.
```

### Issue Closure Reports
When an issue is closed, the `IssueClosureReportHandler` automatically generates a PDF closure report stored via `IBinaryStorageProvider` as a `GeneratedDocument` (documentType: `issue_closure_report`). Content includes: issue summary, triggering event, shipment/order context, temperature telemetry, SLA evaluations, activity timeline, and CAPA reports.

### Agent contact_driver Action
The triage agent can execute a `contact_driver` action. It gathers driver info from Shipment -> Load -> Driver, creates or finds the related issue, and posts an agent comment with driver contact details (name, phone, email). Falls back to a "no driver assigned" message if no driver is linked.

### Key Files
- `backend/src/commands/issues/` — CreateIssue, UpdateIssue (handles snooze/close/reopen/needsCapa), EscalateIssue
- `backend/src/repositories/IssueRepository.ts` — Issue query methods with filtering (status, priority, labels, search)
- `backend/src/events/projections/IssueProjection.ts` — IssueReadModel maintenance (handles all issue.* + comment.* events, tracks commentCount and labels cache)
- `backend/src/events/handlers/IssueClosureReportHandler.ts` — Auto-generates PDF closure report on issue.closed
- `backend/src/events/handlers/InAppNotificationHandler.ts` — Bell notifications for all issue + comment events
- `backend/src/services/IssueClosureReportService.ts` — PDF report generation (pdf-lib, stored via IBinaryStorageProvider)
- `backend/src/services/skills/AddCommentSkill.ts` — Agent skill to post comments on issues
- `backend/src/services/skills/ContactDriverSkill.ts` — Agent skill to look up and post driver contact info
- `backend/src/routes/issues.ts` — Issue REST API + issue labels CRUD + kanban views CRUD
- `backend/src/routes/comments.ts` — Polymorphic comment REST API (issues, shipments, orders)
- `frontend/src/vnext-design/VNextIssueKanban.tsx` — Drag-and-drop kanban board with @dnd-kit
- `frontend/src/vnext-design/VNextIssueDetail.tsx` — Issue detail page with activity timeline + comments
- `backend/src/__tests__/commands/IssueCommands.test.ts` — 16 command handler tests
- `backend/src/__tests__/projections/IssueProjection.test.ts` — 13 projection tests
- `frontend/src/pages/Issues.tsx` - Kanban board with drag-and-drop (@dnd-kit)
- `frontend/src/pages/IssueDetail.tsx` - Issue detail page with activity timeline, comments, SLA sidebar
- `frontend/src/vnext-design/VNextIssues.tsx` - VNext kanban board (if applicable)

## Financial Operations

### Overview
The financial layer covers the full money lifecycle: rating shipments, quoting customers, invoicing (AR), receiving carrier invoices (AP), freight audit, financial queries/disputes, credit notes, and LTL-specific billing. All monetary values are stored as **integer cents** (`amountCents`, `totalPriceCents`, `priceCents`) to avoid floating-point rounding errors.

### Key Models
- **Charge** — Revenue or cost line item on a shipment/order. Categories: `revenue` (customer pays us) and `cost` (we pay carrier). Types: linehaul, fuel_surcharge, accessorial, adjustment, etc. Lifecycle: pending → approved → invoiced.
- **ShipmentFinancialSummary** — Denormalized per-shipment snapshot of expected/actual revenue, cost, margin, billing status, and carrier payment status. Auto-recalculated on every charge mutation.
- **Quote / QuoteLineItem** — Customer price quote with revision tracking. Acceptance auto-creates an Order with approved revenue charges.
- **Invoice / InvoiceLineItem / Payment** — Customer-facing AR invoice. Supports full/partial payment, void, overdue detection, and consolidation.
- **CarrierInvoice / CarrierInvoiceLineItem** — Carrier AP invoice with automatic three-way freight audit match.
- **FinancialQuery** — Dispute/claim record. Can be auto-created from cargo events or raised manually.
- **CreditNote** — Generated when a query is resolved with a financial adjustment.

### Invoice Consolidation Modes
Customer billing supports three consolidation modes (set per customer):
1. **per_shipment** — One invoice per delivered shipment (default)
2. **weekly** — Batches all ready-to-invoice shipments every Monday (pg-boss cron)
3. **monthly** — Batches all ready-to-invoice shipments on the 1st of each month (pg-boss cron)

Manual consolidation trigger: `POST /api/v1/invoices/consolidate`

### LTL Rating
The `LtlRatingService` provides class-based LTL rating with:
- NMFC freight class lookup and density-based class calculation
- Weight break matrix pricing with deficit weight optimization
- FAK (Freight All Kinds) override support
- Minimum charge thresholds
- LTL accessorial codes: liftgate, residential, inside delivery, notification, limited access
- Re-weigh / re-class adjustment workflow (creates cost + revenue adjustment charges)
- Multi-order LTL consolidation billing (`ConsolidationBillingService`, pro-rate by weight)

### EDI Financial Transaction Types
| Code | Name | Direction | Service |
|------|------|-----------|---------|
| 210 | Freight Invoice | Inbound | `EDI210ParseService` — parses carrier invoice, triggers three-way match |
| 810 | Invoice | Outbound | `EDI810Service` — generates customer invoice in X12 format |
| 820 | Payment Order/Remittance | Inbound | `EDI820ParseService` — parses customer payment, applies to invoices |

### Key Files
- `backend/src/services/ChargeService.ts` — Charge CRUD, financial summary recalculation
- `backend/src/services/RatingService.ts` — Lane-carrier rate lookup, fuel surcharge calculation
- `backend/src/services/LtlRatingService.ts` — LTL class-based rating, weight breaks, deficit weight
- `backend/src/services/InvoicingService.ts` — Invoice generation from shipments, ready-to-invoice queries
- `backend/src/services/FreightAuditService.ts` — Three-way match: tender rate vs expected charges vs carrier invoice
- `backend/src/services/ConsolidationBillingService.ts` — Multi-order LTL consolidation, pro-rate by weight
- `backend/src/services/EDI210ParseService.ts` — EDI 210 Freight Invoice parser (inbound)
- `backend/src/services/EDI810Service.ts` — EDI 810 Invoice generator (outbound)
- `backend/src/services/EDI820ParseService.ts` — EDI 820 Payment/Remittance parser (inbound)
- `backend/src/repositories/QuoteRepository.ts` — Quote CRUD with revision tracking
- `backend/src/repositories/InvoiceRepository.ts` — Invoice + payment repository
- `backend/src/repositories/CarrierInvoiceRepository.ts` — Carrier invoice repository
- `backend/src/repositories/FinancialQueryRepository.ts` — Financial query + credit note repository
- `backend/src/commands/charges/` — CreateCharge, ApproveCharge, ReweighAdjustment commands
- `backend/src/commands/quotes/` — CreateQuote, AcceptQuote, DeclineQuote, ReviseQuote commands
- `backend/src/commands/invoices/` — CreateInvoice, ApproveInvoice, SendInvoice, RecordPayment, VoidInvoice commands
- `backend/src/commands/carrierInvoices/` — ReceiveCarrierInvoice, ApproveCarrierInvoice, RecordCarrierPayment commands
- `backend/src/commands/queries/` — RaiseQuery, ResolveQuery commands
- `backend/src/events/handlers/TenderAwardFinancialHandler.ts` — Auto-creates cost charge on tender award
- `backend/src/events/handlers/BillingTriggerHandler.ts` — Shipment delivered → ready to invoice, auto-draft
- `backend/src/events/handlers/FinancialImpactHandler.ts` — Cargo/cold-chain events → auto-raise financial queries
- `backend/src/events/projections/InvoiceProjection.ts` — InvoiceReadModel maintenance
- `backend/src/routes/charges.ts` — Charge REST API
- `backend/src/routes/quotes.ts` — Quote REST API + LTL rate endpoints
- `backend/src/routes/invoices.ts` — Invoice REST API (AR)
- `backend/src/routes/carrierInvoices.ts` — Carrier invoice REST API (AP)
- `backend/src/routes/financialQueries.ts` — Financial queries + credit notes API
- `backend/src/routes/financialReports.ts` — AR aging, carrier spend, margin analysis, CSV exports
- `backend/src/routes/edi820.ts` — EDI 820 inbound endpoint

## Carrier Tendering

### Architecture
The tendering system supports **broadcast** (all carriers simultaneously) and **waterfall** (sequential, auto-progress on timeout/decline) strategies.

### Key Models
- **Tender** — Linked to a Shipment. Has strategy, status lifecycle (draft→open→evaluating→awarded), configurable duration, target rate.
- **TenderOffer** — One per carrier in a tender. Tracks sent/viewed/expired status and waterfall sequence.
- **TenderBid** — Carrier's rate submission. Can come from the web portal (`sourceType: "portal"`) or EDI 990 (`sourceType: "edi_990"`).
- **CarrierUser** — Separate auth model for carrier portal login (not the internal User model).

### Carrier Portal
- Separate app at `/carrier-portal/` with its own layout and JWT auth (`iss: "open-tms-carrier"`)
- Pages: login, dashboard, tender view with bid form, tender history with win/loss tracking, bid history, profile with password change
- Auth middleware: `authenticateCarrierJWT` in `backend/src/middleware/jwtAuth.ts`

### Carrier User Management
- Admin manages carrier portal users on the carrier edit page (`CarrierUserManagement` component)
- Password strength validation: 8+ chars, uppercase, lowercase, number
- Account lockout: 5 failed attempts → 15 minute lockout
- Admin password reset available (no old password required)

### Key Files
- `backend/src/services/TenderService.ts` — Core lifecycle: create, open, bid, award, cancel, waterfall progression
- `backend/src/services/CarrierAuthService.ts` — Carrier JWT auth with lockout
- `backend/src/routes/tenders.ts` — Admin tender CRUD and lifecycle actions
- `backend/src/routes/carrierPortal.ts` — Carrier-facing: login, tenders, bids, history, profile
- `backend/src/routes/carrierUsers.ts` — Admin carrier user management
- `frontend/src/pages/Tenders.tsx` — Tender list with carrier/status filters
- `frontend/src/pages/TenderDetail.tsx` — Bid comparison and award workflow
- `frontend/src/pages/CreateTender.tsx` — 5-step tender creation wizard
- `frontend/src/pages/carrier-portal/` — All carrier portal pages
- `frontend/src/carrier-portal-layout.tsx` — Carrier portal layout

## Database

- PostgreSQL via Prisma
- Migrations in `backend/prisma/migrations/`
- After schema changes: create migration SQL, run `npx prisma generate`
- Custom fields use versioning (not migration) — old records always render against their version

## CQRS & Events

### Command Handlers
- All write operations go through command handlers in `backend/src/commands/`
- Commands execute inside `prisma.$transaction()` via `BaseCommandHandler`
- Events are collected during execution and published AFTER transaction commits
- Register new handlers in `backend/src/di/registry.ts` inside the CommandBus factory
- Routes dispatch commands: `commandBus.dispatch({ type, orgId, actorId, payload, metadata })`

### Events & Projections
- Domain events defined in `backend/src/events/eventTypes.ts`
- Projections (read model builders) in `backend/src/events/projections/`
- Register new projections in `backend/src/events/registerHandlers.ts`
- Read models are flat Prisma tables — no joins needed for list queries
- Backfill script: `npx tsx backend/src/scripts/backfill-read-models.ts`

### When Adding a New Entity or Feature
**You MUST do ALL of the following — this is not optional:**

1. **Command handlers** — Create/Update/Archive commands in `backend/src/commands/<entity>/`
2. **Event types** — Add to `backend/src/events/eventTypes.ts` with schema version
3. **Projection** — Create `<Entity>Projection.ts` in `backend/src/events/projections/` if a read model exists
4. **Tests** — Add unit tests for command handlers AND projections in `backend/src/__tests__/`
5. **Domain behaviours doc** — Update `docs/DOMAIN_BEHAVIOURS.md` with commands, events, and side effects
6. **Roadmap** — Update `roadmap.md` to mark items complete or add new items
7. **API docs** — Add Swagger/OpenAPI `schema` blocks to new endpoints
8. **README** — Update feature list in `README.md` if adding user-facing capability
9. **Marketing website** — Review and update `www/` feature pages if the new feature is user-facing. Check: feature page content (`www/src/pages/features/`), homepage feature list (`www/src/components/Features.tsx`), hero feature cards (`www/src/components/Hero.tsx`), and UI preview mockups (`www/src/components/previews/`). Keep the website in sync with the roadmap and actual capabilities.

### Test Requirements
- Every command handler must have tests verifying: success case, event emission, metadata propagation, error case
- Every projection must have tests verifying: read model creation on entity.created, field updates on entity.updated
- Integration tests should verify command → event → projection pipeline for new entities
- Run `cd backend && npx jest --config jest.config.cjs` to verify all tests pass before committing
- Test utilities in `backend/src/__tests__/helpers/testUtils.ts`: `mockEventBus()`, `createTestCommand()`, `createTestEvent()`

## Marketing Website (www)

- **NEVER use the em dash character (`—`).** Use a regular hyphen (`-`) or rewrite the sentence instead. This applies to all www content: components, blog articles, page copy.
- Open TMS is an **independent open source project** maintained by Dominic Finn and the community. It is NOT a System Loco project. System Loco IoT is an integration, not an ownership relationship. Never describe the project as "maintained by System Loco" or "the System Loco team."

## UI Completion Verification — CRITICAL

**Never assume UI work is done. Always verify it.**

When implementing or modifying any frontend feature, you MUST complete ALL of the following before reporting the work as finished:

### Field-Level Completeness
- Every field defined in the backend schema/API response MUST have a corresponding UI element (form input, table column, detail display, or deliberate omission with a reason)
- When adding a new entity or modifying a schema, cross-reference the Prisma model, API response DTO, and the UI form/table/detail page to confirm every field is accounted for
- Check create forms, edit forms, detail/view pages, and list/table views separately — a field present in the create form but missing from the detail page is incomplete

### End-to-End Verification Checklist
Before marking any UI task complete, verify each of these:
1. **Form submissions** — Does the create/edit form actually send all fields to the API? Check the fetch/axios call payload matches the form state
2. **API integration** — Does the frontend read all fields from the API response and display them? Check the response mapping
3. **Validation** — Are required fields enforced in the UI? Do error messages display correctly?
4. **Loading states** — Does the UI show loading indicators while data is being fetched?
5. **Error states** — Does the UI handle API errors gracefully (network failures, validation errors, 404s)?
6. **Empty states** — Does the UI handle empty/null data without crashing or showing "undefined"?
7. **Navigation** — Can the user get to this page? Is it linked from the sidebar, a list page, or a parent page?
8. **TypeScript** — Does the frontend code compile without type errors? Run `npx tsc --noEmit` in the frontend directory

### How to Verify
- **Read the component code** and trace the data flow: API call → state → render. Do not just check that the file exists
- **Start the dev server** (`cd frontend && npm run dev`) and open the page in a browser when possible
- **Compare the form fields against the API endpoint's request schema** to ensure nothing is missing
- **Compare the display fields against the API endpoint's response schema** to ensure nothing is missing
- If you cannot start the dev server, explicitly state "I was unable to verify this in a browser" and explain what you checked instead

### Common Failures to Watch For
- Form has fields in the UI but the submit handler does not include them in the API payload
- Detail page fetches data but only renders half the fields
- Table page is missing columns for important fields
- Create form works but edit form does not pre-populate existing values
- Dropdown/select fields have no options or hardcoded options instead of fetching from the API
- Modal forms that close on submit but do not refresh the parent list
- New pages added but not wired into the router or sidebar navigation

## Feature Planning and Tracking

When working on a new feature that involves multiple layers (schema, backend, frontend, tests, docs), create a temporary tracking file to maintain a detailed implementation checklist. This prevents work from being forgotten across context boundaries.

### When to Create a Tracking File
- Any feature that spans backend + frontend
- Any feature with more than 3 distinct implementation steps
- When entering plan mode for a new feature
- When the user explicitly asks for detailed planning

### Tracking File Format
Create the file at the project root: `.tracking/<feature-name>.md`

```markdown
# Feature: <Name>
Created: <date>

## Schema / Database
- [ ] Prisma model defined
- [ ] Migration created
- [ ] prisma generate run

## Backend
- [ ] Repository interface + implementation
- [ ] Service layer (if needed)
- [ ] Command handlers (Create, Update, Archive)
- [ ] Event types added
- [ ] Projection created
- [ ] Routes registered with Swagger schemas
- [ ] DI tokens and registry updated

## Frontend
- [ ] List page — all columns mapped to API response fields
- [ ] Create form — all fields present and submitted to API
- [ ] Edit form — all fields pre-populated and submitted
- [ ] Detail/view page — all fields displayed
- [ ] Navigation — page accessible from sidebar/router
- [ ] Loading, error, and empty states handled
- [ ] TypeScript compiles cleanly

## Integration
- [ ] Create flow: form → API → database → list refresh
- [ ] Edit flow: load existing → modify → save → verify changes
- [ ] Delete/archive flow (if applicable)
- [ ] Field-by-field audit: every schema field appears in UI

## Tests
- [ ] Command handler tests
- [ ] Projection tests
- [ ] Backend tests pass

## Documentation
- [ ] DOMAIN_BEHAVIOURS.md updated
- [ ] roadmap.md updated
- [ ] README.md updated (if user-facing)
- [ ] www/ updated (if user-facing)
```

### Rules
- **Check off items as you go** — update the tracking file after completing each step, not in bulk at the end
- **The tracking file is the source of truth** — if it says a task is not checked off, the task is not done
- **Field-by-field audit is mandatory** — before checking off any frontend task, list every field from the schema and confirm it appears in the UI component
- **Delete the tracking file** when the feature is fully complete and verified
- The `.tracking/` directory is gitignored — these files are ephemeral working documents

## Git

- Feature branches off main
- Descriptive commit messages
- Don't push to main directly
