-- #303: UserNotificationPreference had no orgId.
--
-- Table role: reference (small, per user). Backfill takes each row's org from its user, which is
-- NOT NULL since 20260917_01. userId is a soft reference, so a preference for a deleted user has
-- no org; those rows are dead and are removed.
--
-- Index budget: the unique (userId, eventCategory) key already serves EmailHandler's lookup, with
-- orgId as a filter. No index added.

-- AlterTable
ALTER TABLE "UserNotificationPreference" ADD COLUMN "orgId" TEXT;

-- Backfill
UPDATE "UserNotificationPreference" p SET "orgId" = u."organizationId" FROM "User" u
WHERE p."orgId" IS NULL AND p."userId" = u."id";

DELETE FROM "UserNotificationPreference" WHERE "orgId" IS NULL;

-- AlterTable
ALTER TABLE "UserNotificationPreference" ALTER COLUMN "orgId" SET NOT NULL;
