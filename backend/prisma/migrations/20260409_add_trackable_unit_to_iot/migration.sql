-- Add trackableUnitId to SensorReading
ALTER TABLE "SensorReading" ADD COLUMN IF NOT EXISTS "trackableUnitId" TEXT;
CREATE INDEX IF NOT EXISTS "SensorReading_trackableUnitId_eventTime_idx" ON "SensorReading"("trackableUnitId", "eventTime");

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SensorReading_trackableUnitId_fkey') THEN
    ALTER TABLE "SensorReading" ADD CONSTRAINT "SensorReading_trackableUnitId_fkey"
      FOREIGN KEY ("trackableUnitId") REFERENCES "TrackableUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- Add trackableUnitId to DeviceEvent
ALTER TABLE "DeviceEvent" ADD COLUMN IF NOT EXISTS "trackableUnitId" TEXT;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DeviceEvent_trackableUnitId_fkey') THEN
    ALTER TABLE "DeviceEvent" ADD CONSTRAINT "DeviceEvent_trackableUnitId_fkey"
      FOREIGN KEY ("trackableUnitId") REFERENCES "TrackableUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
