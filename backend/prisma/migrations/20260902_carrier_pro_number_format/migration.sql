-- Optional per-carrier PRO number format hint, used to auto-fill and softly
-- validate the PRO number field when a carrier is assigned to a shipment.
-- Not enforced server-side.
ALTER TABLE "Carrier" ADD COLUMN IF NOT EXISTS "proNumberPrefix" TEXT;
ALTER TABLE "Carrier" ADD COLUMN IF NOT EXISTS "proNumberMaxLength" INTEGER;
