import { Link } from 'react-router-dom'
import AnimateIn from '../../components/AnimateIn'
import MissingFeature from '../../components/MissingFeature'
import WarehousePreview from '../../components/previews/WarehousePreview'

/* ── Top-of-page problem cards (broader than launch only) ── */
const topProblems = [
  {
    problem: 'We juggle a TMS and a WMS and they never agree on the truth',
    solution: 'One system, one source of truth',
    description: 'Open TMS includes the full WMS in the box. Receiving, putaway, inventory, waves, picking, packing, loading, and returns all share the same shipments, orders, and customers you already have. No master-data sync, no licence stack, no handoff gaps.',
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 7.5l-9-5.25L3 7.5m18 0l-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9" />
      </svg>
    ),
    color: '#6366f1',
  },
  {
    problem: 'Pickers, packers and receivers are on paper, clipboards or spreadsheets',
    solution: 'A mobile app for every role on the floor',
    description: 'A scan-first PWA for warehouse workers: receive, putaway, pick, pack, pack-audit, check in arriving carriers, and process returns. Works with Zebra and Honeywell RF guns via the barcode wedge hook. No separate licence per handheld.',
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3" />
      </svg>
    ),
    color: '#f59e0b',
  },
  {
    problem: 'Shipments miss carrier cutoffs and we only find out from the customer',
    solution: 'Cutoff-at-risk detection with auto-escalation',
    description: 'Per-carrier, per-day cutoff times and timezones. Every 5 minutes the monitor projects warehouse-ready time from the remaining pick, pack, and load work. When a shipment is going to miss its cutoff, it raises a triage issue automatically. Severity escalates rather than spams.',
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    color: '#ec4899',
  },
  {
    problem: 'Returns are a black hole that eats margin and no-one has a grip on',
    solution: 'Five-channel RMA with disposition-driven routing',
    description: 'Admin, customer portal, public REST API, EDI 180, and marketplace webhooks all converge on one RMA command. Seven dispositions (restock, refurb, scrap, recycle, donate, RTV, customer keeps) drive what physically happens. Quarantine-first flow protects inventory integrity. Finance reviews refunds, the floor runs the physical work.',
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" />
      </svg>
    ),
    color: '#10b981',
  },
]

/* ── Grouped capability sections ── */
interface Capability { title: string; desc: string; icon: string }
interface Section { badge: string; headline: string; headlineAccent: string; pain: string; solution: string; capabilities: Capability[] }

const sections: Section[] = [
  {
    badge: 'Inbound',
    headline: 'Goods come in.',
    headlineAccent: 'Without the paperwork pile.',
    pain: 'Dock doors fill up, ASNs arrive late or never, receivers chase goods-in paperwork, and blind freight sits in limbo while someone figures out what to do with it. Appointments live in a spreadsheet or a carrier portal that the floor team cannot see.',
    solution: 'The entire inbound flow is scan-driven and event-linked. Appointments, receiving, putaway and cross-dock share state so a driver checking in at 08:03 becomes a live receiving task at 08:04, and goods land in the right bin the moment they are scanned off the trailer.',
    capabilities: [
      { title: 'Dock appointments + check-in', desc: 'Schedule carrier arrivals with trailer, seal, and ASN references. Carriers check in on the mobile app; receiving tasks pick up from the same record. No double-entry, no "did they arrive?" calls.', icon: 'M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5' },
      { title: 'ASN + blind receiving', desc: 'Scan a SKU barcode to match ASN lines or record walk-in freight. Capture received vs damaged quantities per line, tag pass / fail / quarantine inspection per line, and the system builds putaway tasks the moment the receipt closes.', icon: 'M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3' },
      { title: 'Directed putaway with deviation tracking', desc: 'Priority-based routing rules match each unit to the right storage location using temperature, hazmat, velocity, and owner constraints. Scan-to-confirm records any deviation from the recommended bin so you can audit why the rule was bypassed.', icon: 'M9 8.25H7.5a2.25 2.25 0 00-2.25 2.25v9a2.25 2.25 0 002.25 2.25h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25H15M9 12l3 3m0 0l3-3m-3 3V2.25' },
      { title: 'Cross-dock flow-through', desc: 'Flag a receipt as cross-dock and the received units route straight to the outbound staging bin. Goods never see storage. Ideal for hub-and-spoke distribution where inventory days are measured in hours.', icon: 'M3 7.5L7.5 3m0 0L12 7.5M7.5 3v13.5m13.5 0L16.5 21m0 0L12 16.5m4.5 4.5V7.5' },
      { title: 'CSV manifest ingestion', desc: 'Upload a supplier manifest in any column format; the system auto-detects the header layout via checksum and remembers the mapping for next time. Each row becomes a receiving task. Perfect for suppliers who will not send EDI.', icon: 'M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-9-11.25v11.25m0 0l-4.5-4.5m4.5 4.5l4.5-4.5' },
    ],
  },
  {
    badge: 'Storage & Inventory',
    headline: 'Know what you have,',
    headlineAccent: 'where, and when.',
    pain: 'Inventory counts drift. Bins are full or empty and nobody knows which. Somebody picks from bulk, the pick face runs dry, and the next wave shorts. Compliance asks for a temperature zone history for a specific lot and nobody can produce it.',
    solution: 'Zones and bins with real capabilities, an immutable inventory transaction ledger, cycle counts with auto-adjust, and auto-replenishment that fires the instant a pick drops a bin below its minimum.',
    capabilities: [
      { title: 'Zones & bins with capabilities', desc: 'Model your warehouse with zones (ambient, refrigerated, frozen, hazmat-certified), aisles, and bins. Each bin carries temperature zone, hazmat certification, capacity, and ownership so putaway rules can route correctly.', icon: 'M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z' },
      { title: 'Real-time inventory + transaction ledger', desc: 'Every receive, pick, adjust, transfer, and return writes a row to an immutable InventoryTransaction ledger with reason codes. Query quantity-on-hand, available, allocated, and on-hold at any point in time. Compliance-ready audit trail.', icon: 'M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z' },
      { title: 'Cycle counting with auto-adjust', desc: 'Run full warehouse, zone, or random sample counts. Variances are detected automatically and the inventory adjustment posts with a count-derived reason code. The 30-day inventory record accuracy % shows up on the operations dashboard.', icon: 'M10.125 2.25h-4.5c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125v-9M10.125 2.25h.375a9 9 0 019 9v.375M10.125 2.25A3.375 3.375 0 0113.5 5.625v1.5c0 .621.504 1.125 1.125 1.125h1.5a3.375 3.375 0 013.375 3.375M9 15l2.25 2.25L15 12' },
      { title: 'Event-driven auto-replenishment', desc: 'Set min/max thresholds per SKU per pick face. When a pick drops a bin below the minimum, a replenishment putaway task fires within seconds - not on the next cron sweep. Bulk storage is pulled to the pick face before the next wave hits it.', icon: 'M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182' },
    ],
  },
  {
    badge: 'Outbound',
    headline: 'Ship right.',
    headlineAccent: 'On time. Every time.',
    pain: 'Wave planning is a spreadsheet exercise. Pickers walk miles per hour of productive time. Packs ship wrong and the first time you find out is a chargeback. Load sequencing is in the dispatcher\'s head. Carrier cutoffs are missed and nobody knows until the complaint comes in.',
    solution: 'Wave templates with cron-based auto-release. Zone picking with sequential and parallel modes. Scan-verified packing. Scale-and-dim pack audits that block faulty shipments at the pack station. Load plans that build a real BOL. Cutoff monitoring that escalates to triage before the shipment slips.',
    capabilities: [
      { title: 'Wave templates with auto-release', desc: 'Define a reusable template: grouping rules (customer, carrier, service level), cutoff time, min/max orders, pick strategy. The cron worker fires APPLY_WAVE_TEMPLATE at the scheduled time. No manual wave-building at 14:00 every day.', icon: 'M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z' },
      { title: 'Zone picking (sequential + parallel)', desc: 'Sequential (pick-and-pass): zones pick in order, tote moves through. Parallel (pick-and-merge): zones pick concurrently and merge at pack. Start and complete timestamps per zone give you SLA visibility on each hop.', icon: 'M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM3.75 12h.007v.008H3.75V12zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm-.375 5.25h.007v.008H3.75v-.008zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z' },
      { title: 'Scan-verified packing', desc: 'Every item on the pick is verified against the pack task by barcode scan. The packer picks the right carton from the intelligence-aware catalogue and runs a pack audit before the label prints. Wrong items never leave the pack station.', icon: 'M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z' },
      { title: 'Pack audit (weight + dim-weight)', desc: 'Scale and optional cubiscan reading at the pack station compared against expected weight from the SKU catalog. Configurable tolerance (10% default). Pass / warning / fail verdict auto-raises a quality issue on variance. Catches mispicks before they become chargebacks.', icon: 'M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3' },
      { title: 'Load planning & BOL', desc: 'Sequence outbound loads with reverse-stop order (last stop loaded first, so it unloads last). Record trailer seals and dock door assignments. Bill of Lading auto-generates as a PDF when the load completes.', icon: 'M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12' },
      { title: 'Cutoff-at-risk monitor', desc: 'Per-carrier, per-day cutoff times with IANA timezone support. A 5-minute cron projects warehouse-ready time from remaining pick, pack, and load work. Warning and critical severity auto-raise a triage issue linked to the shipment. Dedup prevents spam; escalation fires immediately.', icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' },
    ],
  },
  {
    badge: 'Reverse Logistics',
    headline: 'Returns as a managed process,',
    headlineAccent: 'not a cost centre.',
    pain: 'Customer returns arrive unannounced. A box lands at the dock with no RMA number. Damaged goods go back to sellable inventory by accident. Refunds get issued before the item is in the building. Nobody knows which SKUs keep coming back.',
    solution: 'Five channels to create RMAs, a quarantine-first physical flow, seven dispositions that drive the physical routing, and a finance review queue that only releases refunds once inspection is complete.',
    capabilities: [
      { title: 'Full RMA lifecycle', desc: 'Rma and RmaLine models with seven dispositions: restock, refurb, scrap, recycle, donate, return-to-vendor, customer keeps. Status progresses requested → authorized → in_transit → received → inspecting → dispositioning → completed. Partial returns are first-class.', icon: 'M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3' },
      { title: 'Five initiation channels', desc: 'Admin UI, customer portal self-service, public REST API (customer-scoped keys), EDI 180 inbound + outbound authorization, and marketplace webhooks (roadmap). One unified CREATE_RMA command, different initiation sources. initiatedVia is tracked for reporting.', icon: 'M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5' },
      { title: 'Return labels + carrier pickup', desc: 'Generate prepaid return shipping labels and schedule carrier pickups from the RMA detail page. Provider-agnostic interface: manual provider shipping in v1, with FedEx, UPS, and DHL stubs wired for live carrier API integration.', icon: 'M16.5 8.25V6a2.25 2.25 0 00-2.25-2.25H6A2.25 2.25 0 003.75 6v8.25A2.25 2.25 0 006 16.5h2.25m8.25-8.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-7.5A2.25 2.25 0 018.25 18v-1.5m8.25-8.25h-6a2.25 2.25 0 00-2.25 2.25v6' },
      { title: 'Mobile return tasks on the floor', desc: 'Workers scan an RMA and receive lines with per-line quantity input. An inspection task follows with condition (pass / fail / partial damage) and a one-of-seven disposition picker. Routing from quarantine to putaway, refurb, scrap, or RTV happens automatically based on disposition.', icon: 'M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25' },
      { title: 'Finance refund review queue', desc: 'Suggested refund auto-calculated from line prices at inspection time. Finance reviews and can override before the credit note issues. Inventory is only restocked on completion, so refunds cannot go out before the goods are inspected.', icon: 'M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z' },
    ],
  },
  {
    badge: 'Mobile on the Floor',
    headline: 'Scan, tap,',
    headlineAccent: 'move on.',
    pain: 'Half the floor is still using paper pick tickets. The other half is on a WMS that was designed for desktop and shoehorned onto an Android. RF guns, Zebra scanners and mobile phones do not behave the same way. Operators waste time navigating menus instead of moving product.',
    solution: 'One touch-first PWA that runs on any device with a browser. Barcode wedge hook detects Zebra / Honeywell scanner input automatically. Every workflow has a dedicated page with one primary action on screen at a time.',
    capabilities: [
      { title: 'Unified task list', desc: 'Receive / Putaway / Pick / Pack / Returns tabs show every outstanding task at the selected warehouse location. Bottom nav surfaces today\'s carrier arrivals separately so the team can check carriers in as they roll up to the dock.', icon: 'M4 6h16M4 12h16M4 18h7' },
      { title: 'Barcode wedge support', desc: 'useBarcodeScanner hook detects HID-mode scanners (Zebra, Honeywell, Datalogic) by recognising the rapid-keystroke-plus-Enter pattern. No drivers. No native app. The operator just scans and the right line opens.', icon: 'M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 013.75 9.375v-4.5zM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 01-1.125-1.125v-4.5zM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0113.5 9.375v-4.5z' },
      { title: 'Shipment launch app', desc: 'QR-code authentication, assigned shipments, IoT device pairing, cargo manifest scanning, and pre-flight checklists that block launch if a check fails. Catch documentation and accessory issues at the dock, not at delivery.', icon: 'M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3' },
      { title: 'Appointment check-in', desc: 'Today\'s scheduled arrivals with carrier, trailer, seal, ASN reference, and dock bin. One tap to check a carrier in. The receiving task picks up from the same record with the dock assignment already applied.', icon: 'M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75' },
    ],
  },
  {
    badge: 'Intelligence',
    headline: 'The right carton.',
    headlineAccent: 'The right pallet.',
    pain: 'Packers pick whatever box is closest. Hazmat goes in the same box as food-safe goods. High-value watches get a plain mailer. Pallets are loaded to the weight limit with two layers of headroom wasted. Carriers bill for dim-weight no-one measured.',
    solution: 'A constraint-aware container recommender enforces hazmat segregation and temperature matching. A palletization planner picks the right pallet type and works out layers, stacked height, and weight utilization. An operations dashboard surfaces the metrics that matter.',
    capabilities: [
      { title: 'Container intelligence', desc: 'Cartons gain temperature zone, insulation hours, hazmat UN classes, value class, tamper-evident, and material fields. The recommender groups pack items by constraint profile, enforces a UN segregation matrix (no class 3 flammables with class 5.1 oxidizers), picks the smallest qualifying carton per group, and attaches ancillaries (gel pack, dry ice, desiccant, fragile padding, tamper seal). Transit-hours-aware cold-chain upgrades.', icon: 'M21 7.5l-9-5.25L3 7.5m18 0l-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9' },
      { title: 'Pallet types & palletization', desc: 'Seed 13 standard pallet types (EUR1, EUR2, EUR3, EUR6 half, US GMA 48×40, CHEP 1210 + 48×40, AU 1165, plastic, one-way export, quarter display). The planner computes cartons-per-layer (best of two orientations), layers (min of height and weight bound), stacked height, and weight utilization. A recommender ranks all active pallet types for a given carton.', icon: 'M3 8.25V18a2.25 2.25 0 002.25 2.25h13.5A2.25 2.25 0 0021 18V8.25M3 8.25V5.625c0-.621.504-1.125 1.125-1.125h15.75c.621 0 1.125.504 1.125 1.125V8.25m-18 0h18M7.5 8.25v12M12 8.25v12m4.5-12v12' },
      { title: 'Cartonization', desc: 'First-Fit-Decreasing algorithm recommends the right carton mix for a pack task. Pulls dimensions from the ProductUom catalogue with order-line-item fallback. Surfaces volume and weight utilization so the packer can see why the recommendation landed where it did.', icon: 'M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z' },
      { title: 'Operations KPI dashboard', desc: 'Six KPI groups: throughput today vs 7-day, 30-day cycle times (pick, dock-to-stock, order-to-ship), quality (pick accuracy, pack audit pass rate, inventory record accuracy), live work queue, exceptions including cutoff-at-risk, and bin utilization. Tone-coloured thresholds and one-click drill-downs.', icon: 'M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z' },
    ],
  },
  {
    badge: 'Integrations',
    headline: 'Talk to the systems',
    headlineAccent: 'that run your business.',
    pain: 'Depositors send us EDI 940s that we re-key as orders. 945 advice goes out by email, late and manually. Customers want a self-service portal so they can stop calling customer service to ask where their order is. Developer integrations get blocked waiting for support to issue API keys.',
    solution: 'Native EDI 940 / 945 pair for 3PL operations. A customer portal with self-service order, shipment, invoice and returns access plus a Developer Area for API keys, webhooks and EDI config. Webhook delivery with HMAC-SHA256 signatures, pattern subscriptions, and exponential-backoff retry.',
    capabilities: [
      { title: 'EDI 940 / 945 (3PL shipping)', desc: 'Depositors send an EDI 940 Warehouse Shipping Order; we parse the full W05 / N1 / W01 / G62 / W66 structure and create the order automatically. On shipment.delivered, the 945 Warehouse Shipping Advice auto-sends back with W12 status codes (CC complete / PC partial / CN cancelled), W27 carrier + tracking, W03 totals, and line-level N9 refs. Routed through the universal EDI inbound endpoint and trading partner delivery infrastructure.', icon: 'M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM3.75 12h.007v.008H3.75V12zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm-.375 5.25h.007v.008H3.75v-.008zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z' },
      { title: 'Customer portal', desc: 'Self-service access for your customers: orders, shipments, documents, invoices, and returns. JWT-authenticated, scoped to their customerId. Returns include a multi-step request form and a detail page that lets them download the return label.', icon: 'M17.982 18.725A7.488 7.488 0 0012 15.75a7.488 7.488 0 00-5.982 2.975m11.963 0a9 9 0 10-11.963 0m11.963 0A8.966 8.966 0 0112 21a8.966 8.966 0 01-5.982-2.275M15 9.75a3 3 0 11-6 0 3 3 0 016 0z' },
      { title: 'Developer Area in the customer portal', desc: 'Multi-app workspace (Portal / Developer) with a Google-style app switcher in the topbar. API keys CRUD with one-time plaintext reveal on create. Webhooks CRUD with signing secret rotation, send-test, and per-webhook delivery log. Read-only view of EDI trading partner config. Paginated EDI transaction log.', icon: 'M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5' },
      { title: 'Signed webhooks with retry', desc: 'HMAC-SHA256 signature in X-OpenTms-Signature: t=<unix>,v1=<hex> with a 5-minute tolerance window. Pattern subscriptions (*, rma.*, exact). Failed deliveries retry with exponential backoff (2, 4, 8, 16, 30 min) up to 5 attempts. X-OpenTms-Retry header distinguishes retries from original deliveries.', icon: 'M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5m.75-9l3-3 2.148 2.148A12.061 12.061 0 0116.5 7.605' },
      { title: 'EDI 180 RMA interchange', desc: 'Customer sends X12 180 via SFTP or HTTP; we parse the BGN, REF, N1, LX/LQ/SLN segments and auto-create an RMA. Outbound 180 generator emits the authorization response with our RMA number and return instructions. GS functional identifier RZ, routed via the universal EDI inbound endpoint.', icon: 'M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5' },
    ],
  },
]

export default function Warehouse() {
  return (
    <div className="gradient-bg min-h-screen">
      {/* Hero */}
      <section className="relative pt-32 pb-24 overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-amber-600/8 blur-[100px]" />
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
          <Link to="/" className="inline-flex items-center gap-2 text-sm text-surface-400 hover:text-white transition-colors mb-8">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
            Back to home
          </Link>

          <AnimateIn animation="fade-in">
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/20 bg-amber-500/10 px-4 py-1.5 mb-6">
              <span className="text-sm font-medium text-amber-400">Warehouse Management System</span>
            </div>
          </AnimateIn>

          <AnimateIn animation="fade-up" delay={100}>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.1] mb-6 mx-auto max-w-4xl">
              Dock to dispatch.
              <br />
              <span className="gradient-text">In one system.</span>
            </h1>
          </AnimateIn>

          <AnimateIn animation="fade-up" delay={200}>
            <p className="text-xl text-surface-300 leading-relaxed max-w-3xl mx-auto mb-12">
              Open TMS ships with a full WMS in the box. Receiving, putaway, inventory, wave-based picking, packing, load planning, and returns all run against the same shipments, orders, and customers you already manage. No separate licence. No master-data sync.
            </p>
          </AnimateIn>

          <AnimateIn animation="scale-up" delay={350}>
            <div className="glow max-w-xs sm:max-w-sm md:max-w-md lg:max-w-lg mx-auto" style={{ display: 'inline-block', borderRadius: '2rem', padding: '4px' }}>
              <WarehousePreview />
            </div>
          </AnimateIn>
        </div>
      </section>

      {/* Problems we solve - broader than launch */}
      <section className="pb-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <AnimateIn animation="fade-up">
            <h2 className="text-3xl font-bold text-white mb-4 text-center">Problems we solve</h2>
            <p className="text-surface-400 text-center max-w-2xl mx-auto mb-12">
              Operational pain we hear over and over. Every capability below solves at least one of these.
            </p>
          </AnimateIn>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(12, 1fr)',
              gap: '1.5rem',
              alignItems: 'start',
            }}
          >
            {/* Card 1 - larger, top-left */}
            <AnimateIn animation="fade-up" delay={100} className="col-span-12 lg:col-span-7">
              <div className="feature-card glass-card rounded-2xl p-8 lg:p-10 h-full" style={{ borderLeft: `3px solid ${topProblems[0].color}` }}>
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl mb-4" style={{ backgroundColor: `${topProblems[0].color}20`, color: topProblems[0].color }}>
                  {topProblems[0].icon}
                </div>
                <p className="text-surface-400 text-sm italic mb-3">&ldquo;{topProblems[0].problem}&rdquo;</p>
                <h3 className="text-xl font-bold text-white mb-3">{topProblems[0].solution}</h3>
                <p className="text-surface-300 leading-relaxed">{topProblems[0].description}</p>
              </div>
            </AnimateIn>

            {/* Card 2 - smaller, top-right */}
            <AnimateIn animation="fade-up" delay={200} className="col-span-12 lg:col-span-5">
              <div className="feature-card glass-card rounded-2xl p-8 h-full" style={{ borderLeft: `3px solid ${topProblems[1].color}` }}>
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl mb-4" style={{ backgroundColor: `${topProblems[1].color}20`, color: topProblems[1].color }}>
                  {topProblems[1].icon}
                </div>
                <p className="text-surface-400 text-sm italic mb-3">&ldquo;{topProblems[1].problem}&rdquo;</p>
                <h3 className="text-xl font-bold text-white mb-3">{topProblems[1].solution}</h3>
                <p className="text-surface-300 leading-relaxed">{topProblems[1].description}</p>
              </div>
            </AnimateIn>

            {/* Card 3 - smaller, bottom-left */}
            <AnimateIn animation="fade-up" delay={300} className="col-span-12 lg:col-span-5">
              <div className="feature-card glass-card rounded-2xl p-8 h-full" style={{ borderLeft: `3px solid ${topProblems[2].color}` }}>
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl mb-4" style={{ backgroundColor: `${topProblems[2].color}20`, color: topProblems[2].color }}>
                  {topProblems[2].icon}
                </div>
                <p className="text-surface-400 text-sm italic mb-3">&ldquo;{topProblems[2].problem}&rdquo;</p>
                <h3 className="text-xl font-bold text-white mb-3">{topProblems[2].solution}</h3>
                <p className="text-surface-300 leading-relaxed">{topProblems[2].description}</p>
              </div>
            </AnimateIn>

            {/* Card 4 - larger, bottom-right */}
            <AnimateIn animation="fade-up" delay={400} className="col-span-12 lg:col-span-7">
              <div className="feature-card glass-card rounded-2xl p-8 lg:p-10 h-full" style={{ borderLeft: `3px solid ${topProblems[3].color}` }}>
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl mb-4" style={{ backgroundColor: `${topProblems[3].color}20`, color: topProblems[3].color }}>
                  {topProblems[3].icon}
                </div>
                <p className="text-surface-400 text-sm italic mb-3">&ldquo;{topProblems[3].problem}&rdquo;</p>
                <h3 className="text-xl font-bold text-white mb-3">{topProblems[3].solution}</h3>
                <p className="text-surface-300 leading-relaxed">{topProblems[3].description}</p>
              </div>
            </AnimateIn>
          </div>
        </div>
      </section>

      {/* Grouped capability sections */}
      {sections.map((section, sIdx) => (
        <section key={section.badge} className="pb-24" id={section.badge.toLowerCase().replace(/[^a-z]/g, '-')}>
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <AnimateIn animation="fade-up">
              <div className="text-center mb-4">
                <div className="inline-flex items-center gap-2 rounded-full border border-indigo-500/20 bg-indigo-500/10 px-4 py-1.5 mb-6">
                  <span className="text-sm font-medium text-indigo-400">{section.badge}</span>
                </div>
                <h2 style={{ fontSize: 'clamp(2rem, 4vw, 3rem)', fontWeight: 800, lineHeight: 1.1 }}>
                  <span className="text-white">{section.headline}</span>{' '}
                  <span className="gradient-text">{section.headlineAccent}</span>
                </h2>
              </div>
            </AnimateIn>

            <AnimateIn animation="fade-up" delay={100}>
              <div className="grid md:grid-cols-2 gap-6 max-w-5xl mx-auto mb-12">
                <div className="glass-card p-6" style={{ borderLeft: '3px solid rgba(239,68,68,0.6)' }}>
                  <div className="text-xs uppercase tracking-wider text-red-400 font-semibold mb-2">The pain</div>
                  <p className="text-surface-300 leading-relaxed">{section.pain}</p>
                </div>
                <div className="glass-card p-6" style={{ borderLeft: '3px solid rgba(16,185,129,0.6)' }}>
                  <div className="text-xs uppercase tracking-wider text-green-400 font-semibold mb-2">How we solve it</div>
                  <p className="text-surface-300 leading-relaxed">{section.solution}</p>
                </div>
              </div>
            </AnimateIn>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {section.capabilities.map((cap, i) => (
                <AnimateIn key={cap.title} animation="fade-up" delay={(sIdx * 50) + (i * 100)}>
                  <div className="glass-card p-6 h-full">
                    <div className="flex items-center gap-3 mb-3">
                      <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'linear-gradient(135deg, rgba(99,102,241,0.3), rgba(99,102,241,0.1))', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <svg className="h-5 w-5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d={cap.icon} />
                        </svg>
                      </div>
                      <h3 className="text-white font-semibold">{cap.title}</h3>
                    </div>
                    <p className="text-surface-400 text-sm leading-relaxed">{cap.desc}</p>
                  </div>
                </AnimateIn>
              ))}
            </div>
          </div>
        </section>
      ))}

      {/* Test coverage callout */}
      <section className="pb-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <AnimateIn animation="fade-up">
            <div className="glass-card p-8 text-center max-w-3xl mx-auto">
              <div className="text-5xl font-bold gradient-text mb-3">348+</div>
              <p className="text-white font-semibold mb-1">Tests across the warehouse goods flow</p>
              <p className="text-surface-400 text-sm">
                Command handlers, service layers, event handlers, and workers. Every verdict boundary, every UN hazmat segregation rule, every backoff calculation. The WMS ships with the same test rigor as the rest of the platform.
              </p>
            </div>
          </AnimateIn>
        </div>
      </section>

      {/* Pull quote */}
      <section className="pb-24">
        <AnimateIn animation="fade-up">
          <div
            className="glass-card"
            style={{
              padding: '4rem 2rem',
              textAlign: 'center',
              borderRadius: 0,
              borderLeft: 'none',
              borderRight: 'none',
              background: 'linear-gradient(135deg, rgba(255,255,255,0.03), rgba(245,158,11,0.05))',
              backdropFilter: 'blur(20px)',
            }}
          >
            <div className="mx-auto max-w-4xl">
              <svg className="h-10 w-10 mx-auto mb-6 text-amber-500/40" fill="currentColor" viewBox="0 0 24 24">
                <path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10H14.017zM0 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151C7.546 6.068 5.983 8.789 5.983 11h4v10H0z" />
              </svg>
              <blockquote
                style={{
                  fontSize: 'clamp(1.5rem, 3vw, 2.25rem)',
                  fontWeight: 700,
                  lineHeight: 1.3,
                  color: 'white',
                  fontStyle: 'italic',
                }}
              >
                Catch problems at the dock,
                <br />
                <span className="gradient-text">not at delivery.</span>
              </blockquote>
            </div>
          </div>
        </AnimateIn>
      </section>

      {/* MissingFeature */}
      <section className="pb-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <MissingFeature />
        </div>
      </section>

      {/* CTA */}
      <section className="pb-32">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a
                href="https://github.com/dominicfinn/open_tms#-quick-start"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary-600 px-8 py-4 text-lg font-semibold text-white shadow-lg shadow-primary-600/25 transition-all hover:bg-primary-500 hover:-translate-y-0.5"
              >
                Deploy Now
              </a>
              <Link
                to="/features/operations"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-8 py-4 text-lg font-semibold text-white transition-all hover:bg-white/10 hover:-translate-y-0.5"
              >
                Explore Operations
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
