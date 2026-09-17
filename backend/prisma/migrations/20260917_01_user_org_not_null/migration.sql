-- #303: User.organizationId was nullable. Users without one were what the sole-org fallback (#239)
-- served, and a user with no org can't be scoped to a tenant.
--
-- Table role: authoritative mutable. No index change; User_organizationId_idx already exists.
--
-- Backfill: a customer-portal user takes the org of its customer. Anything left takes the
-- deployment's only organization. With several organizations there is no safe guess, so the
-- migration stops and the rows must be assigned by hand first.

UPDATE "User" u SET "organizationId" = c."orgId"
FROM "Customer" c
WHERE u."organizationId" IS NULL AND u."customerId" = c."id";

DO $$
DECLARE
  orphans integer;
  orgs integer;
BEGIN
  SELECT count(*) INTO orphans FROM "User" WHERE "organizationId" IS NULL;
  IF orphans > 0 THEN
    SELECT count(*) INTO orgs FROM "Organization";
    IF orgs <> 1 THEN
      RAISE EXCEPTION '#303: % User rows have no organizationId and there are % organizations. Assign them before migrating.', orphans, orgs;
    END IF;
    UPDATE "User" SET "organizationId" = (SELECT "id" FROM "Organization") WHERE "organizationId" IS NULL;
  END IF;
END $$;

-- DropForeignKey
ALTER TABLE "User" DROP CONSTRAINT "User_organizationId_fkey";

-- AlterTable
ALTER TABLE "User" ALTER COLUMN "organizationId" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
