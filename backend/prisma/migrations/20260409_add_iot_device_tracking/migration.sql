-- CreateTable: Device
CREATE TABLE IF NOT EXISTS "Device" (
    "id" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "displayId" TEXT,
    "name" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'system_loco',
    "model" TEXT,
    "firmware" TEXT,
    "labels" JSONB,
    "status" TEXT NOT NULL DEFAULT 'active',
    "batteryLevel" INTEGER,
    "lastSeenAt" TIMESTAMP(3),
    "lastLat" DOUBLE PRECISION,
    "lastLng" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Device_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Device_externalId_key" ON "Device"("externalId");
CREATE INDEX IF NOT EXISTS "Device_name_idx" ON "Device"("name");
CREATE INDEX IF NOT EXISTS "Device_provider_idx" ON "Device"("provider");
CREATE INDEX IF NOT EXISTS "Device_status_idx" ON "Device"("status");

-- CreateTable: DeviceAssignment
CREATE TABLE IF NOT EXISTS "DeviceAssignment" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "shipmentId" TEXT,
    "orderId" TEXT,
    "trackableUnitId" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "unassignedAt" TIMESTAMP(3),
    CONSTRAINT "DeviceAssignment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "DeviceAssignment_deviceId_active_idx" ON "DeviceAssignment"("deviceId", "active");
CREATE INDEX IF NOT EXISTS "DeviceAssignment_shipmentId_idx" ON "DeviceAssignment"("shipmentId");
CREATE INDEX IF NOT EXISTS "DeviceAssignment_orderId_idx" ON "DeviceAssignment"("orderId");

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DeviceAssignment_deviceId_fkey') THEN
    ALTER TABLE "DeviceAssignment" ADD CONSTRAINT "DeviceAssignment_deviceId_fkey"
      FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DeviceAssignment_shipmentId_fkey') THEN
    ALTER TABLE "DeviceAssignment" ADD CONSTRAINT "DeviceAssignment_shipmentId_fkey"
      FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DeviceAssignment_orderId_fkey') THEN
    ALTER TABLE "DeviceAssignment" ADD CONSTRAINT "DeviceAssignment_orderId_fkey"
      FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- CreateTable: SensorReading
CREATE TABLE IF NOT EXISTS "SensorReading" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "shipmentId" TEXT,
    "orderId" TEXT,
    "eventTime" TIMESTAMP(3) NOT NULL,
    "temperature" DOUBLE PRECISION,
    "humidity" DOUBLE PRECISION,
    "lightLevel" INTEGER,
    "batteryLevel" INTEGER,
    "batteryVoltage" DOUBLE PRECISION,
    "impactG" DOUBLE PRECISION,
    "tiltAngle" DOUBLE PRECISION,
    "movement" TEXT,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "address" TEXT,
    "tempMin" DOUBLE PRECISION,
    "tempMax" DOUBLE PRECISION,
    "lightMin" INTEGER,
    "lightMax" INTEGER,
    "isAlert" BOOLEAN NOT NULL DEFAULT false,
    "alertType" TEXT,
    "rawPayload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SensorReading_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "SensorReading_deviceId_eventTime_idx" ON "SensorReading"("deviceId", "eventTime");
CREATE INDEX IF NOT EXISTS "SensorReading_shipmentId_eventTime_idx" ON "SensorReading"("shipmentId", "eventTime");
CREATE INDEX IF NOT EXISTS "SensorReading_orderId_eventTime_idx" ON "SensorReading"("orderId", "eventTime");
CREATE INDEX IF NOT EXISTS "SensorReading_isAlert_idx" ON "SensorReading"("isAlert");

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SensorReading_deviceId_fkey') THEN
    ALTER TABLE "SensorReading" ADD CONSTRAINT "SensorReading_deviceId_fkey"
      FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SensorReading_shipmentId_fkey') THEN
    ALTER TABLE "SensorReading" ADD CONSTRAINT "SensorReading_shipmentId_fkey"
      FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SensorReading_orderId_fkey') THEN
    ALTER TABLE "SensorReading" ADD CONSTRAINT "SensorReading_orderId_fkey"
      FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- CreateTable: DeviceEvent
CREATE TABLE IF NOT EXISTS "DeviceEvent" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "shipmentId" TEXT,
    "orderId" TEXT,
    "externalEventId" TEXT,
    "eventType" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3),
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "address" TEXT,
    "zoneName" TEXT,
    "message" TEXT,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DeviceEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "DeviceEvent_externalEventId_key" ON "DeviceEvent"("externalEventId");
CREATE INDEX IF NOT EXISTS "DeviceEvent_deviceId_startTime_idx" ON "DeviceEvent"("deviceId", "startTime");
CREATE INDEX IF NOT EXISTS "DeviceEvent_shipmentId_idx" ON "DeviceEvent"("shipmentId");
CREATE INDEX IF NOT EXISTS "DeviceEvent_eventType_idx" ON "DeviceEvent"("eventType");

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DeviceEvent_deviceId_fkey') THEN
    ALTER TABLE "DeviceEvent" ADD CONSTRAINT "DeviceEvent_deviceId_fkey"
      FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
