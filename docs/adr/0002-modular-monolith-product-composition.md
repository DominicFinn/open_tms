# ADR 0002: Modular Monolith with Build-Time Product Composition (FinnTMS / FinnWMS)

- **Status:** Accepted
- **Date:** 2026-08-16
- **Relates to:** the split announced in the `open-tms-is-changing` article
  (`www/src/content/articles.ts`), `docs/roadmap/split-finntms-finnwms.md`

## Context

Open TMS is splitting into distinct products: **FinnTMS** (transport) and **FinnWMS** (warehouse),
with a possible **FinnIMS** (inventory) later. At least one real prospect wants only
WMS + Inventory + Issues, so standalone WMS installs must be possible. The codebase is a single
Fastify/Prisma backend (~150 models, one schema) and a single React SPA, maintained by one person
with heavy AI-assisted development.

An audit of the entanglement found:

- Three conflated models block separation: `Location` (TMS geographic node and WMS facility root,
  with 17 WMS models hanging off it), `TrackableUnit` (required cascade `orderId` FK plus a WMS
  fields block, so stock cannot exist without a TMS order), and `Allocation.orderLineItemId` (the
  only hard FK from stock to demand).
- Clean seams already exist: WMS Prisma models are contiguous, ~55 WMS event types are defined with
  zero cross-domain subscribers, and most WMS→TMS references are already soft string ids.
- There is no backend app registry or feature-flag system; "apps" are a hardcoded frontend array.

### Alternatives considered and rejected

1. **Separate repositories with published core packages.** Versioning, publishing, and cross-repo
   refactoring overhead a solo maintainer cannot pay; breaks the AI-assisted workflow, which
   benefits from the whole system and `.claude/rules/` being visible in one context.
2. **Runtime plugin system** ("TMS and WMS as plugins loaded by Core"). A plugin API surface,
   version compatibility matrix, and dynamic loading are a product in themselves. Everything the
   plugin idea was for is delivered by static composition + entitlements, with type safety intact.
3. **Separate services/databases now.** Permanent 2x operational load with no current forcing
   function. The chosen design keeps this reachable later: ports, events, and soft ids are exactly
   the seams a network boundary would need.
4. **Don't split at all.** Rejected because standalone WMS installs are a real commercial
   requirement, and the conflated models are live bugs regardless.

## Decision

**Keep everything in the existing monorepo, with one backend codebase structured as a modular
monolith. Products are thin build-time entrypoints that compose statically-typed modules.**

- Modules: `core`, `inventory`, `wms`, `tms`, `quality`, and `finance` (charges, invoices,
  payments). Finance sits in core's dependency tier rather than inside tms: the 3PL Billing Suite
  is FinnWMS's revenue feature and bills through the same charge/invoice pipeline, so a standalone
  FinnWMS needs it without depending on tms code (decided 2026-08-16). Each module exposes one
  public surface
  (`modules/<m>/index.ts`: DI ports + a `register()` Fastify plugin contributing routes, DI,
  event handlers, issue types, workers).
- Products: `apps/full` (today's deployment), `apps/tms` (core+finance+inventory+tms → FinnTMS),
  `apps/wms` (core+finance+inventory+wms → FinnWMS), later `apps/ims`.
- Dependency DAG, lint-enforced: `core ← inventory ← wms`; `core ← tms` (tms may import inventory's
  public ports only); `core ← quality`; **tms and wms never import each other**.
- Cross-module communication: domain events by default; DI-resolved ports for the rare synchronous
  call. No module touches another module's Prisma models. No FK crosses the tms↔wms boundary;
  references there are soft string ids only.
- Model fixes required by the boundary: new `Facility` (WMS re-points off `Location`);
  `TrackableUnit` stays TMS and its WMS fields move to a new standalone `HandlingUnit`;
  `Allocation` gets polymorphic `(demandType, demandId)`; `OrgWmsSettings` is carved out of
  `Organization` (no full god-model split).
- Per-org **entitlements** (`OrgApp` table + `requireApp()` guard) replace the hardcoded frontend
  APPS array; `ENABLED_MODULES` env selects modules at boot; `VITE_PRODUCT` selects frontend
  bundles and branding.
- Standalone WMS installs: **Tier 1** ships the full migration history with TMS tables dormant and
  TMS code not compiled in. **Tier 2** (a composed WMS-only schema profile with its own migration
  baseline) is deferred until a customer contractually requires zero TMS tables.
- The dormant `auth-service/` is deleted; core auth remains the identity provider for every product.

## Consequences

- **Easier:** standalone FinnWMS and near-free FinnIMS later; per-product branding; refactoring
  across the whole system stays one-repo cheap; the Issue/Triage centre serves both domains via a
  composition-time issue-type registry; the migration can proceed incrementally with the product
  shipping throughout.
- **Harder:** boundary discipline must be enforced (lint + `.claude/rules/module-boundaries.md`),
  and existing leaks (wave commands reading `tx.order`, load plans writing BOLs, pack audit writing
  issues directly) must be burned down through ports/events/projections.
- **Given up (for now):** independent deploy/scale per product, per-product databases, and a
  runtime marketplace-style plugin model. All remain reachable later because the seams (events,
  ports, soft ids) are the same ones a physical split would need.
