-- Phase 2 of the multi-tenancy plan: add orgId to Shipment.
--
-- Shipment is the highest-volume table in the system and the spine of the
-- read-model (ShipmentReadModel.orgId was already populated by the
-- projection but the source table couldn't actually be filtered on it).
-- Adding the column here closes that loop.
--
-- Backfill: Shipment has a required customerId FK, and Customer now has
-- orgId (Phase 1), so we walk through the customer to populate orgId.

ALTER TABLE "Shipment" ADD COLUMN "orgId" TEXT;

UPDATE "Shipment" s
SET "orgId" = c."orgId"
FROM "Customer" c
WHERE s."customerId" = c."id"
  AND s."orgId" IS NULL
  AND c."orgId" IS NOT NULL;

-- Shipments whose Customer hasn't been backfilled yet: default org. This
-- shouldn't happen in practice because Phase 1's customer backfill has
-- the same default-Organization fallback, but the guard is cheap.
UPDATE "Shipment"
SET "orgId" = (SELECT "id" FROM "Organization" ORDER BY "createdAt" ASC LIMIT 1)
WHERE "orgId" IS NULL;

CREATE INDEX "Shipment_orgId_idx"
  ON "Shipment"("orgId");
CREATE INDEX "Shipment_orgId_status_idx"
  ON "Shipment"("orgId", "status");
CREATE INDEX "Shipment_orgId_archived_status_idx"
  ON "Shipment"("orgId", "archived", "status");
