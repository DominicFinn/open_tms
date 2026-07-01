-- Allow a draft shipment to be saved with a partial/absent route.
-- Route completeness is enforced at the ready transition (readiness gate).
ALTER TABLE "Shipment" ALTER COLUMN "originId" DROP NOT NULL;
ALTER TABLE "Shipment" ALTER COLUMN "destinationId" DROP NOT NULL;
