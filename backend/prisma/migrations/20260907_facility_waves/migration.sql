-- Phase 2a batch 4 (#229): dual-write Facility alongside Location on the wave models. This is the
-- last of the WMS schema: after it, all twelve models that reference Location carry a facilityId.
-- Expand only: both columns are nullable and nothing reads them yet, so this migration is
-- behaviour-neutral and reversible by dropping them.

-- AlterTable
ALTER TABLE "WaveTemplate" ADD COLUMN     "facilityId" TEXT;

-- AlterTable
ALTER TABLE "Wave" ADD COLUMN     "facilityId" TEXT;

-- CreateIndex
CREATE INDEX "WaveTemplate_facilityId_idx" ON "WaveTemplate"("facilityId");

-- CreateIndex
CREATE INDEX "Wave_facilityId_idx" ON "Wave"("facilityId");

-- AddForeignKey
ALTER TABLE "WaveTemplate" ADD CONSTRAINT "WaveTemplate_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "Facility"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Wave" ADD CONSTRAINT "Wave_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "Facility"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- ── Backfill ───────────────────────────────────────────────────────────────────
-- One Facility per Location a wave or template already points at. Each row takes its orgId from
-- its own source record, never a single org resolved for the whole run: the queries here are
-- org-wide and a single id would file one tenant's waves under another's.
--
-- Both models carry orgId directly. The insert is a no-op for any (orgId, locationId) an earlier
-- batch already created a facility for, which by this point is nearly always the case.

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
  SELECT DISTINCT "orgId", "locationId" FROM "Wave"
  UNION
  SELECT DISTINCT "orgId", "locationId" FROM "WaveTemplate"
) AS src
LEFT JOIN "Location" l ON l."id" = src."locationId"
ON CONFLICT ("orgId", "sourceLocationId") DO NOTHING;

UPDATE "Wave" t
SET "facilityId" = f."id"
FROM "Facility" f
WHERE f."orgId" = t."orgId" AND f."sourceLocationId" = t."locationId" AND t."facilityId" IS NULL;

UPDATE "WaveTemplate" t
SET "facilityId" = f."id"
FROM "Facility" f
WHERE f."orgId" = t."orgId" AND f."sourceLocationId" = t."locationId" AND t."facilityId" IS NULL;
