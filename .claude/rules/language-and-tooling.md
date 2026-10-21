# Language & Tooling

## C# is the target, TypeScript is being ported away from

[ADR 0004](../../docs/adr/0004-port-to-csharp-starting-with-finnwms.md) moves the backend to C# and
.NET, one module at a time, starting with FinnWMS (`wms` + `inventory`) under `services/wms/`.

- **New backend services go in `services/<name>/` as C# on .NET 10.** Hand-written SQL with
  Npgsql and Dapper, DbUp migrations, row-level security for tenancy. No Entity Framework.
- **Don't start new feature work in a TypeScript module that is being ported.** Once a module's
  port has begun, its changes land on the .NET side.
- The frontend stays React and TypeScript. Generated API clients come from the .NET OpenAPI
  document.
- Until a module is ported, its TypeScript code follows the existing rules as before.

## No new JavaScript projects

Every TypeScript app in this monorepo stays TypeScript: `backend/`, `frontend/`, `edi-collector/`,
`packages/shared/`, `www/`.

- **Do not create new JavaScript projects, packages, or services.**
- Do not add new `.js` source files to a TypeScript project. Write `.ts`/`.tsx`.
- New shared TypeScript code goes in `packages/shared/`.

Config files that the tool ecosystem requires in JS/CJS (e.g. `jest.config.cjs`,
`postcss.config.js`) are fine and are not what this rule is about.
