-- Phase 3 follow-up: tighten the phase-3 orgId columns to NOT NULL once
-- backfill has verified every row is attributed. Same safety pattern as
-- the phase-2 tightening: abort with a clear error if any NULL row
-- remains so the operator can run the relevant backfill UPDATE first.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "Location" WHERE "orgId" IS NULL) THEN RAISE EXCEPTION 'Location rows with NULL orgId remain; run Phase 3 backfill first'; END IF;
  IF EXISTS (SELECT 1 FROM "Lane"     WHERE "orgId" IS NULL) THEN RAISE EXCEPTION 'Lane rows with NULL orgId remain; run Phase 3 backfill first'; END IF;
  IF EXISTS (SELECT 1 FROM "Driver"   WHERE "orgId" IS NULL) THEN RAISE EXCEPTION 'Driver rows with NULL orgId remain; run Phase 3 backfill first'; END IF;
  IF EXISTS (SELECT 1 FROM "Vehicle"  WHERE "orgId" IS NULL) THEN RAISE EXCEPTION 'Vehicle rows with NULL orgId remain; run Phase 3 backfill first'; END IF;
  IF EXISTS (SELECT 1 FROM "Device"   WHERE "orgId" IS NULL) THEN RAISE EXCEPTION 'Device rows with NULL orgId remain; run Phase 3 backfill first'; END IF;
END $$;

ALTER TABLE "Location" ALTER COLUMN "orgId" SET NOT NULL;
ALTER TABLE "Lane"     ALTER COLUMN "orgId" SET NOT NULL;
ALTER TABLE "Driver"   ALTER COLUMN "orgId" SET NOT NULL;
ALTER TABLE "Vehicle"  ALTER COLUMN "orgId" SET NOT NULL;
ALTER TABLE "Device"   ALTER COLUMN "orgId" SET NOT NULL;
