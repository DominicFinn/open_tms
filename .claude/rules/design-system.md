---
paths:
  - "frontend/src/**/*.{ts,tsx,css}"
  - "frontend/tailwind.config.ts"
  - "frontend/components.json"
---

# Design System — shadcn/ui + Tailwind

The app is built on **shadcn/ui** (`style: "new-york"`, `baseColor: "slate"`, CSS variables on, no
class prefix). Config: `frontend/components.json`.

## Absolute prohibitions

- **NEVER hardcode a color** — no hex, no `rgb()`, no named colors, and no Tailwind arbitrary color
  values (`bg-[#1e293b]`). Semantic tokens only.
- **NEVER use inline `style={{ }}`** for anything the design system covers — spacing, color,
  typography, borders, radius, shadow. Inline styles bypass the token layer and can't respond to the
  theme. The narrow exception is a genuinely computed value the class system cannot express (a
  percentage width from data, a map marker offset); keep it to that one property.
- **NEVER hardcode spacing values.** Use the Tailwind spacing scale (`p-4`, `gap-6`, `space-y-6`),
  not `style={{ padding: 17 }}` or `p-[17px]`.
- **NEVER write a one-off CSS class for a single element.** Compose utilities, or extract a
  component.
- **NEVER use `!important`** unless overriding third-party CSS, and document it as an exception.
- **NEVER mix styling approaches within a component** — pick utilities, don't half-inline it.
- **No new hand-written `.css` files.** `shadcn-tokens.css` is the single CSS layer.

## Mobile-first and responsive

Start at the smallest screen and add complexity upward with Tailwind's `md:` / `lg:` / `xl:`
prefixes. Don't write desktop-first styles and then claw them back.

## Reach for an existing primitive first

shadcn primitives live in `frontend/src/components/ui/`:

`badge`, `button`, `calendar`, `card`, `date-picker`, `dialog`, `dropdown-menu`, `input`, `label`,
`popover`, `select`, `separator`, `table`, `tabs`

Use these rather than hand-rolling a button, modal, or table. To add a primitive that isn't there
yet, add it through the shadcn CLI so it lands in `components/ui/` with the project's style
settings, rather than pasting a bespoke component.

## Import aliases

Defined in `components.json` — use them, not deep relative paths:

| Alias | Resolves to |
|---|---|
| `@/components` | `frontend/src/components` |
| `@/components/ui` | shadcn primitives |
| `@/lib` / `@/lib/utils` | `frontend/src/lib` (includes the `cn()` class merger) |
| `@/hooks` | `frontend/src/hooks` |

Compose conditional classes with `cn()` from `@/lib/utils`.

## Tokens, not colors

Colors come from semantic Tailwind names mapped to `--shadcn-*` HSL triples in
`frontend/tailwind.config.ts`. Never hardcode a color or use a Tailwind arbitrary color value —
see the frontend rule for the full list and the light/dark requirement.

Prefer the paired foreground token over picking a text color by hand: `bg-card text-card-foreground`,
`bg-destructive text-destructive-foreground`, `text-muted-foreground` for secondary text.

## Icons

**lucide-react** is the icon library (`iconLibrary: "lucide"`). Don't introduce a second icon set.

## Legacy note

`frontend/src/vnext-design/` still holds the page components (`VNext*.tsx`) and `vnext-layout.tsx`,
but the old `vn-`-prefixed CSS design system, `theme.css`, and `vnext.css` **no longer exist**. Do
not add `vn-*` classes. Style with Tailwind utilities and shadcn primitives.
