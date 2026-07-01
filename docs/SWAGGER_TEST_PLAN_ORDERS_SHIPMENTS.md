# Swagger UI Test Plan — Orders & Shipments

Manual test plan for exercising the **Orders** and **Shipments** APIs through
Swagger UI, running locally.

- Swagger UI: `http://localhost:3001/docs` (only available when the backend
  is running with `NODE_ENV` unset or not `production` —
  [index.ts:176](../backend/src/index.ts:176))
- Base API prefix: `/api/v1`
- Response envelope: every endpoint returns `{ "data": ..., "error": ... }`.
  A successful call has `error: null`; a failed call has `data: null` and a
  message in `error`.

---

## 0. Before you start

### 0.1 Start the backend

```
cd backend
npm run dev
```

Confirm `http://localhost:3001/docs` loads in the browser and shows the
Swagger UI page with a list of endpoints.

### 0.2 ⚠️ Known limitation: Swagger's "Authorize" button will NOT work for these endpoints

Orders and Shipments require a normal user login (JWT), checked by
`authenticateJWT` in [jwtAuth.ts:95](../backend/src/middleware/jwtAuth.ts:95).
It expects `Authorization: Bearer <token>`.

But the Swagger document only defines **one** security scheme —
`ApiKeyAuth` (the `x-api-key` header used by the *Customer API*,
[index.ts:160-174](../backend/src/index.ts:160)). No `bearerAuth` scheme is
registered, and none of the Orders/Shipments routes declare a `security`
block the way `customerApi.ts` and `customerRmaApi.ts` do
(`security: apiKeySecurity` / `security: [{ ApiKeyAuth: [] }]`).

**Practical effect:** clicking the padlock icon ("Authorize") in Swagger UI
gives you a box for an API key — there is nowhere to paste a JWT, and
Swagger UI won't attach a bearer token to requests just because you typed it
somewhere else. `Try it out` on any Orders/Shipments endpoint will send the
request with no `Authorization` header and get back `401 Authorization
header required`.

This is **Test Case AUTH-1** below — verify it, don't just take our word for
it. Two possible outcomes once you run it:
- If it behaves as described, this is a real gap worth reporting (Swagger UI
  is currently unusable for hands-on testing of Orders/Shipments — you'd need
  Postman with a manually-set `Authorization` header instead, the same way
  you already test the Stocs Bids integration).
- If your browser has an extension that injects a fixed header (e.g.
  ModHeader), you can work around it locally, but that's not a fix for other
  testers.

### 0.3 Get a JWT anyway (for the workaround / for AUTH-1)

1. In Swagger UI find `POST /api/v1/auth/login` (tag **Auth**).
2. Click **Try it out**, enter valid credentials in the request body, **Execute**.
3. Copy the `token` value from the response body — you'll need it either for
   a header-injecting extension, or for cross-checking the same call in
   Postman.

### 0.4 Test data you'll need

- A valid `customerId` (UUID) — get one from `GET /api/v1/customers` (or ask
  whoever seeded your dev database).
- A valid `originId` / `destinationId`, or be ready to supply raw
  `originData` / `destinationData` objects (see 1.2 below).
- The org your login belongs to — all list/get calls are scoped to your
  JWT's `organizationId`, see 4.3.

---

## 1. Orders — Core CRUD

| ID | Endpoint | Steps | Expected Result |
|----|----------|-------|------------------|
| ORD-1 | `GET /api/v1/orders` | Try it out → Execute (no filters) | 200, `data` is an array. Note whether the endpoint even shows up with proper docs — it has **no schema block**, so Swagger UI won't show a `customerId` query-param field even though the handler reads one ([orders.ts:191-192](../backend/src/routes/orders.ts:191)). Confirm this gap: try appending `?customerId=<uuid>` manually to the URL in the browser network tab / via curl and confirm it filters, proving the param works even though Swagger doesn't advertise it. |
| ORD-2 | `POST /api/v1/orders` — happy path | Try it out. Because there's no documented request body, Swagger UI gives you no body editor — you'll need to switch the body type to a raw JSON textbox if Swagger UI allows one, or fall back to Postman/curl for this one. Body: `{ "orderNumber": "TEST-001", "customerId": "<uuid>", "destinationData": {...}, "originData": {...}, "lineItems": [{ "sku":"SKU1","quantity":1 }] }` (schema at [orders.ts:82-136](../backend/src/routes/orders.ts:82)) | 201, `data` is the created order with the fields you sent. |
| ORD-3 | `POST /api/v1/orders` — missing required field | Omit `customerId` | 400 with a Zod validation message referencing `customerId`. |
| ORD-4 | `POST /api/v1/orders` — invalid `serviceLevel` | Send `serviceLevel: "XYZ"` (only `FTL`/`LTL` allowed, [orders.ts:118](../backend/src/routes/orders.ts:118)) | 400. |
| ORD-5 | `GET /api/v1/orders/:id` | Use the id from ORD-2 | 200, order detail matches what was created. |
| ORD-6 | `GET /api/v1/orders/:id` — unknown id | Use a random UUID | 404, `error` explains order not found. |
| ORD-7 | `PUT /api/v1/orders/:id` | Update `notes` and `status` (allowed values: `pending, validated, location_error, converted, cancelled, archived` — [orders.ts:138](../backend/src/routes/orders.ts:138)) | 200, changes reflected on re-`GET`. |
| ORD-8 | `PUT /api/v1/orders/:id` — invalid status enum | Send `status: "shipped"` | 400. |
| ORD-9 | `DELETE /api/v1/orders/:id` | Delete the test order created in ORD-2 | 200/204 depending on implementation; follow-up `GET` returns 404. |
| ORD-10 | `POST /api/v1/orders/:id/validate-location` | Run against an order with `originId`/`destinationId` set | 200, order's location validation status updates. |

## 2. Orders — Line Items & Trackable Units

These *are* documented with `schema.tags: ['Orders - Line Items']` /
similar, so Swagger UI should render proper body editors for them —
confirm that as part of testing.

| ID | Endpoint | Steps | Expected Result |
|----|----------|-------|------------------|
| ORD-11 | `POST /api/v1/orders/:id/line-items` | Add a line item with valid `sku`+`quantity` ([orders.ts:413](../backend/src/routes/orders.ts:413)) | 200/201, item appears on the order. |
| ORD-12 | `PUT /api/v1/orders/:orderId/line-items/:itemId` | Update quantity | 200, reflected on re-`GET` order. |
| ORD-13 | `DELETE /api/v1/orders/:orderId/line-items/:itemId` | Remove the item | 200, item gone from order. |
| ORD-14 | `PUT /api/v1/orders/:orderId/line-items/:itemId/move` | Move a line item into a different trackable unit on the **same** order | 200, item now nested under the target unit. |
| ORD-15 | `POST /api/v1/orders/:id/trackable-units` | Create a unit with `identifier`, `unitType`, and ≥1 line item ([orders.ts:65-73](../backend/src/routes/orders.ts:65)) | 201, unit appears with nested line items. |
| ORD-16 | `POST /api/v1/orders/:id/trackable-units` — empty line items | Send `lineItems: []` | 400 ("Each trackable unit must have at least one line item"). |
| ORD-17 | `PUT /api/v1/orders/:orderId/trackable-units/:unitId` | Update `notes` | 200. |
| ORD-18 | `DELETE /api/v1/orders/:orderId/trackable-units/:unitId` | Delete unit | 200, unit removed. |
| ORD-19 | `POST /api/v1/orders/:orderId/trackable-units/:unitId/generate-barcode` | Run on an existing unit | 200, response includes a generated barcode string. |
| ORD-20 | `POST /api/v1/orders/:orderId/trackable-units/merge` | Merge two units on the same order | 200, one resulting unit with combined line items. |
| ORD-21 | `POST /api/v1/orders/:orderId/trackable-units/:unitId/split` | Split a unit into two | 200, two resulting units. |
| ORD-22 | Cross-tenant guard | Take a `unitId` that belongs to a **different** order and call `PUT /api/v1/orders/:orderId/trackable-units/:unitId` with a mismatched `orderId` | Should be rejected (the code explicitly checks `unitBelongsToOrder` — [orders.ts:179-182](../backend/src/routes/orders.ts:179)). Confirm it does **not** silently update the foreign unit. |

## 3. Orders — Lifecycle: Conversion, Assignment, Delivery

None of these have `schema` blocks, so expect the same "no body editor in
Swagger UI" issue as ORD-2 — note it for each, don't re-derive it every row.

| ID | Endpoint | Steps | Expected Result |
|----|----------|-------|------------------|
| ORD-23 | `POST /api/v1/orders/:id/convert-to-shipment` | Order with valid origin/destination | 200, `data` contains new shipment info; order status becomes `converted`. |
| ORD-24 | `POST /api/v1/orders/:id/assign-to-shipment` — `autoAssign` matching lane exists | Per [CUSTOMER_API_GUIDE.md](CUSTOMER_API_GUIDE.md) auto-assignment logic: FTL creates a dedicated shipment, LTL consolidates into an existing draft on the same lane | 200, `data.success: true`, shipment reference returned. |
| ORD-25 | `POST /api/v1/orders/:id/assign-to-shipment` — no matching lane | Use an order with an origin/destination combo that has no active lane | 200 with `success: false` and a message, OR check whether a `PendingLaneRequest` was created and order status became `pending_lane` per the documented behavior. |
| ORD-26 | `POST /api/v1/orders/:id/delivery-status` | Body `{ "deliveryStatus": "in_transit" }` (valid values: `unassigned, assigned, in_transit, delivered, exception, cancelled` — [orders.ts:139](../backend/src/routes/orders.ts:139)) | 200, order's `deliveryStatus` updates. |
| ORD-27 | `POST /api/v1/orders/:id/delivery-status` — invalid enum | `{ "deliveryStatus": "lost" }` | 400. |
| ORD-28 | `POST /api/v1/orders/:id/mark-delivered` | Body `{ "method": "manual", "confirmedBy": "tester" }` | 200, `deliveryStatus` becomes `delivered`. |
| ORD-29 | `POST /api/v1/orders/:id/delivery-exception` | Body `{ "exceptionType": "damage", "exceptionNotes": "box crushed" }` (types: `delay, damage, refused, address_issue, weather, other`) | 200, `deliveryStatus` becomes `exception`. |
| ORD-30 | `POST /api/v1/orders/:id/resolve-exception` | Run after ORD-29 | 200, exception cleared, status moves on. |
| ORD-31 | `GET /api/v1/orders/:id/audit-logs` | Run after making several changes above | 200, `data` array — check whether entries actually appear (code comment at [orders.ts:739](../backend/src/routes/orders.ts:739) suggests audit logging may not be wired up for every operation — worth confirming what's actually captured vs. empty). |
| ORD-32 | `GET /api/v1/orders/:id/status-timeline` | Same order | 200, timeline reflects the status changes made during this test session. |

## 4. Orders — Batch, Compatibility, Split, Import/Export

| ID | Endpoint | Steps | Expected Result |
|----|----------|-------|------------------|
| ORD-33 | `POST /api/v1/orders/check-compatibility` | Body `{ "orderIds": ["<id1>", "<id2>"] }` | 200, compatibility result (whether they can be combined onto one shipment). |
| ORD-34 | `POST /api/v1/orders/batch-convert` | Body `{ "orderIds": [...], "mode": "combine" }` and separately `mode: "individual"` | 200 for both modes; `combine` produces one shipment, `individual` produces one per order. |
| ORD-35 | `POST /api/v1/orders/:id/split-to-shipments` | Body with **2 groups** of `trackableUnitIds`/`legacyItemIds` (minimum 2 groups enforced — [orders.ts:1231](../backend/src/routes/orders.ts:1231)) | 200, two shipments created from one order. |
| ORD-36 | `POST /api/v1/orders/:id/split-to-shipments` — only 1 group | Send a single group | 400 (schema requires `.min(2)`). |
| ORD-37 | `GET /api/v1/orders/:id/export/csv` | Try it out | 200, response is CSV text (check `Content-Type` header, not JSON). |
| ORD-38 | `GET /api/v1/orders/import/csv/template` | Try it out | 200, downloadable CSV template. |
| ORD-39 | `POST /api/v1/orders/import/csv` | Upload a small CSV file matching the template | 200/201, orders created; check response summarizes success/failure counts. |
| ORD-40 | `POST /api/v1/orders/import/csv` — malformed CSV | Upload a file with missing required columns | 400 or a per-row error summary — confirm it doesn't silently drop bad rows. |

## 5. Shipments — Core CRUD

| ID | Endpoint | Steps | Expected Result |
|----|----------|-------|------------------|
| SHP-1 | `GET /api/v1/shipments` | Try it out, optionally with `status`/`customerId` query params | 200, array of shipments with nested `customer`/`origin`/`destination`/`carrier`/`lane` objects. |
| SHP-2 | `POST /api/v1/shipments` — via `laneId` | Body `{ "customerId": "<uuid>", "laneId": "<uuid>" }` (one of three valid combos — see refine at [shipments.ts:171-177](../backend/src/routes/shipments.ts:171)) | 201, shipment created in `draft` status. |
| SHP-3 | `POST /api/v1/shipments` — via origin/destination ids | Body with `originId`+`destinationId`, no `laneId` | 201. |
| SHP-4 | `POST /api/v1/shipments` — via raw address data | Body with `originData`+`destinationData` objects | 201. |
| SHP-5 | `POST /api/v1/shipments` — none of the three combos | Omit `laneId`, `originId/destinationId`, and `originData/destinationData` | 400, error message: "Provide laneId, both originId/destinationId, or both originData/destinationData". |
| SHP-6 | `POST /api/v1/shipments` — flexible date formats | Try `pickupDate` as `"2026-07-15"` (date-only) and separately as a full ISO datetime | Both accepted, normalized to full ISO in the stored/returned value ([shipments.ts:21-30](../backend/src/routes/shipments.ts:21)). |
| SHP-7 | `POST /api/v1/shipments` — invalid date | `pickupDate: "not-a-date"` | 400 "Invalid date or datetime". |
| SHP-8 | `GET /api/v1/shipments/:id` | Use id from SHP-2 | 200, full detail. |
| SHP-9 | `GET /api/v1/shipments/:id` — unknown/foreign id | Random UUID, or an id from a different org if you can get one | 404. |
| SHP-10 | `PUT /api/v1/shipments/:id` | Update `reference` or `proNumber` | 200, reflected on re-`GET`. |
| SHP-11 | `GET /api/v1/shipments/:id/events` | Run on a shipment after a few updates | 200, event history array. |

## 6. Shipments — Archive / Delete / Permissions

These three carry `preHandler: requirePermission(...)` — good candidates for
testing permission enforcement, not just happy path.

| ID | Endpoint | Steps | Expected Result |
|----|----------|-------|------------------|
| SHP-12 | `DELETE /api/v1/shipments/:id` (archive) | Login as a user **with** `shipments:write` | 200, `data: { id, archived: true }`; shipment disappears from `GET /api/v1/shipments` default list. |
| SHP-13 | `DELETE /api/v1/shipments/:id` — insufficient permission | Login as a user **without** `shipments:write` (if such a test account exists) | 403 "Insufficient permissions" per [jwtAuth.ts:130](../backend/src/middleware/jwtAuth.ts:130). |
| SHP-14 | `POST /api/v1/shipments/:id/soft-delete` | Login as a user with `shipments:delete` | 200, `data: { id, deleted: true }`; shipment hidden from *every* view (stronger than archive). |
| SHP-15 | `POST /api/v1/shipments/:id/unarchive` | Run on a shipment archived in SHP-12 | 200, `data: { id, archived: false }`; shipment reappears in default list. |
| SHP-16 | `DELETE /api/v1/shipments/:id` — already archived/deleted id | Re-run SHP-12 against the same id | 404 "Shipment not found" (query filters on `deletedAt: null`). |

## 7. Shipments — Lifecycle (readiness / transition)

Lifecycle states: `draft → ready → in_progress → complete`
([shipments.ts:99](../backend/src/routes/shipments.ts:99)).

| ID | Endpoint | Steps | Expected Result |
|----|----------|-------|------------------|
| SHP-17 | `GET /api/v1/shipments/:id/readiness` | On a freshly created (draft) shipment | 200, `data.status: "draft"`, `data.missing` lists any required fields not yet set, `data.allowedTransitions` shows valid next steps. |
| SHP-18 | `POST /api/v1/shipments/:id/transition` — valid forward step | Body `{ "toStatus": "ready" }` on a shipment that passes the readiness gate | 200, status becomes `ready`. |
| SHP-19 | `POST /api/v1/shipments/:id/transition` — gate blocks | Attempt `ready → in_progress` (or any transition) while required fields are still missing per readiness check | 400, blocked with explanation — confirm the readiness gate is actually enforced, not just advisory. |
| SHP-20 | `POST /api/v1/shipments/:id/transition` — invalid target status | `{ "toStatus": "cancelled" }` (not in `SHIPMENT_LIFECYCLE`) | 400, schema validation error (enum mismatch). |
| SHP-21 | `POST /api/v1/shipments/:id/transition` — skip a step | Attempt `draft → complete` directly | Should be rejected — confirm `allowedTransitions` only permits one step at a time. |
| SHP-22 | `POST /api/v1/shipments/:id/transition` — unknown shipment id | Random UUID | 404. |
| SHP-23 | `POST /api/v1/shipments/bulk-transition` — mixed validity | Body `{ "ids": ["<ready-one>", "<not-ready-one>"], "toStatus": "in_progress" }` | 200, per-shipment results — confirm the response tells you which succeeded and which failed, rather than all-or-nothing. |
| SHP-24 | `POST /api/v1/shipments/bulk-transition` — >500 ids | Send 501 ids | 400 (schema caps at `.max(500)` — [shipments.ts:618](../backend/src/routes/shipments.ts:618)). |
| SHP-25 | `POST /api/v1/shipments/:id/geofence-check` | Body with `lat`/`lng` inside vs. outside the destination geofence | Confirm behavior differs (e.g. triggers an arrival event) — this doubles as an IoT/webhook endpoint, worth checking it doesn't require the same interactive auth (it may be intended for machine-to-machine calls). |

---

## 8. Cross-cutting checks (run once, applies to all endpoints above)

| ID | Check | How |
|----|-------|-----|
| CC-1 | Response envelope consistency | Every response you captured above should be shaped `{ "data": ..., "error": ... }`. Flag any endpoint that deviates (e.g. CSV export, which is raw text — confirm that's intentional, not a bug). |
| CC-2 | Org scoping (multi-tenant isolation) | If you have login credentials for two different orgs, confirm a shipment/order created under org A returns 404 (not the data) when fetched with an org B token. `registerOrgScope` ([orders.ts:188](../backend/src/routes/orders.ts:188), [shipments.ts:35](../backend/src/routes/shipments.ts:35)) is what's supposed to enforce this. |
| CC-3 | Missing/expired JWT | With no `Authorization` header at all (default Swagger UI state, see AUTH-1), every Orders/Shipments call should return `401 { "data": null, "error": "Authorization header required" }`, never a 500 or a data leak. |
| CC-4 | Undocumented endpoints inventory | While going through Sections 1, 3, 4 above, keep a running list of every endpoint that showed up in Swagger UI with **no request-body editor / no parameter docs**. This becomes the backlog for "add `schema:` blocks" follow-up work — Line Items/Trackable Units and most of Shipments' lifecycle endpoints already do this correctly; Orders' core CRUD and lifecycle-adjacent endpoints (convert/assign/delivery/batch/split) currently don't. |

---

## 9. Reporting results

For each failed/unexpected test case, record: endpoint, request body sent,
actual response (status + body), expected response, and whether you had to
work around AUTH-1 to even attempt it (e.g. via Postman instead of Swagger
UI's Try-it-out). That last detail matters — it tells us whether the bug is
in the API itself or purely in how it's exposed through Swagger.
