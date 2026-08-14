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

Issue creation for the shipment-exception domain is **deterministic and LLM-independent**.
`IssueEngineHandler` maps trigger/recovery events onto issues via the code-defined Issue Type
registry at `backend/src/services/issues/issueTypeRegistry.ts`.

- **Adding a new shipment-exception issue type = add a registry entry.** Nothing else.
- All issue writes go through the command bus (`CREATE_ISSUE` / `UPDATE_ISSUE`).
- **Do NOT add bespoke `prisma.issue.create` writes for shipment exceptions.** Extend the registry
  instead.
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
