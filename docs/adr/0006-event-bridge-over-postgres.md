# ADR 0006: The event bridge between Node and .NET runs through Postgres

- **Status:** Accepted
- **Date:** 2026-10-22
- **Relates to:** [ADR 0004](0004-port-to-csharp-starting-with-finnwms.md) (left the broker open),
  [ADR 0005](0005-wms-table-handover-in-one-move.md), #360

## Context

From stage 3 of the FinnWMS port, .NET commands emit events that Node handlers and projections
consume (triage, customer webhooks, read models), and .NET consumes some Node events (units and
demand, which feed its projections). ADR 0004 said the two sides would talk through a transactional
outbox on each side and a broker, with the broker chosen here.

Both stacks share one Postgres server, and will until the databases separate. The Node event bus is
already Postgres-backed: events land in `DomainEventLog` and fan out through pg-boss queues.

Options considered:

1. **A broker (NATS or RabbitMQ) between the outboxes.** The usual answer, and the right one once
   the databases separate. Today it adds a service to run, monitor and back up everywhere,
   including local development, to move rows from one table in a database to another table in the
   same database. Rejected for now.
2. **Each side reads the other's outbox table directly.** No new infrastructure, and the outbox
   stays the contract a broker would later carry. Chosen.
3. **.NET writes straight into `DomainEventLog` and pg-boss.** Couples .NET to Node's internals and
   breaks single ownership of those tables. Rejected.

## Decision

**Events cross between the stacks through outbox tables in Postgres, polled by the receiving side.
There is no broker until the databases separate.**

### Reading an outbox safely

An outbox polled by a sequence number can skip a row: a transaction that took position 6 can commit
after one that took position 7, and a reader that has moved its cursor to 7 never sees 6.

Each outbox row records the id of the transaction that wrote it (`pg_current_xact_id()`, type
`xid8`). A reader orders by `(tx_id, position)` and only reads rows whose transaction is older than
the oldest transaction still running (`pg_snapshot_xmin(pg_current_snapshot())`). Every such row has
committed, and no transaction that commits later can have a smaller id, so nothing can appear
behind the cursor.

### .NET to Node

- `wms.outbox`, owned by the .NET migrations. A command writes its events there in the same
  transaction as its change.
- The Node worker runs a relay that reads new rows, writes each to `DomainEventLog` and fans it out
  as if a Node command had emitted it, then advances its cursor in `EventBridgeCursor`, a Node table.
- Delivery is **at least once**. The cursor only moves after fan-out, so a crash repeats delivery
  rather than losing it. `DomainEventLog`'s primary key is the event id, so a repeated row is
  ignored, and handlers are already required to be idempotent.
- Node reads `wms.outbox` with raw SQL inside one repository, which is the sanctioned shape for SQL
  Prisma can't express. The outbox is the published contract; Node reads nothing else in `wms`.
- When `wms.outbox` doesn't exist (no .NET service deployed), the relay does nothing.

### Node to .NET

- A Node-side outbox in a `bridge` schema, created by a Prisma migration as raw SQL so Prisma doesn't
  manage it, written by a Node handler for the event types .NET subscribes to.
- A .NET background service reads it with the same rule, records each event id in an inbox table
  with a unique key, and dispatches to its handlers. The inbox makes redelivery a no-op.

This direction is built in a second change, once there is a .NET consumer to feed.

### Contracts

Event payloads are described once as JSON Schema and generated into C# records and TypeScript
types, with a check that every bridged event type exists in `eventTypes.ts`. Built alongside the
first .NET events (stage 3), when there are payloads to describe.

## Consequences

- **Easier:** nothing new to deploy; events are in the same database, so a transaction and its
  events commit together on either side; local development needs no extra container.
- **Harder:** each side polls, so cross-stack latency is the poll interval (one second by default),
  not push; the relay's SQL is Postgres-specific; the outbox tables need pruning once relayed rows
  are old.
- **Given up for now:** independent scaling and delivery across separate databases. The outbox
  tables are what a broker would carry, so adding one later replaces the pollers, not the producers.
