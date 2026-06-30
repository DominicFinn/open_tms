# 🚛 Open TMS

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-20232A?logo=react&logoColor=61DAFB)](https://reactjs.org/)
[![Fastify](https://img.shields.io/badge/Fastify-202020?logo=fastify&logoColor=white)](https://www.fastify.io/)
[![Prisma](https://img.shields.io/badge/Prisma-3982CE?logo=prisma&logoColor=white)](https://www.prisma.io/)

A simple, open-source Transport Management System built with TypeScript, featuring a CQRS event-driven backend, React frontend, and comprehensive domain modelling. Designed for managing shipments, customers, carriers, orders, and operational issues with real-time IoT tracking, EDI integration, and a beautiful interface.

## Important note

This is in active development without a release version yet! When stable I'll tag. 

## Contributing

Open TMS is under active development. We welcome contributions — feature requests, bug reports, code, and documentation improvements are all appreciated.

See the [Contributing Guide](./CONTRIBUTING.md) for details, and the [Roadmap](./roadmap.md) for what's planned.

> **📖 API Docs**: Deploy your own instance and visit `/docs` for full interactive Swagger/OpenAPI documentation.

## Deploy

Deploy your own Open TMS instance with one click:

| Provider | Deploy | What you get |
|----------|--------|--------------|
| **DigitalOcean** | [![Deploy to DO](https://www.deploytodo.com/do-btn-blue.svg)](https://cloud.digitalocean.com/apps/new?repo=https://github.com/dominicfinn/open_tms/tree/main) | App Platform + Managed PostgreSQL |
| **Microsoft Azure** | [![Deploy to Azure](https://aka.ms/deploytoazurebutton)](https://portal.azure.com/#create/Microsoft.Template/uri/https%3A%2F%2Fraw.githubusercontent.com%2Fdominicfinn%2Fopen_tms%2Fmain%2Fazuredeploy.json) | Container Apps + PostgreSQL Flexible Server |
| **Google Cloud** | [![Open in Cloud Shell](https://gstatic.com/cloudssh/images/open-btn.svg)](https://shell.cloud.google.com/cloudshell/editor?cloudshell_git_repo=https://github.com/dominicfinn/open_tms&cloudshell_tutorial=DEPLOYMENT.md) | Cloud Run + Cloud SQL (guided setup) |
| **AWS** | See [`cloudformation.yaml`](./cloudformation.yaml) | ECS Fargate + RDS PostgreSQL + ALB |
| **Docker** | `docker compose up` | Local development stack |

> **AWS note:** Upload `cloudformation.yaml` to an S3 bucket, then use the [Launch Stack](https://console.aws.amazon.com/cloudformation/home#/stacks/new) wizard — or deploy via CLI:
> ```bash
> aws cloudformation create-stack --stack-name open-tms \
>   --template-body file://cloudformation.yaml \
>   --parameters ParameterKey=DBPassword,ParameterValue=YourSecurePassword123 \
>   --capabilities CAPABILITY_IAM
> ```

> **After deployment:** Visit `POST /api/v1/auth/setup` to create your initial admin user, then seed demo data via `POST /api/v1/seed`.

## ✨ Features

### 🎯 Core Functionality
- **Customer Management** - Create, edit, and manage customer information
- **Location Management** - Handle warehouses, distribution centres, cross docks, terminals, and more with facility classification, capabilities tracking, operating hours, and contact details
- **Carrier & Lane Management** - Define carriers, lanes, multi-stop routes, and carrier assignments
- **Order Management** - Full order lifecycle with handling units (pallets, totes, boxes, drums, crates) and line items. Mode-driven required fields (FTL/LTL/parcel, hazmat, international, temperature-controlled), full hazmat detail (UN/class/PG/PSN), customs (HS code, country of origin), temperature range (min/max °C), and derived cartonization (density, suggested freight class, pallet positions, linear feet) computed live as the customer fills the form. Sophisticated shippers can also manually model mixed-SKU pallets via a drag-and-drop handling-unit editor with per-unit weight/dim overrides.
- **Shipment Tracking** - Complete shipment lifecycle management with status tracking
- **Shipment Lifecycle States** - Canonical draft → ready → in_progress → complete workflow. Drafts save with missing fields; a readiness gate (customer, route or lane, carrier, pickup/delivery dates, reference, and shipment-type fields) must pass before a shipment leaves draft. Manual transitions are forward/step-back only and audit-logged with the acting user. Exceptions are tracked as an orthogonal flag. Status is changed from the shipment detail page or bulk-updated from the list
- **Shipment Archive & Soft Delete** - Operational users can archive shipments (recoverable, removed from active lists); admins can soft-delete (hidden everywhere, retained for audit). Both actions are permission-gated and audit-logged
- **Shipment Event Timeline** - Read-only, platform-generated event timeline on each shipment (created, updated, status changed, carrier assigned, exception, delivered, archive/delete, origin/destination/waypoint movements), filterable by event type and date range
- **Order-to-Shipment Conversion** - Combine multiple orders into one shipment, split large orders across multiple shipments, or convert individually with a conversion wizard
- **CSV Import** - Bulk order creation from CSV files with automatic customer/location matching, downloadable CSV template, per-line mode-rules validation (LTL/hazmat/international/temperature-controlled), all-or-nothing per order with row-level error reporting, and a customer-portal upload path scoped to the authenticated customer
- **EDI Communication Hub** - 12 X12 transaction types (850, 856, 204, 990, 997, 214, 210, 810, 820, 180, 940, 945) with unified Trading Partner model, universal inbound endpoint, event-driven outbound (856 on delivery, 810 on invoice, 180 for return authorization, 945 on shipment-delivered for 3PL warehouse shipping advice), 997 auto-ack, SFTP/HTTP delivery, shared X12 envelope utilities, and EDI Portal UI
- **Customer API** - External REST API for customers to create and track orders programmatically
- **Customer Portal - Developer Area** - Self-service integration management for customers: API key create/revoke (one-time plaintext display), webhook subscriptions with HMAC-SHA256 signatures (`X-OpenTms-Signature: t=<unix>,v1=<hex>`), rotate-secret + send-test + per-webhook delivery log, read-only EDI trading partner view (credentials redacted), and a paginated EDI transaction log. Customer portal runs as a multi-app workspace (Portal / Developer) with an app switcher in the top-right, matching the main admin app's look and feel
- **Webhooks** - Receive GPS/location updates from IoT devices with automatic shipment matching
- **Queue Processing** - pg-boss powered async processing with carrier/tracking workers, retry, and dead letter queues
- **Integration Dashboard** - Real-time ops dashboard with activity charts, queue monitoring, and DLQ management
- **Interactive Maps** - Full-page map view with supercluster point clustering, entity switching (shipments/orders/trackable units), location markers, issue/SLA overlay with pulsing breach indicators, fullscreen control centre mode, and 30-second auto-refresh
- **SLA Management** - Two-tier SLA policy hierarchy (org defaults + customer overrides) with 8 rule types: ETA delivery, issue response/resolution, dwell time, light/seal security events, and temperature excursions. Hybrid event-driven + cron-based breach detection with auto-issue creation. SLA dashboard with compliance rate, at-risk evaluations, and breach history.
- **Authentication & Authorization** - Standalone auth service with JWT tokens, OAuth 2.0 (Google/Microsoft), RBAC with fine-grained permissions, and account lockout protection
- **Email Service** - Pluggable email with SMTP and console providers, Handlebars templates, admin-configurable settings, and per-organization overrides
- **Cold Chain Monitoring** - Temperature profiles, immutable logging, excursion detection, compliance reports (CFR 21 Part 11)
- **Quality Centre** - Dedicated quality management app with dashboard analytics, issue trends over time, aggregated quality metrics by carrier/lane/location/customer, CAPA management with 30/60/90-day follow-up tracking, SOP checklists with GDP audit workflows, carrier scorecards, lane quality analysis, and CAPA effectiveness reporting
- **ETA Monitoring** - Cron-driven shipment delay detection using traffic-aware routing APIs (TomTom, HERE, Valhalla), adaptive polling, configurable alert thresholds, and automatic notifications
- **Carrier API Integration** - Automatic shipment status updates from FedEx, UPS, and DHL tracking APIs. OAuth 2.0 and API key authentication, webhook receivers with HMAC-SHA256 signature verification, adaptive polling with rate limiting, normalized status codes across all providers, and automatic shipment status bridging (delivery confirmation, exception detection, in-transit milestone updates). Setup wizard with per-provider credential configuration and connection testing
- **Route Deviation Alerts** - Per-lane planned routes via Google Maps Directions API with draggable route editing, encoded polyline storage, configurable deviation corridors, real-time deviation detection during ETA monitor cycles, and alert banners on shipment detail pages. Supports hub-and-spoke waypoints and auto-populates distance from the planned route
- **Agent Decision Logging (AI compliance & audit)** - Full audit trail for AI agent decisions with outcome recording, decision promotion, and read model projections for compliance review
- **AI Triage Agent** - Event-driven agent that uses Claude to triage shipment exceptions, SLA breaches, cargo issues, and cold chain excursions. Automatically creates or escalates issues with full decision logging for compliance
- **Configurable Agent Prompts** - Per-org prompt templates with immutable versioning, template variables (`{{shipment}}`, `{{event}}`, etc.), event subscription checkboxes, confidence thresholds, and instant rollback
- **LLM Key Management** - Bring-your-own Anthropic API key configured via admin UI, with token tracking, usage telemetry charts, and org-level enable/disable toggle
- **Automation Rule Engine** - Deterministic When/Given/Then rules promoted from proven agent decisions. Condition evaluator with 10 operators, priority ordering, first-match execution. Zero LLM cost for automated patterns
- **Skills System** - Extensible action framework with 4 built-in skills (Create Issue, Escalate Issue, Send Email, Call Webhook). Skill chains with question branching, template field resolution, and org-level skill configuration
- **Location Operations** - Per-location dashboards showing incoming, at-dock, and outgoing shipments with dwell time monitoring. Facility capability display (cross-dock, cold storage, hazmat, docks). Map integration via location marker popups.
- **Financial Operations (AR/AP)** - Full revenue and cost lifecycle: charges with approval workflow, customer invoicing with auto-invoice on delivery, weekly/monthly invoice consolidation, full/partial payment recording, and void/reissue. Carrier invoice receipt with automatic three-way freight audit matching (tender rate vs expected charges vs carrier invoice). Quotes with revision tracking, margin calculation, and auto-order creation on acceptance. Financial queries and disputes with credit note generation. AR aging reports, carrier spend analysis, margin analysis by customer, and CSV exports for accounting.
- **LTL Rating** - Class-based LTL rating with NMFC freight class lookup, density-based class calculation, weight break matrix pricing with deficit weight optimization, FAK overrides, minimum charge thresholds, and LTL accessorial codes. Re-weigh/re-class adjustment workflow and multi-order consolidation billing with pro-rate by weight.
- **EDI Financial Transactions** - EDI 210 (Freight Invoice) inbound parsing with automatic three-way match, EDI 810 (Invoice) outbound generation, EDI 820 (Payment Order/Remittance) inbound parsing with auto-application to invoices
- **Brokerage Operations** - Organization type flag (shipper/broker/carrier/3PL) with broker-specific fields (MC number, bond, operating authority). Internal load board for unmatched shipments with carrier matching by lane rates and historical usage. Quick-assign workflow with real-time margin preview. Margin visibility on shipment list with configurable margin alerts that auto-create issues when thresholds are breached. Quick quote from lane-carrier rates with configurable markup. Quote-to-book flow creates shipments that flow to the load board. Rate confirmation PDF (carrier-facing, hides customer rate). Customer credit check against outstanding invoices. Margin reporting by customer, carrier, lane, and time period with target margin variance tracking. Commission tracking for broker agents (margin or revenue basis, accrued/approved/paid lifecycle). Carrier quick pay with configurable discount. Full RBAC with 7 system roles including broker_admin and broker_agent.

### 🎨 Modern UI/UX
- **Material Design 3** - Beautiful, consistent design system
- **Responsive Design** - Works perfectly on desktop, tablet, and mobile
- **Dark/Light Themes** - Automatic theme switching based on system preferences
- **Custom Theming** - Admin-configurable color overrides stored in DB, applied per session with cache invalidation
- **Logo Upload** - Organization logo displayed in nav bar and on generated documents (PNG, JPEG, SVG, WebP)
- **Loading States** - Smooth user experience with proper feedback
- **Error Handling** - Graceful error management and user notifications

### 🔧 Technical Excellence
- **CQRS Architecture** - Command/Query Responsibility Segregation with 20+ domain command handlers
- **Event-Driven** - Every state change emits a domain event to an immutable event store (DomainEventLog)
- **Read Model Projections** - 6 denormalized read models (Order, Shipment, Carrier, Customer, Lane, Issue) built from events, optimized for fast list queries with zero joins
- **Event Bus** - pg-boss fan-out with per-handler queues, wildcard subscriptions, configurable concurrency
- **Issue/Triage Centre** - Drag-and-drop kanban board with saved views. Full issue lifecycle: create, assign, escalate, snooze, resolve, close, and reopen. Collaborative comments on issues, shipments, and orders. Issue labels for categorization. PDF closure reports auto-generated on close. AI agent driver contact action. Full in-app notification support for all issue events
- **TypeScript** - Full type safety across frontend and backend
- **RESTful API** - Well-documented API with Swagger/OpenAPI
- **Database Migrations** - Prisma-powered database management (45+ models)
- **Dependency Injection** - Custom DI container with Symbol-based tokens
- **Metrics & Monitoring** - `/metrics` endpoint with read model lag detection, event throughput, queue depths
- **Event Export API** - Queryable event store with wildcard filters, cursor pagination, and aggregate stats — ready for data warehouse and ML pipeline consumption
- **Location Auto-Creation** - Automatic location resolution from raw address data. Locations matched by name+city or created with default geofence arrival criteria. Shipment completion auto-triggered when destination arrival criteria are met.
- **Auto-Tender** - Automatic broadcast tenders created for laneless shipments when enabled (org setting). All active carriers receive offers simultaneously.
- **Test Suite** - 305 tests across 35 suites covering commands, projections, services, and full CQRS pipeline integration
- **Soft Delete** - Data preservation with archive functionality
- **Validation** - Comprehensive input validation with Zod schemas

## 🏗️ Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Frontend      │     │   API Server    │     │   PostgreSQL    │
│   React + Vite  │◄───►│   Fastify       │◄───►│   + pg-boss     │
│   TypeScript    │     │   (index.ts)    │     │   queues        │
└────────┬────────┘     └────────┬────────┘     └────────┬────────┘
         │                       │ publishes              │ consumes
         │                       │ events                 │ jobs
         │                       ▼                        │
         │              ┌─────────────────┐               │
         │              │  Event Bus      │               │
         │              │  (pg-boss       │               │
         │              │   fan-out)      │───────────────┘
         │              └─────────────────┘
         │                       │
         │    ┌──────────────────┼──────────────────────┐
         │    │                  │                      │
         │  ┌─▼─────────────┐ ┌─▼───────────────┐ ┌───▼────────────┐
         │  │  Worker 1     │ │  Worker 2       │ │  Worker N      │
         │  │  (worker.ts)  │ │  (worker.ts)    │ │  (worker.ts)   │
         │  │               │ │                 │ │                │
         │  │ • Audit       │ │ • Email         │ │ • Outbound     │
         │  │ • Webhook     │ │ • In-app notif  │ │   carrier      │
         │  │ • Triage      │ │ • Notifications │ │ • Tracking     │
         │  └───────┬───────┘ └────────┬────────┘ └───────┬────────┘
         │          │                  │                   │
         │          ▼                  ▼                   ▼
         │  ┌──────────────┐  ┌──────────────┐   ┌──────────────┐
         │  │ External     │  │ SMTP /       │   │ Carrier APIs │
         │  │ Webhooks     │  │ SendGrid     │   │ (DHL, FedEx) │
         │  └──────────────┘  └──────────────┘   └──────────────┘
         │
         │  ┌─────────────────┐
         └─►│  Auth Service   │
            │  Fastify :3002  │
            │  JWT + OAuth    │
            │  RBAC           │
            └─────────────────┘
```

**Key principle**: The API server only handles HTTP requests and publishes events. All background processing runs in **separate worker containers** with their own database connection pools — so workers never starve the API of resources. See [Event Architecture Plan](./docs/EVENT_ARCHITECTURE_PLAN.md) for the full design.

### Backend Architecture

The backend follows a **CQRS (Command Query Responsibility Segregation)** architecture:

```
Routes (HTTP) ─── validate (Zod) ──→ CommandBus.dispatch()
                                          ↓
                                   BaseCommandHandler
                                   (Prisma $transaction)
                                          ↓
                                     emit(events)
                                          ↓
                                    Commit + Publish
                                    ↓              ↓
                              Read Models     Side Effects
                             (Projections)  (Email, Audit,
                                            Notifications)
```

**Write side** — Commands execute inside transactions, emit domain events after commit:
- 20+ command handlers across 7 entity types (Orders, Shipments, Carriers, Customers, Locations, Lanes, Issues)
- Every write publishes to the immutable DomainEventLog — no silent mutations

**Read side** — Projection handlers build denormalized read models from events:
- 6 read model tables optimized for list queries (no joins needed)
- Eventual consistency with configurable projection concurrency

**Key Patterns:**
- **CQRS** - Commands (write) separated from queries (read)
- **Event Sourcing (lite)** - Immutable event log, not full event-sourced aggregates
- **Repository Pattern** - All database operations abstracted into repository classes
- **Dependency Injection** - Symbol-based DI container for testability
- **Outbox Pattern** - Events collected during transaction, published after commit

See [Domain Behaviours](./docs/DOMAIN_BEHAVIOURS.md) for the complete reference of commands, events, and side effects per entity.

## 🚀 Quick Start

### Prerequisites
- Node.js 20+
- Docker & Docker Compose
- npm or yarn

### Local Development

#### Quick Start (Recommended)

Use the provided run script to start everything automatically:

```bash
git clone https://github.com/DominicFinn/open_tms.git
cd open_tms
npm install
./run.sh
```

This script will:
- ✅ Start the database in Docker
- ✅ Apply any pending database migrations
- ✅ Generate Prisma client
- ✅ Start the backend server
- ✅ Start the frontend development server

> **Note**: The run script starts workers embedded in the API process for simplicity. For production, run workers in separate containers — see [Running Workers](#-running-workers) below.

#### Manual Setup

If you prefer to start services manually:

1. **Clone and install dependencies:**
```bash
git clone https://github.com/DominicFinn/open_tms.git
cd open_tms
npm install
```

2. **Start the database:**
```bash
docker compose up -d db
```

3. **Apply database migrations:**
```bash
cd backend
npx prisma migrate deploy
npm run prisma:generate
cd ..
```

4. **Start development servers:**
```bash
npm run dev
```

5. **Access the application:**
- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:3001
- **API Documentation**: http://localhost:3001/docs

### First Time Setup

1. **Seed the database with sample data:**
```bash
curl -X POST http://localhost:3001/api/v1/seed
```

2. **Explore the features:**
- Navigate through Customers, Locations, and Shipments
- Create, edit, and delete records
- View shipment details with interactive maps

### 🛡️ Rate Limiting

The demo deployment includes built-in rate limiting to protect against abuse:

- **50 requests per minute** per IP address
- **Automatic reset** every 60 seconds
- **429 status code** when limit exceeded
- **Clear error messages** with retry information

IMPORTANT: If you are using the demo, please do not abuse the rate limit. If you need to make more requests, please contact me.

Rate limiting is implemented in the demo backend (`backend/src/index-demo.ts`) and configured via the Docker container. See the [Dockerfile](./backend/Dockerfile) and [TypeScript configuration](./backend/tsconfig.json) for implementation details.

## 🌐 Deployment Options

### 🎪 Demo Deployment (5 minutes)
Perfect for showcasing the system to stakeholders:

**[📖 Hosting a Demo on GCP →](./HOSTING-DEMO-GCP.md)**

### 🏭 Production Deployment
Complete production setup with monitoring and security:

**[📖 Production Deployment Guide →](./DEPLOYMENT.md)**

### 🐳 Docker Deployment
Simple containerized deployment:

```bash
# Build and run with Docker Compose (includes worker)
docker compose up --build -d

# Or build individual services
docker build -t open-tms-backend ./backend
docker build -t open-tms-frontend ./frontend
docker build -t open-tms-auth ./auth-service
```

> **Note**: The auth-service is not yet included in `docker-compose.yml`. Build and run it separately with:
> ```bash
> docker run -d -p 3002:3002 \
>   -e DATABASE_URL=postgres://tms:tms@host.docker.internal:55432/tms \
>   -e JWT_SECRET=your-secret \
>   open-tms-auth
> ```

### 🔧 Running Workers

The system uses **event-driven background workers** for sending emails, firing webhooks, creating audit logs, auto-triaging exceptions, and processing integrations. Workers run in separate Docker containers from the API server so they don't compete for resources.

#### How It Works

- The **API server** (`backend/src/index.ts`) handles HTTP requests and publishes domain events to PostgreSQL-backed queues (pg-boss).
- The **worker process** (`backend/src/worker.ts`) runs in a separate container, picks up events from those queues, and executes handlers (email, notifications, webhooks, audit, triage).
- Each worker container has its own database connection pool, so a burst of email sends can't starve the API of connections.
- pg-boss ensures each job is processed exactly once, even with multiple worker instances.

#### Quick Start (Development)

For local development, the `run.sh` script runs workers embedded in the API process — no extra setup needed.

#### Docker Compose (Recommended for Production)

```bash
# Start everything: db, API, frontend, MinIO, EDI collector, and 1 worker
docker compose up --build -d
```

The `docker-compose.yml` includes a `worker` service that automatically starts alongside the API. You don't need to configure anything extra for a standard deployment.

#### Scaling Workers

For higher throughput, scale the worker containers:

```bash
# Run 3 worker instances (each gets its own connection pool and resources)
docker compose up --scale worker=3 -d
```

For heterogeneous scaling (different container types for different workloads), you can set the `WORKER_MODE` environment variable:

| Mode | What it processes |
|------|------------------|
| `all` (default) | Event handlers + integration workers |
| `events` | Only event handlers (email, notifications, audit, triage, webhooks) |
| `integrations` | Only outbound carrier, tracking, and webhook workers |

To run dedicated containers per mode, add separate service definitions in `docker-compose.override.yml`:

```yaml
services:
  worker-events:
    extends:
      service: worker
    environment:
      WORKER_MODE: events
  worker-integrations:
    extends:
      service: worker
    environment:
      WORKER_MODE: integrations
```

Then scale independently:

```bash
docker compose up --scale worker-events=3 --scale worker-integrations=1 -d
```

#### Resource Limits

Each worker container is capped at **512 MB memory** and **0.5 CPU** by default (configured in `docker-compose.yml` under `deploy.resources.limits`). Adjust these based on your workload.

#### Connection Pool Budget

PostgreSQL defaults to 100 connections. Here's the math:

| Component | Instances | Connections Each | Total |
|-----------|-----------|-----------------|-------|
| API server | 1 | 10 | 10 |
| Worker | 3 | 5 | 15 |
| pg-boss overhead | — | — | ~7 |
| **Total** | | | **~32** |

This leaves plenty of headroom. For larger deployments (10+ workers), add [PgBouncer](https://www.pgbouncer.org/) as a connection multiplexer.

#### Monitoring

Worker containers log to stdout. Use `docker compose logs worker -f` to tail worker output.

For a deeper look at queue health, the API exposes queue monitoring endpoints:
- `GET /api/v1/queues/stats` — queue sizes, active/completed/failed counts
- `GET /api/v1/queues/:name/stats` — stats for a specific queue
- `GET /api/v1/queues/activity` — hourly activity data for dashboards

See the full architecture design in [Event Architecture Plan](./docs/EVENT_ARCHITECTURE_PLAN.md).

### 📧 Email Configuration

The backend includes a pluggable email service. By default it uses a console provider that logs emails to stdout. For production, configure SMTP:

| Variable | Default | Description |
|----------|---------|-------------|
| `EMAIL_PROVIDER` | `console` | `smtp` or `console` |
| `SMTP_HOST` | `localhost` | SMTP server hostname |
| `SMTP_PORT` | `587` | SMTP server port |
| `SMTP_SECURE` | `false` | Use TLS (`true` for port 465) |
| `SMTP_USER` | — | SMTP authentication username |
| `SMTP_PASSWORD` | — | SMTP authentication password |
| `EMAIL_FROM_ADDRESS` | `noreply@opentms.local` | Default sender address |
| `EMAIL_FROM_NAME` | `Open TMS` | Default sender display name |

Email settings can also be managed per-organization via the Admin UI or the `PUT /api/v1/email/settings` endpoint.

### 🔐 Auth Service Configuration

The auth-service runs as a standalone Fastify service on port 3002.

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | — | PostgreSQL connection string (shared with backend) |
| `AUTH_PORT` | `3002` | Port for the auth service |
| `JWT_SECRET` | `open-tms-dev-secret-change-in-production` | Secret for signing JWTs |
| `JWT_ACCESS_EXPIRES_IN` | `900` | Access token TTL in seconds (15 min) |
| `JWT_REFRESH_EXPIRES_IN` | `604800` | Refresh token TTL in seconds (7 days) |
| `AUTH_SERVICE_URL` | `http://localhost:3002` | Base URL for OAuth callbacks |
| `FRONTEND_URL` | `http://localhost:5173` | Frontend URL for OAuth redirects |

On first run, call `POST /api/v1/auth/setup` to seed default roles (admin, dispatcher, warehouse, readonly, customer) and create the initial admin user.

## 📚 API Documentation

### Endpoints Overview

#### Customers
- `GET /api/v1/customers` - List all customers
- `POST /api/v1/customers` - Create new customer
- `GET /api/v1/customers/:id` - Get customer details
- `PUT /api/v1/customers/:id` - Update customer
- `DELETE /api/v1/customers/:id` - Archive customer

#### Locations
- `GET /api/v1/locations` - List all locations
- `POST /api/v1/locations` - Create new location
- `GET /api/v1/locations/:id` - Get location details
- `GET /api/v1/locations/search?q=` - Search locations by name
- `PUT /api/v1/locations/:id` - Update location
- `DELETE /api/v1/locations/:id` - Archive location

#### Carriers
- `GET /api/v1/carriers` - List all carriers
- `POST /api/v1/carriers` - Create new carrier
- `GET /api/v1/carriers/:id` - Get carrier details
- `PUT /api/v1/carriers/:id` - Update carrier
- `DELETE /api/v1/carriers/:id` - Archive carrier

#### Lanes
- `GET /api/v1/lanes` - List all lanes
- `POST /api/v1/lanes` - Create lane with optional stops
- `GET /api/v1/lanes/:id` - Get lane details with stops and carriers
- `PUT /api/v1/lanes/:id` - Update lane
- `DELETE /api/v1/lanes/:id` - Archive lane
- `POST /api/v1/lanes/:id/customers` - Add customer to lane
- `POST /api/v1/lanes/:id/carriers` - Add carrier to lane
- `POST /api/v1/lanes/:id/carriers/:carrierId/assign` - Assign carrier to lane

#### Shipments
- `GET /api/v1/shipments` - List all shipments
- `POST /api/v1/shipments` - Create shipment (lane-based or direct origin/destination)
- `GET /api/v1/shipments/:id` - Get shipment details with all relationships
- `GET /api/v1/shipments/:id/events` - Get shipment events
- `PUT /api/v1/shipments/:id` - Update shipment
- `DELETE /api/v1/shipments/:id` - Archive shipment

#### Orders
- `GET /api/v1/orders` - List all orders
- `POST /api/v1/orders` - Create new order with trackable units and line items
- `GET /api/v1/orders/:id` - Get order details
- `PUT /api/v1/orders/:id` - Update order
- `DELETE /api/v1/orders/:id` - Archive order
- `POST /api/v1/orders/:id/assign-to-shipment` - Auto-assign order to a shipment via lane matching
- `POST /api/v1/orders/:id/convert-to-shipment` - Convert order directly to a shipment
- `POST /api/v1/orders/check-compatibility` - Check if orders can be combined into one shipment
- `POST /api/v1/orders/batch-convert` - Batch convert orders (combine into one or convert individually)
- `POST /api/v1/orders/:id/split-to-shipments` - Split one order into multiple shipments
- `POST /api/v1/orders/:id/delivery-status` - Update delivery status
- `POST /api/v1/orders/:id/mark-delivered` - Mark order as delivered
- `POST /api/v1/orders/import/csv` - Bulk import orders from CSV
- `POST /api/v1/orders/import/edi` - Import orders from EDI X12 850
- `POST /api/v1/orders/import/edi/preview` - Preview EDI content without creating orders

#### Trackable Units (sub-resources of Orders)
- `POST /api/v1/orders/:id/trackable-units` - Add trackable unit
- `PUT /api/v1/orders/:orderId/trackable-units/:unitId` - Update trackable unit
- `DELETE /api/v1/orders/:orderId/trackable-units/:unitId` - Remove trackable unit
- `POST /api/v1/orders/:orderId/trackable-units/:unitId/line-items` - Add line item
- `POST /api/v1/orders/:orderId/trackable-units/merge` - Merge two units
- `POST /api/v1/orders/:orderId/trackable-units/:unitId/split` - Split a unit

#### Pending Lane Requests
- `GET /api/v1/pending-lane-requests` - List all pending lane requests
- `GET /api/v1/pending-lane-requests/status/:status` - Filter by status
- `POST /api/v1/pending-lane-requests/:id/approve` - Approve request
- `POST /api/v1/pending-lane-requests/:id/reject` - Reject request

#### EDI Partners
- `GET /api/v1/edi-partners` - List EDI trading partners
- `POST /api/v1/edi-partners` - Create EDI partner with SFTP configuration
- `GET /api/v1/edi-partners/:id` - Get partner details
- `PUT /api/v1/edi-partners/:id` - Update partner configuration
- `DELETE /api/v1/edi-partners/:id` - Delete partner

#### EDI Files
- `GET /api/v1/edi-files` - List processed EDI files (filter by `?status=`, `?partnerId=`)
- `GET /api/v1/edi-files/:id` - Get file details (`?includeContent=true` for raw content)
- `POST /api/v1/edi-files/:id/reprocess` - Reprocess a failed file
- `GET /api/v1/edi-files/stats` - Processing statistics

#### Customer API (External Integration)

Customer-facing API for programmatic order creation and tracking. Requires a customer-scoped API key. See the [Customer API Guide](./docs/CUSTOMER_API_GUIDE.md) for full integration details.

**Authentication:** Pass your API key via `x-api-key` header or `Authorization: Bearer <key>`.

- `POST /api/v1/customer-api/orders` - Create an order
- `GET /api/v1/customer-api/orders` - List your orders (supports `?status=`, `?limit=`, `?offset=`)
- `GET /api/v1/customer-api/orders/:id` - Get order details
- `GET /api/v1/customer-api/orders/:id/status` - Lightweight status check

**Rate Limiting:** 100 requests/minute per IP. Returns `429` when exceeded.

#### API Keys
- `GET /api/v1/api-keys` - List all API keys
- `POST /api/v1/api-keys` - Create new API key (optional `customerId` to scope to a customer)
- `PUT /api/v1/api-keys/:id` - Update key name/status
- `DELETE /api/v1/api-keys/:id` - Delete key

#### Webhooks & Outbound Integrations
- `POST /api/v1/webhook` - Receive GPS/location updates from IoT devices (requires API key)
- `GET /api/v1/webhook-logs` - List webhook event logs with filtering
- `GET /api/v1/webhook-logs/stats` - Webhook statistics
- `GET /api/v1/outbound-integrations` - List outbound EDI integrations
- `POST /api/v1/outbound-integrations` - Create outbound integration (EDI 856 ASN)
- `POST /api/v1/outbound-integrations/:id/test` - Test integration delivery
- `GET /api/v1/outbound-integration-logs` - List outbound transmission logs

#### Queue Monitoring
- `GET /api/v1/queues/stats` - Get stats for all queues (queued, active, deferred, dead-letter)
- `GET /api/v1/queues/:name/stats` - Get stats for a specific queue
- `GET /api/v1/queues/:name/jobs` - Peek at jobs (query: state, limit)
- `GET /api/v1/queues/activity` - Hourly activity data for charts (query: hours)
- `POST /api/v1/queues/:name/purge-dlq` - Purge dead letter queue
- `POST /api/v1/queues/:name/retry-failed` - Retry failed jobs from DLQ

#### Organization Settings
- `GET /api/v1/organization/settings` - Get org settings (tracking mode, units)
- `PUT /api/v1/organization/settings` - Update org settings

### Integration Guides
- **[Customer Portal Guide](./docs/CUSTOMER_PORTAL_GUIDE.md)** - What a customer can log in and do (dashboard, orders, shipments, issues, returns, invoices, documents)
- **[Customer API Guide](./docs/CUSTOMER_API_GUIDE.md)** - External API for programmatic order creation
- **[CSV Import Guide](./docs/CSV_IMPORT_GUIDE.md)** - Bulk order import from CSV files
- **[EDI Import Guide](./docs/EDI_IMPORT_GUIDE.md)** - X12 850 import, partner config, SFTP collection
- **[Queue Integration Guide](./docs/QUEUE_INTEGRATION_GUIDE.md)** - Queue architecture, monitoring, DLQ, cloud-native alternatives
- **[EDI Collector Service](./edi-collector/README.md)** - Automated SFTP polling for EDI files

### Interactive API Documentation
Visit http://localhost:3001/docs for the complete Swagger/OpenAPI documentation with full request/response schemas for all endpoints.

## 🛠️ Technology Stack

### Frontend
- **React 18** - Modern React with hooks
- **TypeScript** - Type-safe development
- **Vite** - Fast build tool and dev server
- **React Router** - Client-side routing
- **Leaflet** - Interactive maps
- **Material Icons** - Icon system

### Backend
- **Fastify** - Fast and efficient web framework
- **TypeScript** - Type-safe server development
- **Prisma** - Modern database ORM
- **PostgreSQL** - Robust relational database
- **Zod** - Schema validation
- **Swagger** - API documentation

### Architecture Patterns
- **Repository Pattern** - Data access abstraction layer
- **Dependency Injection** - Custom DI container for loose coupling
- **DTO Pattern** - Type-safe data transfer objects
- **Interface Segregation** - Interface-based repository contracts
- **Layered Architecture** - Clear separation of routes, repositories, and services

### Development Tools
- **ESLint** - Code linting
- **Prettier** - Code formatting
- **Docker** - Containerization
- **GitHub Actions** - CI/CD pipeline

## 📁 Project Structure

```
open_tms/
├── backend/                 # Fastify API server
│   ├── src/
│   │   ├── index.ts        # Main server file
│   │   ├── routes/         # HTTP route handlers
│   │   ├── repositories/   # Data access layer (Repository Pattern)
│   │   ├── di/             # Dependency Injection container
│   │   ├── services/       # Business logic (CSV import, EDI parsing, etc.)
│   │   ├── middleware/     # Auth middleware (API key validation)
│   │   ├── storage/        # File storage adapters (pluggable interface)
│   │   └── plugins/        # Fastify plugins
│   ├── prisma/             # Database schema and migrations
│   └── Dockerfile          # Backend container
├── frontend/               # React application
│   ├── src/
│   │   ├── pages/          # Page components
│   │   ├── components/     # Reusable components (AppBar, AppSwitcher, etc.)
│   │   ├── layout.tsx      # Operations app layout
│   │   ├── integrations-layout.tsx  # Integrations app layout
│   │   ├── admin-layout.tsx # Admin app layout
│   │   ├── ThemeProvider.tsx # Theme context — loads DB theme, caches per session
│   │   └── theme.css       # Material Design 3 CSS custom properties
│   └── Dockerfile          # Frontend container
├── edi-collector/           # SFTP EDI collection service
│   ├── src/
│   │   ├── index.ts        # Entry point
│   │   ├── collector.ts    # SFTP download + backend upload
│   │   ├── scheduler.ts    # Per-partner polling scheduler
│   │   └── config.ts       # Config from backend API
│   └── Dockerfile          # Collector container
├── auth-service/            # Standalone authentication & authorization service
│   ├── src/
│   │   ├── index.ts        # Entry point (Fastify, port 3002)
│   │   ├── services/       # Auth, Token, OAuth, Password services
│   │   ├── repositories/   # User, Role, Session, AuthProvider repos
│   │   ├── routes/         # Auth, users, roles, setup, OAuth endpoints
│   │   ├── middleware/      # JWT verification middleware
│   │   └── di/             # Dependency injection container
│   ├── Dockerfile          # Auth service container
│   └── entrypoint.sh       # Runs migrations on startup
├── webhook-service/         # Standalone webhook receiver (GCP)
├── packages/
│   └── shared/             # Shared TypeScript types
├── terraform/              # Infrastructure as Code
├── .github/workflows/      # CI/CD pipelines
├── docs/                   # Integration guides
│   ├── CUSTOMER_PORTAL_GUIDE.md
│   ├── CUSTOMER_API_GUIDE.md
│   ├── CSV_IMPORT_GUIDE.md
│   └── EDI_IMPORT_GUIDE.md
└── docker-compose.yml       # Full stack: db + backend + frontend + edi-collector
```

### Backend Code Organization

The backend follows a modular architecture with clear separation of concerns:

#### **Routes** (`src/routes/`)
- HTTP endpoint definitions
- Request/response handling
- Validation using Zod schemas
- Depends on repository interfaces (not implementations)

#### **Repositories** (`src/repositories/`)
Each repository provides:
- **Interface** - Contract definition (e.g., `ICustomersRepository`)
- **DTOs** - Data Transfer Objects (e.g., `CreateCustomerDTO`, `UpdateCustomerDTO`)
- **Implementation** - Concrete class with Prisma database operations

Example:
```typescript
// Interface defines the contract
export interface ICustomersRepository {
  all(): Promise<Customer[]>;
  findById(id: string): Promise<Customer | null>;
  create(data: CreateCustomerDTO): Promise<Customer>;
  // ...
}

// Implementation uses Prisma
export class CustomersRepository implements ICustomersRepository {
  constructor(private prisma: PrismaClient) {}
  // ... method implementations
}
```

#### **Dependency Injection** (`src/di/`)
- **Container** - Simple DI container for managing dependencies
- **Tokens** - Symbol-based identifiers for each dependency
- **Registry** - Central registration of all application dependencies

Usage in routes:
```typescript
const customersRepo = container.resolve<ICustomersRepository>(
  TOKENS.ICustomersRepository
);
```

This architecture enables:
- ✅ **Testability** - Easy to inject mock repositories
- ✅ **Loose Coupling** - Routes depend on interfaces, not concrete classes
- ✅ **Flexibility** - Swap implementations without changing routes
- ✅ **Type Safety** - Full TypeScript support with generics

#### Testing with Dependency Injection

The DI container makes testing straightforward:

```typescript
import { container, TOKENS } from '../di';
import { ICustomersRepository } from '../repositories/CustomersRepository';

// Create a mock repository
const mockCustomersRepo: ICustomersRepository = {
  all: jest.fn().mockResolvedValue([]),
  findById: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  archive: jest.fn(),
};

// Replace the binding for testing
container.singleton(TOKENS.ICustomersRepository)
  .toFactory(() => mockCustomersRepo);

// Now your routes will use the mock!
```

## 🎯 Key Features in Detail

### Customer Management
- **Complete CRUD operations** with inline editing
- **Email validation** and contact management
- **Soft delete** with archive functionality
- **Real-time updates** across the interface

### Location Management
- **Comprehensive address handling** with coordinates
- **Geographic data support** for mapping
- **Warehouse and retail location** management
- **Address validation** and formatting

### Warehouse Management System (WMS)
- **Location hierarchy** - Zones, aisles, and bins with capacity tracking, temperature zones, hazmat certification
- **Bulk bin generation** - Pattern-based bin creation ({aisle}-{row}-{level}) with live preview
- **Receiving** - Dock appointments, ASN-based and blind receiving, line-by-line inspection
- **Cross-dock** - Flow-through workflow: received goods skip storage and sort directly to staging bins for outbound loading
- **Returns / RMA** - Full returns lifecycle with 7 dispositions (restock, refurb, scrap, recycle, donate, rtv, customer_keeps), quarantine-first flow, partial returns, auto-calculated refunds with finance review queue. Five initiation channels: admin UI, customer portal (self-service request flow with list/new/detail pages and JWT-scoped label download), public REST API (customer-keyed), EDI 180 Return Merchandise Authorization (inbound request + outbound authorization response), and marketplace webhooks (roadmap). Return label generation and carrier pickup scheduling via provider-agnostic `IReturnLabelProvider` (Manual provider active; FedEx/UPS/DHL stubs for live carrier integration)
- **Directed putaway** - Priority-based rules (SKU pattern, temperature, hazmat, customer, velocity), scan-to-confirm with deviation tracking, bin constraint validation, product consolidation
- **Inventory tracking** - Real-time stock levels per bin with immutable transaction ledger, stock adjustments with reason codes, bin-to-bin transfers, per-SKU summary aggregation
- **Wave planning** - Group orders into pick waves (discrete or batch strategy), inventory allocation on release
- **Wave templates** - Automate wave creation with reusable templates (grouping rules, carrier cutoff times, min/max orders, cron schedules, auto-release)
- **Picking** - Walk-sequence-optimized pick lists, line-by-line execution, short-pick handling (backorder/cancel)
- **Packing** - Pack station verification, line-by-line item confirmation
- **Pack Audit** - Scale weight + cubiscan dim-weight variance checks at the pack station. Default ±10% tolerance (configurable per-audit), pass/warning/fail verdict auto-raises medium or high priority quality issues linked to the pack task. Expected weight auto-calculated from `ProductUom.weightGrams × quantity` across pack lines. Admin dashboard shows 30-day pass rate and variance trends
- **Cutoff-at-Risk Monitor** - Per-carrier, per-day-of-week cutoff times with IANA timezone support. A pg-boss cron scans open shipments every 5 minutes, projects warehouse-ready time from remaining pick/pack/load work, and fires `shipment.cutoff_at_risk` with severity (minor/warning/critical). Warning and critical auto-raise triage issues linked to the shipment; dedup prevents spam while still escalating. Admin dashboard surfaces at-risk shipments and lets ops configure cutoffs per carrier
- **Cartonization** - Recommends smallest viable shipping carton at pack time. ProductUom master data for SKU dimensions, CartonCatalogue per location, First-Fit-Decreasing algorithm with volume and weight scoring
- **Loading** - Staging assignments at dock bins, batch loading completion
- **Cycle counting** - Full warehouse, zone, and random sample counts with variance detection and auto-adjustment of inventory
- **Replenishment** - Auto-replenish pick faces from bulk storage when stock drops below configured minimums
- **Manifest ingestion** - CSV upload with column mapping templates and header-checksum auto-detection for reusable supplier formats
- **Zone picking** - Sequential (pick-and-pass) and parallel (pick-and-merge) zone strategies with per-zone task tracking
- **Product dimensions** - SKU-level dimension and weight master data (ProductUom) for cartonization and future palletization
- **Operations dashboard** - Real-time warehouse stats (zones, bins, SKUs, task counts by status)
- **Operations KPI dashboard** - Dedicated `/wms/operations` view with six KPI groups (throughput today vs 7-day, 30-day avg cycle times for pick / dock-to-stock / order-to-ship, pick accuracy + pack audit pass rate + inventory record accuracy, live work queue, exceptions rollup including cutoff-at-risk, bin utilization). Tone-coloured accuracy thresholds, clickable drill-downs, 60-second auto-refresh
- **Pallet Types & Palletization** - `PalletType` catalog with one-click seed of 13 standard types (EUR1 / EUR2 / EUR3 / EUR6 half / US GMA 48×40 / US 42×42 / CHEP 1210 + 48×40 / AU 1165 / plastic + one-way + quarter display) plus full CRUD. Planner service computes cartons-per-layer (best of two orientations), layers (min of height- and weight-bound), stacked height and weight utilization. Recommender ranks all active pallet types for a given carton spec
- **Container Intelligence** - Carton catalogue extended with temperature zone, insulation hours, tamper-evident flag, value class, hazmat UN classes, and material type. Recommender groups pack items by constraint profile (temperature + value + hazmat compatibility with UN segregation matrix), picks the smallest qualifying carton per group, and attaches required ancillaries (gel pack, dry ice, desiccant, fragile padding, tamper seal). Transit-hours aware: refrigerated packages past 24h transit automatically promote to dry ice
- **Warehouse mobile app** - Pick task execution, putaway scan-to-confirm, receiving (ASN + blind) with per-line inspection, packing with barcode verification and carton selection, pack audit (scale + dim variance), and return receiving + inspection/disposition tasks - all on one unified task list with Receive / Putaway / Pick / Pack / Returns tabs. Supports Zebra / Honeywell RF gun barcode wedges alongside camera scanning
- **147 tests** across 13 test suites covering the full goods flow

### Bill of Lading (BOL) workflow

The BOL is an **immutable** document. Its content is captured as a metadata snapshot at generation time and frozen — re-opening the document later does not pull fresh data from the shipment. Generating a BOL too early therefore produces a permanently empty document, so generation is gated to the end of the WMS flow.

**Intended flow (the only path that produces a fully populated BOL):**

1. Order created → assigned to shipment
2. Pick task created → handheld scans (or admin "complete pick")
3. Load plan created with vehicle / dock / driver
4. Lines loaded onto vehicle (handheld scans or admin "Load all")
5. Load plan completed + sealed → BOL is auto-generated here. `POST /api/v1/load-plans/:id/complete` synchronously calls `DocumentGenerationService.generateBOL` after the load plan transitions to `completed`, capturing vehicle, driver, stops, orders, trackable units, and line items.

**Manual generation (`POST /api/v1/documents/generate/bol`)** is still supported for re-issuing a BOL or for admin testing, but it is guarded:

- `400` if the shipment has no orders attached
- `400` if every attached order has zero trackable units **and** zero line items

The `VNextShipmentDetail` page surfaces the guard's error message via a sonner toast so dispatchers see why the document refused to generate. Once picking and loading have produced units/line items the same call succeeds and stores the immutable snapshot.

**Viewing the PDF.** `GET /api/v1/documents/:id/download` is JWT-protected. Plain `<a href>` navigation bypasses the global `window.fetch` interceptor in `frontend/src/authFetch.ts`, so the link arrives without an Authorization header and the backend returns `401 "Authorization header required"`. The BOL view's Download button instead does an authenticated `fetch`, reads the response as a blob, and synthesises a click on a hidden `<a download>`. The pattern lives in [`VNextBolView.handleDownload`](frontend/src/vnext-design/VNextBolView.tsx) and should be reused for any other JWT-protected file download — a system-wide signed-URL or download-cookie scheme is a separate, larger change.

### Trading partners — soft delete

Trading partners support soft delete (`Comment` does too — see below). `DELETE /api/v1/trading-partners/:id` sets `TradingPartner.deletedAt` + `deletedBy` and disables `active` / `inboundEnabled` / `outboundEnabled` so the polling worker stops touching the partner immediately. The row is preserved because `EdiTransactionLog` rows reference it for audit. The list endpoint hides soft-deleted partners by default; pass `?includeDeleted=true` to see them. The frontend (`VNextTradingPartners`) shows a trash icon next to Edit on every row.

Migration: `backend/prisma/migrations/20260430_trading_partner_soft_delete` adds the columns and an index.

> SFTP test connections require the `ssh2-sftp-client` package, which is now listed in `backend/package.json`. If a fresh checkout shows `Cannot find package 'ssh2-sftp-client'` when clicking **Test connection**, run `npm install` from the repo root to pick up workspace dependencies.

### Notes & comments

The polymorphic `Comment` model (issues, shipments, orders) supports edit and delete:

- **POST /api/v1/comments** — author identity is taken from `req.user.sub` and the user's `firstName`/`lastName` are looked up from the DB; `createdAt` is set by Prisma. Frontend never has to send these.
- **PUT /api/v1/comments/:id** — author-only edit. Bumps `updatedAt`; the UI shows an `(edited)` marker when `updatedAt > createdAt`.
- **DELETE /api/v1/comments/:id** — soft delete. Sets `Comment.deletedAt` + `deletedBy` rather than removing the row, so the audit trail is preserved. Author or admin (role `admin` / permission `comments:*` / `*`) can delete; the list endpoint hides soft-deleted rows by default and exposes `?includeDeleted=true` for admins.

Migration: `backend/prisma/migrations/20260430_comment_soft_delete` adds `deletedAt` + `deletedBy` columns and an index.

### Shipment Tracking
- **Full lifecycle management** from draft to delivery
- **Status tracking** with visual indicators
- **Interactive maps** showing shipment routes
- **Item management** with SKU tracking
- **Date management** for pickup and delivery

### Modern UI/UX
- **Material Design 3** implementation
- **Responsive grid layouts** that adapt to screen size
- **Floating labels** and smooth animations
- **Loading states** and error handling
- **Confirmation dialogs** for destructive actions

## 🎨 Frontend Theming

The frontend uses a **CSS custom properties** system based on Material Design 3 tokens. All colors are defined in `frontend/src/theme.css` and must never be hardcoded in components.

### Architecture

1. **`theme.css`** defines all CSS custom properties (`:root` block) — canonical color tokens, aliases, spacing, shadows, overlays, and map marker colors.
2. **`ThemeProvider.tsx`** is a React context that loads theme overrides from `GET /api/v1/theme` on mount. Overrides are applied to `document.documentElement.style` and cached in `sessionStorage` using `themeUpdatedAt` for invalidation.
3. **`useTheme()` hook** provides `hasLogo`, `logoUrl`, `themeUpdatedAt`, and `reloadTheme()` to any component.
4. **Admin > Theme & Branding** page lets admins customize colors via color pickers with live preview and upload an organization logo.

### Rules for Contributors

- **Never hardcode colors** in components — always use `var(--token-name)` in CSS or inline styles.
- **Never import colors from JS** — all color values come from CSS custom properties.
- **Use existing aliases** (`--color-primary`, `--color-error`, `--overlay-bg`, `--marker-origin`, etc.) rather than referencing raw tokens directly.
- **For new color needs**, add a CSS variable to `theme.css` first, then reference it.
- **Modal overlays** use `var(--overlay-bg)`, **modal shadows** use `var(--modal-shadow)`.
- **Map markers** use `var(--marker-origin)`, `var(--marker-destination)`, `var(--marker-stop)`, `var(--marker-default)`.

### Multi-App Layout

The frontend has three "apps" selectable via the AppSwitcher:
- **Operations** (`/`) — Shipments, orders, lanes, carriers, customers
- **Integrations** (`/integrations`) — API keys, webhooks, EDI
- **Admin** (`/admin`) — Settings, theme, document templates, custom fields

Each app has its own layout component (`layout.tsx`, `integrations-layout.tsx`, `admin-layout.tsx`) with a dedicated sidebar.

## 🔒 Security Features

- **Input validation** with Zod schemas
- **SQL injection protection** via Prisma ORM
- **CORS configuration** for secure cross-origin requests
- **Rate limiting** for demo protection (50 requests/minute per IP)
- **Environment variable** management
- **Soft delete** for data preservation

## 📊 Performance

- **Fastify** for high-performance API responses
- **Vite** for lightning-fast development and builds
- **Prisma** for optimized database queries
- **React** with efficient re-rendering
- **Docker** for consistent deployment environments

## 🤝 Contributing

We welcome contributions from the community! Whether you're fixing bugs, adding features, improving documentation, or helping with project management, your contributions make this project better for everyone.

### How to Contribute

1. **Fork the repository** and clone your fork
2. **Create a feature branch**: `git checkout -b feature/amazing-feature`
3. **Make your changes** and test them thoroughly
4. **Add tests** if you're adding new functionality
5. **Commit your changes**: `git commit -m 'Add amazing feature'`
6. **Push to your branch**: `git push origin feature/amazing-feature`
7. **Open a Pull Request** with a clear description of your changes

### Ways to Contribute

- 🐛 **Bug Reports**: Found a bug? [Open an issue](https://github.com/DominicFinn/open_tms/issues) with detailed steps to reproduce
- ✨ **Feature Requests**: Have an idea? [Start a discussion](https://github.com/DominicFinn/open_tms/discussions) or open an issue
- 📝 **Documentation**: Help improve docs, add examples, or fix typos
- 🎨 **UI/UX**: Improve the design, add animations, or enhance user experience
- 🔧 **Backend**: Add new API endpoints, improve performance, or add features
- 🧪 **Testing**: Add unit tests, integration tests, or help improve test coverage
- 📊 **Project Management**: Help triage issues, review PRs, or organize milestones

### Development Guidelines

- Follow the existing code style and patterns
- Write clear, descriptive commit messages
- Update documentation for any new features
- Ensure all tests pass before submitting a PR
- Be respectful and constructive in discussions

### Getting Help

- 💬 **Discussions**: [GitHub Discussions](https://github.com/DominicFinn/open_tms/discussions) for questions and ideas
- 🐛 **Issues**: [GitHub Issues](https://github.com/DominicFinn/open_tms/issues) for bug reports and feature requests
- 📖 **Documentation**: Check the [deployment guide](./DEPLOYMENT.md) and deploy your own instance to access interactive API docs at `/docs`

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- **Documentation**: Check the [deployment guide](./DEPLOYMENT.md)
- **Issues**: [GitHub Issues](https://github.com/DominicFinn/open_tms/issues)
- **Discussions**: [GitHub Discussions](https://github.com/DominicFinn/open_tms/discussions)

## 🎉 Acknowledgments

- **Material Design** for the beautiful design system
- **Fastify** team for the excellent web framework
- **Prisma** team for the amazing database ORM
- **React** team for the powerful UI library

## Marketing Site

The `www/` directory contains the Open TMS marketing and landing page — a standalone React + Vite + Tailwind CSS site deployable to Firebase Hosting (or any static host).

```bash
cd www
npm install
npm run dev      # Development server
npm run build    # Production build → www/dist/
```

The site includes:
- Product landing page with feature overview
- Carrier and shipper-focused sections
- Blog system (articles committed as TypeScript in `www/src/content/`)
- Documentation hub linking to API docs and guides

Deploy to Firebase:
```bash
cd www
npm run build
npx firebase deploy
```

---

**Ready to get started?** Check out the [Quick Start](#-quick-start) section above!
