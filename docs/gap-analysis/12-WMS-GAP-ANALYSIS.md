# WMS Gap Analysis - April 2026

A comparison of the proposed Open TMS WMS specification (`WMS_SPECIFICATION.md`) against modern tier-1 Warehouse Management Systems: Manhattan Active WM, Blue Yonder WMS, Körber (HighJump), SAP EWM, Oracle WMS Cloud, Softeon, Infor WMS, Deposco, Made4net SCExpert, 3PL Central / Extensiv, Generix, and Mecalux Easy WMS.

The goal of this document is not to criticize the spec (it is a strong foundation) but to identify what a serious open-source WMS needs to add to be credible against commercial tier-1 products, and what can safely be deferred.

---

## Executive Summary

The current spec covers the **transactional spine** of a WMS extremely well: zones/bins, digital-twin inventory via nested TrackableUnits, receiving, directed putaway, multi-strategy picking, packing, staging and loading, and cross-dock. For a TMS-attached WMS serving small-to-mid shippers or light 3PL operations, it is roughly 60-65% of what is needed.

The areas where it is materially short of a "world class" WMS are:

1. **3PL / multi-client billing** - no concept of bill-to-client storage, handling, and value-added service charges. This is table stakes for any warehouse that does not own the inventory it holds.
2. **Slotting and labour optimization** - the spec has slots (bins) and walk sequence, but no slotting engine, no engineered labour standards, no task interleaving, and no productivity analytics.
3. **Yard and dock scheduling** - no trailer-in-yard tracking, gatehouse check-in, door assignment optimization, or carrier self-service appointment portal.
4. **Value-added services (VAS) and kitting / light manufacturing** - no bill-of-materials, assembly, ticketing, re-labelling, or co-packing workflows. This is one of the biggest revenue lines for real 3PLs.
5. **Returns / reverse logistics** - quarantine zone is mentioned but there is no RMA model, disposition workflow, refurb/scrap handling, or returns authorization portal.
6. **Parcel execution** - no cartonization, no rate shopping at pack, no multi-carrier manifest, no SSCC / GS1-128 label generation, no compliance label library (UCC-128, retailer routing guides).
7. **Wave planning intelligence** - waves exist as a container but there is no wave templating, carrier cut-off awareness, load-levelling, pick-pack-ship cycle time forecasting, or release-to-labour capacity.
8. **Automation / WCS integration** - no hooks for AS/RS, conveyor, sorter, goods-to-person, AMR/AGV, pick-to-light, put-to-wall, or voice. A modern WMS is expected to be automation-ready.
9. **Traceability and compliance depth** - lot and expiry are present, but there is no serial-number tracking, genealogy / recall trace, catch-weight, hazmat segregation engine, FDA/FSMA/GMP or bonded warehouse support.
10. **EDI warehouse message set** - the TMS has 850/856/990/204/997/210/810/820 but the WMS-specific transactions (940, 943, 944, 945, 947, 846, 753/754) are not in scope.

### Proposed scoring against tier-1 WMS

| Domain | Spec Coverage | Commercial Tier-1 Parity |
|--------|:-------------:|:------------------------:|
| Location hierarchy & bin master | Strong | 85% |
| Inventory ledger & digital twin | Strong | 80% |
| Indoor positioning (BLE/UWB) | Strong - genuinely differentiating | 95% |
| Receiving / ASN / inspection | Good | 70% |
| Putaway (directed) | Good | 70% |
| Picking strategies | Good | 65% |
| Packing | Good | 60% |
| Loading & BOL trigger | Good (TMS-integrated) | 75% |
| Cross-dock | Basic | 45% |
| Cycle counting | Basic | 50% |
| Replenishment | Basic | 40% |
| Slotting optimization | Missing | 0% |
| Labour management | Missing | 0% |
| Yard / dock scheduling | Missing | 0% |
| 3PL billing | Missing | 0% |
| Value-added services / kitting | Missing | 0% |
| Returns / reverse logistics | Missing | 0% |
| Parcel / cartonization / rate shop | Missing | 0% |
| Wave optimization | Missing | 10% |
| Automation / WCS integration | Missing | 0% |
| Hazmat / compliance depth | Partial | 30% |
| WMS EDI (940/944/945/947) | Missing | 0% |
| **Overall** | | **~55%** |

---

## 1. Strengths of the Spec

Before the gaps, it's worth noting what the spec gets right, because these choices should not be watered down when adding the missing pieces.

- **Reusing TrackableUnit as the license-plate / digital-twin primitive** is correct. Commercial WMS call this an LPN (License Plate Number) or HU (Handling Unit in SAP EWM). Self-referencing parent lets you model nested packaging cleanly and is what Manhattan and Körber do internally. Many open-source attempts invent a separate model here and then struggle to keep it in sync with shipment cargo.
- **Event-sourced command/projection pattern** is already in the TMS and will pay off enormously in a WMS, where auditability of every inventory movement is compliance-critical.
- **Indoor positioning via BLE/WiFi/UWB anchors is genuinely differentiating**. Most mid-market WMS rely on RF-gun scans only and have no concept of real-time in-building location. Combined with the digital twin, this is a legitimate "world class" feature if executed well. Recommend going further and adding explicit RTLS dwell/heatmap reporting (see gap #15 below).
- **Walk-sequence on bins** is the right level of pick-path sophistication for a first release. A full travelling-salesman solver is overkill; serpentine walk is what most tier-1 systems default to anyway.
- **BOL at load completion, not shipment launch** is the correct choice and better than most commercial WMS, which often generate the BOL at wave release and then scramble to regenerate after short picks.
- **Feature flag `wmsEnabled` on Organization** is the right switch for a gradual rollout.
- **Cross-dock as a workflow variant rather than a separate system** is correct. SAP EWM and Manhattan both do it the same way.

---

## 2. Gap Catalogue

Gaps are grouped by domain. Each gap lists: why it matters, whether it is a P0/P1/P2 for a world-class WMS, a rough implementation sketch, and the commercial systems that set the benchmark.

### Inventory & Master Data

#### GAP-1. Unit of Measure (UOM) conversions - **P0**
No concept of each / inner-pack / case / pallet conversions. Real warehouses receive in one UOM, store in another, pick in a third, and ship in a fourth ("break case", "split pallet"). Without this, short-picks and cycle-count variances are inevitable whenever a customer orders in a non-storage UOM.

*Implementation:* Add `ProductUom` model (sku, uomCode, parentUomCode, conversionFactor, dimensions, weight). Every `quantityOnHand` becomes UOM-aware. Picking must be able to "break" a case into eaches with an inventory transaction. Oracle WMS and SAP EWM both model this as a mandatory master data object.

#### GAP-2. Serial number tracking - **P1**
Lot tracking is in. Serial-number-level tracking is not. Required for high-value, regulated, or warranty-bearing goods (electronics, medical devices, firearms, aerospace parts).

*Implementation:* Add `SerialNumber` model (sku, serial, trackableUnitId, currentBinId, status). Extend ReceivingLine and PickLine with optional serial capture. Required for 21 CFR Part 820, UDI, and DSCSA compliance in the US.

#### GAP-3. Catch weight / variable weight items - **P2**
For food service, meat, deli, textiles, chemicals - each unit has a different weight captured at receipt and again at ship. Drives invoicing and inventory valuation.

*Implementation:* Optional `capturedWeightKg` on ReceivingLine and PackLine, overrides the SKU's nominal weight for downstream financial and shipping calculations.

#### GAP-4. Batch genealogy & recall management - **P1**
Lot is captured but there is no upstream/downstream trace. For a recall the regulator's question is "where did this specific lot go, on which shipments, to which customers?" and "what was received into that lot?".

*Implementation:* The InventoryTransaction ledger is the raw material. Add a `LotGenealogy` read-model projection that indexes inbound lot → inbound shipment/supplier and lot → outbound shipments/customers. Add a `Recall` entity with notice, affected lots, affected customers, and a generated customer notification workflow.

#### GAP-5. ABC velocity classification & slotting optimization - **P0**
The spec references `velocityClass` in PutawayRule but there is no engine that computes or re-computes it. Slotting - placing fast-movers in ergonomic, low-walk bins and relocating slow-movers out - is one of the highest-ROI features in any WMS. Manhattan's Slot IQ and JDA's Slotting Optimizer are separately licensed multi-million-dollar products.

*Implementation:*
- Nightly job computes 30/60/90-day pick frequency and order affinity per SKU.
- Assign ABC class (A = top 20% of picks, B = next 30%, C = remaining).
- Compute recommended bin for each SKU by combining velocity, weight, volume, co-pick affinity, and ergonomic zone preference.
- Generate `SlottingRecommendation` records that a manager can approve or reject.
- Approved recommendations create `PutawayTask` of type `reslot`.
- Dashboard: honey-pot bins (fast-mover in bad location), cold spots (slow-mover in prime real estate), walk-time heatmap.

#### GAP-6. Multi-warehouse / multi-client inventory segregation - **P0 for 3PL use case**
Locations are separate but there is no concept of `ownerCustomerId` on inventory for 3PL scenarios where multiple clients' goods share the same building but must be reported, billed, and audited separately.

*Implementation:* Add `ownerCustomerId` (FK Customer) to TrackableUnit and InventoryRecord. Every pick, putaway, cycle count, and billing calculation partitions by owner. Required for all 3PL operations.

### 3PL Billing (Value-Added)

#### GAP-7. Storage and handling billing - **P0 for 3PL use case**
No model for charging a client for storage (per pallet-day, per cubic-foot-day, per case-day) or handling (per inbound case, per outbound order, per pick line). This is the core revenue model of every 3PL on the planet.

*Implementation:* This is a significant sub-system.
- `BillingContract` per customer with storage rate tiers, handling rates, VAS rates, minimums, and fuel-surcharge pass-through.
- `StorageBillingCalculator` cron that snapshots on-hand inventory daily per client and accrues storage charges.
- `HandlingBillingCalculator` that emits charges on receipt, pick, pack, ship events.
- Extend existing Charge / Invoice system (`revenue` category is already in place) so that 3PL invoices flow through the same AR pipeline already built.
- Extensiv and 3PL Central's entire product is essentially this plus the basics. It is a major competitive moat.

#### GAP-8. Value-added services (VAS) - **P1 for 3PL, P2 otherwise**
Kitting, assembly, ticketing, re-labelling, re-packing, gift-wrapping, FBA prep, display-ready pallet build. These are priced per activity and billed back to the client. Most warehouses do at least some VAS; 3PLs live off it.

*Implementation:*
- `VasTask` with task type, input SKUs, output SKUs, labour standard, billing rate.
- `Kit` / `BillOfMaterials` model (parent SKU = kit, components = list of child SKUs with quantities).
- `KittingTask` consumes components, produces finished kits as a new TrackableUnit.
- Links to billing so every VAS task auto-emits a handling charge.

### Labour & Performance

#### GAP-9. Labour Management System (LMS) - **P1**
No engineered labour standards, no productivity tracking, no incentive-pay calculation, no supervisor dashboards. Manhattan and JDA ship dedicated LMS modules (Kronos WFS and Easy Metrics integrations are common alternatives).

*Implementation:* Minimum viable LMS:
- `LabourStandard` per task type (receive a pallet = 3.2 min, pick a case = 0.45 min + walk time, pack an order of N lines = 1.2 + 0.3N min).
- Every PickTask, PutawayTask, PackTask, ReceivingTask already has start/complete timestamps. Add `expectedDurationSeconds` on task creation.
- `LabourPerformance` read model aggregates per-user actual vs standard by shift, day, week.
- Dashboards: productivity index (actual/standard × 100), leaderboard, outlier detection.
- Idle time, indirect time, indirect codes.

#### GAP-10. Task interleaving - **P1**
Mature WMS assign a user their *next best task* regardless of task type. A forklift driver putting away a pallet in zone B is told to pick a pallet from zone B's letdown on the way back, rather than deadheading. Significant productivity win.

*Implementation:* Add a `TaskDispatcher` service. Instead of each task type having its own queue, the dispatcher picks the highest-priority task from the combined pool of PickTask, PutawayTask, ReplenishmentTask, CycleCountTask that is geographically closest to the operator's current bin. Requires a task-queue model that unifies the existing task types.

#### GAP-11. User skills / qualifications / equipment certification - **P2**
Forklift-certified, hazmat-trained, cold-room-approved, power-pallet-jack-licensed. The TaskDispatcher should route work only to qualified staff. Regulatory in many jurisdictions.

*Implementation:* `UserQualification` (userId, qualificationCode, expiresAt). Each task type has `requiredQualifications`. Dispatcher filters accordingly. Expiry reminders feed into the Issue system.

### Wave & Flow Control

#### GAP-12. Wave planning & templating - **P0**
Waves exist as a container but there is no wave *template* (carrier X cut-off 14:00 every day, ship-complete only, multi-line orders go first), no capacity awareness (do not release 5000 lines when you have 8 pickers), and no forecasting (you will miss the 17:00 carrier cut-off at current rate). This is the control-tower of a warehouse's day.

*Implementation:*
- `WaveTemplate` with grouping rules, cut-off time, carrier affinity, priority, min/max size, release schedule (cron).
- A wave planner UI that shows candidate orders, simulated labour hours, projected on-time rate, and carrier cut-off countdown.
- Cut-off risk alerts integrated with the existing Issue system (`shipment.cutoff_at_risk`).

#### GAP-13. Allocation engine (hard/soft allocation, ATP) - **P0**
The InventoryRecord tracks `quantityAllocated` but there is no explicit allocation engine, no soft vs hard allocation distinction, no backorder / drop-ship / transfer-from-other-dc fulfilment rules, and no available-to-promise (ATP) calculation for order acceptance.

*Implementation:*
- `Allocation` model linking OrderLineItem → InventoryRecord(s) with state (soft/hard).
- `AllocationEngine` service with rule-based strategies: FIFO/FEFO/LIFO (already in spec), same-lot, closest-to-pick-face, avoid-partial-pallet, customer-dedicated stock.
- ATP query: for SKU X at location Y, how many can I promise on date Z?
- Sourcing rules for multi-DC (fulfil from closest, cheapest, or fastest).

#### GAP-14. Order streaming / continuous release - **P2**
E-commerce fulfilment increasingly uses wave-less or "hyper-wave" streaming: orders are released continuously as capacity frees up, not batched into 4 daily waves. Shopify warehouses, Amazon, and any same-day or next-day operation need this.

*Implementation:* Background job that continuously scans `ready_to_pick` orders, checks labour capacity, and releases in small trickles rather than big batches. Compatible with existing Wave model (a streaming wave is just `waveSize=1` with `autoRelease=true`).

### Yard & Dock

#### GAP-15. Yard Management (YMS) - **P1**
No concept of the yard: trailers that are on property but not yet at a dock, yard moves, swap-outs, drop-and-hook tracking, yard dwell, yard-to-dock assignment optimization. Manhattan, Blue Yonder and C3 Solutions have dedicated YMS products precisely because this is a meaningful gap in coverage for busy sites.

*Implementation:*
- `YardLocation` (spot, parking area, fuel island, wash bay, repair bay).
- `YardMove` (trailer from spot A to spot B, assigned to a spotter/jockey/hostler).
- `TrailerCheckIn` at guard shack (trailer number, carrier, driver, seal, visit type).
- Indoor positioning re-used for outdoor: a GPS puck or trailer telematic device feeds the existing telemetry pipe.
- Dock-door assignment optimizer: assign next inbound trailer to the door closest to the putaway zone it is most likely to feed.

#### GAP-16. Dock appointment portal (carrier self-service) - **P0**
ReceivingAppointment exists but there is no way for a carrier to request, confirm, or reschedule an appointment. Commercial products (OpenDock, Transporeon, C3 Hive) have built entire businesses off this alone.

*Implementation:*
- Carrier portal extension (already exists for tendering) adds an appointment request UI.
- Appointment availability calendar with slot rules per dock (duration, buffer, max per hour, receiving types allowed).
- Auto-approval rules + manual approval queue.
- Email/SMS/push notifications. ICS feed.
- Live-board (public URL for the driver's phone showing current dock assignment and estimated call-in time).

#### GAP-17. Gate / guard shack workflow - **P2**
Driver arrives at the gate, guard captures trailer info, prints a dock pass, directs them to a specific door. Self-service kiosks and ANPR (automatic number plate recognition) cameras are increasingly standard.

*Implementation:* `GateVisit` model with driver capture (photo, licence, signature), trailer photo, seal verification, dock pass generation (PDF via existing document generation).

### Outbound / Parcel

#### GAP-18. Cartonization - **P0 for any e-commerce fulfilment**
Pack spec does not include "which box should I use?". Cartonization engines run a 3D bin-packing heuristic across a catalogue of available cartons and recommend the smallest shippable carton. Major parcel cost saver (and dim-weight optimization).

*Implementation:* `CartonCatalogue` per warehouse (length, width, height, max weight, cost). On pack start, run a First-Fit-Decreasing 3D bin packer using SKU dimensions. Recommend primary carton, allow fallback to larger. Can use `bin-packer` or custom heuristic; Manhattan and Körber do not use anything exotic here - it is a well-known problem.

#### GAP-19. Multi-carrier parcel rate shop & manifest - **P1**
Spec says "shipping label print (via existing Document Generation)" but there is no parcel rate-shop at pack time, no carrier-specific label spec (UPS, FedEx, DHL, USPS, Royal Mail, DPD), and no end-of-day manifest upload (SCAN form, EDI 215).

*Implementation:* ShipEngine, EasyPost, or Shippo integration is the pragmatic approach; however, a credible open-source WMS should also support direct carrier APIs for at least the big four in each region. End-of-day manifest cron per carrier.

#### GAP-20. GS1 / SSCC / UCC-128 labels, retailer routing guides - **P1**
Shipping to Walmart, Target, Amazon, or any major retailer requires strict label and routing compliance. SSCC-18 pallet labels, UCC-128 carton labels, GS1-128 barcodes. Non-compliance results in chargebacks.

*Implementation:* `ComplianceLabelTemplate` per trading partner (existing model) with the retailer's spec. Templating engine that emits ZPL/EPL for Zebra/Honeywell printers. SSCC generation (company prefix + serial counter, mod-10 check digit).

#### GAP-21. Pack verification & weight-check - **P2**
Scales at the pack station, dim-weight capture via cubing machines (Cubiscan, Makerscan). If packed weight differs from expected by >X%, hold for audit. Loss-prevention feature.

*Implementation:* Optional integrations via IoT telemetry. `PackAudit` record if outside tolerance. Auto-creates an Issue.

### Returns & Reverse Logistics

#### GAP-22. RMA / returns workflow - **P1**
Quarantine zone is mentioned but there is no `ReturnMerchandiseAuthorization` model, no customer-facing returns portal, no disposition (restock / refurb / scrap / return-to-vendor) workflow, no reverse pick (bring item from customer back into inventory), and no refund coordination with the financial system.

*Implementation:*
- `Rma` with reason, customer, original order, SKUs, expected receipt.
- Customer portal page to request and print return label.
- `ReturnReceiving` task type (variant of ReceivingTask).
- Disposition workflow with configurable routing (restock → good bin, refurb → refurb queue, scrap → scrap bin, RTV → vendor return shipment).
- Financial link: auto-credit-note via existing CreditNote model.

### Automation / WCS

#### GAP-23. Warehouse Control System (WCS) integration points - **P1**
No hooks for AS/RS, unit-load / mini-load cranes, conveyor and sortation systems, pick-to-light, put-to-light, put-to-wall, voice picking (Vocollect/Honeywell, Lucas), AMR (Locus, 6 River, Fetch), AGV, goods-to-person (Exotec, AutoStore, Geek+, Kardex).

*Implementation:* The pragmatic first step is to define the *interfaces* and support a reference automation partner.
- `IAutomationProvider` service interface (similar to `IRoutingProvider` already in the TMS).
- Webhook/AMQP/MQTT outbound for task events: `pick_task.released`, `putaway_task.assigned`, etc.
- Inbound endpoints for automation completion confirmations.
- Voice provider integration via Vocollect VoiceLink or open source alternatives like Voxware-style VXML.
- Pick-to-light and put-to-wall: dedicated task sub-types, LED controller hooks.

#### GAP-24. Mobile / RF-gun optimized UX with offline mode - **P1**
The spec mentions extending the existing mobile app. A serious WMS RF-gun UX is dense, single-line, keyboard-driven, works on Honeywell CT40/CT60 and Zebra TC72/TC77 devices, and crucially works offline (warehouses have dead zones). Modern equivalents use Android Enterprise with service workers or PWA offline-first.

*Implementation:*
- PWA with IndexedDB for offline task queue.
- Barcode wedge keyboard support (not only camera).
- Keymap: F-keys for actions, TAB to jump fields, no touch required.
- Task reservation so offline-started tasks cannot be assigned to another user.

#### GAP-25. Hands-free / wearable picking - **P2**
Voice, smart glasses (RealWear, Google Glass EE), ring scanners (ProGlove, Zebra RS5100). Trending in the market.

*Implementation:* Same backend task contract; UI variants. Voice template engine.

### Compliance, Safety, Quality

#### GAP-26. Hazmat segregation engine - **P1**
HazmatCertified boolean on bin/zone is a flag, not an engine. Real hazmat compliance has a segregation matrix (Class 3 flammable liquids must be separated from Class 5.1 oxidizers by N metres; Class 8 corrosives cannot co-locate with Class 2.3 toxic gases; etc.). Required for CFR 49, IATA DGR, IMDG.

*Implementation:*
- `HazmatClass` catalogue (UN number, class, division, packing group).
- `HazmatSegregationRule` matrix (class A vs class B → separation requirement).
- Validator on putaway that refuses or warns on non-compliant moves.
- SDS management (upload, version, customer-accessible).
- Shipping papers (Dangerous Goods Declaration, placards) via document generation.

#### GAP-27. Quality hold & QC workflow - **P1**
Inspection status is present but there is no broader QC model: supplier-specific inspection plans, AQL sampling, HOLD status that prevents allocation, release-from-hold workflow, supplier scorecard based on inbound quality.

*Implementation:* `QualityHold` on TrackableUnit or lot, with reason, held-by, release conditions. AllocationEngine refuses to allocate from held inventory. `SupplierScorecard` read model aggregating quality, ASN accuracy, on-time rate.

#### GAP-28. Temperature, humidity and cold-chain monitoring in zones - **P1**
The TMS has cold-chain telemetry on shipments, but the spec does not integrate zone-level telemetry with excursion handling. Pharma, food, biotech need per-bin/per-zone temperature logging, mean kinetic temperature (MKT), excursion reporting, and a `cold_chain.excursion` event that auto-holds affected inventory.

*Implementation:* Reuse existing `SensorReading`, tag readings with `zoneId`, add excursion detection service and link to the existing `cold_chain.excursion_detected` event that the triage agent already subscribes to.

#### GAP-29. Bonded / customs warehouse - **P2**
Customs-bonded, free-trade-zone (FTZ), and duty-deferred warehousing. Inventory is segregated by customs status, and movement is tracked for regulator reporting (7501 entry, bonded withdrawal, FTZ weekly entry).

*Implementation:* `CustomsStatus` on TrackableUnit. Bonded warehouse reports. Links to the TMS's existing customs documentation (which is noted as limited in the Multimodal gap analysis).

#### GAP-30. FSMA / DSCSA / 21 CFR Part 11 electronic signature - **P2**
For food (FSMA 204 traceability), pharma (DSCSA unit-level serialization), and regulated industries (21 CFR Part 11 electronic records with signature meaning, biometric or two-factor), regulators require specific record-keeping and electronic signatures on critical events (release from hold, destruction, adjustment over threshold).

*Implementation:* `ElectronicSignature` on inventory adjustments over threshold, with re-authentication challenge and reason logging.

### EDI (Warehouse-specific)

#### GAP-31. Warehouse EDI transaction set - **P1**
The TMS already supports tendering and financial EDI. WMS-specific transactions are not in the current EDI scope:

| Code | Name | Direction | Priority |
|------|------|-----------|:--------:|
| 940  | Warehouse Shipping Order (client → 3PL) | Inbound | P0 for 3PL |
| 943  | Warehouse Stock Transfer Shipment Advice | Outbound | P1 |
| 944  | Warehouse Stock Transfer Receipt Advice | Inbound | P1 |
| 945  | Warehouse Shipping Advice (3PL → client) | Outbound | P0 for 3PL |
| 947  | Warehouse Inventory Adjustment Advice | Outbound | P1 |
| 846  | Inventory Inquiry/Advice | Outbound | P0 for 3PL |
| 753  | Request for Routing Instructions | Outbound | P2 |
| 754  | Routing Instructions | Inbound | P2 |

The existing `TradingPartner` + `EdiRouterService` architecture extends to these cleanly - each needs a parser or generator service.

### Analytics & Control Tower

#### GAP-32. Warehouse operations dashboard - **P0**
The TMS has dashboards but a warehouse dashboard has specific KPIs not present in any TMS dashboard: dock-to-stock time, order cycle time, pick accuracy, perfect order rate, on-time ship rate, inventory record accuracy (from cycle counts), capacity utilization by zone, labour productivity index, open exception count.

*Implementation:* New VNext page `/wms/dashboard` with tile grid. Each tile reads from a dedicated read model updated by projections.

#### GAP-33. Simulation / what-if planning - **P2**
"What happens if I add a 3rd shift?", "what if I re-slot?", "what if this pallet does not arrive?". Tier-1 WMS sometimes include limited simulation; typically customers buy a separate product (AnyLogic, FlexSim).

*Implementation:* Out of scope for v1. Noting for completeness.

#### GAP-34. Real-time location heatmap - **P1**
The indoor positioning system is in scope. It should be exposed as a real-time heatmap / digital-twin UI showing where every pallet and every picker is right now, dwell times per zone, and bottleneck identification. This is the visible payoff of the indoor positioning investment and a unique selling point.

*Implementation:* WebSocket stream from the existing event bus; D3 or Deck.gl 2D floor-plan visualization with per-zone density.

### Miscellaneous

#### GAP-35. Wave templates library / pre-built operations - **P2**
Ship from Store, BOPIS (Buy Online Pick In Store), ROPIS, Curbside, Ship Complete, Split-Ship. These are configurations of existing capabilities but deserve a named template to save setup time.

#### GAP-36. Shift & break management - **P2**
Clock in, break, lunch, clock out. Integrates with labour productivity calculations to subtract break time from denominator.

#### GAP-37. Incident / safety reporting - **P2**
Near-miss, injury, equipment damage reports. Often regulatory (OSHA 300 log in the US). Can be built on top of existing Issue model.

#### GAP-38. Carbon per order - **P2**
The TMS already has a sustainability gap. Warehouse energy per pick / per order is the warehouse equivalent. Worth noting as a cross-cutting roadmap item.

---

## 3. Recommended Additions to the Spec (v1 and v2)

### v1 (ship with initial WMS release) - should be added to the spec

The following should be pulled into the WMS_SPECIFICATION.md before implementation starts. They are either load-bearing (you cannot responsibly ship without them) or cheap to include up-front.

1. **Unit of Measure master data and conversions** (GAP-1). Without this, pick/pack and cycle counting will produce false variances.
2. **Owner/client on TrackableUnit and InventoryRecord** (GAP-6). Trivial schema cost; impossible to retrofit later.
3. **Cartonization at pack** (GAP-18). High-impact, well-bounded problem.
4. **Wave templates and capacity-aware release** (GAP-12). Waves exist in the spec as empty shells; they need planner intelligence.
5. **Allocation engine as a named service** (GAP-13). The spec has `quantityAllocated` but no engine - call this out explicitly.
6. **Returns/RMA model** (GAP-22). Reverse flows are everywhere; the current "quarantine zone" is not sufficient.
7. **Warehouse operations dashboard** (GAP-32). Table stakes for a warehouse manager's daily standup.
8. **Indoor positioning heatmap UI** (GAP-34). It is the payoff for the anchor work already in the spec.
9. **WMS EDI 940 and 945** (GAP-31 subset). If a 3PL use case is in scope, these are the two transactions you cannot ship without.

### v1.5 / v2 (next phase, separate design docs)

1. **3PL billing suite** (GAP-7, GAP-8). This deserves its own spec document; it is the single largest differentiator for an open-source WMS against commercial mid-market players. Extensiv's product is essentially this plus the basics, and they are valued at nine figures.
2. **Labour management** (GAP-9, GAP-10, GAP-11). Start with standards + performance; task interleaving in a second iteration.
3. **Yard + dock appointment portal** (GAP-15, GAP-16, GAP-17). Significant but self-contained; reuse the carrier portal shell already in the TMS.
4. **Slotting optimization** (GAP-5). Requires 60-90 days of operational data to be useful, so deferring past v1 is natural.
5. **Hazmat segregation engine** (GAP-26). Required if any regulated industry customers.
6. **Automation / WCS integration framework** (GAP-23). The `IAutomationProvider` interface should be defined in v1 even if no provider is implemented, so that the door is open.
7. **Serial number tracking** (GAP-2) and **batch genealogy / recall** (GAP-4) for regulated industries.
8. **Parcel rate-shop and multi-carrier manifesting** (GAP-19, GAP-20).

### v3 / "not in scope"

Simulation (GAP-33), bonded / customs warehouse (GAP-29), voice and wearable picking UI (GAP-25), shift management (GAP-36), incident reporting (GAP-37), carbon per order (GAP-38). These are either niche, require significant third-party integration, or are better done as plugins.

---

## 4. Architectural Observations

- **Task model unification.** The spec has separate `ReceivingTask`, `PutawayTask`, `PickTask`, `PackTask` entities. Commercial WMS typically have a single `Task` supertype with a `taskType` discriminator and specialized child tables. This matters when you add the `TaskDispatcher` for task interleaving (GAP-10) - retrofitting a supertype across four sibling tables is painful. Recommend introducing a common base now, even if each type still has its own detail table.

- **Inventory ledger as the single source of truth.** The `InventoryTransaction` ledger is correctly described as immutable, and `InventoryRecord` is called out as a read model. Enforce this in code: the projection should be the only writer to InventoryRecord, and all mutations should flow through commands that emit `InventoryTransaction` events. Tier-1 WMS that violate this end up with inventory drift that is catastrophic to recover from.

- **Opaque location keys.** The `WarehouseBin.label` (e.g. "BULK-A-01-03-B") is user-facing and carries semantic meaning. This is fine and conventional, but keep any customer-specific bin labelling out of it - the guidance in the TMS CLAUDE.md about opaque storage keys does not apply here (bins are operational metadata, not customer data), but bin labels will leak into BOLs, pack slips, and EDI documents so they should be audit-safe and stable.

- **Pick path optimization.** Walk-sequence on bins is correct for v1. If a site is large enough that serpentine breaks down (>50,000 bins), consider a plug-in optimization service rather than in-process - a graph-based TSP solver deserves its own worker.

- **Event naming discipline.** The WMS spec introduces ~40 new event types. Propose adopting a consistent naming scheme: `wms.<aggregate>.<verb_past_tense>` (e.g. `wms.receiving_task.completed`, `wms.inventory.adjusted`), with a `wms.` prefix to keep the TMS and WMS event streams distinguishable for analytics and automation rules.

- **Projection backfill cost.** At a real warehouse scale (millions of InventoryTransaction rows) the existing `backfill-read-models.ts` script will get slow. Add incremental backfill support and a checkpoint table before the WMS goes to production.

- **Multi-tenancy considerations.** If the 3PL use case is in scope, every WMS query becomes `WHERE ownerCustomerId = ?` in addition to `WHERE orgId = ?`. Plan row-level security or tenant-partitioned indexes up front.

---

## 5. What Would Make It "World Class" vs "Competent"

The spec as written will produce a competent bolt-on WMS that is ahead of any other open-source offering (Odoo's warehouse module, ERPNext, Openboxes) in architecture and is at parity or better on core flows. That is already a strong position.

To cross into "world class" - meaning genuinely competitive with Manhattan, Blue Yonder, Körber, SAP EWM in a mid-market evaluation - the non-negotiables in priority order are:

1. **3PL billing** (GAP-7, GAP-8). Single biggest differentiator against mid-market.
2. **Slotting + labour** (GAP-5, GAP-9). What sophisticated buyers evaluate.
3. **Allocation engine + wave planner + ATP** (GAP-12, GAP-13). The brain of the warehouse.
4. **Yard + appointment portal** (GAP-15, GAP-16). Universally needed, commonly absent.
5. **Automation-ready interfaces** (GAP-23). Without this you are locked out of any customer >50k orders/day.
6. **Indoor positioning heatmap, RTLS, digital twin visualization** (GAP-34). This is where Open TMS can *lead* rather than catch up, and it plays to your unique strengths.
7. **Returns** (GAP-22). E-commerce makes this non-optional.
8. **Cartonization + rate-shop + GS1 labels** (GAP-18, GAP-19, GAP-20). Parcel maturity.

If all eight ship, combined with the strong spec that is already drafted, Open TMS + WMS would be a credible alternative to commercial tier-1 for mid-market shippers and small-to-mid 3PLs. That is a very defensible market position.

---

## 6. Roadmap Impact

Suggest updating `roadmap.md` with a new "WMS" section structured as:

- **Phase 1 - Foundation** (from the existing spec): Location hierarchy, Inventory (with UOM and owner), Receiving, Putaway, Pick, Pack, Loading, Cross-dock, Cycle count, Replenishment basics, Indoor positioning.
- **Phase 2 - Intelligence**: Allocation engine, Wave planner, Cartonization, Warehouse dashboard, Indoor heatmap UI, Returns/RMA, WMS EDI 940/945/846.
- **Phase 3 - 3PL**: Billing contracts, storage/handling/VAS billing, Kitting, Supplier scorecard, Multi-client dashboards.
- **Phase 4 - Optimization**: Slotting engine, Labour management, Task interleaving, Wave templates library.
- **Phase 5 - Ecosystem**: Yard management, Dock appointment portal, Automation/WCS integration interfaces, Parcel rate-shop, Voice/RF-gun PWA offline.
- **Phase 6 - Compliance**: Hazmat segregation, Serial tracking, Lot genealogy/recall, Cold-chain zone integration, Electronic signatures, Bonded warehouse.

---

## Appendix: Commercial Benchmark Matrix

Abbreviated feature coverage comparison (rough, based on 2024-2026 vendor materials; a `✓` means shipped as core, `+` means available as paid add-on, blank means not supported).

| Feature | Manhattan Active | Blue Yonder | Körber | SAP EWM | Oracle WMS | Softeon | Deposco | Open TMS + spec |
|---------|:----------------:|:-----------:|:------:|:-------:|:----------:|:-------:|:-------:|:---------------:|
| Receiving + ASN | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Directed putaway | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Pick strategies (D/B/Z/W) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Cartonization | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |   |
| Slotting optimization | ✓ | + | ✓ | + | + | ✓ | + |   |
| Labour management | ✓ | ✓ | ✓ | ✓ | + | ✓ | + |   |
| Yard management | + | ✓ | + | + | + | ✓ | + |   |
| Dock appointments | ✓ | ✓ | + | + | + | ✓ | ✓ | partial |
| 3PL billing | + | + | ✓ |   | + | ✓ | ✓ |   |
| Kitting / VAS | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |   |
| Returns / RMA | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |   |
| Parcel manifest | ✓ | ✓ | ✓ | + | + | ✓ | ✓ |   |
| GS1 / retailer labels | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |   |
| WCS / automation | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | + |   |
| Voice picking | + | + | + | + | + | + | + |   |
| Hazmat engine | ✓ | ✓ | ✓ | ✓ | ✓ | + |   | partial |
| Serial tracking | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |   |
| Cycle counting | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Wave templates | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | partial |
| Indoor RTLS / digital twin | + | + | + |   |   |   |   | ✓ (spec) |
| Event-sourced audit log |   |   |   | ✓ |   |   |   | ✓ |
| Open source |   |   |   |   |   |   |   | ✓ |

The last three rows are the credible differentiators for Open TMS.
