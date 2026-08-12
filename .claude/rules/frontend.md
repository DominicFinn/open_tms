---
paths:
  - "frontend/src/**/*.{ts,tsx,css}"
  - "frontend-shadcn-preview/**/*.{ts,tsx,css}"
---

# Frontend Conventions

React 18 + TypeScript + Vite, port 5173. Styling is **Tailwind + shadcn/ui** — see the
design-system rule for component and token detail.

## Never hardcode colors — CRITICAL

- **No hex values, no `rgb()`, no named colors** in components, inline styles, or Tailwind
  arbitrary values (`bg-[#1e293b]` is a hardcoded color and is not allowed)
- Use the semantic Tailwind color names wired up in `frontend/tailwind.config.ts`:
  `background`, `foreground`, `card`, `popover`, `primary`, `secondary`, `muted`, `accent`,
  `destructive`, `success`, `warning`, `border`, `input`, `ring` — each with a `-foreground` pair
- Those map to `--shadcn-*` HSL triples defined in `frontend/src/shadcn-tokens.css`, the single CSS
  layer for the app
- If you need a new color, add the token to `shadcn-tokens.css` (both the `:root` dark values and
  the `[data-theme='light']` values) and map it in `tailwind.config.ts` **first**

**Dark is the brand default.** `:root` carries the dark values; explicit light mode comes via
`[data-theme='light']`. Any new token must be defined for both.

## Theme System

- `ThemeProvider.tsx` loads theme config from `GET /api/v1/theme` and applies CSS overrides
- Theme is cached in `sessionStorage` with `themeUpdatedAt` for invalidation
- `useTheme()` hook provides `hasLogo`, `logoUrl`, `reloadTheme()`
- The entire app is wrapped in `<ThemeProvider>` in `main.tsx`

## Layouts

| Layout | Surface |
|---|---|
| `frontend/src/vnext-design/vnext-layout.tsx` | Main operations app |
| `frontend/src/customer-portal-layout.tsx` | Customer portal |
| `frontend/src/carrier-portal-layout.tsx` | Carrier portal |
| `frontend/src/warehouse/warehouse-layout.tsx` | Warehouse PWA |

## Accessibility

- Semantic HTML elements — a `div` with an `onClick` is not a button
- ARIA labels on interactive elements; screen-reader text for icon-only buttons
- Keyboard navigation works, and focus is managed on modals and overlays
- Colour contrast meets WCAG AA (the tokens are built for this — don't defeat it with opacity)
- **Live regions**: data that updates without a navigation (shipment status, issue counts, ETA)
  must be announced via `aria-live="polite"`. A screen-reader user cannot see a number tick.

## Performance

- **Lazy-load routes and heavy components** — charts, maps, the lightbox. Don't eagerly import every
  page into the initial bundle.
- Images carry explicit `width`/`height` to avoid layout shift
- **Every async operation shows a loading state.** Skeletons for initial page loads, inline spinners
  for button actions. Never leave the user wondering whether something is happening.
- Large lists paginate or virtualise — see the api-design rule; no endpoint returns the whole table

## Component Patterns

- Page components live in `frontend/src/vnext-design/VNext*.tsx`
- Reusable components go in `frontend/src/components/`
- shadcn/ui primitives live in `frontend/src/components/ui/` — see the design-system rule
- API base URL from `frontend/src/api.ts` (`API_URL`)
- Icons: **lucide-react**
- No styled-components or CSS-in-JS libraries, and no new hand-written `.css` files —
  `shadcn-tokens.css` is the single CSS layer
