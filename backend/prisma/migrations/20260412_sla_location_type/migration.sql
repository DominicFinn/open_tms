-- Add locationType filter to SlaRule for location-type-specific SLA rules
ALTER TABLE "SlaRule" ADD COLUMN "locationType" TEXT;
