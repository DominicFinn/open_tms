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
