-- CreateTable: ArrivalCriteria
CREATE TABLE IF NOT EXISTS "ArrivalCriteria" (
    "id" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "criteriaType" TEXT NOT NULL,
    "radiusMeters" DOUBLE PRECISION,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "wifiSsid" TEXT,
    "wifiBssid" TEXT,
    "bleUuid" TEXT,
    "bleMajor" INTEGER,
    "bleMinor" INTEGER,
    "bleRssiThreshold" INTEGER,
    "bleAnchorId" TEXT,
    "bleReaderLocation" TEXT,
    "name" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ArrivalCriteria_pkey" PRIMARY KEY ("id")
);

-- Organization: add tendering and geofence settings
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "autoTenderEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "defaultGeofenceRadiusMeters" DOUBLE PRECISION NOT NULL DEFAULT 200;

-- CreateIndex: ArrivalCriteria
CREATE INDEX IF NOT EXISTS "ArrivalCriteria_locationId_idx" ON "ArrivalCriteria"("locationId");
CREATE INDEX IF NOT EXISTS "ArrivalCriteria_criteriaType_idx" ON "ArrivalCriteria"("criteriaType");
CREATE INDEX IF NOT EXISTS "ArrivalCriteria_locationId_active_idx" ON "ArrivalCriteria"("locationId", "active");

-- AddForeignKey: ArrivalCriteria
DO $$ BEGIN
  ALTER TABLE "ArrivalCriteria" ADD CONSTRAINT "ArrivalCriteria_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
