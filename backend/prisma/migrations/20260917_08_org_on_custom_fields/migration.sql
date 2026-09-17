-- #303: custom field versions were shared by every tenant, so one org publishing a new version
-- changed the forms of every other org, and the audit trail showed every tenant's changes.
--
-- Custom field definitions become per org. CustomFieldDefinition takes its org from its version
-- (a required parent), so it gets no column of its own. CustomFieldAudit gets one.
--
-- Backfill: every org was using the same versions, so every org keeps them. The oldest org keeps
-- the existing rows; every other org gets its own copy of each version, its definitions and its
-- audit rows, and its customers, locations, carriers, orders and shipments are repointed at its
-- copy. Nobody's forms or stored values change.
--
-- Table roles: CustomFieldVersion and CustomFieldDefinition are small reference tables;
-- CustomFieldAudit is a ledger.
--
-- Index budget: CustomFieldVersion keeps 2 (both widened to lead with orgId). CustomFieldAudit
-- goes from 2 to 1: the audit endpoint filters on org and entity type and sorts on createdAt, so
-- (orgId, entityType, createdAt) serves it and the two single-column indexes are dropped.

-- DropIndex
DROP INDEX "CustomFieldVersion_entityType_version_key";
DROP INDEX "CustomFieldVersion_entityType_active_idx";
DROP INDEX "CustomFieldAudit_entityType_idx";
DROP INDEX "CustomFieldAudit_createdAt_idx";

-- AlterTable
ALTER TABLE "CustomFieldVersion" ADD COLUMN "orgId" TEXT;
ALTER TABLE "CustomFieldAudit" ADD COLUMN "orgId" TEXT;

DO $$
DECLARE
  owner_org text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM "CustomFieldVersion") AND NOT EXISTS (SELECT 1 FROM "CustomFieldAudit") THEN
    RETURN;
  END IF;

  SELECT "id" INTO owner_org FROM "Organization" ORDER BY "createdAt", "id" LIMIT 1;
  IF owner_org IS NULL THEN
    RAISE EXCEPTION '#303: custom field rows exist but there is no organization to own them.';
  END IF;

  UPDATE "CustomFieldVersion" SET "orgId" = owner_org;

  CREATE TEMP TABLE cf_version_copy AS
  SELECT v."id" AS old_id, o."id" AS org_id, gen_random_uuid()::text AS new_id
  FROM "CustomFieldVersion" v CROSS JOIN "Organization" o
  WHERE o."id" <> owner_org;

  INSERT INTO "CustomFieldVersion" ("id", "orgId", "entityType", "version", "description", "createdBy", "active", "createdAt")
  SELECT m.new_id, m.org_id, v."entityType", v."version", v."description", v."createdBy", v."active", v."createdAt"
  FROM cf_version_copy m JOIN "CustomFieldVersion" v ON v."id" = m.old_id;

  INSERT INTO "CustomFieldDefinition" ("id", "versionId", "fieldKey", "label", "description", "fieldType", "required", "defaultValue", "config", "displayOrder", "createdAt")
  SELECT gen_random_uuid()::text, m.new_id, d."fieldKey", d."label", d."description", d."fieldType", d."required", d."defaultValue", d."config", d."displayOrder", d."createdAt"
  FROM cf_version_copy m JOIN "CustomFieldDefinition" d ON d."versionId" = m.old_id;

  UPDATE "Customer" e SET "customFieldVersionId" = m.new_id FROM cf_version_copy m
  WHERE e."customFieldVersionId" = m.old_id AND e."orgId" = m.org_id;
  UPDATE "Location" e SET "customFieldVersionId" = m.new_id FROM cf_version_copy m
  WHERE e."customFieldVersionId" = m.old_id AND e."orgId" = m.org_id;
  UPDATE "Carrier" e SET "customFieldVersionId" = m.new_id FROM cf_version_copy m
  WHERE e."customFieldVersionId" = m.old_id AND e."orgId" = m.org_id;
  UPDATE "Order" e SET "customFieldVersionId" = m.new_id FROM cf_version_copy m
  WHERE e."customFieldVersionId" = m.old_id AND e."orgId" = m.org_id;
  UPDATE "Shipment" e SET "customFieldVersionId" = m.new_id FROM cf_version_copy m
  WHERE e."customFieldVersionId" = m.old_id AND e."orgId" = m.org_id;

  INSERT INTO "CustomFieldAudit" ("id", "orgId", "entityType", "action", "versionId", "previousVersionId", "changes", "performedBy", "createdAt")
  SELECT gen_random_uuid()::text, o."id", a."entityType", a."action", mv.new_id, mp.new_id, a."changes", a."performedBy", a."createdAt"
  FROM "CustomFieldAudit" a
  CROSS JOIN "Organization" o
  LEFT JOIN cf_version_copy mv ON mv.old_id = a."versionId" AND mv.org_id = o."id"
  LEFT JOIN cf_version_copy mp ON mp.old_id = a."previousVersionId" AND mp.org_id = o."id"
  WHERE o."id" <> owner_org AND a."orgId" IS NULL;

  UPDATE "CustomFieldAudit" SET "orgId" = owner_org WHERE "orgId" IS NULL;

  DROP TABLE cf_version_copy;
END $$;

-- AlterTable
ALTER TABLE "CustomFieldVersion" ALTER COLUMN "orgId" SET NOT NULL;
ALTER TABLE "CustomFieldAudit" ALTER COLUMN "orgId" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "CustomFieldVersion_orgId_entityType_version_key" ON "CustomFieldVersion"("orgId", "entityType", "version");
CREATE INDEX "CustomFieldVersion_orgId_entityType_active_idx" ON "CustomFieldVersion"("orgId", "entityType", "active");
CREATE INDEX "CustomFieldAudit_orgId_entityType_createdAt_idx" ON "CustomFieldAudit"("orgId", "entityType", "createdAt");
