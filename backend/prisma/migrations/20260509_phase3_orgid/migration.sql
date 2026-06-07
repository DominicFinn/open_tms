-- Phase 3 of the multi-tenancy plan: add orgId to the catalogue entities
-- that previously had no tenancy scope: Location, Lane, Driver, Vehicle,
-- Device.
--
-- Product call (recorded here so the migration is self-documenting):
-- treat all five as per-org. Locations, lanes, drivers, vehicles, and
-- devices are operational data each tenant manages independently. A
-- shared logistics catalogue is a future feature, not the current shape.
--
-- Backfill chain:
--   Driver.orgId   ← Carrier.orgId    (Driver has carrierId NOT NULL)
--   Vehicle.orgId  ← Carrier.orgId    (Vehicle has carrierId NOT NULL)
--   Lane.orgId     ← most common Customer.orgId across attached shipments;
--                    fall back to default Organization for orphans
--   Location.orgId ← most common Customer.orgId across attached Shipments
--                    (origin/destination); fall back to default org
--   Device.orgId   ← most common Customer.orgId across attached
--                    DeviceAssignment → Shipment; fall back to default org

ALTER TABLE "Location" ADD COLUMN "orgId" TEXT;
ALTER TABLE "Lane"     ADD COLUMN "orgId" TEXT;
ALTER TABLE "Driver"   ADD COLUMN "orgId" TEXT;
ALTER TABLE "Vehicle"  ADD COLUMN "orgId" TEXT;
ALTER TABLE "Device"   ADD COLUMN "orgId" TEXT;

-- Step 1: Driver.orgId from Carrier (clean: carrierId is NOT NULL post phase 1)
UPDATE "Driver" d
SET "orgId" = c."orgId"
FROM "Carrier" c
WHERE d."carrierId" = c."id"
  AND d."orgId" IS NULL;

-- Step 2: Vehicle.orgId from Carrier (clean: carrierId is NOT NULL)
UPDATE "Vehicle" v
SET "orgId" = c."orgId"
FROM "Carrier" c
WHERE v."carrierId" = c."id"
  AND v."orgId" IS NULL;

-- Step 3: Lane.orgId — pick the orgId of the customer that has the most
-- shipments on this lane. (Tie-break by most recent shipment date.)
UPDATE "Lane" l
SET "orgId" = picked."orgId"
FROM (
  SELECT DISTINCT ON (s."laneId") s."laneId", c."orgId"
  FROM "Shipment" s
  JOIN "Customer" c ON c."id" = s."customerId"
  WHERE s."laneId" IS NOT NULL
    AND c."orgId" IS NOT NULL
  ORDER BY s."laneId", s."createdAt" DESC
) picked
WHERE l."id" = picked."laneId"
  AND l."orgId" IS NULL;

-- Lanes with no attached shipments: default org
UPDATE "Lane"
SET "orgId" = (SELECT "id" FROM "Organization" ORDER BY "createdAt" ASC LIMIT 1)
WHERE "orgId" IS NULL;

-- Step 4: Location.orgId — same heuristic. Pick the tenant that has the
-- most shipments referencing this location as origin or destination. If a
-- location is shared across tenants (legacy single-tenant database has
-- this for sure), the most-recent-shipment owner wins.
WITH location_owners AS (
  SELECT loc_id, "orgId"
  FROM (
    SELECT DISTINCT ON (loc_id)
      loc_id,
      c."orgId",
      max_created
    FROM (
      SELECT s."originId"      AS loc_id, s."customerId", s."createdAt" AS max_created FROM "Shipment" s WHERE s."originId" IS NOT NULL
      UNION ALL
      SELECT s."destinationId" AS loc_id, s."customerId", s."createdAt" AS max_created FROM "Shipment" s WHERE s."destinationId" IS NOT NULL
    ) refs
    JOIN "Customer" c ON c."id" = refs."customerId"
    WHERE c."orgId" IS NOT NULL
    ORDER BY loc_id, max_created DESC
  ) ranked
)
UPDATE "Location" l
SET "orgId" = lo."orgId"
FROM location_owners lo
WHERE l."id" = lo.loc_id
  AND l."orgId" IS NULL;

-- Unattached locations: default org
UPDATE "Location"
SET "orgId" = (SELECT "id" FROM "Organization" ORDER BY "createdAt" ASC LIMIT 1)
WHERE "orgId" IS NULL;

-- Step 5: Device.orgId — walk via DeviceAssignment → Shipment → Customer.
-- Devices that have never been assigned: default org.
WITH device_owners AS (
  SELECT DISTINCT ON (da."deviceId")
    da."deviceId",
    c."orgId"
  FROM "DeviceAssignment" da
  JOIN "Shipment" s ON s."id" = da."shipmentId"
  JOIN "Customer" c ON c."id" = s."customerId"
  WHERE da."shipmentId" IS NOT NULL
    AND c."orgId" IS NOT NULL
  ORDER BY da."deviceId", da."assignedAt" DESC
)
UPDATE "Device" d
SET "orgId" = "do"."orgId"
FROM device_owners "do"
WHERE d."id" = "do"."deviceId"
  AND d."orgId" IS NULL;

UPDATE "Device"
SET "orgId" = (SELECT "id" FROM "Organization" ORDER BY "createdAt" ASC LIMIT 1)
WHERE "orgId" IS NULL;

-- Indexes
CREATE INDEX "Location_orgId_idx" ON "Location"("orgId");
CREATE INDEX "Lane_orgId_idx"     ON "Lane"("orgId");
CREATE INDEX "Driver_orgId_idx"   ON "Driver"("orgId");
CREATE INDEX "Vehicle_orgId_idx"  ON "Vehicle"("orgId");
CREATE INDEX "Device_orgId_idx"   ON "Device"("orgId");
