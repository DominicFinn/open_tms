---
paths:
  - "backend/src/workers/**"
  - "backend/src/queue/**"
  - "backend/src/events/**"
  - "backend/src/services/**"
---

# Queues & Background Jobs

pg-boss is the queue. Adapter: `backend/src/queue/PgBossQueueAdapter.ts`. Workers live in
`backend/src/workers/`.

## Queue everything that doesn't need to be in the request cycle

If it takes more than a couple of seconds, or it talks to a third party, it goes on a queue:

- Email and notification sends — **always queued, never in the request cycle**
- Webhook processing (inbound and outbound delivery)
- EDI inbound processing and outbound delivery
- Carrier tracking polls and ETA monitoring
- Stock / inventory sync processing
- Daily digest and scheduled reports
- Analytics and reporting aggregation
- Document and PDF generation (closure reports, invoices)
- Image processing and caching
- Read-model projections and backfills

## Long-running requests get a handle, not a held connection

When a user asks for something slow — a report, a bulk export, a large import:

1. Validate, enqueue the job, and return **`202 Accepted`** with a job/document id
2. Do the work on a worker
3. Deliver the result by **email or callback notification**, or make it pollable by id

Never hold the HTTP request open waiting. Never run the long query inside a transaction that also
holds write locks.

## Retries, backoff and dead letters

Every job declares its retry policy explicitly. Don't rely on defaults.

- **Exponential backoff**, not a tight retry loop — roughly `60s, 300s, 900s`
- **Bounded attempts.** After the last failure the job goes to the **dead-letter queue**, it does
  not vanish and it does not retry forever
- Dead-lettered jobs must be **inspectable and reprocessable** — that's the point of the DLQ
- **Favour a dead-letter queue wherever one is warranted.** A queue whose failures are invisible is
  worse than no queue

If a projection appears stuck, check the `evt.projection.<name>` queue stats and the dead-letter
queue rather than papering over it by switching the endpoint to a live read.

## Jobs must be idempotent

A job will run twice. Backoff, redelivery and at-least-once semantics guarantee it.

- Make the handler safe to re-run: upsert rather than insert, check-then-skip on a marker column,
  or key off a unique constraint (see the transactions-and-concurrency rule)
- Never assume "this only fires once"
- Jobs that must not overlap need an explicit singleton/uniqueness key on the queue, not a hope

## Dispatch after commit

Enqueue **after** the transaction commits. A job that starts before commit reads data that isn't
visible yet and fails in a way that looks random. Commands already collect events and publish after
commit — put job dispatch on the same side of the line.

## A worker must be running

Queued work only happens if a worker is consuming. Any setup or deployment doc that describes a
feature depending on a worker must say so explicitly — otherwise the failure mode is silent: jobs
pile up and the UI just never updates.
