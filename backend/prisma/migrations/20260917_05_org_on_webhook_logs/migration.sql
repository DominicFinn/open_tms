-- #303: WebhookLog had no orgId, so the webhook log screens showed every tenant's inbound traffic.
--
-- Table role: ledger. A row now belongs to the org whose API key or signature authenticated the
-- request. Backfill takes each row's org from its API key, then from the shipment it matched.
--
-- Rows with neither are requests that failed authentication. They never belonged to a tenant, and
-- the webhook route now sends those to the structured log instead of this table, so they are
-- deleted rather than assigned. Anything else left takes the deployment's only organization; with
-- several there is no safe guess, so the migration stops.
--
-- Index budget: 5 before and after (already over; treat as debt). Every read now leads with orgId
-- and filters or sorts on receivedAt, so WebhookLog_receivedAt_idx is widened to
-- (orgId, receivedAt) instead of adding an index.

-- AlterTable
ALTER TABLE "WebhookLog" ADD COLUMN "orgId" TEXT;

-- Backfill
UPDATE "WebhookLog" w SET "orgId" = k."orgId" FROM "ApiKey" k
WHERE w."orgId" IS NULL AND w."apiKeyId" = k."id";

UPDATE "WebhookLog" w SET "orgId" = s."orgId" FROM "Shipment" s
WHERE w."orgId" IS NULL AND w."shipmentId" = s."id";

DELETE FROM "WebhookLog"
WHERE "orgId" IS NULL AND "apiKeyId" IS NULL AND "shipmentId" IS NULL AND "status" = 'error';

DO $$
DECLARE
  orphans integer;
  orgs integer;
BEGIN
  SELECT count(*) INTO orphans FROM "WebhookLog" WHERE "orgId" IS NULL;
  IF orphans > 0 THEN
    SELECT count(*) INTO orgs FROM "Organization";
    IF orgs <> 1 THEN
      RAISE EXCEPTION '#303: % WebhookLog rows have no derivable org and there are % organizations. Assign them before migrating.', orphans, orgs;
    END IF;
    UPDATE "WebhookLog" SET "orgId" = (SELECT "id" FROM "Organization") WHERE "orgId" IS NULL;
  END IF;
END $$;

-- AlterTable
ALTER TABLE "WebhookLog" ALTER COLUMN "orgId" SET NOT NULL;

-- DropIndex
DROP INDEX "WebhookLog_receivedAt_idx";

-- CreateIndex
CREATE INDEX "WebhookLog_orgId_receivedAt_idx" ON "WebhookLog"("orgId", "receivedAt");
