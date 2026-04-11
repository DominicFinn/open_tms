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

## EDI Communication Hub

### Architecture
The EDI system uses a **unified Trading Partner model** (`TradingPartner`) that replaces the older separate `EdiPartner` (inbound) and `OutboundIntegration` (outbound) models. A single trading partner handles both directions and multiple EDI transaction types.

### Key Models
- **TradingPartner** — Represents any entity you exchange EDI with (customer, carrier, 3PL, ERP, etc.). Has SFTP + HTTP connection config, inbound polling config, and outbound delivery config.
- **TradingPartnerTransaction** — Registry of which EDI types a partner supports. Each entry has: `transactionType` (850, 204, 990, etc.), `direction` (inbound/outbound), `enabled`, `autoProcess`, `ack997Required`.
- **EdiTransactionLog** — Unified audit log for all inbound/outbound EDI files with delivery status tracking.

### Supported Transaction Types
| Code | Name | Direction | Status |
|------|------|-----------|--------|
| 850 | Purchase Order | Inbound | Active |
| 856 | Advance Ship Notice | Outbound | Active |
| 204 | Motor Carrier Load Tender | Outbound | Active |
| 990 | Response to Load Tender | Inbound | Active |
| 997 | Functional Acknowledgment | Both | Active |
| 214 | Shipment Status | Both | Active |
| 210 | Freight Invoice | Inbound | Planned |

### EDI Flow — How It Works
1. **Inbound**: The `edi-collector` service polls SFTP directories for each TradingPartner with `inboundEnabled=true`. It downloads files, detects the transaction type from the ST segment, and routes to the correct backend endpoint (850→orders, 990→tenders).
2. **Outbound**: The `OutboundEdiDeliveryService` writes EDI files to SFTP or POSTs via HTTP. Called automatically when tenders are opened (EDI 204) and extensible for other outbound types.
3. **Auto-204 Delivery**: When `TenderService.openTender()` sends offers, it checks if each carrier has a TradingPartner with outbound 204 enabled. If so, generates and delivers the EDI 204 automatically via SFTP.

### Adding a New EDI Transaction Type
1. Write a parser service (for inbound) or generator service (for outbound) in `backend/src/services/`
2. Add the transaction type to the route map in `EdiRouterService.ts`
3. Add a backend endpoint for processing
4. Trading partners can then add the type to their config via the UI

### Key Files
- `backend/src/repositories/TradingPartnerRepository.ts` — CRUD + query methods
- `backend/src/services/EdiRouterService.ts` — Transaction type detection and routing
- `backend/src/services/OutboundEdiDeliveryService.ts` — SFTP/HTTP delivery engine
- `backend/src/services/EDI204Service.ts` — EDI 204 Motor Carrier Load Tender generator
- `backend/src/services/EDI990ParseService.ts` — EDI 990 Response to Load Tender parser
- `backend/src/services/EDI997Service.ts` — Functional Acknowledgment generator
- `backend/src/services/EDI850ParseService.ts` — Purchase Order parser
- `backend/src/services/EDI856Service.ts` — Advance Ship Notice generator
- `backend/src/services/EDI214ParseService.ts` — EDI 214 Shipment Status parser (inbound)
- `backend/src/services/EDI214Service.ts` — EDI 214 Shipment Status generator (outbound)
- `backend/src/services/edi214StatusMapping.ts` — AT7 status code to internal status mapping
- `backend/src/routes/tradingPartners.ts` — API routes for partner management
- `backend/src/routes/ediTender.ts` — EDI 204 preview and 990 inbound endpoints
- `backend/src/routes/edi214.ts` — EDI 214 inbound, generate, and preview endpoints
- `edi-collector/src/collector.ts` — SFTP polling with multi-type routing
- `frontend/src/pages/TradingPartners.tsx` — Partner management UI (Integrations app)

### Legacy Compatibility
The old `EdiPartner` and `OutboundIntegration` models still exist. The migration copies their data into TradingPartner. The edi-collector fetches from both endpoints during transition. Old UI pages are preserved as "(Legacy)" in the integrations nav.

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

### Test Requirements
- Every command handler must have tests verifying: success case, event emission, metadata propagation, error case
- Every projection must have tests verifying: read model creation on entity.created, field updates on entity.updated
- Integration tests should verify command → event → projection pipeline for new entities
- Run `cd backend && npx jest --config jest.config.cjs` to verify all tests pass before committing
- Test utilities in `backend/src/__tests__/helpers/testUtils.ts`: `mockEventBus()`, `createTestCommand()`, `createTestEvent()`

## Git

- Feature branches off main
- Descriptive commit messages
- Don't push to main directly
