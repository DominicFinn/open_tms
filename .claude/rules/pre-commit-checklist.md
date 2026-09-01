# Pre-Commit Checklist

Walk this before opening a PR. Not a formality — most of these have bitten us.

## Layering

- [ ] `npm run lint:boundaries` passes, with no new entry in `exceptions.json`
- [ ] No business logic in route handlers — routes are HTTP in/out only
- [ ] All writes dispatched through the command bus
- [ ] All query building inside repositories; no `prisma.<model>` calls in routes
- [ ] No raw SQL outside a repository; no string-concatenated SQL anywhere
- [ ] Existing query/repository method reused rather than a near-duplicate added

## Data

- [ ] New query patterns have index support, and the index budget was respected — existing index
      widened or query reused before adding a new one
- [ ] Table role declared for any new table (ledger / hot row / read model / reference)
- [ ] `orgId` present on any new tenant-scoped model, and passed into every repo read and dispatch
- [ ] Money stored as integer cents
- [ ] New read model has a working backfill path
- [ ] Migration is one concern, descriptively named, and doesn't edit a migration already run in prod

## Concurrency

- [ ] Contended writes wrapped in a transaction, with the authoritative row re-read inside it
- [ ] **No I/O inside any transaction** — no HTTP, payment, email, storage, broadcast, or dispatch
- [ ] Events and job dispatch happen after commit
- [ ] Idempotency key with a unique constraint on every external event consumer
- [ ] Concurrency reasoning documented in the service/command doc block

## Async

- [ ] Long-running work is queued, not held in the request cycle
- [ ] Long jobs return 202 + a handle, and notify by email/callback on completion
- [ ] Retry policy, backoff, and dead-letter behaviour declared explicitly
- [ ] Job handler is safe to run twice

## API

- [ ] Validation in the Fastify `schema` block, not hand-rolled in the handler
- [ ] Swagger `schema` + `tags` on every new endpoint
- [ ] `{ data, error }` envelope; no raw Prisma models returned
- [ ] Pagination on every list endpoint
- [ ] Correct HTTP status codes — **never 200 with an error body**

## Frontend

- [ ] No hardcoded colors — semantic tokens only, no hex/`rgb()`/arbitrary Tailwind color values
- [ ] No inline `style={{ }}` for anything the design system covers
- [ ] shadcn primitive reused rather than a bespoke component
- [ ] No new polling interval (and none under 30s) — see the realtime rule
- [ ] Every schema field accounted for in create form, edit form, detail page and list view
- [ ] Loading, error and empty states handled
- [ ] Page reachable from the router/sidebar
- [ ] `npx tsc --noEmit` clean

## Quality

- [ ] Only business-decision comments — no restating what the code does
- [ ] No PII in logs, event metadata, or broadcast payloads
- [ ] Structured logging, no string concatenation
- [ ] try/catch only at the edges; no exceptions used for flow control
- [ ] Cyclomatic complexity under 10 in touched functions
- [ ] Command handler and projection tests added; `cd backend && npx jest --config jest.config.cjs`
      passes

## Docs & tracking

- [ ] `docs/DOMAIN_BEHAVIOURS.md` updated with commands, events, side effects
- [ ] `roadmap.md` updated
- [ ] `README.md` updated if user-facing
- [ ] `www/` reviewed if user-facing
- [ ] Issue number in the branch name and commit message
- [ ] `.tracking/<feature>.md` fully checked off, then deleted
- [ ] Worktree removed and the GitHub issue moved to *Done*
