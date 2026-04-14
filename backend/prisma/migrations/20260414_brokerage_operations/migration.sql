-- Brokerage Operations: Organization type, broker fields, margin config, and ShipmentReadModel financial columns

-- Organization: Add organization type and broker-specific fields
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "organizationType" TEXT NOT NULL DEFAULT 'shipper';
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "mcNumber" TEXT;
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "bondAmountCents" INTEGER;
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "bondExpirationDate" TIMESTAMP(3);
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "operatingAuthorityStatus" TEXT DEFAULT 'active';
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "minMarginPercent" DECIMAL(5,2);
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "marginAlertEnabled" BOOLEAN NOT NULL DEFAULT false;

-- ShipmentReadModel: Add denormalized financial columns
ALTER TABLE "ShipmentReadModel" ADD COLUMN IF NOT EXISTS "expectedRevenueCents" INTEGER;
ALTER TABLE "ShipmentReadModel" ADD COLUMN IF NOT EXISTS "expectedCostCents" INTEGER;
ALTER TABLE "ShipmentReadModel" ADD COLUMN IF NOT EXISTS "expectedMarginCents" INTEGER;
ALTER TABLE "ShipmentReadModel" ADD COLUMN IF NOT EXISTS "actualRevenueCents" INTEGER;
ALTER TABLE "ShipmentReadModel" ADD COLUMN IF NOT EXISTS "actualCostCents" INTEGER;
ALTER TABLE "ShipmentReadModel" ADD COLUMN IF NOT EXISTS "actualMarginCents" INTEGER;
