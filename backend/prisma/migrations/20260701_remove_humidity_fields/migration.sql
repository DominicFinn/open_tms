-- Humidity tracking removed from device telemetry and temperature logging.

-- AlterTable
ALTER TABLE "SensorReading" DROP COLUMN "humidity";

-- AlterTable
ALTER TABLE "ImmutableTemperatureLog" DROP COLUMN "humidity";
