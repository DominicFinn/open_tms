# Issue / Triage Centre

> Conventions and DO/DON'T rules for this area live in `.claude/rules/domains/issues.md`.
> This document is the architecture reference.

## Architecture

The Triage Centre provides a drag-and-drop kanban board for managing operational issues
(exceptions, delays, damage, compliance failures). Issues can be created manually, deterministically
by the **Issue Engine**, or (for uncovered exceptions) by the AI triage agent. The system supports a
full issue lifecycle with collaborative comments, labels, snooze/wake, and automatic PDF closure
reports.

## Deterministic Issue Engine (shipment exceptions)

Issue creation for the shipment-exception domain is deterministic and LLM-independent.
`IssueEngineHandler` maps trigger/recovery events onto issues via a code-defined **Issue Type
registry**. All issue writes go through the command bus (`CREATE_ISSUE`/`UPDATE_ISSUE`).

### Registry

`backend/src/services/issues/issueTypeRegistry.ts` holds the built-in types:

- `shipment_cutoff_risk`
- `shipment_eta_delay`
- `shipment_misship`
- `shipment_temperature`
- `shipment_tamper_light`

Each declares `defaultPriority`, `latched`, `ignoreSignalSeverity`, a raise rule
`{ thresholdCount, windowMinutes, priorityFloor }`, and its trigger/recovery events. Adding a new
shipment-exception type means adding a registry entry (admin-editable DB types are a roadmap item).
`Issue.issueType` and `Issue.latched` are stamped on each issue for reporting.

### Raise rule and dedup

A raise fires on N signals within the window OR a single signal at/above the severity floor. Dedup
is one open issue per (issueType, source entity); a matching event escalates the open issue instead
of duplicating it.

### Latching

Unlatched types (cutoff, ETA) auto-resolve on their recovery event. Latched safety types
(temperature, tamper, mis-ship) never auto-resolve.

### IssueSignal ledger

The `IssueSignal` table is append-only. It drives the accumulator AND the per-shipment
events/issues-over-time graphs (`GET /api/v1/shipments/:id/issue-activity`, Activity tab).

### Recovery emitters

Recovery events are emitted by the owning monitors, not the engine:

- `ShipmentCutoffMonitorService` → `shipment.cutoff_cleared`
- `ShipmentEtaMonitorService` → `tracking.eta_recovered` (tracks `Shipment.lastEtaDelaySeverity`)

### Role of the AI triage agent

The triage agent is an *enricher* on engine issues (comments + priority escalation on
`issue.created`), not a creator.

## Key Models

- **Issue** - Operational problem linked to a source entity (shipment, order, carrier). Fields
  include status, priority, category, assigneeId, escalatedTo, snoozedUntil, snoozedBy,
  snoozedReason, needsCapa, closedAt, closedBy, and label associations.
- **Comment** (polymorphic) - Attached to issues, shipments, or orders via `entityType` +
  `entityId`. Supports user, agent, system, and customer-authored comments. Carries a
  `visibleToCustomer` flag.
- **IssueLabel** - Org-scoped labels for categorizing issues (name + color).
- **IssueLabelAssignment** - Join table linking issues to labels.
- **KanbanView** - Saved filter/sort configurations for the kanban board (per user or shared).

## Issue Lifecycle

```
open -> in_progress -> resolved -> closed
         |                           |
         ^                           v (reopen)
    (escalated: auto-set to        open
     in_progress, priority
     -> critical)

Any status can be snoozed (snoozedUntil set). Auto-wakes when time expires.
```

## API Routes

- **Issues:** `/api/v1/issues` - list, create, detail, update, status changes, assign, escalate,
  snooze, unsnooze, close, reopen, add/remove labels, activity timeline, closure report download
- **Comments:** `/api/v1/comments` - list by entity, create, update, delete
- **Issue Labels:** `/api/v1/issue-labels` - CRUD for org-scoped labels
- **Kanban Views:** `/api/v1/kanban-views` - CRUD for saved board views

## Issue Closure Reports

When an issue is closed, `IssueClosureReportHandler` automatically generates a PDF closure report
stored via `IBinaryStorageProvider` as a `GeneratedDocument` (documentType:
`issue_closure_report`). Content includes: issue summary, triggering event, shipment/order context,
temperature telemetry, SLA evaluations, activity timeline, and CAPA reports.

## Agent contact_driver Action

The triage agent can execute a `contact_driver` action. It gathers driver info from Shipment → Load
→ Driver, creates or finds the related issue, and posts an agent comment with driver contact details
(name, phone, email). Falls back to a "no driver assigned" message if no driver is linked.

## Comment Visibility (Customer Portal)

Comments on issues are exposed to the customer portal under a per-comment opt-in.

**Rules** (enforced by `CreateCommentCommandHandler`):

- `authorType = 'customer'` → `visibleToCustomer` is always `true`. Customers can never hide their
  own comment from internal staff.
- `authorType = 'user' | 'agent' | 'system'` → defaults to `false`. The author must explicitly opt in.

**Internal UI:** `VNextIssueDetail` shows a "Visible to customer in their portal" checkbox under the
compose box, defaulting unchecked. Each comment in the activity feed displays a badge: "Customer"
(customer-authored), "Shared with customer" (internal + visible), or "Internal only" (internal +
hidden).

**Customer portal:**

- `GET /api/v1/customer-portal/issues` and `:id/comments` only return comments where
  `authorType = 'customer'` OR `visibleToCustomer = true`.
- `POST /api/v1/customer-portal/issues/:id/comments` writes with `authorType: 'customer'` (so the
  visibility flag is forced true).
- Customer-portal issue scoping walks from `Issue.sourceEntityType` + `sourceEntityId` to the
  underlying `Shipment.customerId` or `Order.customerId`. Issues with no source entity, or with a
  carrier source, are not exposed.

## Key Files

### Issue Engine
- `backend/src/events/handlers/IssueEngineHandler.ts`
- `backend/src/services/issues/issueTypeRegistry.ts`
- `backend/src/__tests__/handlers/IssueEngineHandler.test.ts`
- `backend/src/__tests__/services/issueTypeRegistry.test.ts`

### Core
- `backend/src/commands/issues/` - CreateIssue, UpdateIssue (snooze/close/reopen/needsCapa),
  EscalateIssue
- `backend/src/repositories/IssueRepository.ts` - query methods with filtering (status, priority,
  labels, search)
- `backend/src/events/projections/IssueProjection.ts` - IssueReadModel maintenance (all `issue.*` +
  `comment.*` events, tracks commentCount and labels cache)
- `backend/src/events/handlers/IssueClosureReportHandler.ts`
- `backend/src/events/handlers/InAppNotificationHandler.ts` - bell notifications for issue + comment
  events
- `backend/src/services/IssueClosureReportService.ts` - PDF generation (pdf-lib, stored via
  IBinaryStorageProvider)
- `backend/src/routes/issues.ts` - Issue REST API + issue labels CRUD + kanban views CRUD
- `backend/src/routes/comments.ts` - polymorphic comment REST API

### Skills
- `backend/src/services/skills/AddCommentSkill.ts`
- `backend/src/services/skills/ContactDriverSkill.ts`

### Frontend
- `frontend/src/vnext-design/VNextIssueKanban.tsx` - drag-and-drop kanban (@dnd-kit)
- `frontend/src/vnext-design/VNextIssueDetail.tsx` - detail page, activity timeline, comments
- `frontend/src/pages/customer-portal/CustomerIssues.tsx` / `CustomerIssueDetail.tsx`

### Comment visibility
- `backend/prisma/migrations/20260606_comment_visible_to_customer/migration.sql`
- `backend/src/commands/comments/CreateCommentCommand.ts`
- `backend/src/routes/customerPortal.ts`

### Tests
- `backend/src/__tests__/commands/IssueCommands.test.ts` - 16 command handler tests
- `backend/src/__tests__/projections/IssueProjection.test.ts` - 13 projection tests
