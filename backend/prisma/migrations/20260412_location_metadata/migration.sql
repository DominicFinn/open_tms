-- Location Metadata: type classification, facility capabilities, operating details, contact info

-- Location type (warehouse, distribution_centre, cross_dock, terminal, port, rail_yard, customer, store, manufacturing)
ALTER TABLE "Location" ADD COLUMN "locationType" TEXT;

-- Facility capabilities (JSON: crossDockCapable, hasColdStorage, hasHazmatCert, hasBondedStorage)
ALTER TABLE "Location" ADD COLUMN "facilityCapabilities" JSONB;

-- Operating hours (JSON: per-day schedule)
ALTER TABLE "Location" ADD COLUMN "operatingHours" JSONB;

-- Appointment required flag
ALTER TABLE "Location" ADD COLUMN "appointmentRequired" BOOLEAN NOT NULL DEFAULT false;

-- Dock count
ALTER TABLE "Location" ADD COLUMN "dockCount" INTEGER;

-- Max trailer length in feet
ALTER TABLE "Location" ADD COLUMN "maxTrailerLengthFt" INTEGER;

-- Contact information
ALTER TABLE "Location" ADD COLUMN "contactName" TEXT;
ALTER TABLE "Location" ADD COLUMN "contactPhone" TEXT;
ALTER TABLE "Location" ADD COLUMN "contactEmail" TEXT;

-- Index on locationType for filtering
CREATE INDEX "Location_locationType_idx" ON "Location"("locationType");
