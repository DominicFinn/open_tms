-- Cold Chain & Compliance Foundation
-- Adds models for cold chain profiles, immutable temperature logging,
-- excursion tracking, device calibration, and CAPA reports.

-- Organization: add auto-deliver shipment docs setting
ALTER TABLE "Organization" ADD COLUMN "autoDeliverShipmentDocs" BOOLEAN NOT NULL DEFAULT false;

-- Device: add manufacturer field
ALTER TABLE "Device" ADD COLUMN "manufacturer" TEXT;

-- Shipment: add cold chain fields
ALTER TABLE "Shipment" ADD COLUMN "coldChainProfileId" TEXT;
ALTER TABLE "Shipment" ADD COLUMN "effectiveMinTemp" DOUBLE PRECISION;
ALTER TABLE "Shipment" ADD COLUMN "effectiveMaxTemp" DOUBLE PRECISION;
ALTER TABLE "Shipment" ADD COLUMN "effectiveAlertMinTemp" DOUBLE PRECISION;
ALTER TABLE "Shipment" ADD COLUMN "effectiveAlertMaxTemp" DOUBLE PRECISION;
ALTER TABLE "Shipment" ADD COLUMN "coldChainDisposition" TEXT NOT NULL DEFAULT 'not_applicable';
ALTER TABLE "Shipment" ADD COLUMN "dispositionSetBy" TEXT;
ALTER TABLE "Shipment" ADD COLUMN "dispositionSetAt" TIMESTAMP(3);
ALTER TABLE "Shipment" ADD COLUMN "dispositionNotes" TEXT;

-- ColdChainProfile
CREATE TABLE "ColdChainProfile" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "minTemperature" DOUBLE PRECISION NOT NULL,
    "maxTemperature" DOUBLE PRECISION NOT NULL,
    "alertMinTemperature" DOUBLE PRECISION NOT NULL,
    "alertMaxTemperature" DOUBLE PRECISION NOT NULL,
    "minHumidity" DOUBLE PRECISION,
    "maxHumidity" DOUBLE PRECISION,
    "alertMinHumidity" DOUBLE PRECISION,
    "alertMaxHumidity" DOUBLE PRECISION,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,

    CONSTRAINT "ColdChainProfile_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ColdChainProfile_orgId_idx" ON "ColdChainProfile"("orgId");
CREATE INDEX "ColdChainProfile_active_idx" ON "ColdChainProfile"("active");

-- DeviceCalibration
CREATE TABLE "DeviceCalibration" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "calibratedAt" TIMESTAMP(3) NOT NULL,
    "calibratedBy" TEXT NOT NULL,
    "certificateNumber" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "calibrationMethod" TEXT,
    "accuracy" DOUBLE PRECISION,
    "status" TEXT NOT NULL DEFAULT 'valid',
    "notes" TEXT,
    "documentStorageKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,

    CONSTRAINT "DeviceCalibration_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "DeviceCalibration_deviceId_idx" ON "DeviceCalibration"("deviceId");
CREATE INDEX "DeviceCalibration_orgId_idx" ON "DeviceCalibration"("orgId");
CREATE INDEX "DeviceCalibration_status_idx" ON "DeviceCalibration"("status");
CREATE INDEX "DeviceCalibration_expiresAt_idx" ON "DeviceCalibration"("expiresAt");

-- ImmutableTemperatureLog — WRITE-ONLY table for CFR 21 Part 11 compliance
CREATE TABLE "ImmutableTemperatureLog" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "shipmentId" TEXT,
    "deviceId" TEXT,
    "orderId" TEXT,
    "trackableUnitId" TEXT,
    "temperature" DOUBLE PRECISION NOT NULL,
    "humidity" DOUBLE PRECISION,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "recordedAt" TIMESTAMP(3) NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "profileMinTemp" DOUBLE PRECISION,
    "profileMaxTemp" DOUBLE PRECISION,
    "profileAlertMinTemp" DOUBLE PRECISION,
    "profileAlertMaxTemp" DOUBLE PRECISION,
    "profileName" TEXT,
    "isWithinRange" BOOLEAN NOT NULL,
    "isWithinAlertRange" BOOLEAN NOT NULL,
    "isExcursion" BOOLEAN NOT NULL DEFAULT false,
    "isAlert" BOOLEAN NOT NULL DEFAULT false,
    "integrityHash" TEXT NOT NULL,
    "rawPayload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImmutableTemperatureLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ImmutableTemperatureLog_shipmentId_recordedAt_idx" ON "ImmutableTemperatureLog"("shipmentId", "recordedAt");
CREATE INDEX "ImmutableTemperatureLog_deviceId_recordedAt_idx" ON "ImmutableTemperatureLog"("deviceId", "recordedAt");
CREATE INDEX "ImmutableTemperatureLog_orgId_capturedAt_idx" ON "ImmutableTemperatureLog"("orgId", "capturedAt");
CREATE INDEX "ImmutableTemperatureLog_isExcursion_idx" ON "ImmutableTemperatureLog"("isExcursion");
CREATE INDEX "ImmutableTemperatureLog_isAlert_idx" ON "ImmutableTemperatureLog"("isAlert");

-- Revoke UPDATE and DELETE on ImmutableTemperatureLog for application role
-- (Enforced at application layer; database-level REVOKE applied during production setup)

-- ColdChainExcursion
CREATE TABLE "ColdChainExcursion" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "shipmentId" TEXT NOT NULL,
    "deviceId" TEXT,
    "excursionType" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3),
    "durationMinutes" INTEGER,
    "peakValue" DOUBLE PRECISION NOT NULL,
    "thresholdValue" DOUBLE PRECISION NOT NULL,
    "readingCount" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'active',
    "acknowledgedBy" TEXT,
    "acknowledgedAt" TIMESTAMP(3),
    "resolvedBy" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "dispositionDecision" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ColdChainExcursion_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ColdChainExcursion_shipmentId_idx" ON "ColdChainExcursion"("shipmentId");
CREATE INDEX "ColdChainExcursion_orgId_idx" ON "ColdChainExcursion"("orgId");
CREATE INDEX "ColdChainExcursion_status_idx" ON "ColdChainExcursion"("status");
CREATE INDEX "ColdChainExcursion_severity_idx" ON "ColdChainExcursion"("severity");
CREATE INDEX "ColdChainExcursion_startedAt_idx" ON "ColdChainExcursion"("startedAt");

-- CAPAReport
CREATE TABLE "CAPAReport" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "issueId" TEXT NOT NULL,
    "shipmentId" TEXT,
    "reportNumber" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "priority" TEXT NOT NULL DEFAULT 'medium',
    "description" TEXT NOT NULL,
    "immediateAction" TEXT,
    "containmentAction" TEXT,
    "investigationDetails" TEXT,
    "rootCause" TEXT,
    "rootCauseCategory" TEXT,
    "correctiveAction" TEXT,
    "correctiveActionDueDate" TIMESTAMP(3),
    "correctiveActionCompletedDate" TIMESTAMP(3),
    "preventiveAction" TEXT,
    "preventiveActionDueDate" TIMESTAMP(3),
    "preventiveActionCompletedDate" TIMESTAMP(3),
    "investigatorId" TEXT,
    "investigatorName" TEXT,
    "approverId" TEXT,
    "approverName" TEXT,
    "approvedAt" TIMESTAMP(3),
    "affectedProducts" JSONB,
    "affectedShipmentIds" JSONB,
    "affectedLocationIds" JSONB,
    "eventTimeline" JSONB,
    "temperatureData" JSONB,
    "verificationMethod" TEXT,
    "verifiedById" TEXT,
    "verifiedByName" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "effectivenessCheck" TEXT,
    "lessonsLearned" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,

    CONSTRAINT "CAPAReport_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CAPAReport_orgId_idx" ON "CAPAReport"("orgId");
CREATE INDEX "CAPAReport_issueId_idx" ON "CAPAReport"("issueId");
CREATE INDEX "CAPAReport_shipmentId_idx" ON "CAPAReport"("shipmentId");
CREATE INDEX "CAPAReport_status_idx" ON "CAPAReport"("status");
CREATE INDEX "CAPAReport_reportNumber_idx" ON "CAPAReport"("reportNumber");

-- Foreign keys
ALTER TABLE "Shipment" ADD CONSTRAINT "Shipment_coldChainProfileId_fkey" FOREIGN KEY ("coldChainProfileId") REFERENCES "ColdChainProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DeviceCalibration" ADD CONSTRAINT "DeviceCalibration_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ImmutableTemperatureLog" ADD CONSTRAINT "ImmutableTemperatureLog_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ImmutableTemperatureLog" ADD CONSTRAINT "ImmutableTemperatureLog_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ColdChainExcursion" ADD CONSTRAINT "ColdChainExcursion_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ColdChainExcursion" ADD CONSTRAINT "ColdChainExcursion_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CAPAReport" ADD CONSTRAINT "CAPAReport_issueId_fkey" FOREIGN KEY ("issueId") REFERENCES "Issue"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CAPAReport" ADD CONSTRAINT "CAPAReport_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
