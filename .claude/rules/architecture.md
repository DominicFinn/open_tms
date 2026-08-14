# Architecture & Layering (STRICT)

The layering that everything else depends on. Applies to all backend work.

```
Route  →  Command (write)  →  Repository / Prisma  →  Database
       →  Repository / Read Model (read)
```

**No layer is skipped, in either direction.**

## Routes must be THIN

A route handler does HTTP in and HTTP out. Nothing else.

- Parse and validate input (via the Fastify `schema` block — see the api-design rule)
- Resolve `req.orgId!` and the actor
- Dispatch a command, or call a repository
- Shape the response envelope and pick the status code

That's the whole job. Get the request back to the caller as fast as possible.

```ts
// ✅ Thin — decision-making lives in the command handler
server.post('/api/v1/shipments', { schema }, async (req, reply) => {
  const result = await commandBus.dispatch({
    type: 'CREATE_SHIPMENT',
    orgId: req.orgId!,
    actorId: req.user!.id,
    payload: req.body,
  });
  return reply.code(201).send({ data: result, error: null });
});
```

## Business logic lives in commands and services, never in a route

If a handler contains a branch that encodes a business rule — eligibility, pricing, status
transitions, "can this be cancelled" — it is in the wrong place. Move it into the command handler
(for writes) or a service (for orchestration and derived reads).

Services orchestrate repositories, dispatch jobs, and emit events. They do not talk HTTP.

## All writes go through the command bus

Never mutate domain data straight from a route. Writes are dispatched as commands so they run
inside a transaction, emit events after commit, and stay auditable. See the cqrs-and-events rule.

## All reads go through repositories or read models

- Query building — `where`, `include`, `orderBy`, `select`, joins — **lives inside repository
  methods**, not in routes or services.
- List endpoints read the denormalized `*ReadModel` tables. See the backend rule.
- Repositories may return model instances or DTOs. They must not return a half-built query builder
  for someone else to finish.

## No raw SQL

**No `$queryRaw` / `$executeRaw` outside a repository.** They bypass Prisma's typing, model casts,
and the org-scope discipline, and they are where injection bugs come from.

If you genuinely need something Prisma can't express (rare — aggregation over a time bucket is the
usual honest case), it goes **inside a repository method**, parameterized via the tagged-template
form, with a comment saying why Prisma couldn't express it.
`AgentDecisionRepository` is the one sanctioned instance in the codebase; match its shape.

Never build SQL by string concatenation with a runtime value, anywhere, for any reason.

## No direct Prisma in routes

`prisma.<model>.<method>()` inside a route handler is a layering violation. Add or reuse a
repository method instead.

The **one** sanctioned exception is org-scope plumbing registered by the middleware helpers, and
even there you must never write `prisma.organization.findFirst()` inline — that silently picks the
first org for every tenant. Use `registerOrgScope` and read `req.orgId!`. See the multi-tenancy rule.

## Reuse a query before you write a near-duplicate

Before adding a repository method, check whether an existing one already runs the same query shape.
If it differs only in which columns it selects, or by a small post-filter over a bounded result,
**reuse it and map the fields you need**. A near-duplicate query will demand its own index, and
index budget is a scarce resource — see the database rule.
