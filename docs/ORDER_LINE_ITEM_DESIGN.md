# Order Line Items & Cartonization — Design Decisions

Working doc to decide what customers capture when they add line items to an order, how it's governed, and how it feeds rating/cartonization. Written June 2026.

## TL;DR recommendations

1. **Keep the two-level model you already have** (commercial line vs. handling unit). Don't merge them.
2. **The portal currently under-collects.** Surface the fields your schema already supports, gated by mode so customers aren't drowned in irrelevant inputs.
3. **Make almost nothing unconditionally mandatory.** Drive required-ness off shipment mode + flags (LTL needs class/dims; hazmat needs UN data; etc.).
4. **Treat packaging as a reference table, not free text.** Generalise `PalletType` into an org-scoped packaging-type catalog.
5. **Cartonization is derived, not captured.** Customers give pieces/packaging/dims; the system computes density, class, pallet positions, linear feet. Never ask a customer for density.

---

## 1. Where you actually are

Your schema is more mature than the portal exposes. Two levels already exist:

- **`OrderLineItem`** — the commercial/SKU line. Already has: `sku`, `description`, `quantity`, `weight`/`weightUnit`, `length`/`width`/`height`/`dimUnit`, `hazmat`, `temperature`, pricing (`unitPriceCents`/`totalPriceCents`), `freightClass`, `nmfcCode`, and an optional link to a `TrackableUnit`.
- **`TrackableUnit`** — the physical handling unit (pallet/tote/box/stillage/custom), with `PalletType`, barcode, sequence, condition, and the line items it contains.
- **`PalletType`** — a reference catalog (EUR1, GMA 48x40, CHEP) with external dims, tare weight, max load (SWL), stack height, material, ISPM-15 flag, stackable.
- **`CustomFieldDefinition`** — versioned per-entity custom fields with types, required flags, and list options.

**The portal form (`CustomerCreateOrder.tsx`) only collects `description`, `quantity`, `weightKg`, `sku`.** Everything below is mostly a surfacing + governance exercise, not net-new modeling. The one genuine gap is cartonization (the derived pack math) and a packaging-type field on the line.

## 2. How the industry models it

The mature pattern (Oracle OTM, EDI X12, LTL carrier APIs) is consistently **three layers**, which maps cleanly onto what you have:

| Industry concept | Purpose | Your model |
|---|---|---|
| Order Base **Line Item** (OTM) / EDI 850 **PO1** | Commercial: what/how much/value | `OrderLineItem` |
| Order Base **Ship Unit** / Transport Handling Unit / EDI **PO4** | Physical: how it's packed for transport | `TrackableUnit` |
| **Ship Unit Spec** / Packaging Unit reference | Standardised packaging dimensions | `PalletType` (→ generalise) |

Key cross-system facts worth baking in:

- **One line ≠ one handling unit.** A line can span many pallets; a pallet can mix SKUs. OTM and EDI both keep these separate and link them. You already do.
- **Freight class rolls up.** When mixed-class lines share a handling unit, carriers bill the *highest* class on that unit. Worth computing at the unit level, not just the line.
- **NMFC/class is conditionally required.** For LTL it drives price; for FTL/parcel it's irrelevant; for hazmat it's effectively mandatory. Don't make it global-required.
- **Stackable is a first-class flag, not a nice-to-have.** It changes cube/pallet-position math and triggers carrier surcharges. Capture it at the handling-unit level.
- **Packaging hierarchy (EDI PO4):** units → inner pack → carton → pallet. You don't need the full hierarchy for v1, but model packaging *type* + *count* so you can grow into it.

## 3. The decisions

### Decision 1 — Keep two levels; expose handling units to customers in phases
**Recommendation:** Keep `OrderLineItem` and `TrackableUnit` separate. For the portal, roll out in phases rather than exposing the full unit modeller on day one:

- **Phase 1 (now):** Customer enters commercial lines + a simple **"how is this packed"** summary at the *order* level (e.g. "6 pallets, stackable, 48x40"). System auto-generates `TrackableUnit`s from that. ~90% of shipper portals do exactly this — they don't make customers build pallets by hand.
- **Phase 2 (later):** Optional per-unit detail (mixed-SKU pallets, per-unit dims/weights) for sophisticated shippers. The schema already supports it.

Rationale: full handling-unit entry is powerful but heavy; most customers think in "lines + pallet count," and forcing manual unit building tanks portal adoption.

### Decision 2 — Field set, tiered by how hard you push it
Surface what the schema already holds, in three tiers:

**Always collected (line level):** description, quantity, **unit of measure** (add this — pieces/cases/pallets/cartons), weight + UOM.

**Strongly recommended (line level):** SKU/part number, dimensions L×W×H + UOM, declared value (you have pricing — reuse for insurance/customs).

**Conditional (shown only when relevant):**
- *LTL mode →* freight class, NMFC code, **stackable**.
- *Hazmat flag on →* UN number, hazmat class, packing group, proper shipping name. **(Schema gap: you have a `hazmat` boolean but no UN/class/PG/PSN fields. Add these — they're legally required to ship.)**
- *Reefer/temperature →* temperature is free-text today; tighten to min/max range + UOM for cold-chain to actually evaluate excursions.
- *International →* HS/commodity code, country of origin. (Schema gap if you want customs.)

**Order-level packing summary (Phase 1 handling units):** packaging type, handling-unit count, stackable, per-unit footprint.

### Decision 3 — Mandatory rules: mode-driven, not a fixed list
Don't hardcode a required set. Required-ness is a function of `(mode, flags)`:

| Field | FTL | LTL | Parcel | Hazmat on |
|---|:--:|:--:|:--:|:--:|
| description, qty, weight | ✓ | ✓ | ✓ | ✓ |
| dimensions | – | ✓ | ✓ | ✓ |
| freight class | – | ✓ | – | ✓ |
| stackable | – | ✓ | – | ✓ |
| UN/class/PG/PSN | – | – | – | ✓ |

Implement as a small rules table (org-overridable), evaluated in the portal form and re-validated server-side. This is the single highest-leverage decision: it keeps the form short for simple freight and rigorous where it matters.

### Decision 4 — Packaging as a reference catalog, not free text
Generalise `PalletType` into an **org-scoped packaging-type catalog** (or add a sibling `PackagingType` covering carton/crate/drum/roll/bag/tote/loose, with the pallet-specific fields nullable). Customers pick from a dropdown; you get standardised dims and clean rating. Seed a sensible default set per org. This kills the "palette" vs "pallet" vs "skid" free-text mess and makes cube math possible.

### Decision 5 — Cartonization is computed, never asked
Customers supply pieces + packaging + dims + stackable. The system derives and stores/displays:

- **Density** (weight ÷ cube) — and auto-suggest freight class from it (you already have density-based class calc in `LtlRatingService`).
- **Pallet positions / handling-unit count** when they enter loose pieces instead of pallets.
- **Linear feet** for FTL floor-space and partial-truckload pricing.
- **Rolled-up class** per handling unit (highest class wins).

Surface these as read-only "calculated" fields on the line/unit so customers see what their entry implies for price. Don't let them type density or linear feet directly.

### Decision 6 — Configurability
Three layers, in priority order:
1. **Mode rules table** (Decision 3) for the standard required/optional matrix — ships with sane defaults.
2. **`CustomFieldDefinition`** (already built, versioned) for org-specific extras like internal cost center, project code, customer-specific refs.
3. **Packaging catalog** (Decision 4) for the per-org list of allowed packaging types.

Avoid a fourth bespoke config surface — these three cover it.

## 4. Recommended portal field set (concrete, Phase 1)

Per commercial line:
- Description *(required)*
- SKU / part number
- Quantity + unit of measure *(required)*
- Weight + UOM *(required)*
- Dimensions L×W×H + UOM *(required for LTL/parcel)*
- Declared value
- Hazmat toggle → reveals UN number, class, packing group, proper shipping name *(required when on)*
- Freight class + NMFC *(shown/required for LTL; auto-suggested from density)*
- Temperature requirement (range)

Per order (packing summary, auto-creates handling units):
- Packaging type *(catalog dropdown)*
- Handling-unit count
- Stackable toggle
- Footprint per unit (default from packaging type)

Calculated, read-only: density, suggested class, pallet positions, linear feet, rolled-up class.

## 5. Schema gaps to close (small)
- Hazmat detail fields on `OrderLineItem`: `unNumber`, `hazmatClass`, `packingGroup`, `properShippingName`.
- `unitOfMeasure` on the line (pieces/cases/pallets/cartons).
- Optional customs fields: `hsCode`, `countryOfOrigin`.
- Tighten `temperature` from free-text to `tempMinC`/`tempMaxC` (keep the label for display).
- Generalise `PalletType` → `PackagingType` (or sibling) so non-pallet packaging has a catalog too.

Everything else is surfacing + the mode-rules engine.
