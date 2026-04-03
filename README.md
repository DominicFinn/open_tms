# 🚛 Open TMS

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-20232A?logo=react&logoColor=61DAFB)](https://reactjs.org/)
[![Fastify](https://img.shields.io/badge/Fastify-202020?logo=fastify&logoColor=white)](https://www.fastify.io/)
[![Prisma](https://img.shields.io/badge/Prisma-3982CE?logo=prisma&logoColor=white)](https://www.prisma.io/)

A simple, open-source Transport Management System built with TypeScript, featuring a Fastify backend, React frontend, and comprehensive CRUD operations. Perfect for managing shipments, customers, and locations with a beautiful Material Design 3 interface.

## 🚨 Help needed please
Under development at the moment. I have really made this as a demo to show off our data platform capabilities at System Loco, we develop IoT devices and the supporting data and intelligence platform. We integrate with real time visibility platforms and TMS systems to provide a complete end to end solution.

Please feel free to contribute to the project, ideally with feature requests, bug reports, or documentation improvements.

I'm outlining a roadmap. It's high level. It can be ticketed up as it goes along as issues [Roadmap](./roadmap.md)

> **🌟 Live Demo**: [Try it now!](https://open-tms-frontend-iutj2b4iaa-uc.a.run.app) | **📖 API Docs**: [View API](https://open-tms-backend-iutj2b4iaa-uc.a.run.app/docs)
>
> *Note: The demo URLs above are for the project maintainer's deployment. Deploy your own instance using the [Quick Demo Guide](./HOSTING-DEMO-GCP.md).*

## ✨ Features

### 🎯 Core Functionality
- **Customer Management** - Create, edit, and manage customer information
- **Location Management** - Handle warehouses, distribution centers, and retail locations
- **Carrier & Lane Management** - Define carriers, lanes, multi-stop routes, and carrier assignments
- **Order Management** - Full order lifecycle with trackable units (pallets, totes, boxes) and line items
- **Shipment Tracking** - Complete shipment lifecycle management with status tracking
- **Order-to-Shipment Conversion** - Combine multiple orders into one shipment, split large orders across multiple shipments, or convert individually with a conversion wizard
- **CSV Import** - Bulk order creation from CSV files with automatic customer/location matching
- **EDI Integration** - X12 850 Purchase Order import, partner configuration, SFTP auto-collection
- **Customer API** - External REST API for customers to create and track orders programmatically
- **Webhooks** - Receive GPS/location updates from IoT devices with automatic shipment matching
- **Outbound Integrations** - EDI 856 ASN and JSON payload delivery to carrier and tracking systems
- **Queue Processing** - pg-boss powered async processing with carrier/tracking workers, retry, and dead letter queues
- **Integration Dashboard** - Real-time ops dashboard with activity charts, queue monitoring, and DLQ management
- **Interactive Maps** - OpenStreetMap integration for shipment visualization
- **Authentication & Authorization** - Standalone auth service with JWT tokens, OAuth 2.0 (Google/Microsoft), RBAC with fine-grained permissions, and account lockout protection
- **Email Service** - Pluggable email with SMTP and console providers, Handlebars templates, admin-configurable settings, and per-organization overrides

### 🎨 Modern UI/UX
- **Material Design 3** - Beautiful, consistent design system
- **Responsive Design** - Works perfectly on desktop, tablet, and mobile
- **Dark/Light Themes** - Automatic theme switching based on system preferences
- **Custom Theming** - Admin-configurable color overrides stored in DB, applied per session with cache invalidation
- **Logo Upload** - Organization logo displayed in nav bar and on generated documents (PNG, JPEG, SVG, WebP)
- **Loading States** - Smooth user experience with proper feedback
- **Error Handling** - Graceful error management and user notifications

### 🔧 Technical Excellence
- **TypeScript** - Full type safety across frontend and backend
- **RESTful API** - Well-documented API with Swagger/OpenAPI
- **Database Migrations** - Prisma-powered database management
- **Repository Pattern** - Clean data access layer with interface-based design
- **Dependency Injection** - Testable, loosely-coupled architecture
- **DTO Pattern** - Type-safe data transfer with validation
- **Soft Delete** - Data preservation with archive functionality
- **Validation** - Comprehensive input validation and error handling

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

The backend follows a clean, layered architecture with:

- **Routes Layer** - HTTP endpoints and request/response handling
- **Repository Layer** - Data access abstraction using the Repository Pattern
- **Dependency Injection** - Custom DI container for loose coupling and testability
- **Type Safety** - TypeScript interfaces (DTOs) for all data structures

```
Routes (HTTP)
    ↓ (uses interfaces)
Repositories (Data Access)
    ↓ (uses Prisma)
Database (PostgreSQL)
```

**Key Patterns:**
- **Repository Pattern** - All database operations abstracted into repository classes
- **Dependency Injection** - Interface-based DI container for testability
- **DTO Pattern** - Type-safe data transfer objects for API contracts
- **Interface Segregation** - Each repository has a corresponding interface

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
- 📖 **Documentation**: Check the [deployment guide](./DEPLOYMENT.md) and [API docs](https://open-tms-backend-iutj2b4iaa-uc.a.run.app/docs)

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

---

**Ready to get started?** Check out the [Quick Start](#-quick-start) section or [deploy a demo](./HOSTING-DEMO-GCP.md) in 5 minutes! 🚀
