-- Phase 2 of the multi-tenancy plan: tighten the new orgId columns to
-- NOT NULL. Phase 1's backfill SQL had a default-Organization fallback so
-- every row in each of these tables should already carry an orgId; this
-- migration asserts that and locks the column shape in.
--
-- Safety: if any row is still NULL we abort the migration. Operators
-- should run the relevant backfill UPDATE manually and re-deploy.
--
-- EdiTransactionLog.orgId is deliberately NOT tightened here — its
-- backfill was best-effort (no relation chain back to org for manual
-- imports) so legitimate NULL rows can exist.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "Customer"       WHERE "orgId" IS NULL) THEN RAISE EXCEPTION 'Customer rows with NULL orgId remain; run Phase 1 backfill first'; END IF;
  IF EXISTS (SELECT 1 FROM "Carrier"        WHERE "orgId" IS NULL) THEN RAISE EXCEPTION 'Carrier rows with NULL orgId remain; run Phase 1 backfill first'; END IF;
  IF EXISTS (SELECT 1 FROM "Order"          WHERE "orgId" IS NULL) THEN RAISE EXCEPTION 'Order rows with NULL orgId remain; run Phase 1 backfill first'; END IF;
  IF EXISTS (SELECT 1 FROM "ApiKey"         WHERE "orgId" IS NULL) THEN RAISE EXCEPTION 'ApiKey rows with NULL orgId remain; run Phase 1 backfill first'; END IF;
  IF EXISTS (SELECT 1 FROM "TradingPartner" WHERE "orgId" IS NULL) THEN RAISE EXCEPTION 'TradingPartner rows with NULL orgId remain; run Phase 1 backfill first'; END IF;
  IF EXISTS (SELECT 1 FROM "Shipment"       WHERE "orgId" IS NULL) THEN RAISE EXCEPTION 'Shipment rows with NULL orgId remain; run Phase 2 backfill first'; END IF;
END $$;

ALTER TABLE "Customer"       ALTER COLUMN "orgId" SET NOT NULL;
ALTER TABLE "Carrier"        ALTER COLUMN "orgId" SET NOT NULL;
ALTER TABLE "Order"          ALTER COLUMN "orgId" SET NOT NULL;
ALTER TABLE "ApiKey"         ALTER COLUMN "orgId" SET NOT NULL;
ALTER TABLE "TradingPartner" ALTER COLUMN "orgId" SET NOT NULL;
ALTER TABLE "Shipment"       ALTER COLUMN "orgId" SET NOT NULL;
