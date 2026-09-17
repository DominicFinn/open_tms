-- #303: shipment types were shared by every tenant, so one org renaming or editing a type changed
-- it for everyone, and a shipment could be given another tenant's type.
--
-- Shipment types become per org. Every org was using the same rows, so every org keeps them: the
-- oldest org keeps the existing rows, every other org gets its own copy of each type, and its
-- shipments are repointed at its copy. The built-in presets are re-seeded per org at startup.
--
-- Table role: small reference. Index budget 0-1: the (orgId, name) unique key serves every read
-- (all reads lead with orgId, and the table is tiny), so ShipmentType_archived_idx is dropped.

-- DropIndex
DROP INDEX "ShipmentType_name_key";
DROP INDEX "ShipmentType_archived_idx";

-- AlterTable
ALTER TABLE "ShipmentType" ADD COLUMN "orgId" TEXT;

DO $$
DECLARE
  owner_org text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM "ShipmentType") THEN
    RETURN;
  END IF;

  SELECT "id" INTO owner_org FROM "Organization" ORDER BY "createdAt", "id" LIMIT 1;
  IF owner_org IS NULL THEN
    RAISE EXCEPTION '#303: shipment types exist but there is no organization to own them.';
  END IF;

  UPDATE "ShipmentType" SET "orgId" = owner_org;

  CREATE TEMP TABLE shipment_type_copy AS
  SELECT t."id" AS old_id, o."id" AS org_id, gen_random_uuid()::text AS new_id
  FROM "ShipmentType" t CROSS JOIN "Organization" o
  WHERE o."id" <> owner_org;

  INSERT INTO "ShipmentType" ("id", "orgId", "name", "icon", "color", "description", "defaults", "requiredFields", "isBuiltIn", "archived", "archivedAt", "createdAt", "updatedAt")
  SELECT m.new_id, m.org_id, t."name", t."icon", t."color", t."description", t."defaults", t."requiredFields", t."isBuiltIn", t."archived", t."archivedAt", t."createdAt", t."updatedAt"
  FROM shipment_type_copy m JOIN "ShipmentType" t ON t."id" = m.old_id;

  UPDATE "Shipment" s SET "shipmentTypeId" = m.new_id FROM shipment_type_copy m
  WHERE s."shipmentTypeId" = m.old_id AND s."orgId" = m.org_id;

  DROP TABLE shipment_type_copy;
END $$;

-- AlterTable
ALTER TABLE "ShipmentType" ALTER COLUMN "orgId" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "ShipmentType_orgId_name_key" ON "ShipmentType"("orgId", "name");
