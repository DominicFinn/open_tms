---
paths:
  - "backend/src/**/*.ts"
  - "auth-service/**/*.ts"
  - "edi-collector/**"
---

# Observability & SRE

If you ship a behaviour you cannot observe, you have shipped an outage you cannot diagnose.

## What already exists — use it, don't reinvent it

| Surface | What it gives you |
|---|---|
| `GET /health` | Liveness only. Returns `{ status: 'ok' }` |
| `GET /metrics` (`routes/metrics.ts`) | Queue depths, event counts, **projection lag** (writeModel − readModel), command stats — **tenant-scoped by `req.orgId`** |
| `GET /api/v1/queues/stats`, `/:name/stats`, `/:name/jobs` | Per-queue depth and job inspection |
| `POST /api/v1/queues/:name/retry-failed`, `/purge-dlq` | Dead-letter recovery |
| `GET /api/v1/queues/activity` | Recent queue activity |
| Fastify `logger: true` (pino) | Structured request logging |

Before adding a new metric, check whether `/metrics` already carries it or should.

## Every metric endpoint is tenant-scoped

`/metrics` previously returned platform-wide totals, which leaked cross-tenant volume to anyone with
a valid JWT. It is now scoped to `req.orgId`.

**Any new metric must declare its scope.** Per-tenant counts are scoped. Genuinely platform-level
values (a per-projection cursor, process uptime) may stay global — but only when they carry no
tenant signal. Aggregate volume is a tenant signal.

## Logging

Full rules in the error-handling-and-logging rule. The SRE-relevant parts:

- **Structured only.** Never concatenate. `log.info('msg', { shipmentId, orgId })`.
- **Never log PII** — ids, not names, emails, addresses or driver contact details
- Include correlating ids on every log line in a request or job: `orgId`, plus the entity id and,
  where available, the request/job id. A log you cannot join to a request is close to useless.
- Log levels mean things: `error` = someone must look; `warn` = degraded but handled; `info` =
  state transitions worth reconstructing; `debug` = off in production.
- **An error log must be actionable.** If it fires routinely and nobody acts, it is `warn` or it is
  noise that will mask a real incident.

## Health checks: liveness is not readiness

`/health` currently only proves the process is up. A readiness check must additionally prove the
dependencies it needs are reachable — database, queue — and should fail the check when they are not,
so a deploy doesn't route traffic into a broken instance.

Keep them separate: liveness restarts the process, readiness removes it from rotation. Wiring
readiness to a heavy query is its own outage.

## The queue is the thing to watch

This system does most of its real work asynchronously, so queue health *is* system health.

Watch and alert on:

- **Queue depth trending up** — consumers can't keep up
- **Dead-letter queue non-empty** — this should page someone. A DLQ nobody watches is a silent
  data-loss channel.
- **Projection lag** (`writeModel − readModel` in `/metrics`) — the read models are the UI. Lag of
  seconds is normal (pg-boss polls at 0.5s); lag of minutes is an incident.
- **No worker consuming** — the failure mode is silent: writes succeed, the UI just never updates.
  Absence of processing must alert, not just presence of errors.

Alert on the absence of expected work, not only on errors. A cron worker that stops firing produces
no errors at all.

## Instrument new background work

When you add a worker, cron, or projection, the deliverable includes:

- It appears in the queue stats
- Its failures land in the DLQ and are retryable
- A stated freshness/latency expectation, so "is this lagging?" has an answer
- Enough logging to reconstruct one run end to end

## External dependencies must degrade, not collapse

This system depends on carrier APIs, routing providers, Google Maps, LLM providers and SFTP hosts.
All of them will fail.

- **Timeouts on every outbound call.** No unbounded wait.
- **Retry with exponential backoff**, bounded, then dead-letter
- **Degrade gracefully**: a missing Google Maps key skips route-deviation detection rather than
  throwing; a carrier API outage must not fail the shipment write
- Respect provider rate limits and quotas (carrier tracking tracks these per integration)
- Never let a third-party call sit inside a transaction — see the transactions-and-concurrency rule
- Log provider failures with the provider name and status, never with the credential

## Runbooks

Anything that can page someone needs a written response. When you add an alerting condition, add
the runbook entry with it: what it means, how to confirm, what to do, and how to recover — including
the DLQ retry/purge endpoints where relevant.

Put operational procedures in `docs/`, next to the guide for the subsystem they belong to.

## Gaps worth knowing about

- No distributed tracing and no error-reporting service (no OpenTelemetry, Sentry, or equivalent)
- `/metrics` is bespoke JSON, not Prometheus exposition format — the file notes it can be adapted
- No readiness endpoint distinct from `/health`
- No HTTP rate limiting (see the security rule) — which is also an availability control, not just a
  security one

Don't treat these as settled. If you are adding something that would be undiagnosable without
tracing, raise it.
