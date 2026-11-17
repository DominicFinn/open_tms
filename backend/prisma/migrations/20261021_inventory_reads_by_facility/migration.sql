-- Inventory is read by facility (#297). The location indexes give way to facility ones rather than
-- adding to the budget, since nothing reads inventory by locationId any more, and locationId
-- becomes nullable because a facility with no Location (a standalone FinnWMS) has none to write.
-- The columns themselves go after a soak.

ALTER TABLE "InventoryRecord" ALTER COLUMN "locationId" DROP NOT NULL;
ALTER TABLE "InventoryObservation" ALTER COLUMN "locationId" DROP NOT NULL;

-- Rows written between the backfill in 20261021_inventory_facility_soft_refs and this release
-- already carry facilityId, since every create writes it. This catches anything the first pass
-- couldn't resolve and that has since gained a facility through its bin.
UPDATE "InventoryRecord" r SET "facilityId" = b."facilityId"
FROM "WarehouseBin" b
WHERE r."facilityId" IS NULL AND b."id" = r."binId" AND b."facilityId" IS NOT NULL;

UPDATE "InventoryObservation" o SET "facilityId" = b."facilityId"
FROM "WarehouseBin" b
WHERE o."facilityId" IS NULL AND b."id" = o."binId" AND b."facilityId" IS NOT NULL;

DROP INDEX "InventoryRecord_locationId_idx";
CREATE INDEX "InventoryRecord_facilityId_sku_idx" ON "InventoryRecord"("facilityId", "sku");

DROP INDEX "InventoryObservation_orgId_locationId_observedAt_idx";
CREATE INDEX "InventoryObservation_orgId_facilityId_observedAt_idx" ON "InventoryObservation"("orgId", "facilityId", "observedAt");
