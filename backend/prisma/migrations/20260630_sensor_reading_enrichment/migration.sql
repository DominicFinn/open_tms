-- Richer telemetry from System Loco device events.
ALTER TABLE "SensorReading" ADD COLUMN "atmosphericPressure" DOUBLE PRECISION;
ALTER TABLE "SensorReading" ADD COLUMN "locationType" TEXT;
ALTER TABLE "SensorReading" ADD COLUMN "locationAccuracy" DOUBLE PRECISION;
