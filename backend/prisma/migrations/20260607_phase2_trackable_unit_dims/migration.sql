-- Phase 2: Order Line Items & Cartonization
--   Per-unit dim/weight overrides for sophisticated shippers
--   (mixed-SKU pallets, custom-built handling units).
--
--   When these fields are null, cartonization falls back to summing the
--   contained line items.

ALTER TABLE "TrackableUnit"
  ADD COLUMN "weight"     DOUBLE PRECISION,
  ADD COLUMN "weightUnit" TEXT NOT NULL DEFAULT 'kg',
  ADD COLUMN "length"     DOUBLE PRECISION,
  ADD COLUMN "width"      DOUBLE PRECISION,
  ADD COLUMN "height"     DOUBLE PRECISION,
  ADD COLUMN "dimUnit"    TEXT NOT NULL DEFAULT 'cm',
  ADD COLUMN "stackable"  BOOLEAN NOT NULL DEFAULT true;
