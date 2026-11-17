# Language & Tooling

## TypeScript throughout

Open TMS is TypeScript, front and back. [ADR 0007](../../docs/adr/0007-tms-only-in-typescript.md)
dropped the port to C# that ADR 0004 had started, and the .NET service has been removed.

- The backend is Fastify, Prisma and PostgreSQL. The frontend is React and Vite.
- **Do not add a second backend language or runtime.** A new service is a TypeScript service.
- Database access goes through Prisma, in repositories. See the architecture and database rules.

## No new JavaScript projects

Every app in this monorepo is TypeScript: `backend/`, `frontend/`, `edi-collector/`,
`packages/shared/`, `www/`.

- **Do not create new JavaScript projects, packages, or services.**
- Do not add new `.js` source files to a TypeScript project. Write `.ts`/`.tsx`.
- New shared TypeScript code goes in `packages/shared/`.

Config files that the tool ecosystem requires in JS/CJS (e.g. `jest.config.cjs`,
`postcss.config.js`) are fine and are not what this rule is about.
