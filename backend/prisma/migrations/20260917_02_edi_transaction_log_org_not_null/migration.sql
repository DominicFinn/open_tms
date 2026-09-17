-- #303: EdiTransactionLog.orgId was nullable so older rows could be backfilled lazily. Every writer
-- now passes an org, so the column goes NOT NULL.
--
-- Table role: ledger. Backfill takes each row's org from its own trading partner, then its
-- shipment, order or invoice. Anything left takes the deployment's only organization; with
-- several there is no safe guess, so the migration stops.
--
-- Index budget: this table is well over budget (14). EdiTransactionLog_orgId_idx is a leftmost
-- prefix of EdiTransactionLog_orgId_createdAt_idx, so it is dropped rather than kept alongside.

UPDATE "EdiTransactionLog" l SET "orgId" = p."orgId"
FROM "TradingPartner" p
WHERE l."orgId" IS NULL AND l."partnerId" = p."id";

UPDATE "EdiTransactionLog" l SET "orgId" = s."orgId"
FROM "Shipment" s
WHERE l."orgId" IS NULL AND l."shipmentId" = s."id";

UPDATE "EdiTransactionLog" l SET "orgId" = o."orgId"
FROM "Order" o
WHERE l."orgId" IS NULL AND l."orderId" = o."id";

UPDATE "EdiTransactionLog" l SET "orgId" = i."orgId"
FROM "Invoice" i
WHERE l."orgId" IS NULL AND l."invoiceId" = i."id";

DO $$
DECLARE
  orphans integer;
  orgs integer;
BEGIN
  SELECT count(*) INTO orphans FROM "EdiTransactionLog" WHERE "orgId" IS NULL;
  IF orphans > 0 THEN
    SELECT count(*) INTO orgs FROM "Organization";
    IF orgs <> 1 THEN
      RAISE EXCEPTION '#303: % EdiTransactionLog rows have no derivable org and there are % organizations. Assign them before migrating.', orphans, orgs;
    END IF;
    UPDATE "EdiTransactionLog" SET "orgId" = (SELECT "id" FROM "Organization") WHERE "orgId" IS NULL;
  END IF;
END $$;

-- AlterTable
ALTER TABLE "EdiTransactionLog" ALTER COLUMN "orgId" SET NOT NULL;

-- DropIndex
DROP INDEX "EdiTransactionLog_orgId_idx";
