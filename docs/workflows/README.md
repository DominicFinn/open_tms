# Open TMS - Workflows, Tasks & Activities

> **Purpose.** This folder defines *how Open TMS is operated*, not just what features exist. It answers the
> process questions: what happens first, who sets what up, who creates customers, how lanes get created, how
> carriers are onboarded, what tasks carriers and customers do on the platform, what is deliberately **out of
> scope**, and what reporting the operation needs.
>
> It is written against the **actual current system** (verified in code, June 2026), not the older
> `docs/gap-analysis/` feature comparison, which is now stale in several places (most notably the customer
> portal, which is far more complete than that document claims).

## How this is organised

| File | What it covers |
|------|----------------|
| [01-ACTORS-ROLES-SCOPE.md](./01-ACTORS-ROLES-SCOPE.md) | The actors (internal roles, external portal users, system/automation), a RACI per operating model, the explicit **in-scope / out-of-scope** boundary, and the **required reporting suite**. |
| [02-SETUP-AND-ONBOARDING.md](./02-SETUP-AND-ONBOARDING.md) | The one-time **setup sequence** (who configures what, in order) and the **onboarding flows** for customers, locations, lanes, carriers, and portal users. |
| [03-OPERATING-WORKFLOWS.md](./03-OPERATING-WORKFLOWS.md) | The recurring **operating workflows**: order-to-cash, tender-to-award, track-to-deliver, exception handling, returns - with the broker / shipper / 3PL variations called out. |
| [04-TEST-RUNBOOK.md](./04-TEST-RUNBOOK.md) | An **executable, step-by-step runbook** you can follow against a running instance to walk through and validate every workflow end to end. Start here when you want to *do* it. |

## The three operating models

Open TMS is one platform configured for three different operating models. The model is set by
`organizationType` on the Organization (`shipper` | `broker` | `3pl` | `carrier`), via
`PUT /api/v1/organization/settings`. The model changes **who owns each step** - especially who creates
customers and who books freight - but the underlying entities are the same.

| Tag | Model | Who runs the instance | "Customer" means | "Carrier" means | Primary money flow |
|-----|-------|-----------------------|------------------|-----------------|--------------------|
| **[Shipper]** | Shipper-run | A company managing its own freight | A consignee / receiving party / internal business unit they ship to | A contracted haulier they pay | They pay carriers (cost only; no customer AR) |
| **[Broker]** | Broker-first | A freight broker / 3PL brokerage | A shipper client who pays the broker | A haulier the broker covers the load with | Customer pays broker (AR), broker pays carrier (AP), broker keeps margin |
| **[3PL]** | 3PL / control tower | A 3PL managing logistics for multiple client shippers | A client shipper (each client = one Customer record today) | A haulier in the 3PL's carrier base | Client pays 3PL (AR), 3PL pays carrier (AP); often white-labelled |

Throughout these docs, a step that differs by model is marked with the tags above. A step with no tag applies
to all three.

> **Single-org caveat (important for 3PL).** The platform is **single-organization** today. The 3PL model is
> achieved by representing each client shipper as a `Customer` record, *not* as an isolated tenant. There is no
> per-client data isolation, per-client branding, or per-client user partitioning yet. This is the single
> biggest architectural boundary for the 3PL model and is captured in the out-of-scope section.

## How to use these docs

- **Designing / reviewing the operating model?** Read 01 → 02 → 03 in order.
- **Want to start working through and testing it right now?** Go straight to
  [04-TEST-RUNBOOK.md](./04-TEST-RUNBOOK.md). It boots the stack, seeds demo data, and walks every workflow.
- **Building a gap analysis?** 01 (scope) and 03 (workflows) flag every place where a workflow has a missing
  step, a manual workaround, or a handoff hole. Those flags are the raw material for the workflow-lens gap
  analysis (the next deliverable after this spec).

## Status legend used throughout

| Marker | Meaning |
|--------|---------|
| ✅ Built | Works today, UI + API present |
| 🟡 Partial | Exists but incomplete or API-only / manual workaround needed |
| 🔌 Integration | Deliberately delegated to an external system (out of scope to build) |
| ❌ Gap | Needed by the workflow but not built - candidate for the gap analysis |
