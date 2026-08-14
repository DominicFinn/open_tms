---
paths:
  - "frontend/src/**/*.{ts,tsx}"
  - "backend/src/events/**"
  - "backend/src/routes/**"
---

# Real-time & Broadcasting

> **Current state:** there is no WebSocket/SSE transport in this codebase yet. Several pages poll on
> a timer instead (`VNextIssueKanban`, `VNextSlaDashboard`, `VNextShipmentMap`,
> `VNextWmsOperationsDashboard`, `WarehouseShipments`). These rules define what live data must look
> like when the transport lands, and set the ceiling on polling until then.

## If we're doing broadcasting, do broadcasting — we don't poll

A page that needs live data **subscribes to a channel**. It does not set an interval and hammer an
endpoint. Polling is a load multiplier: every open tab is a scheduled request against the same
endpoint whether anything changed or not.

## Until there is a transport

New live surfaces should not add another timer. If a page genuinely needs fresher data than a
navigation provides:

- Refetch on a **user-visible action** (filter change, tab focus, explicit refresh button)
- If a timer is unavoidable, it must be **≥30s**, **paused when the tab is hidden**, and cleared on
  unmount
- Say in the PR why a subscription wasn't possible

Do not introduce a sub-30s poll. Do not poll a heavy aggregate or report endpoint on any interval.

## Broadcast rules (when the transport exists)

- **Broadcast after commit, never inside the transaction.** A client that reacts before commit reads
  stale data. See the transactions-and-concurrency rule.
- **Payloads are display-shaped and minimal** — the fields the UI renders, nothing more. Never
  serialize a whole model onto a channel; casts and hidden fields won't save you when someone adds a
  column.
- **Never put PII on a channel more than one person can hear.** No email, phone, address, full name,
  or order detail on a shared/public channel. A payload is a log with an audience — the PII rules in
  the logging rule apply unchanged.
- Every payload for a mutable entity carries a **monotonic version**, bumped in the same transaction
  as the state change. Clients drop events older than what they hold — delivery is not ordered and
  reconnects replay.
- Where a client must not miss an update, write to an **outbox table in the same transaction** as the
  state change and publish from a worker after commit, with a unique constraint on
  `(entityType, entityId, version, eventName)` so a retried publish can't double-send.
- A reconnecting client must be able to **resynchronise from an HTTP endpoint**. The socket delivers
  deltas; the endpoint delivers truth. Every live surface needs both.
- **Every private channel has an explicit authorization check**, scoped to one identity — never "is
  logged in". A channel with no check must carry nothing that isn't public.
- The socket is a **display channel, never an authorization channel**. A client told "you won" still
  has to be authorized on the next HTTP request.
- **A queue worker must be running** for broadcasts to be delivered. Say so in the setup docs.
