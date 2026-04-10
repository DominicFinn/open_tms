# Testing Strategy

**Date:** 2026-03-30
**Current state:** 2 test files, 11 test cases, ~1% coverage. Tests don't run in CI.

---

## Current Coverage

| Area | Source Files | Test Files | Test Cases |
|------|-------------|------------|------------|
| Backend | 99 | 1 | 5 |
| Frontend | 63 | 1 | 6 |
| E2E | — | 0 | 0 |
| **Total** | **162** | **2** | **11** |

The only things tested are `DistanceService` (backend) and `LocationMap` component (frontend).

---

## Strategy: Three Tiers

### Tier 1 — Unit Tests (immediate priority)

Fast, isolated, no database or network. Mock external dependencies.

#### Backend — What to Test First

**Repositories (highest value):**
These are where saves break. Test each repository's CRUD methods against a mocked Prisma client.

| Repository | File | Priority |
|-----------|------|----------|
| ShipmentsRepository | `backend/src/repositories/ShipmentsRepository.ts` | P0 |
| OrdersRepository | `backend/src/repositories/OrdersRepository.ts` | P0 |
| CustomersRepository | `backend/src/repositories/CustomersRepository.ts` | P0 |
| LocationsRepository | `backend/src/repositories/LocationsRepository.ts` | P0 |
| CarriersRepository | `backend/src/repositories/CarriersRepository.ts` | P1 |
| LanesRepository | `backend/src/repositories/LanesRepository.ts` | P1 |

**Services (business logic):**

| Service | File | Priority |
|---------|------|----------|
| DocumentGenerationService | `backend/src/services/DocumentGenerationService.ts` | P0 |
| EmailTemplateService | `backend/src/services/EmailTemplateService.ts` | P1 |
| CustomFieldService | `backend/src/services/CustomFieldService.ts` | P1 |
| DailyReportService | `backend/src/services/DailyReportService.ts` | P2 |
| EdiService | `backend/src/services/EdiService.ts` | P2 |

**Utilities:**

| Utility | File | Priority |
|---------|------|----------|
| DistanceService | Already tested | Done |
| EDI Parser (850/856) | `backend/src/services/edi/` | P1 |
| Event handlers | `backend/src/events/handlers/` | P2 |

#### Frontend — What to Test First

**Form components (where saves happen):**

| Component | File | Priority |
|-----------|------|----------|
| ShipmentCreationForm | `frontend/src/components/ShipmentCreationForm.tsx` | P0 |
| OrderCreationForm | `frontend/src/components/OrderCreationForm.tsx` | P0 |
| LocationCreationForm | `frontend/src/components/LocationCreationForm.tsx` | P0 |
| CarrierCreationForm | `frontend/src/components/CarrierCreationForm.tsx` | P1 |
| CustomerCreationForm | `frontend/src/components/CustomerCreationForm.tsx` | P1 |

Test that:
- Required field validation works
- Submit sends the correct payload shape to the correct endpoint
- Error responses are handled and displayed
- Success redirects/callbacks fire

**Provider components:**

| Component | File | Priority |
|-----------|------|----------|
| ThemeProvider | `frontend/src/ThemeProvider.tsx` | P1 |
| MapProvider | `frontend/src/MapProvider.tsx` | P1 |

---

### Tier 2 — Integration / Smoke Tests

These hit real services (database, APIs) but in a controlled test environment.

#### Backend API Smoke Tests

Spin up the Fastify server + test database, hit each endpoint, verify the response shape.

**Recommended approach:**
- Use `docker-compose` to spin up a test PostgreSQL instance
- Use Fastify's `.inject()` method (no real HTTP needed)
- Run migrations on the test DB before the suite
- Truncate tables between tests

**What to smoke test:**

| Endpoint Group | Method | Route | Check |
|---------------|--------|-------|-------|
| Shipments | POST | `/api/v1/shipments` | Creates and returns `{ data }` |
| Shipments | GET | `/api/v1/shipments` | Returns list in `{ data }` |
| Shipments | GET | `/api/v1/shipments/:id` | Returns single in `{ data }` |
| Shipments | PUT | `/api/v1/shipments/:id` | Updates and returns `{ data }` |
| Orders | POST | `/api/v1/orders` | Creates and returns `{ data }` |
| Customers | POST/GET/PUT | `/api/v1/customers/*` | CRUD cycle |
| Locations | POST/GET/PUT | `/api/v1/locations/*` | CRUD cycle |
| Carriers | POST/GET/PUT | `/api/v1/carriers/*` | CRUD cycle |
| Lanes | POST/GET/PUT | `/api/v1/lanes/*` | CRUD cycle |
| Documents | POST | `/api/v1/shipments/:id/documents/generate` | Returns document |
| Theme | GET/PUT | `/api/v1/theme` | Read + update cycle |
| Email Settings | GET/PUT | `/api/v1/email-settings` | Read + update cycle |

**Test database setup script:**
```bash
# Add to docker-compose.yml
test-db:
  image: postgres:16-alpine
  ports:
    - "55433:5432"
  environment:
    POSTGRES_DB: open_tms_test
    POSTGRES_USER: postgres
    POSTGRES_PASSWORD: postgres
```

**NPM script to add:**
```json
"test:integration": "DATABASE_URL=postgresql://postgres:postgres@localhost:55433/open_tms_test jest --config jest.integration.config.cjs --runInBand"
```

---

### Tier 3 — End-to-End Tests

Full browser tests simulating real user workflows.

**Recommended tool:** Playwright
- Built-in TypeScript support
- Multi-browser (Chromium, Firefox, WebKit)
- Auto-waiting, no flaky selectors
- Trace viewer for debugging failures

**Critical user flows to test:**

| Flow | Steps | Priority |
|------|-------|----------|
| Create Shipment | Login > New Shipment > Fill form > Save > Verify on list | P0 |
| Create Order on Shipment | Navigate to shipment > Add order > Fill form > Save | P0 |
| Create Customer | Admin > New Customer > Fill form > Save > Verify | P1 |
| Create Location | Locations > New > Fill form + map > Save > Verify | P1 |
| Generate BOL | Shipment details > Generate BOL > Download | P1 |
| Theme Settings | Admin > Theme > Change colour > Save > Verify applied | P2 |
| EDI Partner Setup | Integrations > EDI > New partner > Configure > Test | P2 |

---

## CI Pipeline Changes

The current CI pipeline (`deploy.yml`) runs builds but **never runs tests**. Fix:

```yaml
test:
  runs-on: ubuntu-latest
  services:
    postgres:
      image: postgres:16-alpine
      env:
        POSTGRES_DB: open_tms_test
        POSTGRES_USER: postgres
        POSTGRES_PASSWORD: postgres
      ports:
        - 5432:5432
      options: >-
        --health-cmd pg_isready
        --health-interval 10s
        --health-timeout 5s
        --health-retries 5
  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
      with:
        node-version: 20
    - run: npm ci
    - run: npm -w backend run build
    - run: npm -w frontend run build
    - name: Run migrations
      run: npx -w backend prisma migrate deploy
      env:
        DATABASE_URL: postgresql://postgres:postgres@localhost:5432/open_tms_test
    - name: Backend unit tests
      run: npm -w backend test
    - name: Frontend unit tests
      run: npm -w frontend test
    - name: Backend integration tests
      run: npm -w backend run test:integration
      env:
        DATABASE_URL: postgresql://postgres:postgres@localhost:5432/open_tms_test
```

---

## Recommended Implementation Order

### Phase 1 — Quick Wins (this week)
1. Fix CI to actually run existing tests
2. Add backend repository unit tests for Shipments, Orders, Customers, Locations
3. Add frontend form submission tests for ShipmentCreationForm and OrderCreationForm
4. **Target: 30+ test cases, catch the save bugs**

### Phase 2 — Foundation (next 1-2 weeks)
5. Add test database to docker-compose
6. Add Fastify `.inject()` smoke tests for all CRUD endpoints
7. Add remaining repository and service unit tests
8. Add remaining form component tests
9. **Target: 100+ test cases, all CRUD paths covered**

### Phase 3 — Confidence (2-4 weeks)
10. Set up Playwright for E2E
11. Add critical user flow tests (create shipment, generate BOL)
12. Add EDI parsing tests
13. Add event handler tests
14. **Target: 200+ test cases, all critical paths covered**

### Phase 4 — Maturity (ongoing)
15. Coverage gates in CI (e.g. fail if coverage drops below 60%)
16. Visual regression tests for theme system
17. Load testing for API endpoints
18. Contract tests between frontend and backend
