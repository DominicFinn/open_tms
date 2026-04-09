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

## Database

- PostgreSQL via Prisma
- Migrations in `backend/prisma/migrations/`
- After schema changes: create migration SQL, run `npx prisma generate`
- Custom fields use versioning (not migration) — old records always render against their version

## Git

- Feature branches off main
- Descriptive commit messages
- Don't push to main directly
