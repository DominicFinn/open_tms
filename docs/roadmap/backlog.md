# Roadmap Backlog

The open work behind each theme in [roadmap.md](../../roadmap.md). Shipped work is in
[completed.md](completed.md).

Items here are candidates, not commitments. When a theme is picked up, its items become GitHub
issues on the [Open TMS board](https://github.com/users/DominicFinn/projects/3) and
come off this list. Where an issue already exists it's linked.

## Platform hardening

Security, tenancy and correctness gaps. See the security rule for the reasoning behind each.

- #407: hash passwords with a real password hash
- #408: compare JWT signatures in constant time
- #409: skills routes use Prisma directly and write outside the command bus
- #318: tenders have no `orgId` of their own
- #116: register `@fastify/rate-limit`, with aggressive limits on the auth endpoints
- Security headers on every response (HSTS, frame, nosniff, referrer and permissions policy, CSP on
  the frontend). No issue yet
- #316: RMA label provider called inside a transaction
- #170: `AuditHandler` logs the actor's name

Internal user auth, carried over from the old roadmap:

- Self-service password reset by email (`/api/v1/auth/forgot-password` is a stub that only logs)
- Forced password change on first login for admin-provisioned users
- Account invitation flow, replacing "admin types a temporary password"
- DB-backed login lockout instead of the in-memory map, so it survives restarts and replicas
- Move password hashing from HMAC-SHA256 to argon2id, rehashing on login
- Auth event audit log (success, failure, lockout, resets, SSO provisioning)
- Session records, revocation and "sign out other devices"
- Optional TOTP MFA with recovery codes and per-role enforcement
- Finish Google and Microsoft SSO, plus SAML for enterprise IdPs
- Per-organisation password policy
- Login polish: remember me, per-tenant branding, CAPTCHA after repeated failures

Audit trail:

- Searchable audit log viewer and a per-entity timeline
- Hash-chained `DomainEventLog` records
- Compliance reports: user activity, data access, SOC 2 and ISO 27001 templates

## Ingest and live tracking

- #301: move IoT, carrier webhooks and EDI inbound into their own ingest process (verify, enqueue,
  202). Inbound webhook and worker org resolution moves with it
- #288: consolidate the duplicate geofence evaluators
- #289: dead `payload.shipmentId` read breaks EDI 214 auto-completion
- #317: edi-collector can't load trading partner config
- #347: drawn location geofences are ignored by ping arrival matching
- #348: the journey report for multi-stop shipments
- #153: repeatable test for shipment telemetry through the ingestion API
- IoT-driven alerts and automation (excursion alerts, geofence plus sensor triggers)
- System Loco Device Reports V2 feed (denser telemetry) and Shipments feed (their lifecycle events)
- Longer term: move the queue off Postgres (Redis, NATS or similar behind `IQueueAdapter`) and add
  read replicas for reporting, once device volume justifies it

## Shipment quality

The work that was on the Shipments v1 board: making the core shipment flow behave properly.

- #276: cargo tab never shows weight, quantity or dimensions from line items
- #249: tab-switch scroll lands in the wrong place on detail pages
- #199: shipment delete should be admin-only and soft
- #399: a cutoff issue stays open after its shipment departs
- #406: the Issue column on Cutoff At Risk is always empty
- #202: `CreateShipmentCommand` publishes to two queues nobody consumes
- #149: test overriding a lane's default carrier on a shipment
- #151: decide what a rate confirmation should contain
- #195 and #198: map error messages and the map view layout
- #80: carrier bidding buttons do nothing, and the map shows the same lane for every bid
- #104: pickup stops show no cargo
- #70 and #76: carrier tracking discoverability and the Track button
- #90: filter orders by kind of issue
- Customer portal leftovers: map of active shipments, POD access, order templates, embeddable
  tracking widget

## Carrier connectivity

EDI first, since it reaches any carrier with a trading-partner relationship without bespoke work.
Background in [CARRIER_INTEGRATIONS.md](../CARRIER_INTEGRATIONS.md).

- Trading-partner setup and inbound 214 verification for the seeded national LTL carriers
- Per-carrier PRO check-digit validation, once checked against real carrier documentation
- Verify the seeded SCAC codes and PRO formats against each carrier's EDI guide
- Automated EDI 204 delivery and 990 polling over SFTP/HTTP (both manual today)
- #410: decide whether EDI 940 and 945 stay
- EDI 855 outbound
- AS2 transport
- Configurable outbound file naming per partner
- ERP integration patterns (iDoc mapping, CSV and fixed-width adapters, REST/SOAP)
- Multi-carrier tracking aggregators (EasyPost, AfterShip) as a second path
- Direct carrier APIs where a carrier offers one, one integration at a time
- TMS-to-TMS integration (JSON APIs modelled on EDI)

## Reporting

The executive dashboard exists. Background in
[07-REPORTING.md](../gap-analysis/07-REPORTING.md).

- On-time delivery percentage and cost per shipment, unit and mile on the dashboard
- Carrier scorecards: on-time pickup and delivery, tender acceptance and response time, claims,
  transit vs quoted, invoice accuracy, weighted composite score, rolling trends, PDF export. This
  is the single implementation; it replaces the Quality Centre scorecard page and the AI "lane
  performance scoring" item
- Operational reports: status summary, lane utilisation, dwell time, exception breakdown, SLA
  compliance trends, stop performance
- Scheduled reports: pg-boss cron, parameter presets, email with PDF/CSV, recipient lists, history
- Ad-hoc report builder with saved definitions and export
- Bulk data export (documents, attachments, CSV/PDF)

## Developer experience and deployment

- #412: a bootstrap command for the first organisation and admin user
- #413: bring the README back in line with the code
- #414: loose ends from the TMS-only change
- #111: a hosted demo people can try
- #402: `Session` and `AuthProvider` tables have no reader, and the forgot-password stub logs the
  email
- #403: internal user routes need `users:*`
- #124: retire `vnext` from the frontend
- #115: architecture site for the ADRs
- Observability: Prometheus format and Grafana dashboards on `/metrics`, OpenTelemetry, queue
  alert thresholds, dependency checks on `/health`, worker liveness, DLQ dashboard, Sentry
- Operations docs: blue/green deploys, migration safety, worker drain, rollback playbook, sizing
  guide, load test scripts, PgBouncer

## Planning and maps

Background in [12-PLANNING.md](../gap-analysis/12-PLANNING.md).

- Multi-stop route optimisation (VROOM or OR-Tools) with time windows, capacity and driver hours,
  compared against the manual route
- #386, #387 and #388: tender a consolidation as one run, check it fits its truck, and suggest
  consolidations, including LTL to FTL upgrades
- #411: driver and vehicle on a consolidation, and what happens to `Load`
- #405: Google Maps never loads for signed-in users
- Mode selection: FTL vs LTL vs parcel with rate and transit comparison
- Load planning board with weight, cube and pallet-position building
- Appointment scheduling for docks and delivery windows
- Route polylines coloured by status on the map
- PostGIS spatial index for inverse geofence queries, behind `ISpatialIndexProvider`
- Traffic overlay, closure alerts and alternative routes
- Pluggable map provider interface

## Cold chain

The infrastructure is in place (profiles, excursion detection, disposition, CAPA). What's missing
is the regulatory UI and reporting.

- Audit trail viewer for temperature records (21 CFR Part 11), showing integrity hashes and chain
  of custody, with PDF export
- Customer-facing compliance reports, FDA and USDA export formats, batch reports, excursion trends
- Cold chain dashboard: live readings, excursion feed, compliance rate, device health and
  calibration

## Unassigned

Items that don't belong to a theme yet.

- False-start detection for IoT devices, and a geofence-based ready to in-transit transition
- AI: visual node builder for skill chains, prompts that learn from human overrides, predictive
  dashboards
- Multi-language support with RTL
- n8n integration (webhook emission, custom node, templates)
