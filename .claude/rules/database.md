---
paths:
  - "backend/prisma/**"
  - "backend/src/repositories/**"
  - "backend/src/events/projections/**"
---

# Database Rules (STRICT)

PostgreSQL via Prisma. Migrations in `backend/prisma/migrations/`. After schema changes: write the
migration SQL, then run `npx prisma generate`.

## Where a model lives

The schema is one file per module in `backend/prisma/schema/`: `core`, `finance`, `inventory`,
`quality`, `tms`, `wms`, plus `config.prisma` for the generator and datasource. Prisma reads the
folder as a single schema, so a relation may point at a model in another file, but **the file a
model sits in is the record of which module owns it**.

Put a new model in the module that owns the behaviour, and keep it there. No FK may cross the
tms/wms boundary. References there are soft string ids. See
[module-boundaries](module-boundaries.md).

## Naming

Prisma conventions, not SQL conventions:

- Models: `PascalCase`, singular — `Shipment`, `TradingPartner`, `IssueSignal`
- Read models: `<Entity>ReadModel` — `ShipmentReadModel`, `IssueReadModel`
- Fields: `camelCase` — `createdAt`, `customerId`, `isActive`
- Foreign keys: `{singularModel}Id` — `customerId`, `orderId`
- Join tables: `<A><B>Assignment` / `<A><B>` — `IssueLabelAssignment`
- Money: always integer cents, suffixed `Cents` — `amountCents`, `totalPriceCents`
- Timestamps: `createdAt`, `updatedAt`, plus explicit event times (`deliveredAt`, `archivedAt`,
  `snoozedUntil`). **Store all times in UTC.**
- Every tenant-scoped model carries `orgId String` (NOT NULL) — see the multi-tenancy rule

## Indexing (STRICT)

### Every query must have index support

Every query we ship must be servable by an index covering its `WHERE`, `ORDER BY`, `JOIN` and
`GROUP BY` columns. **No unindexed `WHERE` on a table that can grow. Ever.**

Order predicates for the index, not for readability: equality columns first, the range/sort column
last.

### The index budget (the counterweight)

The rule above pulls one way; this one pulls the other. **Every table has an index budget: a soft
cap of 4 secondary indexes.**

Why a cap:

- Every secondary index is rewritten on every `INSERT`, and on every `UPDATE` touching its columns.
  Index count is a direct tax on write throughput — worst on the tables we write hardest.
- The planner picks essentially one index per table per query. The 5th index usually isn't chosen;
  it's pure write cost.
- **A table needing 6+ indexes is a table doing two jobs.** In this codebase that has a specific
  remedy: split the read side into another read model. See Table Roles.

Budget by table role:

| Role | Budget | Reason |
|---|---|---|
| Ledger / append-only (`IssueSignal`, `EdiTransactionLog`, event store) | 1–2 | Insert throughput is the whole point |
| Authoritative mutable / hot row (`Shipment`, `Order`, `Issue`, `Charge`) | 2–3 | Every update pays; reads should come off a read model |
| Read model / projection (`ShipmentReadModel`, `IssueReadModel`) | 3–4 | Read-optimised by definition — this is where indexes belong |
| Small bounded reference (`ShipmentType`, `IssueLabel`) | 0–1 | A scan of 50 rows is free; cache it instead |

Unique constraints that exist for **correctness** (idempotency keys, natural keys) are exempt from
the budget, but keep the key narrow.

> **Current state:** several tables are already well over budget — `Shipment` (18), `Issue` (14),
> `EdiTransactionLog` (14), `Order` (12). Treat that as debt, not licence. On those tables the
> "4+ → do not add" row below applies: reuse a query, or move the read into a read model.

### Before you add an index — decision procedure

Work down this list in order. Only reach the bottom if everything above genuinely fails.

1. **Can an existing index already serve it?** Read the model's current `@@index` lines first. A
   composite on `(a, b, c)` serves `WHERE a`, `WHERE a AND b`, `WHERE a AND b AND c`, and sorts on
   `a` or `a, b` — the **leftmost-prefix rule**. Most "I need a new index" moments are a query
   written in the wrong shape.
2. **Can the query be reshaped to fit an existing index?** Reorder predicates, add the leading
   column as a predicate, or push a cheap filter into TypeScript. Reshaping is free; an index is
   forever.
3. **Can you reuse an existing query instead of a near-duplicate?** If a repository method already
   runs the same shape and differs only in selected columns or a small post-filter, use it and map
   the fields you need out of the result.
4. **Can you widen an existing index instead of adding one?** `(status, customerId)` →
   `(status, customerId, createdAt)` keeps the count at one and serves both patterns. Prefer
   widening whenever the new pattern shares a leftmost prefix. Then drop any index that is now a
   redundant prefix of another.
5. **Only now, add the index** — and only if the table stays within budget.
6. **Over budget?** The table is doing two jobs. Move the read side into a read model. Do not "just
   add one more."

### The deciding factor — reuse a query or add an index?

The trade: **reusing a query costs a little over-fetching on each read; an index costs write
throughput and memory forever.** Which wins depends on how many indexes the table already carries.

| Indexes already on the table | Decision |
|---|---|
| 0–2 | A justified index is fine. Still check steps 1–4 first. |
| 3 | Strongly prefer widening or reuse. A new index needs written justification in the migration. |
| 4+ | **Do not add.** Reuse the existing query and map fields in TypeScript, or extract a read model. |

**Guard rail on reuse:** filtering in TypeScript is only acceptable when the reused query returns a
**bounded, small** result set (a page of results, or a set with a stated upper bound). Never reuse a
query that pulls an unbounded set into memory just to dodge an index. When the alternative is
loading 50k rows, add the index.

**If the crossover genuinely can't be resolved** — every existing index is wrong, the table is at
budget, and splitting the read model isn't obviously right — make the sensible call, query only what
you need, and **raise it to the user** rather than quietly adding a fifth index.

### Composite index design

- Equality predicates first, range/sort column last: `@@index([status, customerId, createdAt])`
- One composite beats two singles for the same access pattern
- Never index a low-cardinality column alone (`status`, a boolean) — it must lead into a composite
- Never keep two indexes where one is a leftmost prefix of the other. Drop the shorter one.

### Documenting and proving indexes

- Add indexes in the same migration that creates the query need
- The migration comment states **which repository method the index serves** and **why an existing
  index couldn't**
- Prove it with `EXPLAIN (ANALYZE, BUFFERS)` before merging: no sequential scan on a growable table,
  no external sort on a hot read path

## Table Roles (STRICT)

**Every table has exactly one role. Declare it in the migration comment.** The role decides who may
write to it, how it's locked, and how much index budget it gets.

### 1. Ledger — append-only

Examples: `IssueSignal`, `EdiTransactionLog`, the event store, agent decision logs.

- **INSERT only.** A state change is a new row, never an edit to an old one. The one allowed
  exception is a claim/completion marker column (`processedAt`, `publishedAt`).
- Tight index budget — insert throughput is the point.
- **Never aggregate a ledger on a request path.** A `count()` over `IssueSignal` during a page
  render is a bug; that number belongs in a read model.
- Grows forever: a retention or archival policy is part of the deliverable.

### 2. Authoritative mutable — the hot row

Examples: `Shipment`, `Order`, `Issue`, `Charge`, `Invoice`.

- The contested source of truth for a value two writers might fight over.
- Every mutation goes through a command handler's `prisma.$transaction()`. See the
  transactions-and-concurrency rule.
- **Keep the row narrow.** You lock the row, not the column — long text, JSON blobs and rarely-read
  fields belong in a sibling table so they aren't dragged through every contended write.
- Reads for display should come off a read model, so listing traffic doesn't queue behind writes.

### 3. Read model / projection

Examples: `ShipmentReadModel`, `IssueReadModel`, `InvoiceReadModel`.

- Written **only** by projections, from events. A route handler never writes a read model directly.
- **Must be rebuildable from source.** `backend/src/scripts/backfill-read-models.ts` is part of the
  deliverable for a new read model, not a nice-to-have. If it can't be rebuilt, it isn't a
  projection — it's unbacked state. Register the step in `STEPS` so it can be run on its own with
  `--only=<name>`, and take each row's `orgId` from its own source record.
- **A new read model is empty on the day it deploys**, and the features reading it fail silently
  rather than erroring. Running the backfill is part of shipping it, not a follow-up.
- Read paths never lock it and never join more than one level off it.
- Freshness contract is documented. Ours is roughly half a second (pg-boss polls at 0.5s) — stale by
  seconds is fine; stale by minutes is a bug.

### The one rule that matters

**Never make a correctness decision from a read model.**

Display from the read model. Decide from the authoritative row inside the command's transaction.

```ts
// ✅ Display — read model, fast, no lock
const rows = await shipmentReadModel.list(orgId, filters);

// ✅ Decide — authoritative row, re-read inside the transaction
await prisma.$transaction(async (tx) => {
  const shipment = await tx.shipment.findUnique({ where: { id } });
  if (shipment.status !== 'in_progress') throw new InvalidTransitionError();
  // ...
});

// ❌ NEVER — deciding from the read model
if (readModelRow.status === 'in_progress') { /* race */ }
```

### When to add a read model

Add one when **any two** hold:

- The read runs on every page load or sits in a hot path
- The query needs 3+ joins, or aggregates over a ledger table
- The source is a hot-row table and you don't want reads competing with write locks
- Serving it live would push the source table over its index budget

Query live instead when: the read is admin-only or low-frequency; the value drives a correctness
decision; or the source is small and bounded.

## Prefer write-many over complex joins

This is the read-model role in practice.

- Favour denormalized flat tables for read-heavy frontend queries
- Write to several tables rather than building a complex join
- It is fine to store computed/derived values if it avoids an expensive query
- List pages should be answerable without joins
- The denormalized copy is **display-only** — decisions still read the authoritative row

## Soft deletes and archival

**Prefer soft deletes. We never hard-delete customer data without an explicit GDPR request.**

This codebase has two distinct recoverable states — do not conflate them:

- **Archive** (`archived`, `archivedAt`, `statusBeforeArchive`) — recoverable, still visible in lists
- **Soft delete** (`deletedAt`, `deletedBy`) — admin-only, hidden from every view

See the archival rule for the full semantics. Any new entity holding customer data should carry the
same shape rather than inventing a third one.

## Auditing

Track changes on important entities. Audit trails in this codebase are **event-sourced** — the
domain event stream is the audit log, so an auditable change must go through a command that emits an
event. Don't add a bespoke audit table when an event will do.

Audit/ledger tables are ledgers: append-only, tight index budget, never aggregated on a request path.
Audit metadata must not contain PII — reference `userId`/`orgId`, never an email or name. See the
logging rule.

## Migration discipline

- **One concern per migration**
- Descriptive names: `create_issue_signal_table`, `add_status_index_to_shipment_read_model`
- Include index creation in the same migration as the table or query it serves
- **Never modify a migration that has run in production — create a new one**
- Declare the table role in the migration comment

### Migration checklist

- [ ] Table role declared in the migration comment (ledger / hot row / read model / reference)
- [ ] Every new query pattern has index support
- [ ] Steps 1–4 of the index decision procedure worked through before any new index
- [ ] Table still within its index budget, and no index is a redundant prefix of another
- [ ] Each index names the repository method it serves
- [ ] `EXPLAIN` run on the hot path — no seq scan on a growable table, no external sort
- [ ] Idempotency keys backed by a unique constraint
- [ ] `orgId` present on any tenant-scoped model
- [ ] Money stored as integer cents
- [ ] Read model has a working backfill path
- [ ] Custom fields use versioning, not migration — old records render against their version
