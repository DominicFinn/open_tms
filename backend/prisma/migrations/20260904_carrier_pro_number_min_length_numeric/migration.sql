-- Extends the per-carrier PRO number format hint (see 20260902_carrier_pro_number_format)
-- with a minimum length and a numeric-only flag, so the soft validation on shipment
-- assignment can catch more than "too long" (e.g. a transposed digit that's too short,
-- or letters typed into a numeric-only carrier's PRO). Still never enforced server-side.
ALTER TABLE "Carrier" ADD COLUMN IF NOT EXISTS "proNumberMinLength" INTEGER;
ALTER TABLE "Carrier" ADD COLUMN IF NOT EXISTS "proNumberNumericOnly" BOOLEAN;
