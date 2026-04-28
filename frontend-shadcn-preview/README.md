# Open TMS - shadcn/ui preview

A standalone Vite app that shows what Open TMS looks like rebuilt entirely on **shadcn/ui** with the brand applied per `marketing/brand-guidelines.html`.

The point of this directory is to evaluate the visual direction before committing to a full migration. It is **not** wired to the backend - data is hardcoded.

---

## Run it

```bash
cd frontend-shadcn-preview
npm install
npm run dev
```

Opens on http://localhost:5174.

A theme toggle (sun/moon icon top right) flips between dark and light. Dark is the default per the brand.

---

## What is in here

| Surface | File | Demonstrates |
|---|---|---|
| Dashboard | `src/pages/dashboard.tsx` | Stat cards, recent activity list, triage callout panel, gradient text greeting |
| Shipments list | `src/pages/shipments-list.tsx` | Page header, **filter bar (the alignment problem the old VNext could not solve)**, data table, pagination, table/map view toggle |
| Shipment detail | `src/pages/shipment-detail.tsx` | Two-column detail layout, tabs, timeline, sticky sidebar with carrier/SLA/issues |
| Create shipment | `src/pages/create-shipment.tsx` | Multi-section form, suggested-rate side panel, form grid, validation slots |
| Logo | `src/components/brand/logo.tsx` | Canonical swap-arrows mark + Inter wordmark from brand guidelines (replaces the `hub` Material icon) |
| App shell | `src/components/app/app-shell.tsx` | Sidebar + sticky topbar with search and theme toggle |

---

## What is **not** in here (deliberately)

- **No bespoke CSS layer.** No `vn-*` classes, no per-component padding overrides, no custom `.filter-input` or `.filter-btn`. Everything is shadcn primitives + Tailwind utilities.
- **No `theme.css`-style global stylesheet.** The only CSS file is `src/index.css`, which is `@tailwind base/components/utilities` + the shadcn HSL token block. That is it.
- **No bespoke components for Material 3 lookalikes.** Where shadcn does not ship something out of the box (Logo, GradientText), the file is under `components/brand/` and is a thin Tailwind composition - not a new design system.

---

## How the brand maps to shadcn tokens

shadcn theming is HSL CSS variables. The brand guideline ramps map like this (`src/index.css`):

| Brand token (guideline) | Hex | shadcn variable (dark) |
|---|---|---|
| primary-500 / 600 | `#3b82f6` / `#2563eb` | `--primary: 217 91% 60%` |
| accent-500 (purple) | `#8b5cf6` | `--accent: 258 90% 66%` |
| surface-950 | `#020617` | `--background: 222 84% 5%` |
| surface-900 | `#0f172a` | `--card`, `--popover: 222 47% 11%` |
| surface-800 | `#1e293b` | `--secondary`, `--muted: 217 33% 17%` |
| surface-400 | `#94a3b8` | `--muted-foreground: 215 20% 65%` |
| Inter | font | `font-sans` in Tailwind |
| JetBrains Mono | font | `font-mono` in Tailwind |
| brand-gradient | 135deg blue->purple | `bg-brand-gradient` Tailwind utility |

To re-skin the whole app you change those eight HSL triplets. Nothing else.

---

## Logo update

The legacy product chrome renders `<span class="material-icons">hub</span>` in the sidebar. The brand guidelines mark that as **legacy** - the canonical logo is the rounded-square swap-arrows mark.

`src/components/brand/logo.tsx` ships the canonical lockup with three variants:
- `default` - mark on `--primary`, "TMS" wordmark in primary
- `mono-light` - outlined mark on light backgrounds
- `mono-dark` - outlined mark on dark backgrounds (single-colour print)

Drop `<Logo />` anywhere. Nothing about the lockup is hardcoded - it inherits from the active theme.

---

## Migration plan (preview, full plan in /plan)

This is a big job. Rough phases:

1. **Foundation** (1-2 days) - Add Tailwind + shadcn to `frontend/`, port the brand token block from `index.css` to live alongside `theme.css`, install Radix primitives, vendor shadcn UI components. Both systems coexist.
2. **Shell + Logo** (1 day) - Replace `vnext-layout.tsx` with shadcn-based shell, swap the Material `hub` glyph for the canonical Logo.
3. **High-traffic surfaces first** (1 week) - Shipments list, Shipment detail, Orders list, Order detail, Dashboard, Create shipment, Create order. Most of the value lives here.
4. **Forms** (3-5 days) - Quotes, Invoices, Carrier setup, Lane create. These are mechanical conversions.
5. **Long tail** (1 week) - Carriers, Devices, Issues kanban, EDI dashboard, Settings, Quality, WMS. ~80 page components total.
6. **Delete `vnext.css`** (a single satisfying day) - Remove `vn-*` rules, remove `vnext-design/components/*`, remove the dual-system shims.

**Mobile apps:** the warehouse PWA and any future React Native work need a separate decision.
- The **warehouse PWA** at `/warehouse/*` is just web - it gets shadcn for free once the base ships.
- A **React Native client** cannot use shadcn (which is web-only). For RN we want a sibling primitive layer with the same tokens - candidates are `tamagui`, `react-native-reusables` (the de-facto "shadcn for RN"), or `gluestack-ui`. The brand tokens in `src/index.css` are portable; the components are not. We will plan that explicitly when we get there - do not block the web migration on it.

**Risk:** the existing app embeds custom map components (Leaflet/Google Maps), Google Maps lane editor, leaflet polylines, and pdf-lib outputs. None of those care about the UI layer - they keep working. The only friction is that any place a map/editor component reads `--surface-*` tokens directly will need to be re-pointed to the shadcn token names (or aliased).

---

## Honest notes

- This preview uses simple state-based routing. The real migration uses your existing React Router setup - identical files, just with `useNavigate` instead of an `onNavigate` prop.
- Charts (recharts) sit outside shadcn. Where the existing app has charts they keep working, just restyled to read `--primary` etc.
- Nothing here is irreversible. If you decide shadcn is wrong, you delete the directory.
