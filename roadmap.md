# Open TMS Roadmap

Open TMS is becoming two products over a shared core: **FinnTMS** for transport and **FinnWMS**
for the warehouse, with inventory (FinnIMS) possibly separating later. It stays one modular
monolith, with each product composed at build time, per
[ADR 0002](docs/adr/0002-modular-monolith-product-composition.md).

This file is the high-level view and should stay short. The detail lives elsewhere:

- **Work in flight**: the [Open TMS project board](https://github.com/users/DominicFinn/projects/3).
  Every open issue has a Theme and a Horizon (Now, Next, Later)
- **Backlog per theme**: [docs/roadmap/backlog.md](docs/roadmap/backlog.md), and
  [docs/roadmap/finnwms.md](docs/roadmap/finnwms.md) for the warehouse
- **Shipped work**: [docs/roadmap/completed.md](docs/roadmap/completed.md)

Last reviewed September 2026.

## Now

**Split programme.** Separating WMS from TMS so FinnWMS can be installed on its own. Phases 0 and 1
are done, and phase 2a moved WMS onto `Facility`. #297 finishes 2a, then `HandlingUnit`,
polymorphic `Allocation`, the app shell and entitlements, and a standalone WMS install. Sequenced
in [split-finntms-finnwms.md](docs/roadmap/split-finntms-finnwms.md).

**Platform hardening.** The tenancy baseline is empty (#314). What's left is the last of the
`organization.findFirst` calls (#296, #203), rate limiting (#116), security headers, a handful of
correctness bugs, and the internal auth gaps: password reset by email, persistent lockout, argon2id,
invitations and MFA.

**Ingest and live tracking.** Moving IoT, carrier webhooks and EDI inbound into their own process
(#301), fixing the geofence and arrival-criteria gaps that showed up in the journey work (#287,
#288, #289), and finishing the checkpoint and geofence drawing UI (#305, #307, #309, #312).

**Shipment quality.** Making the core shipment flow behave properly for someone using it for the
first time: the cargo tab, map errors, carrier bidding buttons that do nothing, soft delete, and
the rest of the reports from the Shipments v1 bug bash.

## Next

**Carrier connectivity.** US LTL first, over EDI 214 rather than one API per carrier. The national
carrier catalogue is seeded; next come trading-partner setup, verifying SCAC codes and PRO formats,
and automating 204 and 990. Aggregators and direct APIs come after that.

**Reporting.** The executive dashboard exists. Next are on-time delivery, carrier scorecards (one
implementation, replacing the Quality Centre page), operational reports and scheduled reports.
This is the biggest gap when demoing.

**Developer experience and deployment.** A clean first install (#292, #110, #293), jest exiting
properly (#298), retiring `vnext` from the frontend (#124), and the observability and operations
docs a self-hoster needs.

## Later

**Planning and maps.** Route optimisation, consolidation, mode selection, load planning, dock
appointments, route lines and a spatial index.

**Cold chain.** The regulatory audit trail UI, compliance reporting and a cold chain dashboard, on
top of the detection and CAPA work that's already there.

**FinnWMS v2.** 3PL billing, VAS and kitting, parcel and compliance labels, serial tracking, the
dock appointment portal and task interleaving. Waits on the split programme's phase 2, so it builds
on `Facility` and `HandlingUnit` rather than the old conflated models.

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
- WMS v3 and beyond: slotting, labour management, yard, WCS and automation, voice picking. See
  [finnwms.md](docs/roadmap/finnwms.md)

## Keeping this file current

- When a feature ships, add it to `completed.md` and take it out of `backlog.md` or `finnwms.md`
- Change this file only when a theme starts, finishes or moves between Now, Next and Later
- New work gets an issue on the board with a Theme and a Horizon, not a paragraph here
