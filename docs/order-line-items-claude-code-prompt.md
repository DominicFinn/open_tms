# Claude Code prompt — Order Line Items & Cartonization (Phase 1)

Copy everything below the line into Claude Code.

---

Implement Phase 1 of the Order Line Items & Cartonization feature in this repo (Open TMS).

**Read first, in order:**
1. `docs/ORDER_LINE_ITEM_DESIGN.md` — the design decisions. This is the source of truth for scope and rationale.
2. `.tracking/order-line-items.md` — the implementation checklist. Work through Phase 1 and check items off **as you complete them**, not in bulk.
3. `CLAUDE.md` — project conventions. Follow them exactly, especially: the `{ data, error }` response envelope, DI container registration, repository pattern, command/event/projection (CQRS) flow, multi-tenancy (`req.orgId!` on every repo call and dispatch), VNext design system for any new UI, and theme.css CSS variables (never hardcode colors).

**Context — what already exists (do not rebuild):**
- `OrderLineItem` (Prisma) already has dims, hazmat boolean, temperature, pricing, `freightClass`, `nmfcCode`, and a link to `TrackableUnit`. The portal just doesn't surface most of it.
- `TrackableUnit` is the handling-unit model (pallet/tote/box/stillage), with a `PalletType` reference catalog.
- `CustomFieldDefinition` is a versioned per-entity custom-field system — reuse it, don't reinvent org-specific extras.
- `LtlRatingService` already has density-based freight-class calculation — reuse it for class suggestion; do not duplicate the math.
- The portal form is `frontend/src/pages/customer-portal/CustomerCreateOrder.tsx` (currently only description/quantity/weight/SKU).

**Phase 1 scope (full detail in the tracking file):**
1. **Schema gaps** — add to `OrderLineItem`: `unNumber`, `hazmatClass`, `packingGroup`, `properShippingName`, `unitOfMeasure`, `hsCode`, `countryOfOrigin`, `tempMinC`, `tempMaxC`. Generalise `PalletType` into an org-scoped packaging catalog covering non-pallet types (pallet/carton/crate/drum/roll/bag/tote/loose) — propose rename-vs-sibling and pick one. Migration + `prisma generate`.
2. **Mode-rules service** — pure function `(mode, flags) → required field set`, org-overridable with sane defaults. Required matrix: description/qty/weight always; dims + freight class + stackable for LTL; UN/class/PG/PSN when hazmat; HS/country for international. Enforced in the portal form AND re-validated server-side.
3. **Cartonization service** — derive (never capture from user): density, suggested freight class (via `LtlRatingService`), pallet positions, linear feet, rolled-up class (highest class per handling unit). Expose as read-only calculated fields.
4. **Auto-generate handling units** from an order-level packing summary (packaging type + count + stackable). Do NOT make customers build pallets by hand in Phase 1.
5. **Portal UI** — expand `CustomerCreateOrder.tsx` line form + add the order-level packing summary block + live calculated fields. Conditional fields driven by the mode-rules API. Update `CustomerOrderDetail.tsx` to display everything.
6. **Admin UI** — packaging-type catalog CRUD under `/admin`, wired into router + sidebar.

**Mandatory per CLAUDE.md "When Adding a New Entity or Feature" — do ALL of these, not optional:**
- Command handlers for any new write paths; register in DI registry inside the CommandBus factory.
- Event types in `eventTypes.ts` with schema version bumps; projections updated + registered.
- Swagger/OpenAPI `schema` blocks on every new/changed endpoint.
- Tests: mode-rules service, cartonization service, command handlers (success + event emission + metadata + error), projections. Run `cd backend && npx jest --config jest.config.cjs` and get it green.
- Docs: `docs/DOMAIN_BEHAVIOURS.md`, `roadmap.md`, `README.md`, and `www/` feature pages if user-facing (no em dashes anywhere in www).

**UI completion verification (CLAUDE.md is strict on this):**
- Field-by-field audit: every new schema field must appear in the portal create form, the portal detail page, and internal views — or be a deliberate, noted omission.
- Confirm the submit handler actually sends every new field (compare payload vs form state).
- Run `cd frontend && npx tsc --noEmit` and confirm it's clean. Handle loading/error/empty states.
- If you can't verify in a browser, say so explicitly and list what you checked instead.

**Working style:**
- Work on a feature branch off main; do not push to main. Descriptive commits.
- Update `.tracking/order-line-items.md` as you go; it's the source of truth for progress.
- If a design decision is ambiguous, check `docs/ORDER_LINE_ITEM_DESIGN.md` first; ask only if it's genuinely unresolved there.
- Start by confirming the current state of the four models named above, then propose the migration plan (including the PalletType rename-vs-sibling decision) before writing it.
