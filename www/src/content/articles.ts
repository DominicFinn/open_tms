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
    slug: 'open-logistics-roadmap',
    title: 'The Open Logistics Roadmap',
    excerpt: 'More thoughts about the name, the scope, and what this thing is actually trying to be. Where the project is, where it is going, and why I am pumping the brakes on new functionality.',
    date: '2026-05-07',
    author: 'Dominic Finn',
    category: 'announcements',
    readTime: '6 min read',
    content: `
## The Honest Starting Point

I work on Open TMS as a side project. A few hours here, a few hours there, in between everything else. I will be the first to admit I have meandered. The scope has grown well beyond what I originally set out to build, and at this point the project includes:

- A TMS
- A WMS
- An exception and issue centre
- IoT ingestion with shipment visibility
- A quality centre with follow-ups and CAPA management
- Financial reporting
- A carrier portal
- A customer portal

And more besides. I like all of it. I think most of it is genuinely useful. But I have, very obviously, bitten off more than one person working part-time can chew.

So this article is about where the project actually is, what I think the name should eventually be, and where the next few months go.

## "Open Logistics" Keeps Coming Back

I wrote a separate article about whether the project should keep the name "Open TMS". Short answer: for now, yes. Long answer: the moment the WMS features mature and the platform genuinely spans transportation and warehousing, "TMS" stops describing what this is.

The functionality already in the repo points at something broader. Once you have WMS, exception handling, IoT visibility, financial reporting, quality and CAPA workflows, and carrier and customer portals all under one roof, you are not really running a TMS. You are running a logistics platform.

That is why "Open Logistics" keeps creeping into how I think about the roadmap. Not as a rename today  - that is premature  - but as a direction.

## Short Term: Stop Bashing In Features

The most important thing right now is to stop adding new things and get the existing ones into a state where someone can actually run them in production.

I work with a tester who will be helping with this once he wraps up another project. The plan is straightforward: manual testing of the full flows, then locking that knowledge in with automated test coverage. I want every behaviour and scenario covered  - not just unit tests around individual handlers, but the end-to-end flows that match what an operator actually does day to day. A lot of the scenarios are documented already. The gap is in turning that documentation into a verified, repeatable test suite.

This is the unglamorous part. It is also the part that decides whether this becomes a project people use or a project people fork and abandon.

## Medium Term: Assets, Digital Twins, ERP

Once the foundations are solid, the part of the roadmap I am most excited about is asset management and digital twins.

The idea is this: cartonised goods with BLE labels become assets in the system. Once they are assets, they have state  - location, custody, condition, ownership. That state can move with them through the WMS, into an ERP layer, and right out into the visibility functionality on shipment.

This is really about state management. A pallet at rest in a warehouse and the same pallet on a truck should not be two different records in two different systems. They should be the same asset, with the same identity, observed by different parts of the platform at different points in time. BLE labels are the practical bridge between the warehouse view of the world and the in-transit view.

The ERP angle is interesting too. I am not going to replace SAP. Nobody is. But there is a real gap for small and medium-sized businesses who need basic ERP functionality without the SAP price tag and complexity. If Open Logistics can offer a basic ERP layer that integrates naturally with the TMS and WMS already in the codebase, that is a useful thing to exist.

The other medium-term thought is whether the actual shipments work belongs inside this codebase at all, or whether it should be pushed out into an API service that abstracts shipment management. System Loco is one option for that integration. There may be others. The point is: the shipment domain is well-defined enough that it could live behind an API and let the rest of the platform focus on orchestration rather than re-implementing the same primitives over and over.

## Long Term: Performance, and Maybe a Different Backend

Long term, I think about backend performance. The current Fastify and TypeScript stack is fine. It is productive, it is familiar, and it is not the bottleneck today. But at some scale, and for the kind of event-driven, concurrent workloads that logistics platforms generate, something like Elixir starts to look attractive.

Honestly, part of the appeal is that Elixir has been on my "languages I want to learn properly" list for a long time. That is not a good reason to rewrite a working backend. So I am holding off. If and when there is a real performance ceiling we hit on the current stack, that is the moment to evaluate alternatives properly  - not before.

## The Real Question

Underneath all of this is a question I keep circling. What is Open TMS actually trying to be?

The most honest answer I have is: an open source platform that does the boring, expensive, vendor-locked parts of logistics software well, and gives them away. TMS, WMS, visibility, financial reporting, carrier and customer portals, exception and quality management. The stuff that costs hundreds of thousands a year in commercial licenses.

If the platform keeps growing in that direction  - and I think it will  - the name will have to grow too. "Open TMS" describes the entry point. "Open Logistics" describes the destination. I am not in a hurry to make that change, but I am not pretending it is not coming either.

For now: less new functionality, more testing, more reliability. The roadmap is mostly about not getting distracted.
    `,
  },
  {
    slug: 'why-open-source-tms',
    title: 'Why We Built an Open Source TMS',
    excerpt: 'TMS software costs a fortune and most of it isn\'t even that complex under the hood. So I built one and open sourced it.',
    date: '2026-04-10',
    author: 'Dominic Finn',
    category: 'announcements',
    readTime: '5 min read',
    content: `
## The Pricing Problem

Here's what annoys me about TMS software. The commercial platforms - the ones with proper EDI, carrier tendering, and cold chain compliance - charge $500 to $5,000+ per user per month. A mid-size 3PL with 20 dispatchers is looking at $120K to $1.2M a year. Just for software licenses.

And the thing is, the technology underneath isn't magic. Order management, shipment tracking, carrier communication - these are well-understood problems. The complexity is in wiring it all together, not in any individual piece being particularly hard.

So why does it cost so much? Because the vendors can charge it. There's no credible open source alternative, so you either pay or you build your own from scratch. Most people pay.

## Why I Open Sourced It

I wanted to prove you could build a proper TMS - not a toy, not a demo, a real one with EDI and tendering and compliance features - and give it away.

The thinking is pretty simple:

Your software costs should be hosting and database, not per-seat licensing. EDI support, IoT tracking, cold chain compliance - these shouldn't be premium add-ons you unlock at a higher tier. And you should be able to read the source code of the software running your logistics operation. Audit the database queries. Understand exactly what happens when a shipment status changes.

## What's Actually In Here

This isn't a proof of concept. It's a working TMS with 87+ database models, 20+ CQRS command handlers, a full EDI suite (850, 856, 204, 990, 214, 997), carrier tendering with broadcast and waterfall strategies, a dedicated carrier portal, cold chain compliance with CFR 21 Part 11 logging, IoT integration for GPS and temperature and humidity sensors, traffic-aware ETA monitoring, and cargo reconciliation at the pallet level.

It's a lot. And it's all MIT licensed. No catch.

## Getting Started

\`\`\`bash
git clone https://github.com/dominicfinn/open_tms.git
cd open_tms
npm install && ./run.sh
\`\`\`

Docker Compose brings up PostgreSQL, the backend starts with migrations applied, and the frontend dev server launches. Visit localhost:5173 and you're running a full TMS. That's genuinely it.
    `,
  },
  {
    slug: 'cqrs-event-architecture-logistics',
    title: 'CQRS & Event Sourcing in Logistics Software',
    excerpt: 'How we designed Open TMS with Command/Query Responsibility Segregation and immutable domain events  - and why it matters for supply chain operations.',
    date: '2026-04-08',
    author: 'Dominic Finn',
    category: 'engineering',
    readTime: '8 min read',
    content: `
## Why CQRS for a TMS?

Transportation management is fundamentally an event-driven domain. A shipment doesn't just "change status"  - it goes through a series of discrete events: picked up, departed origin, arrived at stop, delayed by traffic, temperature excursion detected, delivered.

Traditional CRUD applications lose this history. They store the current state but not how you got there. For logistics  - where audit trails, compliance, and analytics matter  - that's a problem.

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

Commands execute inside database transactions. Events are collected during execution and published AFTER the transaction commits  - no partial event emission on rollback.

### Read Side (Projections)

Six denormalized read models are maintained by projection handlers:

- **OrderReadModel**  - customerName, originCity, destinationCity, status
- **ShipmentReadModel**  - carrierName, currentLat/Lng, orderCount, stopCount
- **CarrierReadModel**  - vehicleCount, driverCount, activeLaneCount
- **CustomerReadModel**  - activeOrderCount, totalOrderCount
- **LaneReadModel**  - originName, destinationName, carrierCount
- **IssueReadModel**  - assigneeName, escalatedTo, resolvedAt

These are flat tables. List queries hit read models with zero JOINs. Fast, simple, and cache-friendly.

## Why This Matters for Operations

### Audit Trail
Every state change is recorded in the immutable DomainEventLog. When a regulator asks "who changed this shipment's temperature disposition and when?"  - the answer is in the event store.

### Analytics Pipeline
The event export API gives you cursor-paginated access to every domain event. Pipe it to your data warehouse for operational analytics, ML-driven ETA prediction, or carrier performance scoring.

### Resilient Integrations
Side effects (email notifications, EDI delivery, tracking registration) run in separate worker processes via pg-boss queues. If an email provider is down, the shipment still gets created  - the notification retries with exponential backoff.

### Eventual Consistency
Read models are eventually consistent  - there's a brief lag between command execution and projection update. For a TMS (where users refresh dashboards, not millisecond-sensitive trading), this tradeoff is perfect. You get fast writes AND fast reads.

## Getting Started with the Architecture

See the [Domain Behaviours documentation](https://github.com/dominicfinn/open_tms/blob/main/docs/DOMAIN_BEHAVIOURS.md) for the complete reference of commands, events, and side effects per entity.
    `,
  },
  {
    slug: 'cold-chain-compliance-open-tms',
    title: 'Cold Chain Compliance with Open TMS',
    excerpt: 'Cold chain compliance in most TMS platforms is either a paid add-on or doesn\'t exist. We built it in from day one.',
    date: '2026-04-05',
    author: 'Dominic Finn',
    category: 'guides',
    readTime: '6 min read',
    content: `
## Why This Matters

If you're shipping pharmaceuticals or temperature-sensitive food products, you're dealing with CFR 21 Part 11. That means your electronic records need to be tamper-evident, attributed to specific people, and kept with full audit trails. It's not optional and getting it wrong is expensive.

Most TMS platforms either don't handle this at all, or they charge you extra for a bolt-on module. Open TMS includes cold chain compliance as a core feature. It's not an add-on. It's just there.

## Temperature Profiles

You set up a profile that defines what's acceptable - target temperature range (say 2-8°C for vaccines), alert thresholds, humidity limits if relevant. Assign the profile to a shipment and the system watches it automatically.

## The Logging Bit

This is where it gets important for compliance. Every single temperature reading gets stored with a timestamp, the device ID, its calibration status, and a SHA-256 integrity hash. The hashes chain together, so if anyone tampers with a record, the chain breaks. That's your tamper evidence for auditors.

It's not fancy technology. It's just done properly.

## What Happens When Something Goes Wrong

When a reading goes out of range:

1. The system catches it immediately
2. A triage issue gets created automatically in the Quality Centre with critical priority
3. The shipment's cold chain status moves to "pending review"
4. Your quality team decides - release it or quarantine it

No one needs to be watching a dashboard. The system handles the detection and alerting. Your team handles the decision.

## Compliance Reports

When a shipment delivers, a compliance report generates automatically. Complete temperature timeline, any excursions with how long they lasted, device calibration status, the full custody chain showing which devices were on which shipment and when. Ready for your auditor without anyone having to compile anything.

## Device Calibration

The system tracks calibration status for every IoT device - certificate references, calibration dates, expiry dates, accuracy ranges. If a device isn't calibrated, its readings get flagged in reports. Because an auditor will ask, and "I think it was calibrated" isn't an answer.

## Connecting to CAPA

When excursions reveal a pattern - say the same carrier keeps having temperature issues on the same lane - you can escalate from triage into a full CAPA investigation in the Quality Centre. Root cause analysis, corrective actions, preventive measures, verification. The whole lifecycle, tracked.

## Getting Set Up

1. Create a cold chain profile in Admin
2. Assign it to a shipment
3. Connect your IoT sensors (System Loco devices work out of the box)
4. Readings flow in, excursions get caught, reports generate themselves

No premium license. No per-feature pricing. It's just part of the platform.
    `,
  },
  {
    slug: 'pallet-level-tracking-digital-twins',
    title: 'Pallet-Level Tracking & Digital Twins',
    excerpt: 'Most TMS platforms tell you where the truck is. That\'s not enough when you\'ve got 24 pallets for 3 customers across 5 stops.',
    date: '2026-04-01',
    author: 'Dominic Finn',
    category: 'product',
    readTime: '5 min read',
    content: `
## The Problem With Shipment-Level Tracking

"Shipment X is at Location Y." Great. But which of the 24 pallets on that truck are for which customer? Did the right pallets get unloaded at stop 3? Is pallet 17 still at the correct temperature?

Most TMS platforms can't answer those questions because they track trucks, not cargo. Open TMS tracks at the unit level - pallets, totes, boxes, whatever your operation uses.

## How It Actually Works

Every order can have trackable units attached to it. A pallet of pharmaceuticals that needs temperature monitoring. A tote of electronics that needs shock detection. Each unit gets a barcode and can be paired with its own IoT device.

The pairing happens in the Warehouse Launch App. Your floor staff scan barcodes to link devices to shipments and devices to individual units. That creates a digital twin - a live digital representation of each physical pallet with real-time sensor data attached to it.

## Cargo Reconciliation

This is where it gets really useful. At each stop, the system knows what should be on the truck, what was actually scanned, and where the discrepancies are. Missing a unit? Flagged. Unexpected unit that shouldn't be there? Flagged. Pallet scanned at the wrong stop? Flagged immediately.

That last one - the misdrop - is one of the most expensive mistakes in logistics. A pallet gets loaded onto the wrong truck and ends up in the wrong city. Catching it at the loading dock instead of after delivery saves thousands.

## The Warehouse Launch Flow

The whole thing runs on mobile. Pick your shipment, scan the IoT devices, pair sensors to pallets, run through the pre-flight checklist, hit launch. Camera barcode scanning, no special hardware needed. The shipment flips to in-transit and monitoring kicks in automatically.

## Why This Matters

For pharma - you can prove each individual pallet maintained cold chain, not just the truck. For multi-customer loads - you know exactly which customer's cargo went where. For loss prevention - you catch misdrops before the truck leaves the dock. For insurance claims - granular proof of custody and condition for every unit.

## What's Coming Next

We're building a dedicated digital twin app for unit-level visibility. Real-time sensor dashboards per unit, full event timelines, condition alerts, and QR code scanning for instant lookup. It's on the roadmap.
    `,
  },
  {
    slug: 'carrier-tendering-guide',
    title: 'Carrier Tendering: Broadcast vs Waterfall',
    excerpt: 'You\'ve got a load that needs covering. Do you blast it to every carrier at once, or work down your preferred list? Here\'s how both strategies work in Open TMS.',
    date: '2026-03-28',
    author: 'Dominic Finn',
    category: 'guides',
    readTime: '4 min read',
    content: `
## The Two Approaches

You've got a shipment that needs a carrier. There are basically two ways to handle this:

**Broadcast** - send it to everyone at once and compare what comes back. All your selected carriers see the load simultaneously, submit their rates, and you pick the best one. This is your spot market play - when you want the best rate and you don't have a preferred carrier for this lane.

**Waterfall** - work down a priority list. Your first-choice carrier gets the offer. If they decline or don't respond before the timeout, it automatically falls to the next one, then the next. This is your contract lane play - when you've got a relationship hierarchy and you want to honour it, but you don't want to waste time chasing people on the phone.

Both strategies are built into Open TMS. You choose which one when you create the tender.

## How a Tender Actually Flows

You draft it - pick the shipment, choose your strategy, select carriers. Open it - carriers get notified through the portal, email, or EDI 204 if they're set up for that. Bids come in. You compare them. Pick a winner. The carrier confirms. Done.

The whole creation process is a 5-step wizard and takes about 30 seconds. Select shipment, choose strategy, pick carriers (drag to reorder for waterfall), set your duration and target rate, review and publish.

## The Carrier Portal

This is one of the features I'm most pleased with. Carriers get their own login to a dedicated portal where they can see active tenders with countdown timers, submit bids, track their history - wins, losses, pending, expired - and see their overall win rate.

No phone calls. No email threads where someone said they'd take it but actually they meant the other load. It's all tracked, all timestamped, all in one place.

## EDI 204/990

For carriers that do EDI, they don't even need to log into the portal. Open TMS generates an EDI 204 (Load Tender), the carrier responds with an EDI 990 (accept or decline with their rate), and that response automatically shows up as a bid in the tender. They participate using their existing EDI setup without changing anything on their end.

This is important because a lot of carriers - especially larger ones - don't want another portal to log into. They want EDI. So they get EDI.
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

Not because the people involved aren't talented or passionate. But because they've optimised for the wrong thing. They've built the scaffolding of a project  - the governance, the processes, the committee structures  - without anyone actually sitting down and building features.

## The Real Problem: Nobody Ships

The uncomfortable truth about early-stage open source is that it doesn't need a committee. It needs one person  - or a very small number of people  - who are relentlessly focused on shipping working software.

Most open source logistics projects fail because:

- **Too many cooks, not enough cooking.** Five people debating architecture in a Slack channel will lose to one person who just builds something and iterates.
- **Governance before code.** You don't need a contributor agreement, a code of conduct committee, and a release process when you have zero releases.
- **Design by committee.** Every decision requires consensus from people with different priorities, different availability, and different levels of commitment. Progress stalls.
- **No product owner.** Without someone who wakes up every morning thinking about what to build next, the backlog becomes a graveyard of "good ideas we'll get to eventually."

## What Actually Works

At this stage of Open TMS, the project has a single active contributor acting as both product manager and developer. That's not a limitation  - it's the strategy.

Here's what that looks like in practice:

### One Person, Wearing Both Hats

The same person who decides "we need carrier tendering with broadcast and waterfall strategies" is the one who implements it. The same person who talks to logistics operators about their pain points is the one who writes the CAPA workflow engine. There's no handoff, no "requirements document" that gets misinterpreted, no three-week delay while a committee reviews the approach.

### AI as a Force Multiplier

This is where modern tooling changes the equation entirely. Tools like Claude don't just write code  - they enable a single person to operate at the speed of a small team.

The human contribution is the part that matters most: **thinking about the problem correctly.** What do logistics operators actually need? How should the data model work at scale? Which integrations matter? What are the right technology choices? How do we handle multi-tenancy, compliance, cold chain regulations?

The AI handles the implementation velocity  - generating well-structured code, writing tests, building UI components, handling the repetitive parts of software development. But it's guided by someone who understands the domain, makes architectural decisions deliberately, and documents the reasoning as they go.

This isn't "vibe coding." It's product management with an AI development partner.

### Moving Fast, Documenting As We Go

Open TMS ships features fast. The event architecture, the carrier tendering system, the Quality Centre with CAPA investigations, the EDI suite, the IoT integration, the warehouse launch app  - these were all built in a matter of weeks, not months.

But speed without documentation is tech debt. Every feature ships with:
- Updated domain behaviour docs
- API schema blocks
- Event type definitions
- Test coverage
- Marketing site updates

The documentation isn't an afterthought  - it's part of shipping.

### Taking Feedback From Everywhere

Being a single contributor doesn't mean working in isolation. Feature ideas come from:
- Logistics operators describing their daily pain points
- Compliance officers explaining regulatory requirements
- Carrier partners describing their integration needs
- GitHub issues from people who've deployed and found gaps
- Industry forums where people discuss what they wish their TMS could do

The difference is that feedback gets turned into features quickly, not added to a backlog that gets reviewed quarterly.

## Why This Matters for Logistics

The logistics industry is underserved by open source. There are excellent open source tools for CRM, ERP, e-commerce, project management  - but almost nothing for transportation management. The commercial options cost hundreds of thousands per year.

The path to changing that isn't forming a consortium. It's building software that works, shipping it, and letting the community grow around working code rather than around governance.

## The Committee Can Come Later

To be clear: governance matters. Contributor guidelines matter. Community structures matter. But they matter at a different stage. They matter when you have something worth governing  - when you have working software that people depend on, when you have multiple active contributors who need coordination.

Trying to build the community infrastructure before you have the software is putting the cart before the horse. Or, since we're in logistics  - it's building the dispatch office before you have any trucks.

## You Don't Need to Be a Developer

If you're reading this and you're a logistics professional  - a dispatcher, a warehouse manager, a compliance officer, a carrier relations manager  - your contribution to this project is potentially more valuable than any code contribution.

You know what features matter. You know which workflows are painful. You know what the regulations actually require. You know what carriers need from a TMS.

Open a GitHub issue. Describe the problem. Tell us what your day looks like and where the software falls short. That's not a small contribution  - that's the contribution that determines whether this project builds the right thing.

The code will follow. It always does, when you know what to build.
    `,
  },
  {
    slug: 'training-content',
    title: 'Training Content: What\'s Coming and Why It\'s Not Here Yet',
    excerpt: 'Open TMS doesn\'t have training videos yet. That\'s deliberate. Here\'s the plan for when it will, and why rushing it would be a waste of everyone\'s time.',
    date: '2026-04-12',
    author: 'Dominic Finn',
    category: 'announcements',
    readTime: '4 min read',
    content: `
## Let's Be Honest

There's no training content for Open TMS right now. No video walkthroughs, no how-to guides with screenshots, no onboarding course. If you're looking at this project and thinking "I'd love to try it but I don't know where to start" - that's a fair reaction, and I know it's a gap.

But here's the thing: creating training content for software that's still changing rapidly is a waste of time. You record a 20-minute walkthrough of the shipment creation flow, then two weeks later the UI gets redesigned and the video is wrong. Now you've got training content that actively misleads people. That's worse than having nothing.

## The Plan

Here's what's actually going to happen, in order:

**1. Keep shipping features.** The roadmap still has important items on it. The core platform needs to be solid before we start telling people how to use it.

**2. Hit a testing phase.** Once the feature set is where I want it, we'll slow down on new features and focus on stability. Bug fixes, edge cases, performance, the boring stuff that makes software actually reliable.

**3. Tag a version.** Something very un-committal like 0.1. Not 1.0 - we're not pretending this is production-ready for everyone. But a tagged release that says "this is a known state you can deploy and test against."

**4. Then - video content.** Once we have a stable version to point at, I'll create proper how-to videos for every major feature. The Operations app, the Triage Centre, the Quality Centre, carrier tendering, EDI setup, IoT configuration, the warehouse launch app. Every feature gets a walkthrough.

## What the Training Content Will Look Like

I'm not going to hire a marketing agency to produce polished corporate training videos with stock music and animated intros. It'll be me, screen recording, walking through each feature the way you'd actually use it.

The format:

- **Feature walkthroughs** - "Here's the Triage Centre. Here's how issues get created automatically. Here's how you drag them between columns. Here's how to escalate to a CAPA investigation."
- **Setup guides** - "Here's how to deploy with Docker. Here's how to configure your first trading partner for EDI. Here's how to connect a System Loco IoT device."
- **Workflow guides** - "Here's how a shipment goes from order creation to delivery, end to end. Here's where the documents generate. Here's what the carrier sees on their portal."

No padding, no filler. Each video covers one thing and covers it properly.

## Why Not Just Write Documentation?

We do have documentation. The API has Swagger docs. There's a domain behaviours reference. There are architecture guides. That stuff exists and it's kept up to date as features ship.

But written docs and video walkthroughs serve different purposes. Docs are great when you know what you're looking for - "how do I configure the ETA monitoring thresholds?" Video is great when you don't know what you don't know - "show me what this thing can actually do."

Both matter. The written docs come first because they're faster to update when things change. The videos come once things stop changing so much.

## In the Meantime

If you want to get started with Open TMS today:

- **Deploy it.** \`docker compose up\` and poke around. The UI is designed to be explorable - you shouldn't need a manual to figure out the basics.
- **Read the domain behaviours doc.** It explains what every command does, what events it emits, and what side effects happen. That's the closest thing to a comprehensive guide right now.
- **Open an issue.** If something is confusing or you can't figure out how to do something, that's useful feedback. It tells me what needs better UX, better docs, or both.

Training content is coming. It's just coming at the right time, not prematurely.
    `,
  },
  {
    slug: 'cap-theorem-iot-scale-logistics',
    title: 'Why Your Shipment Data Can\'t Be Everywhere At Once',
    excerpt: 'CAP theorem, service workers, and what happens when 10,000 IoT devices are all trying to update at the same time. Explained for people who run logistics, not computer science lectures.',
    date: '2026-04-12',
    author: 'Dominic Finn',
    category: 'engineering',
    readTime: '8 min read',
    content: `
## The Problem, In Plain English

You've got a truck with a GPS tracker pinging its location every 30 seconds. You've got a temperature sensor on a pallet reading every 60 seconds. You've got a warehouse scanning barcodes. You've got dispatchers updating shipment statuses. You've got carriers responding to tenders. You've got EDI files landing on an SFTP server.

All of this is happening at the same time. And all of it needs to end up in the same database, consistently, without losing anything.

Now multiply that by hundreds of shipments. Thousands of IoT devices. This is where things get interesting - and where a lot of logistics platforms quietly start dropping data or slowing to a crawl.

## CAP Theorem (Without the Computer Science)

There's a concept in distributed systems called CAP theorem. It says that when you're dealing with data spread across multiple places, you can only guarantee two out of three things:

\`\`\`
        Pick any two:

    Consistency -------- Availability
         \\                  /
          \\                /
           \\              /
            \\            /
         Partition Tolerance
\`\`\`

- **Consistency** - Everyone sees the same data at the same time. When a dispatcher marks a shipment as delivered, everyone sees "delivered" immediately.
- **Availability** - The system always responds. You click something, you get an answer. It never just hangs.
- **Partition Tolerance** - The system keeps working even when parts of the network are unreliable. And networks are always unreliable.

Here's the thing: in the real world, you can't ignore partition tolerance. Networks fail. IoT devices go through tunnels. SFTP servers go down. So the real choice is: do you prioritise consistency or availability?

## What This Means for Logistics Software

Most of the time in a TMS, you want availability. If a dispatcher is trying to assign a carrier and the IoT data pipeline is backed up, the dispatch screen should still work. You don't want the whole application to freeze because a temperature sensor in Nebraska can't reach the server.

But you also can't just throw away consistency entirely. If two people award the same tender to different carriers at the same moment, that's a real problem.

So you make different choices for different parts of the system:

\`\`\`
  High Consistency (can't get this wrong)
  ========================================
  - Tender awards
  - Shipment status transitions
  - Financial data (rates, invoices)
  - Cold chain disposition decisions

  Eventual Consistency (a few seconds delay is fine)
  ========================================
  - GPS location updates
  - Temperature readings
  - Dashboard metrics
  - Read model projections
  - Notification delivery
\`\`\`

This is why Open TMS uses CQRS - Command Query Responsibility Segregation. The write side (commands) is strongly consistent. When you award a tender, that happens inside a database transaction. It either works or it doesn't. No half-states.

The read side (dashboards, lists, reports) is eventually consistent. There's a brief lag - maybe a second or two - between a command executing and the read models updating. For a logistics dashboard that people refresh every few minutes, that's completely fine.

## The IoT Scale Problem

Here's where it gets properly challenging. Let's use realistic reporting intervals. A GPS tracker reporting every 5 minutes generates 288 data points per day. A temperature sensor reporting every 15 minutes adds another 96. That sounds manageable per device.

But think about the fleet sizes. A mid-size cold chain operator might have 5,000 active devices across their shipments in a given month. A larger logistics company could easily have 15,000 or 30,000. These aren't hypothetical numbers - if you're running a few hundred shipments a month and each one has a GPS tracker plus a couple of temperature sensors, you get there fast.

\`\`\`
  Active        GPS           Temp          Total/day    Total/month
  Devices       (every 5m)    (every 15m)
  -------       ----------    -----------   ---------    -----------
  1,000         288,000       96,000        384,000      11.5M
  5,000         1,440,000     480,000       1,920,000    57.6M
  15,000        4,320,000     1,440,000     5,760,000    172.8M
  30,000        8,640,000     2,880,000     11,520,000   345.6M
\`\`\`

At 30,000 devices - which is genuinely realistic for a large 3PL or cold chain operator - you're looking at 345 million data points per month. Even at the "relaxed" 5-minute and 15-minute intervals. Some devices report more frequently than that.

And that's just IoT. It's not the whole picture.

## It's Not Just IoT

IoT devices are the biggest volume source, but they're far from the only thing hammering the system. Think about everything else that's generating data in real time:

- **Carrier webhook updates.** Your carriers are pushing status updates via their APIs. FedEx, XPO, Old Dominion, Schneider - each one sending tracking events, POD confirmations, exception notifications. If you're working with 20 carriers across 500 active shipments, that's thousands of webhook callbacks per day.
- **EDI transactions.** 214 status updates landing on SFTP. 990 tender responses. 997 acknowledgments. Each one needs to be parsed, validated, matched to the right shipment, and processed.
- **ETA recalculations.** Every GPS update potentially triggers a routing API call to TomTom or HERE to recalculate the arrival time. That's not just a database write - it's an outbound API call with its own latency.
- **Triage automation.** Temperature excursion detected? That's not just storing a reading - it's creating an issue, assigning it, potentially sending notifications, updating the shipment's compliance status.
- **Document generation.** Shipment delivered? Generate the compliance report, the breadcrumb PDF, update the read models, close out the tracking.

So your actual data flow looks more like this:

\`\`\`
  Source                    Events/day (500 active shipments)
  ------                    ---------------------------------
  IoT devices (5,000)       1,920,000
  Carrier webhooks          5,000 - 15,000
  EDI transactions          1,000 - 5,000
  ETA recalculations        10,000 - 50,000
  Internal state changes    20,000 - 40,000
  Document generation       500 - 2,000
                            -------------------------
  Total                     ~2,000,000+/day
\`\`\`

The IoT data dominates by volume, but the carrier webhooks and ETA recalculations are often more complex per event. A single carrier webhook might trigger a status update, a read model projection, a notification, and a triage check. That's four operations from one inbound event.

## And Then There Are Agents

This is where it gets really interesting - and where the architecture decisions we're making now will matter most.

AI agents are coming to logistics operations. Not as a vague future concept - this is on the Open TMS roadmap. Agents that can:

- Automatically respond to carrier tender offers based on rate history and lane performance
- Triage exceptions and assign them based on severity, carrier history, and team workload
- Detect patterns across shipments that no human would spot at scale - this carrier always runs late on this lane on Fridays, this temperature profile consistently drifts in the last 2 hours of transit
- Proactively reroute shipments when ETA monitoring detects a delay that will miss a delivery window

Here's the thing about agents: they work at machine speed, not human speed. A dispatcher might check the triage board every 30 minutes. An agent checks it continuously. A human might review 20 tender bids before lunch. An agent evaluates every bid against historical data the moment it arrives.

That means the system needs to handle not just the inbound data volume, but the processing volume that agents generate. An agent responding to events creates more events - decisions, actions, notifications, state changes. The data flow isn't just inbound anymore. It's a feedback loop:

\`\`\`
  Inbound data -----> Processing -----> Agent decisions
       ^                                      |
       |                                      v
       +--------- New events <----- Agent actions
\`\`\`

If your architecture can't handle the base IoT and webhook volume without choking, it's got no chance once agents are in the mix generating their own event streams on top. That's why the queue-based worker architecture matters so much. The system needs to be able to absorb spikes, process asynchronously, and scale the workers independently of the API layer.

This isn't theoretical. It's the reason we built it this way from the start.

You can't just INSERT each one into a PostgreSQL table synchronously and hope for the best. The database will choke long before you hit those numbers.

## How Open TMS Handles This

### Service Workers

This is where service workers come in, and it's worth understanding why they exist.

A naive approach would be: IoT device sends data, API receives it, API writes to database, API returns success. Simple. But if that database write takes 50ms and you're getting hundreds of requests per second from IoT devices, you've got a bottleneck. The API is spending all its time waiting for database writes instead of accepting new data.

The solution is to separate receiving data from processing it:

\`\`\`
  IoT Device
      |
      v
  API Endpoint -----> Queue (pg-boss)
  (fast - just         |
   accept & queue)     v
                   Worker Process
                   (batch insert,
                    check thresholds,
                    trigger alerts)
\`\`\`

The API endpoint does almost nothing - validates the data, drops it onto a queue, returns 200. Fast. The heavy lifting happens in a background worker process that can:

- Batch-insert readings (100 at a time instead of one at a time)
- Check temperature thresholds and create triage items if needed
- Update ETA calculations
- Trigger notifications for delays

If the worker falls behind, the queue grows, but the API keeps accepting data. Nothing gets lost. The worker catches up when it can.

### Adaptive Polling

Not all data is equally urgent. A shipment that's 12 hours from delivery doesn't need minute-by-minute ETA checks. A shipment that's 30 minutes out does.

Open TMS uses adaptive polling for ETA monitoring:

\`\`\`
  Time to delivery     Check interval
  -----------------    ---------------
  > 8 hours            ~40 minutes
  2-8 hours            ~20 minutes
  < 2 hours            ~10 minutes
  Stale GPS (>60min)   Skip entirely
\`\`\`

This dramatically reduces the number of routing API calls. Instead of checking every shipment every 10 minutes regardless, you focus computational resources on the shipments that are actually close to delivery - where a delay actually matters.

### Data Retention

You don't need sub-second GPS resolution from six months ago. At scale, you need a retention strategy:

\`\`\`
  Age              Resolution        Storage
  ----             ----------        -------
  < 7 days         Full (every ping) Hot (PostgreSQL)
  7-30 days        Downsampled       Warm
  30-180 days      Aggregated        Cold
  > 180 days       Summary only      Archive
\`\`\`

Open TMS currently keeps everything in PostgreSQL, which works fine up to a few hundred devices. For larger deployments, a tiered storage approach is on the roadmap.

## The Network Reality

IoT devices in logistics don't have reliable internet connections. Trucks go through tunnels. Rural areas have patchy coverage. Cellular networks drop. This is just reality.

So the system has to handle gaps gracefully:

- GPS data arrives out of order? Sort by device timestamp, not receive time.
- 30-minute gap in temperature readings? Flag it in the compliance report but don't assume the worst.
- Device goes completely dark? After 60 minutes of no data, skip it for ETA calculations rather than using stale coordinates.

This is partition tolerance in practice. The system keeps working with whatever data it has and reconciles when the missing data eventually arrives.

## Why This Matters To You

If you're running a logistics operation, you probably don't care about CAP theorem as a concept. But you do care about:

- **Will my dashboard show the right data?** Yes, within a second or two of it happening.
- **Will I lose IoT data if there's a spike?** No, it queues and processes when it can.
- **Will the system slow down as I add more devices?** Not with the worker architecture. The API and the processing scale independently.
- **What happens when a device loses signal?** The system handles gaps and catches up when data resumes.

The technical decisions behind all of this exist so that you don't have to think about them. The system just works, even when the network doesn't.
    `,
  },
  {
    slug: 'the-name-open-tms',
    title: 'The Name: Open TMS',
    excerpt: 'There were other projects called OpenTMS before this one. None of them are what you\'d call active. So do we keep the name, or does this project need a different one?',
    date: '2026-04-12',
    author: 'Dominic Finn',
    category: 'announcements',
    readTime: '4 min read',
    content: `
## The Elephant in the Room

If you search for "OpenTMS" you'll find this project isn't the first to use the name. There are at least three others:

**fossabot/open-tms on GitHub** - A Node.js/React TMS aimed at small to medium transport companies. Described itself as "ALPHA DEVELOPMENT" in the repo title. The last meaningful activity was years ago. It never got past the initial scaffolding stage.

**kongko/OpenTMS on GitHub** - A PHP-based Transportation Management System. Also inactive. The repo exists but there's nothing you'd call a working product.

**openTMS on SourceForge** - This one's actually nothing to do with transportation at all. It stands for Open Source Translation Management System, built by the Forum Open Language Tools. Different domain entirely, just an unfortunate naming collision.

There's also **OpenTMS ATMS** by Q-Free, which is a commercial Advanced Traffic Management System for road infrastructure. Again, completely different thing - traffic signals and highway management, not freight logistics.

## Are Any of Them Active?

In short: no. The two transportation-focused projects both stalled at the very early stages. This is exactly the pattern I wrote about in the "Why Most Open Source Logistics Projects Fail" post - initial enthusiasm, a repo gets created, maybe some scaffolding goes in, and then nothing happens. Nobody ships features.

That said, the names exist. The repos are still up on GitHub. It's worth being honest about that.

## So Do We Keep the Name?

I'm genuinely undecided on this. Here's my thinking:

**Arguments for keeping "Open TMS":**

- It describes exactly what this is. Open source. TMS. Done.
- The previous projects are inactive and have been for a long time. Nobody is going to confuse a project with 87 database models and a full EDI suite with an empty repo that has a README and not much else.
- Name recognition matters, and "Open TMS" is intuitive. If someone searches for an open source TMS, they should find this.
- Renaming a project is disruptive - new URLs, new repos, new documentation, confused users.

**Arguments for changing it:**

- There's a legitimate question about namespace collision. Even if the other projects are dead, their repos still exist.
- The scope of this project is growing. WMS features are on the roadmap. Once you're managing warehouses as well as transportation, "TMS" doesn't fully describe what the platform does.
- Something like "Open Logistics" or "OpenFreight" might better capture the ambition of the project as it expands.

## The WMS Question

This is actually the bigger factor in the naming discussion. Right now, Open TMS is a transportation management system. But the warehouse launch app is already blurring that line - it's managing shipment preparation workflows on the warehouse floor. And the roadmap includes proper WMS features: inventory management, pick/pack workflows, receiving, put-away.

At that point, calling it a "TMS" is underselling it. You're running a logistics platform that handles both transportation and warehousing. "TMS" becomes limiting.

Some options I've been thinking about:

- **Open TMS** - keep it, accept that it'll outgrow the name, deal with it later
- **Open Logistics** - broader, but maybe too generic. Also, the Open Logistics Foundation already exists as an industry body in Germany, which could cause confusion
- **OpenFreight** - specific to the domain, not taken by any active project that I can find
- **Something entirely different** - start fresh with a name that doesn't describe the category at all

## Where I'm At Right Now

Honestly? I'm keeping the name for now. The project is still early. Renaming before there's a significant user base is easier than renaming after, but renaming before there's a reason to is just procrastination.

When WMS features land and the platform genuinely spans both domains, that's probably the right time to have this conversation properly. Until then, Open TMS describes what the project does today, and today is what matters.

If you've got strong feelings about this - or a name suggestion that's better than anything I've come up with - open an issue on GitHub. I'm genuinely interested in what people think.
    `,
  },
  {
    slug: 'language-support',
    title: 'Language Support: It\'s Coming, But Not Yet',
    excerpt: 'Open TMS is English-only right now. That needs to change. Here\'s the plan for internationalisation and why it\'s not at the top of the list yet.',
    date: '2026-04-12',
    author: 'Dominic Finn',
    category: 'product',
    readTime: '4 min read',
    content: `
## The Current State

Open TMS is English-only. Every label, every button, every error message, every status name. If you don't read English, you can't use it. That's obviously not acceptable long term for a platform that's supposed to serve the global logistics industry.

I'm being upfront about this because I think it's better to say "we know, it's on the roadmap, here's how we'll do it" than to pretend the problem doesn't exist.

## How It'll Work

This isn't a mystery to solve. Language file based internationalisation is a well-established pattern. I've implemented it before at scale - at UNiDAYS we had extensive multi-language support across the platform and it worked well.

The approach:

Every piece of user-facing text gets replaced with a key that maps to a language file. Instead of hardcoding "Shipment Created" in the UI, the component references something like t('shipment.created'), and the actual string comes from a JSON language file. English gets en.json, French gets fr.json, German gets de.json, and so on.

The language files look something like this:

**en.json:**
"shipment.status.created": "Created",
"shipment.status.in_transit": "In Transit",
"shipment.status.delivered": "Delivered",
"triage.priority.critical": "Critical",
"tender.strategy.broadcast": "Broadcast",
"tender.strategy.waterfall": "Waterfall"

**de.json:**
"shipment.status.created": "Erstellt",
"shipment.status.in_transit": "Unterwegs",
"shipment.status.delivered": "Zugestellt",
"triage.priority.critical": "Kritisch",
"tender.strategy.broadcast": "Rundschreiben",
"tender.strategy.waterfall": "Kaskade"

The UI loads the right file based on user preference. Same components, same code, different text. It's clean and it scales to any number of languages without touching application logic.

## Why It's Not Done Yet

Honestly? Because it adds complexity to every single piece of UI work, and right now the priority is shipping features.

When you internationalise a codebase, every new component needs to use translation keys instead of raw strings. Every form label, every validation message, every tooltip. It's not hard per feature, but it adds friction to everything. And when you're one person trying to ship a carrier tendering system, a quality centre, a warehouse app, and an EDI suite, that friction adds up.

There's also the question of what to translate. It's not just the UI. There are:

- Email notification templates
- Document templates (BOLs, compliance reports)
- EDI transaction descriptions
- Error messages from the API
- The marketing site and documentation

Doing it properly means doing all of it. Doing half of it just creates a weird experience where some things are in your language and some aren't.

## Where It Sits on the Roadmap

I'm going to be honest about priorities. The agentic features - AI-powered triage, automated tender responses, pattern detection across shipments - that's more interesting work and arguably higher impact for early adopters. Language support is important, but it's not what's going to differentiate this platform right now.

The plan is:

1. Ship the remaining core features
2. Build the agent capabilities
3. Then internationalise the platform, probably as a dedicated sprint

When it happens, it'll be done properly. Every string extracted, every component updated, a contribution workflow for community translations. Logistics is global and the software needs to reflect that.

## Contributing Translations

When we do implement language support, this is going to be one of the best ways for non-developers to contribute to the project. If you speak a language that isn't English and you work in logistics, you'll know the correct terminology far better than any automated translation.

"In Transit" doesn't just need translating - it needs translating by someone who knows what logistics companies in that country actually call it. Google Translate won't give you that. A dispatcher in Hamburg will.

If you want to be involved when this happens, open a GitHub issue or just keep an eye on the project. We'll need native speakers who understand logistics terminology, and that's a genuinely valuable contribution.
    `,
  },
  {
    slug: 'multi-tenancy-shared-installations',
    title: 'Multi-Tenancy: One Installation, Many Organisations',
    excerpt: 'Right now, supporting multiple organisations means multiple installations. That works, but it doesn\'t scale for teams managing several orgs centrally. Here\'s what a proper multi-tenant architecture might look like - and why I need your input before building it.',
    date: '2026-04-12',
    author: 'Dominic Finn',
    category: 'product',
    readTime: '6 min read',
    content: `
## How It Works Today

Open TMS already has the concept of an organisation. Every shipment, every order, every carrier, every user - it all belongs to an \`orgId\`. That's how data is segregated. If you're running a single logistics operation, this is fine. One installation, one org, done.

But what if you're running multiple organisations? Maybe you're a 3PL operating different brands. Maybe you're a logistics consultancy managing operations for several clients. Maybe you're an enterprise with regional divisions that each need their own TMS instance with separate customers, carriers, and billing.

Right now, the answer is: you run separate installations. Each org gets its own deployment - its own database, its own backend, its own frontend. The data is completely isolated, which is great for security. But it means the person administering all of this has multiple URLs, multiple logins, multiple sets of infrastructure to maintain. If you've got three organisations, you've got three PostgreSQL databases, three backend processes, three sets of environment variables to manage.

That works. It's simple and it's secure. But it doesn't scale well for centralised teams.

## The Problem

Picture this: you're a small team running logistics operations for five different organisations. Each org has its own customers, its own carriers, its own rate agreements, its own EDI trading partners. They need to be separate - you can't have Org A's customers showing up in Org B's shipment list.

But your operations team works across all five. The same dispatcher might handle exceptions for three different orgs. Your admin needs to configure settings, manage users, and update trading partners across all of them. Your finance team needs to review invoices from multiple orgs.

With separate installations, that team is constantly switching between five different browser tabs, five different logins, five different dashboards. They can't see a unified view of exceptions across all their orgs. They can't compare carrier performance across organisations. Every configuration change needs to be done five times in five places.

This is the kind of friction that's manageable at two organisations and unbearable at ten.

## What Multi-Tenancy Would Look Like

The core idea is a new hierarchical level above the existing organisation. You'd have one installation that supports multiple organisations, with clear boundaries between them.

### Data Segregation

This is non-negotiable. Organisation A must never see Organisation B's data. Not in API responses, not in database queries, not in background workers, not in EDI processing. The existing \`orgId\` pattern already enforces this at the application level - every query is scoped by org. Multi-tenancy would keep that model and add infrastructure around it.

### User Hierarchy

This is where it gets interesting. You'd need at least two levels:

- **Super Admin** - Can see and manage all organisations on the installation. Can switch between orgs, configure system-wide settings, manage billing at the platform level. Think of this as the person running the infrastructure.
- **Org Admin** - Can only see and manage their own organisation. This is the existing admin role, unchanged. They manage users, settings, carriers, and trading partners within their org.

A super admin should be able to impersonate any organisation. Not in a creepy way - in a practical way. If an org admin reports a problem with their EDI configuration, the super admin needs to be able to switch into that org's context and see exactly what they see. Same UI, same data, same permissions - just viewed through that org's lens.

### Organisation-Level Settings

Each organisation already has its own settings in the current system. Multi-tenancy wouldn't change that. What it would add is a platform level above it:

- **Platform settings** - Database connection, deployment config, feature flags that apply to all orgs, platform-wide defaults
- **Organisation settings** - Everything that exists today: theme, EDI config, notification preferences, custom fields, document templates

An org admin only sees their org settings. A super admin sees both levels.

## The Open Questions

Here's where I'm going to be honest: I haven't fully scoped this. There are real architectural questions I don't have answers to yet.

### Cross-Org Operations

Should a super admin be able to see a unified triage board across all organisations? The current Triage Centre shows issues for one org. If you're managing five orgs, you probably want to see all critical issues in one place, sorted by severity, regardless of which org they belong to.

But that raises UX questions. Do you show the org name on every issue? Do you colour-code by org? Can you drag an issue from Org A's board into a different status? What about the automation rules - do they run per-org or can you have platform-wide rules?

Same question applies to the carrier tendering pipeline, the financial dashboards, the ETA monitoring. All of these are currently org-scoped. Making them work across orgs isn't just a backend query change - it's a UX redesign.

### Agent Behaviour

The AI triage agent currently runs per-org with per-org prompt configuration. In a multi-tenant setup, do you want:

- One agent config per org (each org gets its own triage behaviour)?
- One agent config at the platform level (all orgs triaged the same way)?
- Both, with platform defaults that orgs can override?

The answer probably depends on who's operating it. A 3PL running five similar operations might want the same triage rules everywhere. An enterprise with a pharma division and a retail division might need completely different agent behaviour per org.

### Billing and Financial Isolation

Invoices, charges, carrier payments, financial queries - these absolutely must stay org-scoped. But should there be a platform-level financial overview? A super admin dashboard showing AR aging across all orgs, total carrier spend, consolidated margin analysis?

That's useful data for the platform operator, but it means building aggregation layers that span org boundaries. Every financial query today assumes a single orgId. Cross-org aggregation is a different pattern entirely.

### Shared Resources

Some things might genuinely be shared across organisations:

- Carrier definitions (the carrier company itself, not the rate agreements)
- Document templates (maybe a platform default that orgs can customise)
- NMFC freight class tables
- System-wide reference data

Others must never be shared:

- Customer records
- Rate agreements
- EDI trading partner configs
- User accounts (probably - though maybe a super admin account spans orgs?)

Drawing that line correctly matters. Get it wrong and you leak data between orgs. Get it too conservative and you duplicate data unnecessarily.

## Why I'm Writing This Before Building It

I could start building multi-tenancy right now. The \`orgId\` pattern means the backend is already structured for it. The database queries are already scoped. Adding a "switch org" capability for super admins is technically straightforward.

But the hard part isn't the implementation. It's the product decisions. Who operates this? What do they actually need to see across orgs? What should stay isolated? How does the agent system work at platform scale?

These aren't questions I can answer from first principles. They need input from people who'd actually use this - someone running operations for multiple organisations who can say "yes, I need a unified triage view" or "no, each org's triage is completely independent and I don't want them mixed."

## What Would Help

If multi-tenancy is something you'd use, I want to hear from you. Specifically:

- **How many organisations would you run on one installation?** Two? Five? Fifty? The answer changes the architecture significantly.
- **What does your team structure look like?** Is it one team managing all orgs, or separate teams per org with a shared admin layer?
- **What needs to be cross-org?** Triage? Financial reporting? Carrier management? Everything? Nothing?
- **How do your orgs relate to each other?** Are they divisions of the same company? Completely separate clients? Something in between?

Open an issue on GitHub with the "multi-tenancy" label, or comment on the existing discussion thread. This is one of those features where building the wrong thing is worse than building nothing, so I'd rather get it right than get it fast.
    `,
  },
]

export function getArticle(slug: string): Article | undefined {
  return articles.find(a => a.slug === slug)
}

export function getArticlesByCategory(category: string): Article[] {
  return articles.filter(a => a.category === category)
}
