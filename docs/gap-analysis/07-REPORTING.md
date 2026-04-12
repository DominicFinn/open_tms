# Reporting & Analytics

## What's Built

- AR aging report (JSON API + CSV export, aging buckets by customer, date picker)
- Carrier spend summary (total invoiced/approved/paid per carrier)
- Margin analysis by customer (revenue/cost/margin from shipment summaries)
- CSV exports: invoice register, carrier invoice register, payment ledger, charge detail (with date range + status filters)
- SLA compliance reports (CSV export with date range and customer filters)
- SLA summary stats (compliance rate, breach rate by rule type, avg breach duration)
- Daily operations report (Excel with 5 sheets: summary, shipments, orders, stop schedule, exceptions)
- Agent decision usage telemetry (daily usage chart, token stats, invocations per day)

## What's Partially Built

- **Operations dashboard**: Exists but limited to SLA health widget and basic counts. No on-time %, cost per shipment, or trend charts.

## What's Planned (On Roadmap)

| Feature | Phase | Notes |
|---------|-------|-------|
| Operational dashboards and KPIs (on-time %, cost per shipment, carrier scorecard) | Phase 7 | Not started |
| Scheduled reports via email | Phase 7 / Phase 9 | Not started |

## What's Missing

This is the biggest functional gap relative to commercial TMS platforms. Every competitor has a rich reporting suite.

| Feature | Commercial Standard | Impact |
|---------|-------------------|--------|
| **On-time delivery/pickup % report** | Core KPI. Percentage by carrier, lane, customer, time period. Trend charts. | Critical - #1 most requested report |
| **Carrier scorecard dashboard** | Visual scorecards: on-time, tender acceptance, claim rate, transit time, billing accuracy | Critical - carrier management |
| **Transit time performance** | Actual vs quoted transit time by lane and carrier with trend analysis | High |
| **Tender acceptance rate report** | % of tenders accepted per carrier, trend over time | High |
| **Load utilization report** | Weight and cube utilization per shipment/carrier | Medium |
| **Exception/claim frequency** | Exceptions by type, carrier, lane, time period with root cause breakdown | High |
| **Freight spend forecasting** | Project future spend based on historical trends and order pipeline | Medium |
| **Lane rate benchmarking** | Compare contracted rates vs spot market (DAT/Truckstop feeds) | Medium |
| **Customer profitability analysis** | Revenue minus cost per customer with margin trend | Medium - partially exists |
| **Detention/dwell time analysis** | Avg dwell time by location, carrier, with cost impact | Medium |
| **Executive dashboard** | High-level KPIs: cost per unit shipped, freight as % of revenue, on-time rate | High |
| **Scheduled report delivery** | Email reports on daily/weekly/monthly cadence to distribution lists | High |
| **Custom report builder** | Ad-hoc query tool or saved report configurations | Medium |
| **BI platform integration** | Native export to Power BI, Tableau, Looker, or Snowflake/BigQuery connector | Medium |
| **Role-based report access** | Restrict which reports each role can view | Low |
| **Carbon/emissions reporting** | CO2 per shipment, lane, carrier, mode with trend reporting | Medium - regulatory pressure |

## Recommendation

Reporting is where Open TMS loses the most ground to commercial alternatives. The financial reports are solid, but operational reporting is almost entirely absent. Priority order:

1. **On-time % dashboard** - single most important operational KPI
2. **Carrier scorecard** - feeds into procurement decisions
3. **Executive summary dashboard** - what leadership looks at
4. **Scheduled email reports** - automation that saves daily time
5. **CSV export on all list pages** - quick win, many pages already have data grids
