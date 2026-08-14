# Language & Tooling

## TypeScript everywhere — no new JavaScript projects

Every service and app in this monorepo is **TypeScript**: `backend/`, `frontend/`, `edi-collector/`,
`auth-service/`, `packages/shared/`, `www/`.

- **Do not create new JavaScript projects, packages, or services.**
- Do not add new `.js` source files to a TypeScript project — write `.ts`/`.tsx`.
- New shared code goes in `packages/shared/` as TypeScript.

`webhook-service/` is plain JavaScript (`index.js`). It is a **legacy exception**, not a pattern to
copy or extend. Don't treat it as precedent for a new service, and don't port other services toward
it. If it needs substantial work, converting it to TypeScript is the preferred direction.

Config files that the tool ecosystem requires in JS/CJS (e.g. `jest.config.cjs`,
`postcss.config.js`) are fine and are not what this rule is about.
