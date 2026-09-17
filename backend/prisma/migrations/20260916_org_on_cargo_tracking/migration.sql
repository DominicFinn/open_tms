-- #295: CargoScan and CargoDiscrepancy had no orgId, so the cargo tracking routes could not be
-- scoped to the caller's tenant.
--
-- Each row takes its orgId from its own shipment, never one org for the whole run. The columns go
-- NOT NULL once the backfill is done; every row has a shipment (the FK is required), so nothing is
-- left behind.
--
-- Index budget: the per-shipment and per-stop lookups already have selective indexes on
-- shipmentId and shipmentStopId, so orgId rides along as a filter there. The one new query shape,
-- open discrepancies for an org, is served by widening the existing status index.

-- AlterTable
ALTER TABLE "CargoScan" ADD COLUMN "orgId" TEXT;

-- AlterTable
ALTER TABLE "CargoDiscrepancy" ADD COLUMN "orgId" TEXT;

-- Backfill
UPDATE "CargoScan" c SET "orgId" = s."orgId" FROM "Shipment" s
WHERE s."id" = c."shipmentId" AND c."orgId" IS NULL;

UPDATE "CargoDiscrepancy" d SET "orgId" = s."orgId" FROM "Shipment" s
WHERE s."id" = d."shipmentId" AND d."orgId" IS NULL;

-- AlterTable
ALTER TABLE "CargoScan" ALTER COLUMN "orgId" SET NOT NULL;

-- AlterTable
ALTER TABLE "CargoDiscrepancy" ALTER COLUMN "orgId" SET NOT NULL;

-- DropIndex
DROP INDEX "CargoDiscrepancy_status_idx";

-- CreateIndex
CREATE INDEX "CargoDiscrepancy_orgId_status_idx" ON "CargoDiscrepancy"("orgId", "status");

-- AddForeignKey
ALTER TABLE "CargoScan" ADD CONSTRAINT "CargoScan_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CargoDiscrepancy" ADD CONSTRAINT "CargoDiscrepancy_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
