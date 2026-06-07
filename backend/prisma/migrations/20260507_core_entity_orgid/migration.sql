-- Phase 1 of the multi-tenancy plan: add orgId to the core entities that
-- previously had no column for it. Columns are nullable so the backfill can
-- run lazily without breaking applications mid-deploy. New writes from
-- authed routes always populate orgId via req.user.organizationId; legacy
-- rows are backfilled here on a best-effort basis. Future phase 2 will
-- tighten these to NOT NULL once the backfill is verified.
--
-- Backfill chain (each step uses the previous step's results):
--   Customer.orgId   ← User.organizationId   (any User attached to this Customer)
--   Carrier.orgId    ← Customer.orgId        (via the Customer that has the
--                                              most shipments with this Carrier;
--                                              fall back to default Organization)
--   Order.orgId      ← Customer.orgId
--   ApiKey.orgId     ← Customer.orgId (when customerId is set)
--   TradingPartner.orgId ← Customer.orgId, else Carrier.orgId

ALTER TABLE "Customer"        ADD COLUMN "orgId" TEXT;
ALTER TABLE "Carrier"         ADD COLUMN "orgId" TEXT;
ALTER TABLE "Order"           ADD COLUMN "orgId" TEXT;
ALTER TABLE "ApiKey"          ADD COLUMN "orgId" TEXT;
ALTER TABLE "TradingPartner"  ADD COLUMN "orgId" TEXT;

-- Step 1: Customer.orgId from User.organizationId
-- (DISTINCT ON to pick a single user per customer — first match wins)
UPDATE "Customer" c
SET "orgId" = u."organizationId"
FROM (
  SELECT DISTINCT ON ("customerId") "customerId", "organizationId"
  FROM "User"
  WHERE "customerId" IS NOT NULL
    AND "organizationId" IS NOT NULL
) u
WHERE c."id" = u."customerId"
  AND c."orgId" IS NULL;

-- Customers with no attached User: fall back to the first Organization
UPDATE "Customer"
SET "orgId" = (SELECT "id" FROM "Organization" ORDER BY "createdAt" ASC LIMIT 1)
WHERE "orgId" IS NULL;

-- Step 2: Carrier.orgId from the customer whose shipments most frequently
-- use this carrier (best-effort heuristic).
UPDATE "Carrier" c
SET "orgId" = cust."orgId"
FROM (
  SELECT DISTINCT ON (s."carrierId") s."carrierId", cu."orgId"
  FROM "Shipment" s
  JOIN "Customer" cu ON cu."id" = s."customerId"
  WHERE s."carrierId" IS NOT NULL
    AND cu."orgId" IS NOT NULL
  ORDER BY s."carrierId", s."createdAt" DESC
) cust
WHERE c."id" = cust."carrierId"
  AND c."orgId" IS NULL;

-- Orphan carriers (no shipments yet): default org
UPDATE "Carrier"
SET "orgId" = (SELECT "id" FROM "Organization" ORDER BY "createdAt" ASC LIMIT 1)
WHERE "orgId" IS NULL;

-- Step 3: Order.orgId from Customer.orgId
UPDATE "Order" o
SET "orgId" = c."orgId"
FROM "Customer" c
WHERE o."customerId" = c."id"
  AND o."orgId" IS NULL;

-- Step 4: ApiKey.orgId from Customer.orgId when scoped, else default org
UPDATE "ApiKey" k
SET "orgId" = c."orgId"
FROM "Customer" c
WHERE k."customerId" = c."id"
  AND k."orgId" IS NULL;

UPDATE "ApiKey"
SET "orgId" = (SELECT "id" FROM "Organization" ORDER BY "createdAt" ASC LIMIT 1)
WHERE "orgId" IS NULL;

-- Step 5: TradingPartner.orgId — prefer customer-side scope, then carrier
UPDATE "TradingPartner" tp
SET "orgId" = c."orgId"
FROM "Customer" c
WHERE tp."customerId" = c."id"
  AND tp."orgId" IS NULL;

UPDATE "TradingPartner" tp
SET "orgId" = car."orgId"
FROM "Carrier" car
WHERE tp."carrierId" = car."id"
  AND tp."orgId" IS NULL;

UPDATE "TradingPartner"
SET "orgId" = (SELECT "id" FROM "Organization" ORDER BY "createdAt" ASC LIMIT 1)
WHERE "orgId" IS NULL;

-- Indexes for scoped queries (mirror what each existing read pattern needs)
CREATE INDEX "Customer_orgId_idx"        ON "Customer"("orgId");
CREATE INDEX "Carrier_orgId_idx"         ON "Carrier"("orgId");
CREATE INDEX "Order_orgId_idx"           ON "Order"("orgId");
CREATE INDEX "Order_orgId_status_idx"    ON "Order"("orgId", "status");
CREATE INDEX "ApiKey_orgId_idx"          ON "ApiKey"("orgId");
CREATE INDEX "TradingPartner_orgId_idx"  ON "TradingPartner"("orgId");
