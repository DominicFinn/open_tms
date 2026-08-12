# Feature Planning and Tracking

When working on a feature that spans multiple layers (schema, backend, frontend, tests, docs),
create a temporary tracking file so work isn't forgotten across context boundaries.

## When to Create a Tracking File

- Any feature that spans backend + frontend
- Any feature with more than 3 distinct implementation steps
- When entering plan mode for a new feature
- When the user explicitly asks for detailed planning

## Tracking File Format

Create the file at the project root: `.tracking/<feature-name>.md`

```markdown
# Feature: <Name>
Created: <date>

## Schema / Database
- [ ] Prisma model defined
- [ ] Migration created
- [ ] prisma generate run

## Backend
- [ ] Repository interface + implementation
- [ ] Service layer (if needed)
- [ ] Command handlers (Create, Update, Archive)
- [ ] Event types added
- [ ] Projection created
- [ ] Routes registered with Swagger schemas
- [ ] DI tokens and registry updated

## Frontend
- [ ] List page — all columns mapped to API response fields
- [ ] Create form — all fields present and submitted to API
- [ ] Edit form — all fields pre-populated and submitted
- [ ] Detail/view page — all fields displayed
- [ ] Navigation — page accessible from sidebar/router
- [ ] Loading, error, and empty states handled
- [ ] TypeScript compiles cleanly

## Integration
- [ ] Create flow: form → API → database → list refresh
- [ ] Edit flow: load existing → modify → save → verify changes
- [ ] Delete/archive flow (if applicable)
- [ ] Field-by-field audit: every schema field appears in UI

## Tests
- [ ] Command handler tests
- [ ] Projection tests
- [ ] Backend tests pass

## Documentation
- [ ] DOMAIN_BEHAVIOURS.md updated
- [ ] roadmap.md updated
- [ ] README.md updated (if user-facing)
- [ ] www/ updated (if user-facing)
```

## Rules

- **Check off items as you go** — update the tracking file after each step, not in bulk at the end
- **The tracking file is the source of truth** — if it isn't checked off, it isn't done
- **Field-by-field audit is mandatory** — before checking off any frontend task, list every field
  from the schema and confirm it appears in the UI component
- **Delete the tracking file** when the feature is fully complete and verified
- `.tracking/` is gitignored — these files are ephemeral working documents
