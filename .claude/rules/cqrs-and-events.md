# CQRS, Commands, Events & Projections

The write path for this codebase. Applies to every entity and feature.

## Command Handlers

- All write operations go through command handlers in `backend/src/commands/`
- Commands execute inside `prisma.$transaction()` via `BaseCommandHandler`
- Events are collected during execution and published AFTER the transaction commits
- Register new handlers in `backend/src/di/modules/<module>.ts`, in that module's
  `register<Module>CommandHandlers` function. See the module-boundaries rule
- Routes dispatch commands: `commandBus.dispatch({ type, orgId, actorId, payload, metadata })`

## Events & Projections

- Domain events are defined in `backend/src/events/eventTypes.ts` with a schema version
- Projections (read model builders) live in `backend/src/events/projections/`
- Register new projections in `backend/src/events/registerHandlers.ts`
- Read models are flat Prisma tables — no joins needed for list queries
- Backfill script: `npx tsx backend/src/scripts/backfill-read-models.ts`, or
  `--only=<name>` to rebuild one read model. Add your step to `STEPS` in that file
- **A backfill takes each row's `orgId` from its own source record.** Never resolve one org for the
  whole run: the queries are org-wide, so a single id would write one tenant's rows under another's

## When Adding a New Entity or Feature

**You MUST do ALL of the following — this is not optional:**

1. **Command handlers** — Create/Update/Archive commands in `backend/src/commands/<entity>/`
2. **Event types** — Add to `backend/src/events/eventTypes.ts` with schema version
3. **Projection** — Create `<Entity>Projection.ts` in `backend/src/events/projections/` if a read model exists
4. **Tests** — Unit tests for command handlers AND projections in `backend/src/__tests__/`
5. **Domain behaviours doc** — Update `docs/DOMAIN_BEHAVIOURS.md` with commands, events, and side effects
6. **Roadmap** — Update `roadmap.md` to mark items complete or add new items
7. **API docs** — Add Swagger/OpenAPI `schema` blocks to new endpoints
8. **README** — Update the feature list in `README.md` if adding user-facing capability
9. **Marketing website** — Review and update `www/` feature pages if the feature is user-facing.
   Check: `www/src/pages/features/`, `www/src/components/Features.tsx`,
   `www/src/components/Hero.tsx`, and `www/src/components/previews/`.

## Test Requirements

- Every command handler must have tests verifying: success case, event emission,
  metadata propagation, error case
- Every projection must have tests verifying: read model creation on `entity.created`,
  field updates on `entity.updated`
- Integration tests should verify the command → event → projection pipeline for new entities
- Run `cd backend && npx jest --config jest.config.cjs` and confirm tests pass before committing
- Test utilities in `backend/src/__tests__/helpers/testUtils.ts`:
  `mockEventBus()`, `createTestCommand()`, `createTestEvent()`
