-- Phase 1: Order Line Items & Cartonization
--   1. Generalise PalletType -> PackagingType (rename + add `kind` + nullability)
--   2. Rename TrackableUnit.palletTypeId -> packagingTypeId (FK rewired)
--   3. Add logistics fields to OrderLineItem (hazmat detail, UoM, customs, temp range)

-- ---------- 1. PalletType -> PackagingType ----------

ALTER TABLE "PalletType" RENAME TO "PackagingType";

-- Discriminator column. Existing rows are all pallets.
ALTER TABLE "PackagingType" ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'pallet';

-- Loosen pallet-only requirements for non-pallet kinds (carton/drum/roll/bag/etc.)
ALTER TABLE "PackagingType" ALTER COLUMN "tareWeightGrams" DROP NOT NULL;
ALTER TABLE "PackagingType" ALTER COLUMN "maxLoadGrams"    DROP NOT NULL;
ALTER TABLE "PackagingType" ALTER COLUMN "material"        DROP NOT NULL;

-- Rename PK + indexes to match the new model name.
ALTER TABLE "PackagingType" RENAME CONSTRAINT "PalletType_pkey" TO "PackagingType_pkey";
ALTER INDEX "PalletType_orgId_code_key" RENAME TO "PackagingType_orgId_code_key";
ALTER INDEX "PalletType_orgId_idx"      RENAME TO "PackagingType_orgId_idx";
ALTER INDEX "PalletType_active_idx"     RENAME TO "PackagingType_active_idx";

-- New index on the discriminator
CREATE INDEX "PackagingType_kind_idx" ON "PackagingType"("kind");

-- ---------- 2. TrackableUnit.palletTypeId -> packagingTypeId ----------

-- Drop any pre-existing FK (Prisma may or may not have introspected one).
ALTER TABLE "TrackableUnit" DROP CONSTRAINT IF EXISTS "TrackableUnit_palletTypeId_fkey";

-- Rename existing column-level index if one was created by an earlier migration.
ALTER INDEX IF EXISTS "TrackableUnit_palletTypeId_idx" RENAME TO "TrackableUnit_packagingTypeId_idx";

ALTER TABLE "TrackableUnit" RENAME COLUMN "palletTypeId" TO "packagingTypeId";

ALTER TABLE "TrackableUnit"
  ADD CONSTRAINT "TrackableUnit_packagingTypeId_fkey"
  FOREIGN KEY ("packagingTypeId") REFERENCES "PackagingType"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- ---------- 3. OrderLineItem additions ----------

ALTER TABLE "OrderLineItem"
  ADD COLUMN "unitOfMeasure"      TEXT NOT NULL DEFAULT 'each',
  ADD COLUMN "unNumber"           TEXT,
  ADD COLUMN "hazmatClass"        TEXT,
  ADD COLUMN "packingGroup"       TEXT,
  ADD COLUMN "properShippingName" TEXT,
  ADD COLUMN "hsCode"             TEXT,
  ADD COLUMN "countryOfOrigin"    TEXT,
  ADD COLUMN "tempMinC"           DOUBLE PRECISION,
  ADD COLUMN "tempMaxC"           DOUBLE PRECISION;
