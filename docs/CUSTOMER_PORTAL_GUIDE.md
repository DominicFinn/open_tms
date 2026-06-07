# Customer Portal Guide

This guide describes everything a logged-in customer can see and do inside Open TMS today. It is written for product, support, and onboarding - if you need to explain "what does my customer get?" this is the source of truth.

For the headless integration path (API keys + JSON), see [CUSTOMER_API_GUIDE.md](./CUSTOMER_API_GUIDE.md). For the developer sub-app inside the portal (webhooks, EDI setup, integration logs), see the [Developer App](#developer-app) section below.

## Table of Contents

- [Overview](#overview)
- [Accounts and Roles](#accounts-and-roles)
- [Sign-in and Sessions](#sign-in-and-sessions)
- [Customer Portal App](#customer-portal-app)
  - [Dashboard](#dashboard)
  - [Orders](#orders)
  - [Shipments](#shipments)
  - [Issues](#issues)
  - [Returns](#returns)
  - [Invoices](#invoices)
  - [Documents](#documents)
  - [Profile](#profile)
- [Developer App](#developer-app)
- [Scoping and Multi-tenancy](#scoping-and-multi-tenancy)
- [What Customers Cannot Do](#what-customers-cannot-do)

---

## Overview

The Customer Portal is a self-service web app for the customers (shippers) that Open TMS moves freight for. It sits at `/customer-portal` and is a separate auth realm from internal TMS staff and from carrier portal users - customers cannot see internal operations data, other customers' shipments, or carrier-only tender pricing.

Three logical surfaces are exposed:

1. **Customer Portal app** - operations + finance self-service for end users.
2. **Developer sub-app** - API keys, webhooks, EDI/JSON integration setup.
3. **Backend API** - `/api/v1/customer-portal/*` endpoints used by both of the above and available for any custom client (Postman, curl, your own UI).

All three are scoped to a single `Customer` record via the logged-in `CustomerUser`.

---

## Accounts and Roles

Customer logins live in the `CustomerUser` table - separate from internal TMS users (`User`) and from carriers (`CarrierUser`). Each row carries:

- `customerId` - which Customer the user works for.
- `role` - one of `admin` or `viewer`.
- `email` (unique), `passwordHash`, `name`.
- Account-security state: `failedLoginAttempts`, `lockedUntil`, `lastLoginAt`.

The seed (`backend/src/scripts/comprehensive-seed.ts`) creates two customer users per seeded customer:

| Email | Role | Notes |
|---|---|---|
| `admin@<slug>.demo` | admin | Can create orders, request returns, dispute invoices |
| `viewer@<slug>.demo` | viewer | Read-only access to the same surfaces |

The role split is enforced today by route-level convention; future role-specific UI hiding lives in the layout's `user.role` check.

**Account management**: customer users are provisioned by internal staff via the admin app (Customers > customer detail > Users). Customers cannot self-register.

---

## Sign-in and Sessions

- Login page: `/customer-portal/login`.
- Endpoint: `POST /api/v1/customer-portal/login` returns `{ token, user }`.
- Token: HS256-signed JWT, 24-hour expiry, issuer `open-tms-customer`.
- Persistence: the token + user payload are mirrored to both `localStorage` and a `SameSite=Lax` cookie on the same domain. The cookie is a fallback so the session survives `localStorage` getting wiped in private mode, by ITP, or by browser extensions. Auth is still carried via the `Authorization: Bearer <jwt>` header on every API call - the cookie is not consumed by the backend.
- Lockout: 5 failed attempts -> 15 minute lockout (`backend/src/services/CustomerAuthService.ts`).
- Logout: clears both `localStorage` and the cookie, then redirects to `/customer-portal/login`.

A "Customer login" link is also surfaced at the bottom of the main staff login page so customers landing on the wrong URL can self-correct.

---

## Customer Portal App

Layout: fixed sidebar with two grouped sections plus an Account section. Topbar shows the customer name pulled from the JWT.

### Dashboard

Path: `/customer-portal` -> [CustomerDashboard.tsx](../frontend/src/pages/customer-portal/CustomerDashboard.tsx)
API: `GET /api/v1/customer-portal/dashboard`

Four summary tiles, each scoped to the logged-in customer. Tiles are clickable and deep-link into the relevant list with a pre-applied filter:

| Tile | Counts | Click destination |
|---|---|---|
| Active shipments | `booked`, `in_transit`, `at_pickup`, `at_delivery` | `shipments?status=active` |
| Delivered | `delivered` (lifetime, not just recent) | `shipments?status=delivered` |
| Open issues | `open` + `in_progress`, scoped via the customer's shipments/orders | `issues?status=open` |
| Outstanding invoices | `sent`, `partial_paid`, `overdue` + total balance | `invoices?status=outstanding` |

Below the tiles, a "Recent shipments" feed shows the 5 most recently updated shipments with click-through to the shipment detail.

### Orders

Paths:
- List: `/customer-portal/orders` -> [CustomerOrders.tsx](../frontend/src/pages/customer-portal/CustomerOrders.tsx)
- Create: `/customer-portal/orders/create` -> [CustomerCreateOrder.tsx](../frontend/src/pages/customer-portal/CustomerCreateOrder.tsx)
- Detail: `/customer-portal/orders/:id` -> [CustomerOrderDetail.tsx](../frontend/src/pages/customer-portal/CustomerOrderDetail.tsx)

What a customer can do:

- **List with search + status filter** (`pending`, `validated`, `assigned`, `delivered`, `exception`). Reads from `OrderReadModel`, so archived orders disappear automatically.
- **Drill into an order** to see PO number, service level, temperature/hazmat requirements, dates, origin + destination, line items, and trackable units.
- **Create an order** with PO number, requested pickup/delivery dates, service level, temperature, hazmat flag, origin + destination addresses, and one or more line items (SKU, description, quantity, weight, dimensions, freight class).
- **Archive an order** (delete icon on the detail page). Archive is allowed at any time - customers may have created an order by accident or simply no longer need it. Archived orders drop out of the active list immediately; the detail page still resolves by ID with a clear "Archived" badge and date so the audit trail is preserved.
- **Auto-archive**: delivered and cancelled orders are auto-archived after 30 days by the `order-auto-archive` cron worker. See [CLAUDE.md > Order Archival Policy](../CLAUDE.md) for the full rule.

### Shipments

Paths:
- List: `/customer-portal/shipments` -> [CustomerShipments.tsx](../frontend/src/pages/customer-portal/CustomerShipments.tsx)
- Detail: `/customer-portal/shipments/:id` -> [CustomerShipmentDetail.tsx](../frontend/src/pages/customer-portal/CustomerShipmentDetail.tsx)

What a customer can do:

- **List with status filter**. Single-status options match the underlying enum (`booked`, `in_transit`, `at_pickup`, `at_delivery`, `delivered`, `exception`). An additional **Active (in flight)** option is a meta-filter for the same 4 statuses the dashboard counts.
- **Drill into a shipment** to see reference, status, carrier, pickup/delivery dates, PRO number, full origin + destination addresses, multi-stop sequence with per-stop status, and the most recent 20 tracking events.
- URL-aware filtering: status is read from `?status=` so deep-links from the dashboard (or shared URLs) restore the same view.

### Issues

Paths:
- List: `/customer-portal/issues` -> [CustomerIssues.tsx](../frontend/src/pages/customer-portal/CustomerIssues.tsx)
- Detail: `/customer-portal/issues/:id` -> [CustomerIssueDetail.tsx](../frontend/src/pages/customer-portal/CustomerIssueDetail.tsx)

Issues are the operational problem log (exceptions, delays, damage, compliance failures). Customers see only issues attached to one of their own shipments or orders - never carrier-only issues or issues with no source entity.

What a customer can do:

- **List filterable by status** (`open`, `in_progress`, `resolved`, `closed`). Default view is `open`.
- **Drill in** to see title, status, priority, category, description, resolution (when set), and the comment thread.
- **Read and post comments**. The thread shows comments that are either (a) authored by the customer side, or (b) flagged "Visible to customer" by internal staff. Internal-only comments are hidden from this view.
- Customer-posted comments are always visible to internal staff in the Triage Centre - customers cannot post privately to themselves.

Internal staff control visibility per-comment via a "Visible to customer in their portal" checkbox in `VNextIssueDetail.tsx`. See [CLAUDE.md > Comment Visibility](../CLAUDE.md) for the full rules.

### Returns

Paths:
- List: `/customer-portal/returns` -> [CustomerReturns.tsx](../frontend/src/pages/customer-portal/CustomerReturns.tsx)
- Request: `/customer-portal/returns/new` -> [CustomerRequestReturn.tsx](../frontend/src/pages/customer-portal/CustomerRequestReturn.tsx)
- Detail: `/customer-portal/returns/:id` -> [CustomerReturnDetail.tsx](../frontend/src/pages/customer-portal/CustomerReturnDetail.tsx)

What a customer can do:

- **List all RMAs** raised against their orders, with status and request date.
- **Open a new return request** against a delivered (or partially delivered) order. The flow picks eligible order line items, captures the return reason from a fixed list (`damaged`, `wrong_item`, `not_as_described`, `no_longer_needed`, `defective`, `ordered_extra`, `other`), and a free-text note. The request is created in `requested` status for CSR review.
- **Drill into a return** to see status, requested items, and CSR notes.
- **Download a generated return label** (when CSR has issued one).

### Invoices

Paths:
- List: `/customer-portal/invoices` -> [CustomerInvoices.tsx](../frontend/src/pages/customer-portal/CustomerInvoices.tsx)

What a customer can do:

- **List invoices with status filter**. Real statuses (`sent`, `partial_paid`, `overdue`, `paid`, `voided`) plus an **Outstanding** meta-option matching the dashboard tile (`sent` + `partial_paid` + `overdue`).
- See per-invoice totals, paid amount, balance, due date, and days overdue.
- **Dispute an invoice**: opens a modal to capture the reason. Creates a `FinancialQuery` (status: `raised`) for the AR team to triage. Only available for `sent` and `overdue` invoices.

Invoice PDFs are exposed via the documents endpoint (next section).

### Documents

Paths:
- List: `/customer-portal/documents` -> [CustomerDocuments.tsx](../frontend/src/pages/customer-portal/CustomerDocuments.tsx)
- Download: `GET /api/v1/customer-portal/documents/:id/download`

What a customer can do:

- See generated documents attached to the customer's own shipments, orders, and invoices (PoDs, BOLs, invoice PDFs, etc.).
- Download a document by ID. The download streams through `IBinaryStorageProvider` so the storage backend (S3 or DB) is transparent. Storage keys are opaque - the URL never exposes filenames or entity IDs.

### Profile

Path: `/customer-portal/profile` -> [CustomerProfile.tsx](../frontend/src/pages/customer-portal/CustomerProfile.tsx)
API: `GET /api/v1/customer-portal/profile`, `POST /api/v1/customer-portal/change-password`

What a customer can do:

- See their email, display name, role, and parent customer.
- **Change password**. Enforced strength: 8+ chars, uppercase, lowercase, number. Wrong current password returns 400.

There is no self-service email change today - that goes through internal staff.

---

## Developer App

Path: `/customer-portal/developer` (sub-app within the same portal session)

The developer sub-app is for customers who want to integrate Open TMS into their own systems. It uses the same customer login and the same scoping rules.

| Page | Path | What it does |
|---|---|---|
| Dashboard | `/developer` | Overview of integration health (API call volume, recent webhook failures, EDI throughput). |
| API Keys | `/developer/api-keys` | Create / revoke API keys for the headless [Customer API](./CUSTOMER_API_GUIDE.md). Each key is scoped to this customer. |
| Webhooks | `/developer/webhooks` | Register outbound webhook URLs for shipment/order events. Includes delivery history and replay. |
| EDI Setup | `/developer/edi` | Configure SFTP credentials + transaction types (850, 855, 856, 990, 210, 820, etc.) for EDI ingest and outbound. |
| Integration Logs | `/developer/logs` | Cross-cuts API calls, webhook deliveries, and EDI transactions in one timeline for debugging. |

---

## Scoping and Multi-tenancy

Every authenticated customer-portal request resolves `req.orgId` and `customerId` from the JWT (`customerUser.customerId` -> `Customer.orgId`). All queries are filtered on at least one of these:

- **Orders, Shipments, Invoices, Documents, RMAs**: `customerId` directly.
- **Issues**: walked through `Issue.sourceEntityType` + `sourceEntityId` to either `Shipment.customerId` or `Order.customerId`. Issues with no source entity, or `sourceEntityType = 'carrier'`, are hidden.
- **Comments**: filtered to `authorType = 'customer'` OR `visibleToCustomer = true`.
- **Documents**: storage keys are opaque (`files/{uuid}`) - the URL never leaks entity info or filenames.

A customer logged into Portal A cannot see, modify, or even infer the existence of Portal B's records. Org-level isolation is enforced at the DB query layer, not just at the UI.

---

## What Customers Cannot Do

The portal is deliberately scoped. Customers cannot:

- See other customers' shipments, orders, invoices, issues, or documents.
- See carrier-side data: tender rates, bid history, carrier user contact info, carrier financial settlement.
- See internal-only comments on their own issues (only `visibleToCustomer = true` or customer-authored comments).
- Cancel or modify a shipment once a carrier has been awarded. (Issues exist for raising delivery exceptions; archive exists for orders.)
- Create or modify their own login. User provisioning + email changes go through internal staff.
- Pay an invoice from the portal today. Disputes are captured; payment capture is a planned addition.
- Access any `/api/v1/...` route outside the `/api/v1/customer-portal/*` prefix. The customer JWT is rejected at the auth middleware on every other route.

---

## Key Files

Backend:
- `backend/src/routes/customerPortal.ts` - all `/api/v1/customer-portal/*` endpoints
- `backend/src/services/CustomerAuthService.ts` - JWT issuance, password hashing, lockout
- `backend/src/middleware/jwtAuth.ts` - `authenticateCustomerJWT` preHandler
- `backend/src/repositories/CustomerUserRepository.ts` - CustomerUser CRUD

Frontend:
- `frontend/src/customer-portal-layout.tsx` - layout, sidebar, auth guard, logout
- `frontend/src/pages/customer-portal/` - all portal pages
- `frontend/src/pages/customer-portal/customerSession.ts` - localStorage + cookie session helper
- `frontend/src/portal-session.ts` - shared session helper (used by customer + carrier portals)

Related:
- [CUSTOMER_API_GUIDE.md](./CUSTOMER_API_GUIDE.md) - headless API integration via API keys
- [CLAUDE.md > Order Archival Policy](../CLAUDE.md) - manual + auto-archive rules
- [CLAUDE.md > Comment Visibility](../CLAUDE.md) - internal/customer visibility model
- [CLAUDE.md > Issue / Triage Centre](../CLAUDE.md) - the system the customer Issues page mirrors
