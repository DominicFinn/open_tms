-- #303: Attachment had no orgId, and AttachmentRepository.findById looked rows up by id alone, so
-- any internal user could download or delete another tenant's file by id.
--
-- Table role: authoritative mutable. Backfill takes each row's org from the entity it is attached
-- to. Anything left takes the deployment's only organization; with several there is no safe guess,
-- so the migration stops.
--
-- Index budget: 3 before and after. The per-entity list (AttachmentRepository.findByEntity) now
-- filters on orgId too, so the existing (entityType, entityId) index is widened to lead with orgId.

-- AlterTable
ALTER TABLE "Attachment" ADD COLUMN "orgId" TEXT;

-- Backfill
UPDATE "Attachment" a SET "orgId" = e."orgId" FROM "Shipment" e
WHERE a."orgId" IS NULL AND a."entityType" = 'shipment' AND a."entityId" = e."id";

UPDATE "Attachment" a SET "orgId" = e."orgId" FROM "Order" e
WHERE a."orgId" IS NULL AND a."entityType" = 'order' AND a."entityId" = e."id";

UPDATE "Attachment" a SET "orgId" = e."orgId" FROM "Carrier" e
WHERE a."orgId" IS NULL AND a."entityType" = 'carrier' AND a."entityId" = e."id";

UPDATE "Attachment" a SET "orgId" = e."orgId" FROM "Customer" e
WHERE a."orgId" IS NULL AND a."entityType" = 'customer' AND a."entityId" = e."id";

UPDATE "Attachment" a SET "orgId" = e."orgId" FROM "Location" e
WHERE a."orgId" IS NULL AND a."entityType" = 'location' AND a."entityId" = e."id";

UPDATE "Attachment" a SET "orgId" = e."orgId" FROM "SOPAudit" e
WHERE a."orgId" IS NULL AND a."entityType" = 'sop_audit' AND a."entityId" = e."id";

DO $$
DECLARE
  orphans integer;
  orgs integer;
BEGIN
  SELECT count(*) INTO orphans FROM "Attachment" WHERE "orgId" IS NULL;
  IF orphans > 0 THEN
    SELECT count(*) INTO orgs FROM "Organization";
    IF orgs <> 1 THEN
      RAISE EXCEPTION '#303: % Attachment rows have no derivable org and there are % organizations. Assign them before migrating.', orphans, orgs;
    END IF;
    UPDATE "Attachment" SET "orgId" = (SELECT "id" FROM "Organization") WHERE "orgId" IS NULL;
  END IF;
END $$;

-- AlterTable
ALTER TABLE "Attachment" ALTER COLUMN "orgId" SET NOT NULL;

-- DropIndex
DROP INDEX "Attachment_entityType_entityId_idx";

-- CreateIndex
CREATE INDEX "Attachment_orgId_entityType_entityId_idx" ON "Attachment"("orgId", "entityType", "entityId");
