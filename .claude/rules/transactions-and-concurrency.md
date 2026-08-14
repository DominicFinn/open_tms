---
paths:
  - "backend/src/commands/**"
  - "backend/src/services/**"
  - "backend/src/repositories/**"
  - "backend/src/events/**"
  - "backend/src/workers/**"
---

# Transactions & Concurrency (STRICT)

## Wrap contended writes in a transaction

Every write that two actors might race on — status transitions, stock, money, allocation, issue
dedup — runs inside `prisma.$transaction()`. Command handlers get this from `BaseCommandHandler`;
use it rather than opening transactions by hand in a route or service.

- **Re-read inside the transaction.** Any value read before the transaction opened is stale and must
  be discarded. Load the authoritative row again and re-check the precondition.
- **Consistent lock ordering** everywhere: parent before child, ascending primary key for multi-row.
  Inconsistent ordering is how deadlocks happen.
- **Keep the transaction short.** Target a hold under 100ms.
- **Atomic increments** when no decision depends on the value (`{ increment: 1 }`), never
  read-modify-write.
- **Bounded retry** on serialization failure. Never an unbounded retry loop.

## NEVER do I/O inside a transaction

Obvious, but stated so it is unambiguous. Inside `prisma.$transaction()` there must be **no**:

- Payment provider / Stripe call
- HTTP or fetch call of any kind (carrier API, routing API, LLM call, webhook POST)
- Email or notification send
- File or object-storage I/O (`IBinaryStorageProvider`)
- Broadcast or realtime publish
- Queue dispatch that isn't explicitly after-commit

A transaction holds locks. Anything network-bound inside one converts a remote timeout into a
database-wide stall.

**Do the I/O after the transaction commits**, or hand it to a queued job. This is already the
codebase's shape: commands collect events during execution and the bus publishes them **after** the
transaction commits. Preserve that — an event consumed before commit reads data that isn't visible
yet.

## Long or contended work belongs on a queue, not in the request cycle

If work could plausibly take more than a couple of seconds, it does not belong in the request.

- Report generation, exports, bulk imports, aggregation → enqueue, return `202 Accepted` with a
  handle, and deliver the result by **email or callback notification** when it finishes
- Never hold an HTTP request open waiting for a long-running query
- Never run a long query inside a transaction that also holds write locks

See the queues-and-jobs rule.

## Idempotency keys on every external event consumer

Every consumer of an external event — **webhooks, EDI inbound, carrier tracking callbacks, sync
payloads, outbox publishes** — needs an idempotency key.

**Enforced by a unique constraint, not by a `SELECT`-then-`INSERT` check** — that check is itself a
race. Insert and let the unique violation tell you it's a duplicate.

Keep the key narrow (it costs writes like any index), and make it deterministic from the payload:
provider + external event id, or partner + control number.

## Document the concurrency reasoning

Every service or command handler that takes a lock or coordinates a contended write carries a doc
block stating:

- **What contends** — which two writers can race, and over what value
- **What is locked**, and **in what order**
- What is re-read inside the transaction
- What is deliberately deferred to after commit

```ts
/**
 * Concurrency: two tender awards for the same shipment can race.
 * Locks: Tender row by PK, then Shipment by PK (parent-before-child ordering
 * shared with CancelTenderCommand — do not reorder).
 * Re-reads tender.status inside the transaction; the pre-check outside is
 * advisory only.
 * Deferred to after commit: EDI 204 delivery, carrier notification email.
 */
```

Write it even when it feels obvious. The next person cannot infer lock ordering from the code, and
tests will not catch an ordering inversion until it deadlocks in production.
