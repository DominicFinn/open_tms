-- AlterTable: Add Google Maps API key to Organization
ALTER TABLE "Organization" ADD COLUMN "googleMapsApiKey" TEXT;

-- AlterTable: Add carrier validation fields to Carrier
ALTER TABLE "Carrier" ADD COLUMN "validationTier" TEXT;
ALTER TABLE "Carrier" ADD COLUMN "registrationChecked" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Carrier" ADD COLUMN "insuranceDocReceived" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Carrier" ADD COLUMN "insuranceVerified" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Carrier" ADD COLUMN "identityConfirmed" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Carrier" ADD COLUMN "complianceChecked" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Carrier" ADD COLUMN "validationNotes" TEXT;
ALTER TABLE "Carrier" ADD COLUMN "validatedAt" TIMESTAMP(3);
ALTER TABLE "Carrier" ADD COLUMN "validatedBy" TEXT;
