-- Phase 2a batch 3 (#227): dual-write Facility alongside Location on the outbound models.
-- Expand only: every facilityId is nullable and nothing reads it yet, so this migration is
-- behaviour-neutral and reversible by dropping the three columns.

-- AlterTable
ALTER TABLE "PickTask" ADD COLUMN     "facilityId" TEXT;

-- AlterTable
ALTER TABLE "PackTask" ADD COLUMN     "facilityId" TEXT;

-- AlterTable
ALTER TABLE "StagingAssignment" ADD COLUMN     "facilityId" TEXT;

-- CreateIndex
CREATE INDEX "PickTask_facilityId_idx" ON "PickTask"("facilityId");

-- CreateIndex
CREATE INDEX "PackTask_facilityId_idx" ON "PackTask"("facilityId");

-- CreateIndex
CREATE INDEX "StagingAssignment_facilityId_idx" ON "StagingAssignment"("facilityId");

-- AddForeignKey
ALTER TABLE "PickTask" ADD CONSTRAINT "PickTask_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "Facility"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackTask" ADD CONSTRAINT "PackTask_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "Facility"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StagingAssignment" ADD CONSTRAINT "StagingAssignment_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "Facility"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- ── Backfill ───────────────────────────────────────────────────────────────────
-- One Facility per Location any outbound row already points at. Each row takes its orgId from its
-- own source record, never a single org resolved for the whole run: the queries here are org-wide
-- and a single id would file one tenant's outbound work under another's.
--
-- All three models carry orgId directly, so nothing needs scoping through a parent.
--
-- The insert is a no-op for any (orgId, locationId) that batch 1 or batch 2 already created a
-- facility for, which is the common case: outbound work happens where the racking and the inbound
-- flow already are.

INSERT INTO "Facility" ("id", "orgId", "name", "sourceLocationId", "address1", "address2", "city", "state", "postalCode", "country", "createdAt", "updatedAt")
SELECT
  gen_random_uuid(),
  src."orgId",
  COALESCE(l."name", 'Facility'),
  src."locationId",
  l."address1",
  l."address2",
  l."city",
  l."state",
  l."postalCode",
  l."country",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM (
  SELECT DISTINCT "orgId", "locationId" FROM "PickTask"
  UNION
  SELECT DISTINCT "orgId", "locationId" FROM "PackTask"
  UNION
  SELECT DISTINCT "orgId", "locationId" FROM "StagingAssignment"
) AS src
LEFT JOIN "Location" l ON l."id" = src."locationId"
ON CONFLICT ("orgId", "sourceLocationId") DO NOTHING;

UPDATE "PickTask" t
SET "facilityId" = f."id"
FROM "Facility" f
WHERE f."orgId" = t."orgId" AND f."sourceLocationId" = t."locationId" AND t."facilityId" IS NULL;

UPDATE "PackTask" t
SET "facilityId" = f."id"
FROM "Facility" f
WHERE f."orgId" = t."orgId" AND f."sourceLocationId" = t."locationId" AND t."facilityId" IS NULL;

UPDATE "StagingAssignment" t
SET "facilityId" = f."id"
FROM "Facility" f
WHERE f."orgId" = t."orgId" AND f."sourceLocationId" = t."locationId" AND t."facilityId" IS NULL;
