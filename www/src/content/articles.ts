export interface Article {
  slug: string
  title: string
  excerpt: string
  date: string
  author: string
  category: 'engineering' | 'product' | 'guides' | 'announcements'
  readTime: string
  content: string
}

export const articles: Article[] = [
  {
    slug: 'why-open-source-tms',
    title: 'Why We Built an Open Source TMS',
    excerpt: 'Enterprise transportation management software costs tens of thousands per year. We believe logistics teams deserve better — enterprise-grade tools without enterprise-grade bills.',
    date: '2026-04-10',
    author: 'Dominic Finn',
    category: 'announcements',
    readTime: '5 min read',
    content: `
## The Problem with Commercial TMS

The logistics industry has a software problem. Enterprise TMS platforms — the kind with proper EDI integration, carrier tendering, and compliance features — typically cost $500 to $5,000+ per user per month. For a mid-size 3PL with 20 dispatchers, that's $120,000 to $1.2M annually just for software licenses.

Meanwhile, the underlying technology isn't particularly exotic. Order management, shipment tracking, carrier communication — these are well-understood domains. The complexity is in the integration, not the concept.

## Why Open Source?

Open TMS exists because we believe:

1. **Logistics software shouldn't be a profit centre for vendors.** Your software costs should be infrastructure (hosting, database) — not per-seat licensing.

2. **You should own your data pipeline.** With a CQRS event architecture, every state change in Open TMS is an immutable event. Export it, pipe it to your data warehouse, train ML models on it. It's your data.

3. **Integrations shouldn't be gated features.** EDI 850, 856, 204, 990, 214, 997 support is included. IoT tracking is included. Cold chain compliance is included. These aren't premium add-ons.

4. **Transparency builds trust.** Read every line of code. Audit every database query. Understand exactly what happens when a shipment status changes.

## What Makes Open TMS Different

This isn't a toy project or a proof of concept. Open TMS ships with:

- **87+ database models** covering the full logistics domain
- **20+ CQRS command handlers** with immutable event sourcing
- **Full EDI suite** (850, 856, 204, 990, 214, 997) with SFTP auto-collection
- **Carrier tendering** with broadcast and waterfall strategies
- **A dedicated carrier portal** with bid submission and history
- **Cold chain compliance** with CFR 21 Part 11 immutable logging
- **IoT integration** — GPS, temperature, humidity, shock, door sensors
- **Traffic-aware ETA monitoring** via TomTom, HERE, or Valhalla
- **Cargo reconciliation** at the pallet/tote level with misdrop detection

## The Business Model

Open TMS is MIT licensed and free forever. It's an independent open source project maintained by Dominic Finn and the community.

The software itself? Always free.

## Getting Started

\`\`\`bash
git clone https://github.com/dominicfinn/open_tms.git
cd open_tms
npm install && ./run.sh
\`\`\`

That's it. Docker Compose brings up PostgreSQL, the backend starts with migrations applied, and the frontend dev server launches. Visit localhost:5173 and you're running a full TMS.
    `,
  },
  {
    slug: 'cqrs-event-architecture-logistics',
    title: 'CQRS & Event Sourcing in Logistics Software',
    excerpt: 'How we designed Open TMS with Command/Query Responsibility Segregation and immutable domain events — and why it matters for supply chain operations.',
    date: '2026-04-08',
    author: 'Dominic Finn',
    category: 'engineering',
    readTime: '8 min read',
    content: `
## Why CQRS for a TMS?

Transportation management is fundamentally an event-driven domain. A shipment doesn't just "change status" — it goes through a series of discrete events: picked up, departed origin, arrived at stop, delayed by traffic, temperature excursion detected, delivered.

Traditional CRUD applications lose this history. They store the current state but not how you got there. For logistics — where audit trails, compliance, and analytics matter — that's a problem.

## Our Architecture

Open TMS uses a CQRS pattern with event sourcing (lite):

### Write Side (Commands)

Every state change goes through a command handler:

\`\`\`
Route (HTTP) → Validate (Zod) → CommandBus.dispatch()
                                      ↓
                               BaseCommandHandler
                               (Prisma $transaction)
                                      ↓
                                 emit(events)
                                      ↓
                                Commit + Publish
\`\`\`

Commands execute inside database transactions. Events are collected during execution and published AFTER the transaction commits — no partial event emission on rollback.

### Read Side (Projections)

Six denormalized read models are maintained by projection handlers:

- **OrderReadModel** — customerName, originCity, destinationCity, status
- **ShipmentReadModel** — carrierName, currentLat/Lng, orderCount, stopCount
- **CarrierReadModel** — vehicleCount, driverCount, activeLaneCount
- **CustomerReadModel** — activeOrderCount, totalOrderCount
- **LaneReadModel** — originName, destinationName, carrierCount
- **IssueReadModel** — assigneeName, escalatedTo, resolvedAt

These are flat tables. List queries hit read models with zero JOINs. Fast, simple, and cache-friendly.

## Why This Matters for Operations

### Audit Trail
Every state change is recorded in the immutable DomainEventLog. When a regulator asks "who changed this shipment's temperature disposition and when?" — the answer is in the event store.

### Analytics Pipeline
The event export API gives you cursor-paginated access to every domain event. Pipe it to your data warehouse for operational analytics, ML-driven ETA prediction, or carrier performance scoring.

### Resilient Integrations
Side effects (email notifications, EDI delivery, tracking registration) run in separate worker processes via pg-boss queues. If an email provider is down, the shipment still gets created — the notification retries with exponential backoff.

### Eventual Consistency
Read models are eventually consistent — there's a brief lag between command execution and projection update. For a TMS (where users refresh dashboards, not millisecond-sensitive trading), this tradeoff is perfect. You get fast writes AND fast reads.

## Getting Started with the Architecture

See the [Domain Behaviours documentation](https://github.com/dominicfinn/open_tms/blob/main/docs/DOMAIN_BEHAVIOURS.md) for the complete reference of commands, events, and side effects per entity.
    `,
  },
  {
    slug: 'cold-chain-compliance-open-tms',
    title: 'Cold Chain Compliance with Open TMS',
    excerpt: 'How Open TMS handles pharmaceutical and food-grade cold chain requirements — including CFR 21 Part 11 compliance, immutable temperature logging, and automatic excursion management.',
    date: '2026-04-05',
    author: 'Dominic Finn',
    category: 'guides',
    readTime: '6 min read',
    content: `
## The Cold Chain Challenge

Pharmaceutical logistics operates under strict regulatory requirements. CFR 21 Part 11 mandates that electronic records must be tamper-evident, attributed to specific individuals, and maintained with full audit trails.

Most TMS platforms treat cold chain as a premium add-on. Open TMS includes it as a core feature.

## How It Works

### Temperature Profiles

Create cold chain profiles defining acceptable ranges:

- **Target temperature range** (e.g., 2-8°C for vaccines)
- **Alert range** (when to start watching)
- **Humidity thresholds** (if applicable)

Profiles are assigned to shipments based on product or customer requirements.

### Immutable Logging

Every temperature reading is stored with:
- Timestamp
- Device ID and calibration status
- SHA-256 integrity hash
- Actor attribution

The integrity hash chains readings together. If any record is modified, the hash chain breaks — providing tamper evidence for regulatory audits.

### Excursion Management

When a reading falls outside the acceptable range:

1. **Detection** — The system identifies the excursion immediately
2. **Triage** — An issue is auto-created in the Quality Centre with critical priority
3. **Disposition** — The shipment's cold chain status moves to "pending review"
4. **Resolution** — Quality team decides: release the shipment or quarantine it

### Compliance Reports

When a shipment is delivered, Open TMS automatically generates a compliance report PDF containing:
- Complete temperature timeline
- Any excursions with duration and severity
- Device calibration status at time of monitoring
- Custody chain (which devices were assigned when)

## Device Calibration Tracking

The system tracks calibration status for every IoT device:
- Calibration certificate reference
- Calibration date and expiry
- Device accuracy within range

Readings from uncalibrated devices are flagged in compliance reports.

## CAPA Integration

For organisations with quality management requirements, the CAPA (Corrective and Preventive Action) module links issues to root cause analysis and preventive measures. The full lifecycle is tracked: draft → submitted → under review → approved → verified → closed.

## Getting Started

1. Create a cold chain profile in Admin → Cold Chain Profiles
2. Assign the profile to a shipment
3. Connect IoT sensors (System Loco devices work out of the box)
4. Temperature readings flow in automatically
5. Excursions are detected and triaged in real-time

No additional configuration or premium licenses required.
    `,
  },
  {
    slug: 'pallet-level-tracking-digital-twins',
    title: 'Pallet-Level Tracking & Digital Twins',
    excerpt: 'Track cargo at the pallet and tote level — not just the shipment. How Open TMS enables granular visibility with IoT device pairing and cargo scan reconciliation.',
    date: '2026-04-01',
    author: 'Dominic Finn',
    category: 'product',
    readTime: '5 min read',
    content: `
## Beyond Shipment-Level Tracking

Most TMS platforms track at the shipment level: "Shipment X is at Location Y." But supply chain operations need more granularity. When a truck carries 24 pallets for 3 different customers across 5 stops, knowing the truck's location isn't enough.

Open TMS tracks at the **trackable unit** level — pallets, totes, boxes, bags, or any container type your operation uses.

## How It Works

### Trackable Units on Orders

Every order can contain trackable units:
- Pallet of pharmaceuticals (temperature-sensitive)
- Tote of electronics (shock-sensitive)
- Box of documents (standard)

Each unit gets a unique barcode and can be individually assigned to an IoT device.

### Device Pairing

Using the Warehouse Launch App, floor staff scan barcodes to pair:
- **IoT devices → Shipments** (GPS tracking for the truck)
- **IoT devices → Trackable Units** (sensor data for individual pallets)

This creates a digital twin — a digital representation of each physical unit with real-time sensor data attached.

### Cargo Manifest & Reconciliation

At each stop, the system knows:
- **Expected cargo** — which units should be loaded/unloaded
- **Actual scans** — what was actually scanned (barcode, RFID, manual, geofence, or IoT)
- **Discrepancies** — missing units, unexpected units, misdropped cargo

### Misdrop Detection

If a pallet is scanned at the wrong stop (loaded onto a truck going to the wrong location), the system flags it immediately. This is one of the most expensive errors in logistics — catching it at the loading dock saves thousands in re-delivery costs.

## The Warehouse App Flow

1. **Select shipment** to launch
2. **Scan IoT devices** (GPS trackers, temperature sensors)
3. **Attach accessories** (door seals, BLE beacons)
4. **Pair units to devices** (which pallet gets which sensor)
5. **Pre-flight check** — resolve any flags before dispatch
6. **Launch** — shipment status moves to in-transit

The whole flow works on mobile with barcode camera scanning. No desktop required.

## Why This Matters

- **Pharmaceutical compliance** — prove each pallet maintained cold chain independently
- **Multi-customer loads** — track which customer's cargo was delivered where
- **Loss prevention** — know immediately when cargo is at the wrong location
- **Insurance claims** — granular proof of custody and condition

## Coming Soon: Digital Twin App

We're building a dedicated app for associating digital twins at the pallet/unit level. This will provide:
- Real-time sensor dashboard per unit
- Historical timeline with all events
- Condition alerts (temperature, shock, humidity)
- QR code scanning for instant unit lookup
    `,
  },
  {
    slug: 'carrier-tendering-guide',
    title: 'Carrier Tendering: Broadcast vs Waterfall',
    excerpt: 'A guide to Open TMS carrier tendering strategies — when to use broadcast tenders, when to use waterfall, and how the carrier portal enables real-time bid submission.',
    date: '2026-03-28',
    author: 'Dominic Finn',
    category: 'guides',
    readTime: '4 min read',
    content: `
## Two Tendering Strategies

Open TMS supports two carrier tendering strategies, each suited to different operational scenarios.

### Broadcast Tendering

All selected carriers are notified simultaneously. They submit bids (rate + transit time + equipment type) and you compare them side by side.

**Best for:**
- Spot market loads where you want the best rate
- Lanes without contract carriers
- High-volume situations where multiple carriers have capacity

### Waterfall Tendering

Carriers are notified one at a time in a pre-defined sequence. If the first carrier declines or doesn't respond within the timeout, it automatically falls to the next carrier.

**Best for:**
- Contract lanes with preferred carrier priority
- Time-sensitive loads where you need a quick yes/no
- Situations where carrier relationship matters more than rate

## The Tender Lifecycle

1. **Draft** — Select the shipment, choose a strategy, pick carriers
2. **Open** — Carriers are notified (via portal, email, or EDI 204)
3. **Evaluating** — Bids come in, you compare them
4. **Awarded** — Winner selected, shipment assigned to carrier
5. **Confirmed** — Carrier acknowledges the load

## The Carrier Portal

Carriers access a dedicated portal to:
- View active tenders with countdown timers
- Submit bids with rate, transit days, and equipment type
- Track bid history (won, lost, pending, expired)
- See their overall win rate
- Manage their profile and credentials

No phone calls. No email chains. Real-time digital tendering.

## EDI Integration

For EDI-capable carriers, the entire flow can happen without portal login:
- Open TMS generates **EDI 204** (Motor Carrier Load Tender)
- Carrier responds with **EDI 990** (accept/decline with rate)
- Bids from EDI 990 responses are automatically added to the tender

This means a carrier can participate in your tenders purely through their existing EDI infrastructure.

## Creating a Tender

The 5-step wizard guides you through:
1. Select the shipment
2. Choose broadcast or waterfall strategy
3. Pick carriers (with drag-and-drop reordering for waterfall sequence)
4. Set parameters (duration, target rate)
5. Review and publish

The whole process takes under 30 seconds.
    `,
  },
  {
    slug: 'why-open-source-logistics-projects-fail',
    title: 'Why Most Open Source Logistics Projects Fail',
    excerpt: 'A group of people get together, form a committee, build a basic website, and then spend all their time on governance instead of shipping features. Here\'s how to actually build something.',
    date: '2026-04-12',
    author: 'Dominic Finn',
    category: 'announcements',
    readTime: '6 min read',
    content: `
## The Pattern

You've seen it before. A group of people in the logistics industry get together and say: "Let's build an open source TMS." There's genuine enthusiasm. They have a few meetings. They set up a GitHub organisation. They build a basic website. They write a charter. They form a technical steering committee.

And then nothing happens.

Not because the people involved aren't talented or passionate. But because they've optimised for the wrong thing. They've built the scaffolding of a project — the governance, the processes, the committee structures — without anyone actually sitting down and building features.

## The Real Problem: Nobody Ships

The uncomfortable truth about early-stage open source is that it doesn't need a committee. It needs one person — or a very small number of people — who are relentlessly focused on shipping working software.

Most open source logistics projects fail because:

- **Too many cooks, not enough cooking.** Five people debating architecture in a Slack channel will lose to one person who just builds something and iterates.
- **Governance before code.** You don't need a contributor agreement, a code of conduct committee, and a release process when you have zero releases.
- **Design by committee.** Every decision requires consensus from people with different priorities, different availability, and different levels of commitment. Progress stalls.
- **No product owner.** Without someone who wakes up every morning thinking about what to build next, the backlog becomes a graveyard of "good ideas we'll get to eventually."

## What Actually Works

At this stage of Open TMS, the project has a single active contributor acting as both product manager and developer. That's not a limitation — it's the strategy.

Here's what that looks like in practice:

### One Person, Wearing Both Hats

The same person who decides "we need carrier tendering with broadcast and waterfall strategies" is the one who implements it. The same person who talks to logistics operators about their pain points is the one who writes the CAPA workflow engine. There's no handoff, no "requirements document" that gets misinterpreted, no three-week delay while a committee reviews the approach.

### AI as a Force Multiplier

This is where modern tooling changes the equation entirely. Tools like Claude don't just write code — they enable a single person to operate at the speed of a small team.

The human contribution is the part that matters most: **thinking about the problem correctly.** What do logistics operators actually need? How should the data model work at scale? Which integrations matter? What are the right technology choices? How do we handle multi-tenancy, compliance, cold chain regulations?

The AI handles the implementation velocity — generating well-structured code, writing tests, building UI components, handling the repetitive parts of software development. But it's guided by someone who understands the domain, makes architectural decisions deliberately, and documents the reasoning as they go.

This isn't "vibe coding." It's product management with an AI development partner.

### Moving Fast, Documenting As We Go

Open TMS ships features fast. The event architecture, the carrier tendering system, the Quality Centre with CAPA investigations, the EDI suite, the IoT integration, the warehouse launch app — these were all built in a matter of weeks, not months.

But speed without documentation is tech debt. Every feature ships with:
- Updated domain behaviour docs
- API schema blocks
- Event type definitions
- Test coverage
- Marketing site updates

The documentation isn't an afterthought — it's part of shipping.

### Taking Feedback From Everywhere

Being a single contributor doesn't mean working in isolation. Feature ideas come from:
- Logistics operators describing their daily pain points
- Compliance officers explaining regulatory requirements
- Carrier partners describing their integration needs
- GitHub issues from people who've deployed and found gaps
- Industry forums where people discuss what they wish their TMS could do

The difference is that feedback gets turned into features quickly, not added to a backlog that gets reviewed quarterly.

## Why This Matters for Logistics

The logistics industry is underserved by open source. There are excellent open source tools for CRM, ERP, e-commerce, project management — but almost nothing for transportation management. The commercial options cost hundreds of thousands per year.

The path to changing that isn't forming a consortium. It's building software that works, shipping it, and letting the community grow around working code rather than around governance.

## The Committee Can Come Later

To be clear: governance matters. Contributor guidelines matter. Community structures matter. But they matter at a different stage. They matter when you have something worth governing — when you have working software that people depend on, when you have multiple active contributors who need coordination.

Trying to build the community infrastructure before you have the software is putting the cart before the horse. Or, since we're in logistics — it's building the dispatch office before you have any trucks.

## You Don't Need to Be a Developer

If you're reading this and you're a logistics professional — a dispatcher, a warehouse manager, a compliance officer, a carrier relations manager — your contribution to this project is potentially more valuable than any code contribution.

You know what features matter. You know which workflows are painful. You know what the regulations actually require. You know what carriers need from a TMS.

Open a GitHub issue. Describe the problem. Tell us what your day looks like and where the software falls short. That's not a small contribution — that's the contribution that determines whether this project builds the right thing.

The code will follow. It always does, when you know what to build.
    `,
  },
]

export function getArticle(slug: string): Article | undefined {
  return articles.find(a => a.slug === slug)
}

export function getArticlesByCategory(category: string): Article[] {
  return articles.filter(a => a.category === category)
}
