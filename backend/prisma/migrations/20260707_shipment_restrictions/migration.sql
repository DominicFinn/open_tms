-- Declared shipment restrictions, set directly at shipment creation time.
-- Distinct from Shipment.effectiveMinTemp/effectiveMaxTemp, which remain
-- computed from linked orders via ColdChainService.

-- AlterTable
ALTER TABLE "Shipment"
  ADD COLUMN "tempControlled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "tempMinC" DOUBLE PRECISION,
  ADD COLUMN "tempMaxC" DOUBLE PRECISION,
  ADD COLUMN "humidityControlled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "humidityMinPct" DOUBLE PRECISION,
  ADD COLUMN "humidityMaxPct" DOUBLE PRECISION,
  ADD COLUMN "hazmat" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "unNumber" TEXT,
  ADD COLUMN "hazmatClass" TEXT,
  ADD COLUMN "packingGroup" TEXT,
  ADD COLUMN "properShippingName" TEXT,
  ADD COLUMN "requiredEquipmentType" TEXT;
