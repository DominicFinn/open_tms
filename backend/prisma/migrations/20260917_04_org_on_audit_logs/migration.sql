-- #303: AuditLog had no orgId.
--
-- Table role: ledger. Backfill takes each row's org from its order, then from the domain event
-- that recorded the same entity (AuditHandler writes one audit row per event, and the event store
-- carries orgId), then from the acting user. Anything left takes the deployment's only
-- organization; with several there is no safe guess, so the migration stops.
--
-- Index budget: 3, unchanged. Every read (the order audit and timeline endpoints) filters on
-- orderId, which is selective, so orgId rides along as a filter on AuditLog_orderId_idx. That
-- index also serves the cascade from Order, which an orgId-leading index would not.

-- AlterTable
ALTER TABLE "AuditLog" ADD COLUMN "orgId" TEXT;

-- Backfill
UPDATE "AuditLog" a SET "orgId" = o."orgId" FROM "Order" o
WHERE a."orgId" IS NULL AND a."orderId" = o."id";

UPDATE "AuditLog" a SET "orgId" = e."orgId"
FROM (
  SELECT DISTINCT ON ("entityType", "entityId") "entityType", "entityId", "orgId"
  FROM "DomainEventLog"
  ORDER BY "entityType", "entityId", "createdAt"
) e
WHERE a."orgId" IS NULL AND a."entityType" = e."entityType" AND a."entityId" = e."entityId";

UPDATE "AuditLog" a SET "orgId" = u."organizationId" FROM "User" u
WHERE a."orgId" IS NULL AND a."userId" = u."id";

DO $$
DECLARE
  orphans integer;
  orgs integer;
BEGIN
  SELECT count(*) INTO orphans FROM "AuditLog" WHERE "orgId" IS NULL;
  IF orphans > 0 THEN
    SELECT count(*) INTO orgs FROM "Organization";
    IF orgs <> 1 THEN
      RAISE EXCEPTION '#303: % AuditLog rows have no derivable org and there are % organizations. Assign them before migrating.', orphans, orgs;
    END IF;
    UPDATE "AuditLog" SET "orgId" = (SELECT "id" FROM "Organization") WHERE "orgId" IS NULL;
  END IF;
END $$;

-- AlterTable
ALTER TABLE "AuditLog" ALTER COLUMN "orgId" SET NOT NULL;
