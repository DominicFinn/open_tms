-- Webhook idempotency: dedupe sensor readings on the originating System Loco
-- report/event id, so a redelivered webhook cannot double-write.
ALTER TABLE "SensorReading" ADD COLUMN "sourceReportId" TEXT;
CREATE UNIQUE INDEX "SensorReading_sourceReportId_key" ON "SensorReading"("sourceReportId");
