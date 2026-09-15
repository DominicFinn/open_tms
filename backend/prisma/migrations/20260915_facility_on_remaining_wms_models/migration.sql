-- #285: the four WMS models that never got a facilityId.
--
-- CycleCount, ReplenishmentRule, LoadPlan and CartonCatalogue carry locationId as a plain column
-- with no Location relation, so every dual-write batch built its model list from the relation
-- fields and missed them. #248 then moved their routes and commands onto facilityId, which made
-- four list endpoints filter on a column that did not exist.
--
-- Same backfill shape as the earlier batches: each row takes its orgId from its own record, and
-- resolves through the Facility already derived from its location.

-- AlterTable
ALTER TABLE "CartonCatalogue" ADD COLUMN     "facilityId" TEXT;

-- AlterTable
ALTER TABLE "LoadPlan" ADD COLUMN     "facilityId" TEXT;

-- AlterTable
ALTER TABLE "CycleCount" ADD COLUMN     "facilityId" TEXT;

-- AlterTable
ALTER TABLE "ReplenishmentRule" ADD COLUMN     "facilityId" TEXT;

-- CreateIndex
CREATE INDEX "CartonCatalogue_facilityId_idx" ON "CartonCatalogue"("facilityId");

-- CreateIndex
CREATE INDEX "LoadPlan_facilityId_idx" ON "LoadPlan"("facilityId");

-- CreateIndex
CREATE INDEX "CycleCount_facilityId_idx" ON "CycleCount"("facilityId");

-- CreateIndex
CREATE INDEX "ReplenishmentRule_facilityId_idx" ON "ReplenishmentRule"("facilityId");

-- AddForeignKey
ALTER TABLE "CartonCatalogue" ADD CONSTRAINT "CartonCatalogue_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "Facility"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoadPlan" ADD CONSTRAINT "LoadPlan_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "Facility"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CycleCount" ADD CONSTRAINT "CycleCount_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "Facility"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReplenishmentRule" ADD CONSTRAINT "ReplenishmentRule_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "Facility"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- ── Backfill ───────────────────────────────────────────────────────────────────
UPDATE "CycleCount" t SET "facilityId" = f."id" FROM "Facility" f
WHERE f."orgId" = t."orgId" AND f."sourceLocationId" = t."locationId" AND t."facilityId" IS NULL;

UPDATE "ReplenishmentRule" t SET "facilityId" = f."id" FROM "Facility" f
WHERE f."orgId" = t."orgId" AND f."sourceLocationId" = t."locationId" AND t."facilityId" IS NULL;

UPDATE "LoadPlan" t SET "facilityId" = f."id" FROM "Facility" f
WHERE f."orgId" = t."orgId" AND f."sourceLocationId" = t."locationId" AND t."facilityId" IS NULL;

UPDATE "CartonCatalogue" t SET "facilityId" = f."id" FROM "Facility" f
WHERE f."orgId" = t."orgId" AND f."sourceLocationId" = t."locationId" AND t."facilityId" IS NULL;
