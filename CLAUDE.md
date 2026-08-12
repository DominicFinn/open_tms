# CLAUDE.md — Project Conventions for Open TMS

Detailed conventions are split into `.claude/rules/`. Rules with a `paths:` header load
automatically when Claude reads a matching file; the rest load every session. This file holds only
what applies everywhere.

## Project Structure

- **Monorepo** with `backend/`, `frontend/`, `edi-collector/`, `packages/shared/`, `www/`
- Root `package.json` has hoisted `node_modules`; run `npm install` from root
- Backend: Fastify + TypeScript + Prisma + PostgreSQL (port 3001)
- Frontend: React 18 + TypeScript + Vite (port 5173)

## Where the rules live

Always loaded:

| Rule | Covers |
|---|---|
| `.claude/rules/architecture.md` | **Layering**: thin routes → commands/services → repositories/read models. No raw SQL, no Prisma in routes |
| `.claude/rules/cqrs-and-events.md` | Command handlers, events, projections, **the mandatory checklist for any new entity**, test requirements |
| `.claude/rules/security.md` | Tenancy as a security boundary, auth guards, validation, **rate limiting**, headers, webhooks, PII, secrets |
| `.claude/rules/error-handling-and-logging.md` | try/catch at the edges, **no PII in logs**, structured logging, complexity limit |
| `.claude/rules/language-and-tooling.md` | TypeScript everywhere — **no new JavaScript projects** |
| `.claude/rules/workflow.md` | GitHub Issues + Projects, TMS/WMS prefixes, `gh` CLI, worktrees, tidy-up |
| `.claude/rules/pre-commit-checklist.md` | Walk before every PR |
| `.claude/rules/feature-tracking.md` | `.tracking/<feature>.md` planning files for multi-layer work |

Loaded when you touch matching files:

| Rule | Scope |
|---|---|
| `.claude/rules/backend.md` | `backend/src/**` — API envelope, DI, repositories, read models, file storage |
| `.claude/rules/multi-tenancy.md` | `backend/src/**` — `orgId`, `req.orgId`, per-surface scope helpers |
| `.claude/rules/api-design.md` | `backend/src/routes/**` — REST, envelope, pagination, **HTTP status codes**, schema validation |
| `.claude/rules/transactions-and-concurrency.md` | commands/services/workers — **no I/O in a transaction**, locking, idempotency keys |
| `.claude/rules/queues-and-jobs.md` | workers/queue — queue everything non-request, backoff, dead letters |
| `.claude/rules/observability-and-sre.md` | `backend/src/**` — `/metrics` + queue health, projection lag, alerting on absence, graceful degradation |
| `.claude/rules/database.md` | `backend/prisma/**`, repositories, projections — **indexing + index budget**, table roles, soft deletes, migrations |
| `.claude/rules/frontend.md` | `frontend/src/**` — never hardcode colors, theme system, layouts |
| `.claude/rules/design-system.md` | `frontend/src/**` — shadcn/ui primitives, styling prohibitions, tokens, icons |
| `.claude/rules/ui-verification.md` | `frontend/src/**` — **never assume UI work is done**; field audit + E2E checklist |
| `.claude/rules/realtime.md` | frontend + events — **broadcast, don't poll**; after commit; no PII on channels |
| `.claude/rules/marketing-website.md` | `www/**`, `README.md` — no em dashes, project identity |
| `.claude/rules/domains/*.md` | Per-domain rules: issues, edi, financials, archival, agents-and-automation, tracking-and-routing, tendering |

Architecture references (not rules) live in `docs/`. Each domain rule links to its guide.

## Git

- **Branch per issue off an up-to-date `origin/main`** — pull first, always
- Issue number in the branch name and the commit message
- Worktrees strongly preferred; remove them when the work merges
- Don't push to `main` directly

Full detail in `.claude/rules/workflow.md`.

## Adding a new rule

One topic per file, in `.claude/rules/` (or `.claude/rules/domains/` for a business domain). Add
`paths:` frontmatter unless the rule genuinely applies to every file — path-scoping keeps it out of
context until it's relevant. Then add a row to the table above.

Keep rules to conventions, invariants, and pitfalls. Architecture narrative, model listings, and
key-file maps belong in `docs/`, which Claude reads on demand.
