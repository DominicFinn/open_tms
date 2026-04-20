-- Return label + pickup fields on Rma
ALTER TABLE "Rma" ADD COLUMN IF NOT EXISTS "returnCarrierId" TEXT;
ALTER TABLE "Rma" ADD COLUMN IF NOT EXISTS "returnServiceLevel" TEXT;
ALTER TABLE "Rma" ADD COLUMN IF NOT EXISTS "returnLabelStorageKey" TEXT;
ALTER TABLE "Rma" ADD COLUMN IF NOT EXISTS "returnLabelFormat" TEXT;
ALTER TABLE "Rma" ADD COLUMN IF NOT EXISTS "returnLabelGeneratedAt" TIMESTAMP(3);
ALTER TABLE "Rma" ADD COLUMN IF NOT EXISTS "returnLabelProvider" TEXT;
ALTER TABLE "Rma" ADD COLUMN IF NOT EXISTS "returnPickupScheduledAt" TIMESTAMP(3);
ALTER TABLE "Rma" ADD COLUMN IF NOT EXISTS "returnPickupWindow" TEXT;
ALTER TABLE "Rma" ADD COLUMN IF NOT EXISTS "returnPickupConfirmationNumber" TEXT;
ALTER TABLE "Rma" ADD COLUMN IF NOT EXISTS "returnPickupAddressId" TEXT;
ALTER TABLE "Rma" ADD COLUMN IF NOT EXISTS "returnPickupCancelledAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "Rma_returnCarrierId_idx" ON "Rma"("returnCarrierId");
CREATE INDEX IF NOT EXISTS "Rma_returnTrackingNumber_idx" ON "Rma"("returnTrackingNumber");

-- Carrier return label config
ALTER TABLE "Carrier" ADD COLUMN IF NOT EXISTS "returnLabelProvider" TEXT;
ALTER TABLE "Carrier" ADD COLUMN IF NOT EXISTS "returnLabelAccountNumber" TEXT;
ALTER TABLE "Carrier" ADD COLUMN IF NOT EXISTS "returnLabelDefaultService" TEXT;
