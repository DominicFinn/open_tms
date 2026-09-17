-- #294: GeneratedDocument and DocumentTemplate had no orgId, so any internal user could list,
-- read, download or delete another tenant's documents, and every tenant shared one template set.
--
-- Shape: add the column nullable, backfill, then tighten to NOT NULL.
--
-- Documents take their orgId from their own source record, never one org for the whole run:
-- shipment, then order, then the issue a closure report was written for, then customer, then
-- carrier. A document with none of those has no owner to recover. If the database holds exactly
-- one organization those rows go to it; with more than one, the migration stops rather than guess.
--
-- Templates have no source record. Until now every tenant could see and use every template, so
-- the backfill keeps that behaviour without the sharing: a template is owned by the org of the
-- earliest document rendered from it (or the oldest org if unused), and every other org gets its
-- own copy. Documents rendered from a template by another org are repointed at that org's copy.

-- ── Columns ───────────────────────────────────────────────────────────────────
ALTER TABLE "GeneratedDocument" ADD COLUMN "orgId" TEXT;
ALTER TABLE "DocumentTemplate" ADD COLUMN "orgId" TEXT;

-- ── GeneratedDocument backfill ────────────────────────────────────────────────
UPDATE "GeneratedDocument" d SET "orgId" = s."orgId" FROM "Shipment" s
WHERE d."orgId" IS NULL AND d."shipmentId" = s."id";

UPDATE "GeneratedDocument" d SET "orgId" = o."orgId" FROM "Order" o
WHERE d."orgId" IS NULL AND d."orderId" = o."id";

UPDATE "GeneratedDocument" d SET "orgId" = i."orgId" FROM "Issue" i
WHERE d."orgId" IS NULL AND d."metadata"->>'issueId' = i."id";

UPDATE "GeneratedDocument" d SET "orgId" = c."orgId" FROM "Customer" c
WHERE d."orgId" IS NULL AND d."customerId" = c."id";

UPDATE "GeneratedDocument" d SET "orgId" = c."orgId" FROM "Carrier" c
WHERE d."orgId" IS NULL AND d."carrierId" = c."id";

DO $$
DECLARE
  orphan_count INTEGER;
  org_count INTEGER;
BEGIN
  SELECT count(*) INTO orphan_count FROM "GeneratedDocument" WHERE "orgId" IS NULL;
  IF orphan_count = 0 THEN
    RETURN;
  END IF;
  SELECT count(*) INTO org_count FROM "Organization";
  IF org_count <> 1 THEN
    RAISE EXCEPTION '#294: % GeneratedDocument rows have no shipment, order, issue, customer or carrier to take an org from, and there are % organizations. Assign them by hand, then rerun.', orphan_count, org_count;
  END IF;
  UPDATE "GeneratedDocument" SET "orgId" = (SELECT "id" FROM "Organization") WHERE "orgId" IS NULL;
END $$;

-- ── DocumentTemplate backfill ─────────────────────────────────────────────────
UPDATE "DocumentTemplate" t SET "orgId" = first_use."orgId"
FROM (
  SELECT DISTINCT ON ("templateId") "templateId", "orgId"
  FROM "GeneratedDocument"
  WHERE "templateId" IS NOT NULL
  ORDER BY "templateId", "createdAt"
) first_use
WHERE first_use."templateId" = t."id";

UPDATE "DocumentTemplate"
SET "orgId" = (SELECT "id" FROM "Organization" ORDER BY "createdAt", "id" LIMIT 1)
WHERE "orgId" IS NULL;

CREATE TEMP TABLE "_template_copy" AS
SELECT t."id" AS "sourceId", o."id" AS "orgId", gen_random_uuid()::text AS "newId"
FROM "DocumentTemplate" t
CROSS JOIN "Organization" o
WHERE o."id" <> t."orgId";

INSERT INTO "DocumentTemplate"
  ("id", "orgId", "name", "documentType", "description", "htmlTemplate", "config",
   "isDefault", "active", "createdAt", "updatedAt")
SELECT c."newId", c."orgId", t."name", t."documentType", t."description", t."htmlTemplate",
       t."config", t."isDefault", t."active", t."createdAt", t."updatedAt"
FROM "_template_copy" c
JOIN "DocumentTemplate" t ON t."id" = c."sourceId";

UPDATE "GeneratedDocument" d SET "templateId" = c."newId"
FROM "_template_copy" c
WHERE d."templateId" = c."sourceId" AND d."orgId" = c."orgId";

DROP TABLE "_template_copy";

-- ── Tighten ───────────────────────────────────────────────────────────────────
ALTER TABLE "GeneratedDocument" ALTER COLUMN "orgId" SET NOT NULL;
ALTER TABLE "DocumentTemplate" ALTER COLUMN "orgId" SET NOT NULL;

-- ── Indexes: widen existing ones to lead with orgId, no net additions ────────
DROP INDEX "DocumentTemplate_documentType_idx";
DROP INDEX "GeneratedDocument_createdAt_idx";
DROP INDEX "GeneratedDocument_orderId_idx";
DROP INDEX "GeneratedDocument_shipmentId_idx";

CREATE INDEX "DocumentTemplate_orgId_documentType_idx" ON "DocumentTemplate"("orgId", "documentType");
CREATE INDEX "GeneratedDocument_orgId_shipmentId_idx" ON "GeneratedDocument"("orgId", "shipmentId");
CREATE INDEX "GeneratedDocument_orgId_orderId_idx" ON "GeneratedDocument"("orgId", "orderId");
CREATE INDEX "GeneratedDocument_orgId_createdAt_idx" ON "GeneratedDocument"("orgId", "createdAt");

-- ── Foreign keys ──────────────────────────────────────────────────────────────
ALTER TABLE "DocumentTemplate" ADD CONSTRAINT "DocumentTemplate_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GeneratedDocument" ADD CONSTRAINT "GeneratedDocument_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
