-- #303: ConnectivityLog had no orgId.
--
-- Table role: ledger. Backfill takes each row's org from the reporting user, then from the
-- warehouse location. Anything left takes the deployment's only organization; with several there
-- is no safe guess, so the migration stops.
--
-- Index budget: 2, unchanged. Nothing reads this table on a request path yet.

-- AlterTable
ALTER TABLE "ConnectivityLog" ADD COLUMN "orgId" TEXT;

-- Backfill
UPDATE "ConnectivityLog" c SET "orgId" = u."organizationId" FROM "User" u
WHERE c."orgId" IS NULL AND c."userId" = u."id";

UPDATE "ConnectivityLog" c SET "orgId" = l."orgId" FROM "Location" l
WHERE c."orgId" IS NULL AND c."locationId" = l."id";

DO $$
DECLARE
  orphans integer;
  orgs integer;
BEGIN
  SELECT count(*) INTO orphans FROM "ConnectivityLog" WHERE "orgId" IS NULL;
  IF orphans > 0 THEN
    SELECT count(*) INTO orgs FROM "Organization";
    IF orgs <> 1 THEN
      RAISE EXCEPTION '#303: % ConnectivityLog rows have no derivable org and there are % organizations. Assign them before migrating.', orphans, orgs;
    END IF;
    UPDATE "ConnectivityLog" SET "orgId" = (SELECT "id" FROM "Organization") WHERE "orgId" IS NULL;
  END IF;
END $$;

-- AlterTable
ALTER TABLE "ConnectivityLog" ALTER COLUMN "orgId" SET NOT NULL;
