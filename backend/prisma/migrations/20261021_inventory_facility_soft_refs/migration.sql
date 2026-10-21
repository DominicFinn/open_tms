-- Inventory gets a facility, and its references into core become soft (#297).
--
-- facilityId is the facility of the row's bin, copied onto the row so stock can be read by
-- facility without a join. Reads still go by locationId until they switch, so no index yet: it
-- comes with the reads that need it.
--
-- The FKs to Location and Customer go. These tables leave Prisma for the .NET service in one move
-- (ADR 0005), and no foreign key may run from them into Prisma's tables. The columns stay as soft
-- references.

ALTER TABLE "InventoryRecord" ADD COLUMN "facilityId" TEXT;
ALTER TABLE "InventoryObservation" ADD COLUMN "facilityId" TEXT;

-- The bin's facility first. Phase 2a gave every bin one wherever a facility could be derived.
UPDATE "InventoryRecord" r SET "facilityId" = b."facilityId"
FROM "WarehouseBin" b
WHERE b."id" = r."binId" AND b."facilityId" IS NOT NULL;

UPDATE "InventoryObservation" o SET "facilityId" = b."facilityId"
FROM "WarehouseBin" b
WHERE b."id" = o."binId" AND b."facilityId" IS NOT NULL;

-- Then the facility derived from the row's own Location, matched within the row's own org.
-- (orgId, sourceLocationId) is unique on Facility, so this picks at most one.
UPDATE "InventoryRecord" r SET "facilityId" = f."id"
FROM "Facility" f
WHERE r."facilityId" IS NULL AND f."orgId" = r."orgId" AND f."sourceLocationId" = r."locationId";

UPDATE "InventoryObservation" o SET "facilityId" = f."id"
FROM "Facility" f
WHERE o."facilityId" IS NULL AND f."orgId" = o."orgId" AND f."sourceLocationId" = o."locationId";

ALTER TABLE "InventoryRecord" DROP CONSTRAINT "InventoryRecord_locationId_fkey";
ALTER TABLE "InventoryRecord" DROP CONSTRAINT "InventoryRecord_ownerCustomerId_fkey";
ALTER TABLE "InventoryObservation" DROP CONSTRAINT "InventoryObservation_locationId_fkey";
