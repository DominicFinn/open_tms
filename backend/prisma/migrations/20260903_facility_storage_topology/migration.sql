-- Phase 2a chunk 1 (#217): introduce Facility as the WMS root and dual-write it alongside
-- Location on the storage topology models. Expand only: every facilityId stays nullable and
-- nothing reads it yet, so this migration is behaviour-neutral and reversible by dropping the
-- three columns and the table.

-- AlterTable
ALTER TABLE "WarehouseZone" ADD COLUMN     "facilityId" TEXT;

-- AlterTable
ALTER TABLE "WarehouseAisle" ADD COLUMN     "facilityId" TEXT;

-- AlterTable
ALTER TABLE "WarehouseBin" ADD COLUMN     "facilityId" TEXT;

-- CreateTable
CREATE TABLE "Facility" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "sourceLocationId" TEXT,
    "address1" TEXT,
    "address2" TEXT,
    "city" TEXT,
    "state" TEXT,
    "postalCode" TEXT,
    "country" TEXT,
    "timezone" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Facility_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Facility_orgId_idx" ON "Facility"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "Facility_orgId_sourceLocationId_key" ON "Facility"("orgId", "sourceLocationId");

-- CreateIndex
CREATE INDEX "WarehouseZone_facilityId_idx" ON "WarehouseZone"("facilityId");

-- CreateIndex
CREATE INDEX "WarehouseAisle_facilityId_idx" ON "WarehouseAisle"("facilityId");

-- CreateIndex
CREATE INDEX "WarehouseBin_facilityId_idx" ON "WarehouseBin"("facilityId");

-- AddForeignKey
ALTER TABLE "WarehouseZone" ADD CONSTRAINT "WarehouseZone_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "Facility"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarehouseAisle" ADD CONSTRAINT "WarehouseAisle_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "Facility"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarehouseBin" ADD CONSTRAINT "WarehouseBin_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "Facility"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- ── Backfill ───────────────────────────────────────────────────────────────────
-- One Facility per Location that any storage topology row already points at. Each row takes its
-- orgId from its own source record, never a single org resolved for the whole run: the queries
-- here are org-wide and a single id would file one tenant's warehouse under another's.
--
-- WarehouseAisle carries no orgId of its own, so it is scoped through its zone.

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
  SELECT DISTINCT "orgId", "locationId" FROM "WarehouseZone"
  UNION
  SELECT DISTINCT "orgId", "locationId" FROM "WarehouseBin"
  UNION
  SELECT DISTINCT z."orgId", a."locationId" FROM "WarehouseAisle" a JOIN "WarehouseZone" z ON z."id" = a."zoneId"
) AS src
LEFT JOIN "Location" l ON l."id" = src."locationId"
ON CONFLICT ("orgId", "sourceLocationId") DO NOTHING;

UPDATE "WarehouseZone" z
SET "facilityId" = f."id"
FROM "Facility" f
WHERE f."orgId" = z."orgId" AND f."sourceLocationId" = z."locationId" AND z."facilityId" IS NULL;

UPDATE "WarehouseBin" b
SET "facilityId" = f."id"
FROM "Facility" f
WHERE f."orgId" = b."orgId" AND f."sourceLocationId" = b."locationId" AND b."facilityId" IS NULL;

UPDATE "WarehouseAisle" a
SET "facilityId" = z."facilityId"
FROM "WarehouseZone" z
WHERE z."id" = a."zoneId" AND a."facilityId" IS NULL;
