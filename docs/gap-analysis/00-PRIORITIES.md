# Top Priorities - What to Build Next

Ranked by impact on making Open TMS a credible alternative to commercial systems. Considers: how many prospective users would walk away without this feature, implementation complexity, and dependencies.

## Tier 1 - Table Stakes (Blockers for Adoption)

These are features that most TMS buyers consider non-negotiable. Without them, Open TMS cannot compete in an RFP or demo.

### 1. Customer Self-Service Portal
**Gap**: 22% coverage. No customer-facing portal exists beyond the carrier portal.
**Why it matters**: Every commercial TMS has a branded customer portal. Shippers and 3PLs need to give their customers visibility without sharing internal tools. This is a top-3 demo question.
**What to build**:
- Branded login with customer user management
- Order entry (submit shipment requests)
- Real-time tracking with map and milestone timeline
- Shareable public tracking link (no login required)
- Document access (BOL, POD, invoices)
- Invoice review and dispute initiation
- Notification preferences

### 2. Reporting & Analytics Overhaul
**Gap**: 40% coverage. Only financial reports (AR aging, carrier spend, margin) exist.
**Why it matters**: Decision-makers buy a TMS partly for the data it provides. Ops managers need on-time %, dispatchers need exception dashboards, and finance needs scheduled reports. Current reporting is minimal.
**What to build**:
- Operational KPI dashboard (on-time pickup/delivery %, cost per shipment, active exceptions)
- Carrier scorecard dashboard (on-time, tender acceptance, claim rate, transit time)
- Lane performance reports (volume, cost trends, carrier utilization)
- Scheduled report delivery via email (daily/weekly digest)
- CSV/Excel export on all data grids (many pages lack this)
- Dashboard builder or saved views

### 3. Carrier Scorecards & Performance Monitoring
**Gap**: Partially on roadmap (Phase 8c) but nothing built.
**Why it matters**: Carrier selection and performance management is core to TMS value. Without scorecards, users can't make data-driven carrier decisions. Waterfall tender priority should be informed by performance data.
**What to build**:
- On-time pickup/delivery % per carrier per lane
- Tender acceptance rate tracking
- Claim/damage rate tracking
- Average transit time vs quoted
- Composite carrier score algorithm
- Performance-based waterfall ordering
- Carrier scorecard UI with trend charts

### 4. Route Optimization & Load Planning
**Gap**: 23% coverage. No optimization engine exists.
**Why it matters**: Route optimization is one of the primary ROI justifications for TMS adoption. "Save 10-15% on freight spend" is the headline pitch for every TMS vendor.
**What to build**:
- Multi-stop route optimization (TSP/VRP solver - can use OSRM or Google OR-Tools)
- LTL consolidation optimizer (combine compatible orders)
- Mode selection recommendation (TL vs LTL vs intermodal)
- Load building with weight/cube constraints
- What-if scenario tool for lane planning

### 5. Driver Mobile App / POD Capture
**Gap**: On roadmap but nothing built. Warehouse app exists but is warehouse-only.
**Why it matters**: Many small-to-mid carriers don't have their own ELD/app. A free driver app that captures POD, location, and status is a massive differentiator for open source. This also enables the "carrier portal" to extend to the field.
**What to build**:
- Mobile-responsive web app (PWA) for drivers
- Accept/view load assignments with stop details
- GPS location sharing (periodic pings)
- Status updates at each stop (arrived, loading/unloading, departed)
- POD capture: photo + e-signature + timestamp
- Offline mode with sync on reconnect
- Push notifications for new assignments

## Tier 2 - Competitive Differentiators

Features that separate serious TMS platforms from basic ones. Not blockers, but their absence limits the addressable market.

### 6. Multi-Modal Support (Parcel, Intermodal, Ocean, Air)
**Gap**: 27% coverage. Only trucking (TL/LTL) is supported.
**Why it matters**: Most shippers use multiple modes. A TMS that only handles trucking loses deals to platforms that can also rate-shop parcel, book intermodal, or track ocean containers.
**Quick wins**:
- Parcel rating integration (UPS/FedEx/USPS APIs) with rate shopping
- Intermodal rail: ramp-to-ramp planning and tracking via Class I railroad feeds
- Mode recommendation engine (suggest cheapest mode for given lane/weight)

### 7. International / Cross-Border
**Gap**: 8% coverage. No international trade features exist.
**Why it matters**: Any shipper with cross-border freight needs customs docs, HTS codes, multi-currency, and compliance screening. This blocks the entire international logistics market.
**What to build** (phased):
- Multi-currency support (rate entry, invoicing, payments)
- Commercial invoice and packing list generation
- HTS code field on order line items
- Incoterms field on orders/shipments
- Denied party screening integration (OFAC/BIS)
- Customs broker assignment workflow

### 8. Dock Scheduling / Appointment Management
**Gap**: 36% coverage. Location ops view exists but no appointment booking.
**Why it matters**: Warehouse and DC operators need appointment scheduling to manage dock capacity. Without it, you get truck queues and detention charges. Many TMS buyers specifically ask for this.
**What to build**:
- Dock appointment calendar (time slots per dock door)
- Carrier self-booking via portal
- Appointment confirmation and reminder notifications
- Real-time dock availability dashboard
- Detention clock (auto-start from scheduled vs actual arrival)
- Integration with ETA monitoring (auto-adjust appointments based on truck ETA)

### 9. Returns / Reverse Logistics
**Gap**: 0% coverage. Nothing built.
**Why it matters**: E-commerce and retail shippers need returns management. It's a growing segment and a checkbox on many RFPs.
**What to build**:
- Return order creation from original outbound shipment
- Return reason coding and disposition routing
- Return carrier selection and tendering
- Return tracking with same visibility as outbound
- Credit note generation from returns
- Return analytics (rate by carrier, reason, product)

### 10. Sustainability / Carbon Tracking
**Gap**: 8% coverage. Nothing built except being on the roadmap.
**Why it matters**: CSRD in Europe now mandates Scope 3 emissions reporting. ESG reporting is increasingly a procurement requirement. Green credentials are a competitive advantage.
**What to build**:
- CO2 calculation per shipment (GLEC Framework methodology)
- Emissions by mode, lane, carrier
- Modal shift opportunity identification
- Emissions dashboard with trend reporting
- SmartWay carrier flag
- CSRD/Scope 3 export format

## Tier 3 - Advanced / Niche

Features that matter for specific market segments or large enterprise buyers.

### 11. Carrier Onboarding Workflow
Self-registration portal, document collection (insurance, W-9, authority), automated validation, approval pipeline. Currently carrier creation is admin-only.

### 12. Claims Management Lifecycle
Full cargo claim workflow (filed, acknowledged, investigation, settled/denied), document attachment, recovery tracking. Currently only financial queries exist without the full claims lifecycle.

### 13. Advanced Freight Audit
Line-item discrepancy detection for unauthorized accessorials, duplicate billing detection across invoices, automated approval rules beyond 2% tolerance, dispute communication log with carrier.

### 14. Multi-Tenant / 3PL White-Label
Per-client data isolation, client-specific configuration, client-branded portals, client-level user management. Currently single-org only.

### 15. SSO for External Users
SAML/OIDC for customer portal and carrier portal users (enterprise customers require federated auth for their teams).

### 16. Scheduled Report Delivery
Email-based report distribution on daily/weekly/monthly cadence. Currently all reports are on-demand only.

### 17. BI Platform Integration
Native connectors or data export to Power BI, Tableau, Looker. Currently only CSV export exists.

### 18. Workflow / Approval Engine
Configurable multi-step approval workflows for charges, invoices, credit notes, rate changes. Currently approvals are single-step.

### 19. Audit Trail UI
Searchable audit log viewer (on roadmap, Phase 9a). Entity-level timelines, export for compliance reviews.

### 20. Electronic Signature (Legal-Grade)
Integration with DocuSign/Adobe Sign for legally binding POD signatures. Currently on the roadmap but not built.
