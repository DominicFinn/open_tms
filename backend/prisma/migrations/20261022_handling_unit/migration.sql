-- The warehouse gets its own unit, HandlingUnit, so it stops writing its state onto the TMS
-- TrackableUnit (#357, split step 2b).
--
-- This is the first of three steps. Here: the tables, a backfill of one handling unit per
-- TrackableUnit (same id, so references carry over unchanged), and a handlingUnitId column beside
-- every warehouse trackableUnitId. Commands write both from this release. Reads switch next, and
-- the TrackableUnit references go last.

-- AlterTable
ALTER TABLE "Allocation" ADD COLUMN     "handlingUnitId" TEXT;

-- AlterTable
ALTER TABLE "InventoryTransaction" ADD COLUMN     "handlingUnitId" TEXT;

-- AlterTable
ALTER TABLE "LoadPlanLine" ADD COLUMN     "handlingUnitId" TEXT;

-- AlterTable
ALTER TABLE "PackLine" ADD COLUMN     "handlingUnitId" TEXT;

-- AlterTable
ALTER TABLE "PickLine" ADD COLUMN     "handlingUnitId" TEXT;

-- AlterTable
ALTER TABLE "PutawayTask" ADD COLUMN     "handlingUnitId" TEXT;

-- AlterTable
ALTER TABLE "ReceivingLine" ADD COLUMN     "handlingUnitId" TEXT;

-- AlterTable
ALTER TABLE "StagingAssignment" ADD COLUMN     "handlingUnitId" TEXT;

-- CreateTable
CREATE TABLE "HandlingUnit" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "sourceOrderId" TEXT,
    "sourceRemovedAt" TIMESTAMP(3),
    "identifier" TEXT NOT NULL,
    "unitType" TEXT NOT NULL,
    "customTypeName" TEXT,
    "barcode" TEXT,
    "currentBinId" TEXT,
    "currentZoneId" TEXT,
    "parentHandlingUnitId" TEXT,
    "lotNumber" TEXT,
    "expiryDate" TIMESTAMP(3),
    "receivedAt" TIMESTAMP(3),
    "ownerCustomerId" TEXT,
    "qualityStatus" TEXT NOT NULL DEFAULT 'available',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HandlingUnit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HandlingUnitLine" (
    "id" TEXT NOT NULL,
    "handlingUnitId" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "sourceLineId" TEXT,
    "sku" TEXT NOT NULL,
    "description" TEXT,
    "quantity" INTEGER NOT NULL,
    "weight" DOUBLE PRECISION,
    "hazmat" BOOLEAN NOT NULL DEFAULT false,
    "temperature" TEXT,

    CONSTRAINT "HandlingUnitLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HandlingUnit_currentBinId_idx" ON "HandlingUnit"("currentBinId");

-- CreateIndex
CREATE UNIQUE INDEX "HandlingUnit_orgId_sourceType_sourceId_key" ON "HandlingUnit"("orgId", "sourceType", "sourceId");

-- CreateIndex
CREATE INDEX "HandlingUnitLine_handlingUnitId_idx" ON "HandlingUnitLine"("handlingUnitId");

-- AddForeignKey
ALTER TABLE "HandlingUnit" ADD CONSTRAINT "HandlingUnit_currentBinId_fkey" FOREIGN KEY ("currentBinId") REFERENCES "WarehouseBin"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HandlingUnit" ADD CONSTRAINT "HandlingUnit_currentZoneId_fkey" FOREIGN KEY ("currentZoneId") REFERENCES "WarehouseZone"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HandlingUnit" ADD CONSTRAINT "HandlingUnit_parentHandlingUnitId_fkey" FOREIGN KEY ("parentHandlingUnitId") REFERENCES "HandlingUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HandlingUnitLine" ADD CONSTRAINT "HandlingUnitLine_handlingUnitId_fkey" FOREIGN KEY ("handlingUnitId") REFERENCES "HandlingUnit"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Backfill. Every TrackableUnit gets a handling unit with the same id, its org taken from its own
-- order, its identity copied, and the warehouse state the TMS row was carrying moved across.
INSERT INTO "HandlingUnit" (
    "id", "orgId", "sourceType", "sourceId", "sourceOrderId",
    "identifier", "unitType", "customTypeName", "barcode",
    "currentBinId", "currentZoneId", "lotNumber", "expiryDate", "receivedAt",
    "ownerCustomerId", "qualityStatus", "createdAt", "updatedAt"
)
SELECT
    tu."id", o."orgId", 'tms_trackable_unit', tu."id", tu."orderId",
    tu."identifier", tu."unitType", tu."customTypeName", tu."barcode",
    tu."currentBinId", tu."currentZoneId", tu."lotNumber", tu."expiryDate", tu."receivedAt",
    tu."ownerCustomerId", tu."qualityStatus", tu."createdAt", tu."updatedAt"
FROM "TrackableUnit" tu
JOIN "Order" o ON o."id" = tu."orderId";

-- Nesting, once every unit exists.
UPDATE "HandlingUnit" h SET "parentHandlingUnitId" = tu."parentUnitId"
FROM "TrackableUnit" tu
WHERE tu."id" = h."id" AND tu."parentUnitId" IS NOT NULL;

-- Contents, from the order lines packed into each unit.
INSERT INTO "HandlingUnitLine" (
    "id", "handlingUnitId", "orgId", "sourceLineId", "sku", "description", "quantity", "weight", "hazmat", "temperature"
)
SELECT
    gen_random_uuid()::text, li."trackableUnitId", o."orgId", li."id", li."sku", li."description",
    li."quantity", li."weight", li."hazmat", li."temperature"
FROM "OrderLineItem" li
JOIN "Order" o ON o."id" = li."orderId"
WHERE li."trackableUnitId" IS NOT NULL;

-- Warehouse references. Same id, so the value copies across wherever the unit exists. A
-- trackableUnitId with no matching unit (CheckReplenishment writes an inventory record id there)
-- stays null.
UPDATE "ReceivingLine" t SET "handlingUnitId" = t."trackableUnitId" FROM "HandlingUnit" h WHERE h."id" = t."trackableUnitId";
UPDATE "PutawayTask" t SET "handlingUnitId" = t."trackableUnitId" FROM "HandlingUnit" h WHERE h."id" = t."trackableUnitId";
UPDATE "PickLine" t SET "handlingUnitId" = t."trackableUnitId" FROM "HandlingUnit" h WHERE h."id" = t."trackableUnitId";
UPDATE "PackLine" t SET "handlingUnitId" = t."trackableUnitId" FROM "HandlingUnit" h WHERE h."id" = t."trackableUnitId";
UPDATE "StagingAssignment" t SET "handlingUnitId" = t."trackableUnitId" FROM "HandlingUnit" h WHERE h."id" = t."trackableUnitId";
UPDATE "LoadPlanLine" t SET "handlingUnitId" = t."trackableUnitId" FROM "HandlingUnit" h WHERE h."id" = t."trackableUnitId";
UPDATE "InventoryTransaction" t SET "handlingUnitId" = t."trackableUnitId" FROM "HandlingUnit" h WHERE h."id" = t."trackableUnitId";
UPDATE "Allocation" t SET "handlingUnitId" = t."trackableUnitId" FROM "HandlingUnit" h WHERE h."id" = t."trackableUnitId";
