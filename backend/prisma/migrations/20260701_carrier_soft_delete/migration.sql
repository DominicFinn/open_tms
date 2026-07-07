-- Carrier soft delete (tombstone) + carrier-user PII anonymisation marker.
ALTER TABLE "Carrier" ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "Carrier" ADD COLUMN "deletedBy" TEXT;
CREATE INDEX "Carrier_deletedAt_idx" ON "Carrier"("deletedAt");

ALTER TABLE "CarrierUser" ADD COLUMN "anonymizedAt" TIMESTAMP(3);
