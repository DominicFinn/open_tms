---
paths:
  - "backend/src/services/issues/**"
  - "backend/src/commands/{issues,issueLabels,comments}/**"
  - "backend/src/events/handlers/{IssueEngineHandler,IssueClosureReportHandler,TriageAgentHandler}.ts"
  - "backend/src/events/projections/IssueProjection.ts"
  - "backend/src/repositories/IssueRepository.ts"
  - "backend/src/routes/{issues,comments,customerPortal}.ts"
  - "frontend/src/vnext-design/VNextIssue*.tsx"
  - "frontend/src/pages/customer-portal/CustomerIssue*.tsx"
---

# Issue / Triage Centre — Rules

Architecture, models, lifecycle and file map: `docs/ISSUE_ENGINE.md`

## Issue creation is deterministic — extend the registry, never write issues directly

Issue creation is **deterministic and LLM-independent**, and no longer shipment-only (#133).
`IssueEngineHandler` maps trigger/recovery events onto issues via the code-defined Issue Type
registry at `backend/src/services/issues/issueTypeRegistry.ts`. Each type declares its own
`sourceEntityType` ('shipment', 'pack_task', ...) and `entityIdField` (the payload key holding the
source entity id) — the engine assumes nothing about the domain.

- **Adding a new issue type (TMS or WMS) = add a registry entry.** Nothing else. The WMS
  `pack_audit_variance` entry is the canonical non-shipment example.
- All issue writes go through the command bus (`CREATE_ISSUE` / `UPDATE_ISSUE`).
- **Do NOT add bespoke `prisma.issue.create` writes.** Extend the registry instead. (Known legacy
  direct writers still to convert: `MarginAlertHandler`, `SlaEvaluationService`,
  `ShipmentAssignmentService`.)
- The **AI triage agent is an enricher** on engine issues (comments + priority escalation on
  `issue.created`), not a creator.
- Recovery emitters live in the owning monitors, not in the engine (e.g.
  `ShipmentCutoffMonitorService` emits `shipment.cutoff_cleared`; `ShipmentEtaMonitorService` emits
  `tracking.eta_recovered`).

## Dedup and latching

- Dedup is **one open issue per (issueType, source entity)**. A matching event escalates the open
  issue instead of duplicating it.
- Raise rule: N signals within the window OR a single signal at/above the severity floor.
- **Unlatched** types (cutoff, ETA) auto-resolve on their recovery event.
- **Latched** safety types (temperature, tamper, mis-ship) never auto-resolve.

## Comment visibility (customer portal)

Enforced by `CreateCommentCommandHandler`:

- `authorType = 'customer'` → `visibleToCustomer` is **always** `true`. Customers can never hide
  their own comment from internal staff.
- `authorType = 'user' | 'agent' | 'system'` → defaults to `false`. The author must explicitly opt in.

Customer-portal endpoints only return comments where `authorType = 'customer'` OR
`visibleToCustomer = true`. Customer-portal issue scoping walks from `Issue.sourceEntityType` +
`sourceEntityId` to the underlying `Shipment.customerId` or `Order.customerId`. Issues with no
source entity, or with a carrier source, are **not** exposed.
