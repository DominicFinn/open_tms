-- Phase 2a batch 2 (#225): dual-write Facility alongside Location on the inbound models.
-- Expand only: every facilityId is nullable and nothing reads it yet, so this migration is
-- behaviour-neutral and reversible by dropping the four columns.

-- AlterTable
ALTER TABLE "ReceivingAppointment" ADD COLUMN     "facilityId" TEXT;

-- AlterTable
ALTER TABLE "ReceivingTask" ADD COLUMN     "facilityId" TEXT;

-- AlterTable
ALTER TABLE "PutawayRule" ADD COLUMN     "facilityId" TEXT;

-- AlterTable
ALTER TABLE "PutawayTask" ADD COLUMN     "facilityId" TEXT;

-- CreateIndex
CREATE INDEX "ReceivingAppointment_facilityId_idx" ON "ReceivingAppointment"("facilityId");

-- CreateIndex
CREATE INDEX "ReceivingTask_facilityId_idx" ON "ReceivingTask"("facilityId");

-- CreateIndex
CREATE INDEX "PutawayRule_facilityId_idx" ON "PutawayRule"("facilityId");

-- CreateIndex
CREATE INDEX "PutawayTask_facilityId_idx" ON "PutawayTask"("facilityId");

-- AddForeignKey
ALTER TABLE "ReceivingAppointment" ADD CONSTRAINT "ReceivingAppointment_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "Facility"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReceivingTask" ADD CONSTRAINT "ReceivingTask_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "Facility"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PutawayRule" ADD CONSTRAINT "PutawayRule_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "Facility"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PutawayTask" ADD CONSTRAINT "PutawayTask_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "Facility"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- ── Backfill ───────────────────────────────────────────────────────────────────
-- One Facility per Location any inbound row already points at. Each row takes its orgId from its
-- own source record, never a single org resolved for the whole run: the queries here are org-wide
-- and a single id would file one tenant's inbound work under another's.
--
-- Unlike the storage topology in #217, all four models carry orgId directly, so nothing needs
-- scoping through a parent.
--
-- The insert is a no-op for any (orgId, locationId) chunk 1 already created a facility for, which
-- is the common case: inbound work happens at a location that already has zones and bins.

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
  SELECT DISTINCT "orgId", "locationId" FROM "ReceivingAppointment"
  UNION
  SELECT DISTINCT "orgId", "locationId" FROM "ReceivingTask"
  UNION
  SELECT DISTINCT "orgId", "locationId" FROM "PutawayRule"
  UNION
  SELECT DISTINCT "orgId", "locationId" FROM "PutawayTask"
) AS src
LEFT JOIN "Location" l ON l."id" = src."locationId"
ON CONFLICT ("orgId", "sourceLocationId") DO NOTHING;

UPDATE "ReceivingAppointment" t
SET "facilityId" = f."id"
FROM "Facility" f
WHERE f."orgId" = t."orgId" AND f."sourceLocationId" = t."locationId" AND t."facilityId" IS NULL;

UPDATE "ReceivingTask" t
SET "facilityId" = f."id"
FROM "Facility" f
WHERE f."orgId" = t."orgId" AND f."sourceLocationId" = t."locationId" AND t."facilityId" IS NULL;

UPDATE "PutawayRule" t
SET "facilityId" = f."id"
FROM "Facility" f
WHERE f."orgId" = t."orgId" AND f."sourceLocationId" = t."locationId" AND t."facilityId" IS NULL;

UPDATE "PutawayTask" t
SET "facilityId" = f."id"
FROM "Facility" f
WHERE f."orgId" = t."orgId" AND f."sourceLocationId" = t."locationId" AND t."facilityId" IS NULL;
