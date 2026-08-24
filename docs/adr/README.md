# Architecture Decision Records

Decisions that shape the system, recorded at the moment they were made, with the context that
forced them. An ADR is immutable once accepted: if a decision changes, write a new ADR that
supersedes the old one and link the two.

## Index

| # | Title | Status | Date |
|---|---|---|---|
| [0001](0001-security-event-geofencing.md) | Security event geofencing | Accepted | 2026 |
| [0002](0002-modular-monolith-product-composition.md) | Modular monolith with build-time product composition (FinnTMS / FinnWMS split) | Accepted | 2026-08-16 |

## Convention

- One file per decision: `NNNN-short-kebab-title.md`, numbered sequentially
- Sections: **Status** (Proposed / Accepted / Superseded by NNNN), **Context** (the forces at
  play), **Decision** (what we chose, stated actively), **Consequences** (what gets easier, what
  gets harder, what we gave up)
- Record rejected alternatives briefly under Context; a year on, the "why not X" is half the value
- Add a row to the index above when adding an ADR
- Big cross-cutting decisions get an ADR; routine feature design stays in `docs/` guides
