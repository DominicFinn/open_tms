-- Shipment archival now overwrites `status` with 'archived' (mirroring
-- Order), so that archived shipments stay visible in list views as just
-- another filterable status instead of being removed from the read model.
-- Capture the prior status so unarchive can restore it instead of guessing.
ALTER TABLE "Shipment" ADD COLUMN "statusBeforeArchive" TEXT;
