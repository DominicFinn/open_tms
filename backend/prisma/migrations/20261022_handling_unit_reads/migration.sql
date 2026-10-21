-- The warehouse reads and writes its own HandlingUnit (#357, step 2 of 3).
--
-- Until this release TrackableUnit was authoritative for warehouse state: commands wrote it first
-- and mirrored onto the handling unit, and the mirror did nothing for a unit the projection hadn't
-- reached yet. So before reads switch, state is copied across once more, any missing handling unit
-- is created, and every handlingUnitId is made to point at a real unit, so the foreign keys below
-- hold.

-- Handling units the projection hasn't created yet.
INSERT INTO "HandlingUnit" (
    "id", "orgId", "sourceType", "sourceId", "sourceOrderId",
    "identifier", "unitType", "customTypeName", "barcode", "createdAt", "updatedAt"
)
SELECT tu."id", o."orgId", 'tms_trackable_unit', tu."id", tu."orderId",
       tu."identifier", tu."unitType", tu."customTypeName", tu."barcode", tu."createdAt", tu."updatedAt"
FROM "TrackableUnit" tu
JOIN "Order" o ON o."id" = tu."orderId"
WHERE NOT EXISTS (SELECT 1 FROM "HandlingUnit" h WHERE h."id" = tu."id");

INSERT INTO "HandlingUnitLine" (
    "id", "handlingUnitId", "orgId", "sourceLineId", "sku", "description", "quantity", "weight", "hazmat", "temperature"
)
SELECT gen_random_uuid()::text, li."trackableUnitId", o."orgId", li."id", li."sku", li."description",
       li."quantity", li."weight", li."hazmat", li."temperature"
FROM "OrderLineItem" li
JOIN "Order" o ON o."id" = li."orderId"
WHERE li."trackableUnitId" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "HandlingUnitLine" l WHERE l."handlingUnitId" = li."trackableUnitId");

-- Warehouse state, from the row that was authoritative until now.
UPDATE "HandlingUnit" h SET
    "currentBinId" = tu."currentBinId",
    "currentZoneId" = tu."currentZoneId",
    "parentHandlingUnitId" = tu."parentUnitId",
    "lotNumber" = tu."lotNumber",
    "expiryDate" = tu."expiryDate",
    "receivedAt" = tu."receivedAt",
    "ownerCustomerId" = tu."ownerCustomerId",
    "qualityStatus" = tu."qualityStatus"
FROM "TrackableUnit" tu
WHERE tu."id" = h."id" AND h."sourceType" = 'tms_trackable_unit';

-- References: fill any the dual-write missed, and clear any that point nowhere.
UPDATE "ReceivingLine" SET "handlingUnitId" = "trackableUnitId" WHERE "handlingUnitId" IS NULL AND "trackableUnitId" IS NOT NULL;
UPDATE "PutawayTask" SET "handlingUnitId" = "trackableUnitId" WHERE "handlingUnitId" IS NULL AND "trackableUnitId" IS NOT NULL;
UPDATE "PickLine" SET "handlingUnitId" = "trackableUnitId" WHERE "handlingUnitId" IS NULL AND "trackableUnitId" IS NOT NULL;
UPDATE "PackLine" SET "handlingUnitId" = "trackableUnitId" WHERE "handlingUnitId" IS NULL AND "trackableUnitId" IS NOT NULL;
UPDATE "StagingAssignment" SET "handlingUnitId" = "trackableUnitId" WHERE "handlingUnitId" IS NULL AND "trackableUnitId" IS NOT NULL;
UPDATE "LoadPlanLine" SET "handlingUnitId" = "trackableUnitId" WHERE "handlingUnitId" IS NULL AND "trackableUnitId" IS NOT NULL;
UPDATE "InventoryTransaction" SET "handlingUnitId" = "trackableUnitId" WHERE "handlingUnitId" IS NULL AND "trackableUnitId" IS NOT NULL;
UPDATE "Allocation" SET "handlingUnitId" = "trackableUnitId" WHERE "handlingUnitId" IS NULL AND "trackableUnitId" IS NOT NULL;

UPDATE "ReceivingLine" t SET "handlingUnitId" = NULL WHERE "handlingUnitId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "HandlingUnit" h WHERE h."id" = t."handlingUnitId");
UPDATE "PutawayTask" t SET "handlingUnitId" = NULL WHERE "handlingUnitId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "HandlingUnit" h WHERE h."id" = t."handlingUnitId");
UPDATE "PickLine" t SET "handlingUnitId" = NULL WHERE "handlingUnitId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "HandlingUnit" h WHERE h."id" = t."handlingUnitId");
UPDATE "PackLine" t SET "handlingUnitId" = NULL WHERE "handlingUnitId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "HandlingUnit" h WHERE h."id" = t."handlingUnitId");
UPDATE "StagingAssignment" t SET "handlingUnitId" = NULL WHERE "handlingUnitId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "HandlingUnit" h WHERE h."id" = t."handlingUnitId");
UPDATE "LoadPlanLine" t SET "handlingUnitId" = NULL WHERE "handlingUnitId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "HandlingUnit" h WHERE h."id" = t."handlingUnitId");
UPDATE "InventoryTransaction" t SET "handlingUnitId" = NULL WHERE "handlingUnitId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "HandlingUnit" h WHERE h."id" = t."handlingUnitId");
UPDATE "Allocation" t SET "handlingUnitId" = NULL WHERE "handlingUnitId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "HandlingUnit" h WHERE h."id" = t."handlingUnitId");

-- A replenishment putaway moves stock between bins, not a unit, so PutawayTask.trackableUnitId
-- becomes optional (CheckReplenishment was writing an inventory record id into it).

-- DropForeignKey
ALTER TABLE "PutawayTask" DROP CONSTRAINT "PutawayTask_trackableUnitId_fkey";

-- AlterTable
ALTER TABLE "PutawayTask" ALTER COLUMN "trackableUnitId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "InventoryTransaction" ADD CONSTRAINT "InventoryTransaction_handlingUnitId_fkey" FOREIGN KEY ("handlingUnitId") REFERENCES "HandlingUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Allocation" ADD CONSTRAINT "Allocation_handlingUnitId_fkey" FOREIGN KEY ("handlingUnitId") REFERENCES "HandlingUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReceivingLine" ADD CONSTRAINT "ReceivingLine_handlingUnitId_fkey" FOREIGN KEY ("handlingUnitId") REFERENCES "HandlingUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PutawayTask" ADD CONSTRAINT "PutawayTask_handlingUnitId_fkey" FOREIGN KEY ("handlingUnitId") REFERENCES "HandlingUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PutawayTask" ADD CONSTRAINT "PutawayTask_trackableUnitId_fkey" FOREIGN KEY ("trackableUnitId") REFERENCES "TrackableUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PickLine" ADD CONSTRAINT "PickLine_handlingUnitId_fkey" FOREIGN KEY ("handlingUnitId") REFERENCES "HandlingUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackLine" ADD CONSTRAINT "PackLine_handlingUnitId_fkey" FOREIGN KEY ("handlingUnitId") REFERENCES "HandlingUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StagingAssignment" ADD CONSTRAINT "StagingAssignment_handlingUnitId_fkey" FOREIGN KEY ("handlingUnitId") REFERENCES "HandlingUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoadPlanLine" ADD CONSTRAINT "LoadPlanLine_handlingUnitId_fkey" FOREIGN KEY ("handlingUnitId") REFERENCES "HandlingUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

