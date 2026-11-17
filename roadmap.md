# Open TMS Roadmap

Open TMS is a transport management system, built in TypeScript. The warehouse and inventory
modules were removed in November 2026 so the transport side could be finished, per
[ADR 0007](docs/adr/0007-tms-only-in-typescript.md). The removed code is in the git history under
the tag `last-with-wms`.

This file is the high-level view and should stay short. The detail lives elsewhere:

- **Work in flight**: the [Open TMS project board](https://github.com/users/DominicFinn/projects/3).
  Every open issue has a Theme and a Horizon (Now, Next, Later)
- **Backlog per theme**: [docs/roadmap/backlog.md](docs/roadmap/backlog.md)
- **Shipped work**: [docs/roadmap/completed.md](docs/roadmap/completed.md)

Last reviewed November 2026.

## Now

**Consolidations.** Several customers' shipments on one truck have shipped. Still to come:
tendering a consolidated run to carriers as one load (#386), checking a consolidation fits on its
truck (#387), suggesting consolidations, including LTL to FTL upgrades (#388), and driver and
vehicle on the run (#411).

**Platform hardening.** The tenancy baseline is empty and no route guesses its organisation any
more. What's left is rate limiting (#116), security headers, a proper password hash (#407),
constant-time signature checks (#408), a handful of correctness bugs, and the internal auth gaps:
password reset by email, persistent lockout, invitations and MFA.

**Ingest and live tracking.** Moving IoT, carrier webhooks and EDI inbound into their own process
(#301), fixing the geofence and arrival-criteria gaps that showed up in the journey work (#288,
#289, #347), journey reports for multi-stop shipments (#348), and getting Google Maps loading again
for signed-in users (#405).

**Shipment quality.** Making the core shipment flow behave properly for someone using it for the
first time: the cargo tab, map errors, carrier bidding buttons that do nothing, soft delete, cutoff
issues that stay open after a shipment departs (#399), and the rest of the reports from the
Shipments v1 bug bash.

## Next

**Carrier connectivity.** US LTL first, over EDI 214 rather than one API per carrier. The national
carrier catalogue is seeded; next come trading-partner setup, verifying SCAC codes and PRO formats,
and automating 204 and 990. Aggregators and direct APIs come after that.

**Reporting.** The executive dashboard exists. Next are on-time delivery, carrier scorecards (one
implementation, replacing the Quality Centre page), operational reports and scheduled reports.
This is the biggest gap when demoing.

**Developer experience and deployment.** A proper bootstrap command for the first user (#412), retiring `vnext` from the frontend (#124), and the observability and
operations docs a self-hoster needs.

## Later

**Planning and maps.** Route optimisation, consolidation, mode selection, load planning, dock
appointments, route lines and a spatial index.

**Cold chain.** The regulatory audit trail UI, compliance reporting and a cold chain dashboard, on
top of the detection and CAPA work that's already there.

## Not planned

Acknowledged but deliberately not on the roadmap. Any of these can come back if a customer needs
it.

- Control tower dashboard with live maps and alert streams
- Carrier risk scoring and FMCSA checks, and a carrier self-onboarding workflow
- Driver mobile app (status, signature, photo POD, GPS)
- Digital BOL and e-signature, which needs a legally binding signature provider first
- Hub-and-spoke and multi-modal transport (ocean, air, rail, intermodal)
- Sustainability and carbon reporting
- External data feeds: weather, maritime, aviation, rail, market rates
- Admin-editable issue types. The issue engine uses a code-defined registry
  (`issueTypeRegistry.ts`), which keeps it deterministic. A DB-backed `IssueType` table with an
  admin UI would let organisations tune their own
- Warehouse management and inventory. Removed in November 2026 (ADR 0007). Receiving, putaway,
  picking, packing, stock and the floor apps are out of scope; integrate an external WMS instead

## Keeping this file current

- When a feature ships, add it to `completed.md` and take it out of `backlog.md`
- Change this file only when a theme starts, finishes or moves between Now, Next and Later
- New work gets an issue on the board with a Theme and a Horizon, not a paragraph here
