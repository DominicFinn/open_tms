-- Carrier Tracking API Integrations

-- Add tracking number to shipments
ALTER TABLE "Shipment" ADD COLUMN IF NOT EXISTS "trackingNumber" TEXT;

-- Carrier tracking integration config (one per carrier)
CREATE TABLE IF NOT EXISTS "CarrierTrackingIntegration" (
    "id" TEXT NOT NULL,
    "carrierId" TEXT NOT NULL,
    "providerType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending_setup',
    "credentials" JSONB,
    "webhookEnabled" BOOLEAN NOT NULL DEFAULT false,
    "webhookSecret" TEXT,
    "webhookEndpointId" TEXT,
    "pollingEnabled" BOOLEAN NOT NULL DEFAULT false,
    "pollingIntervalSeconds" INTEGER NOT NULL DEFAULT 900,
    "lastPolledAt" TIMESTAMP(3),
    "rateLimitDailyMax" INTEGER,
    "rateLimitCallsToday" INTEGER NOT NULL DEFAULT 0,
    "rateLimitResetAt" TIMESTAMP(3),
    "lastErrorMessage" TEXT,
    "lastErrorAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CarrierTrackingIntegration_pkey" PRIMARY KEY ("id")
);

-- Normalized tracking events from carrier APIs
CREATE TABLE IF NOT EXISTS "CarrierTrackingEvent" (
    "id" TEXT NOT NULL,
    "shipmentId" TEXT NOT NULL,
    "carrierId" TEXT NOT NULL,
    "integrationId" TEXT NOT NULL,
    "providerType" TEXT NOT NULL,
    "trackingNumber" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "statusDetail" TEXT,
    "statusCode" TEXT,
    "city" TEXT,
    "state" TEXT,
    "country" TEXT,
    "postalCode" TEXT,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "estimatedDelivery" TIMESTAMP(3),
    "signedBy" TEXT,
    "rawPayload" JSONB,
    "source" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CarrierTrackingEvent_pkey" PRIMARY KEY ("id")
);

-- Unique constraint: one integration per carrier
CREATE UNIQUE INDEX IF NOT EXISTS "CarrierTrackingIntegration_carrierId_key" ON "CarrierTrackingIntegration"("carrierId");

-- Integration indexes
CREATE INDEX IF NOT EXISTS "CarrierTrackingIntegration_providerType_idx" ON "CarrierTrackingIntegration"("providerType");
CREATE INDEX IF NOT EXISTS "CarrierTrackingIntegration_status_idx" ON "CarrierTrackingIntegration"("status");

-- Event indexes
CREATE INDEX IF NOT EXISTS "CarrierTrackingEvent_shipmentId_idx" ON "CarrierTrackingEvent"("shipmentId");
CREATE INDEX IF NOT EXISTS "CarrierTrackingEvent_carrierId_idx" ON "CarrierTrackingEvent"("carrierId");
CREATE INDEX IF NOT EXISTS "CarrierTrackingEvent_integrationId_idx" ON "CarrierTrackingEvent"("integrationId");
CREATE INDEX IF NOT EXISTS "CarrierTrackingEvent_trackingNumber_idx" ON "CarrierTrackingEvent"("trackingNumber");
CREATE INDEX IF NOT EXISTS "CarrierTrackingEvent_occurredAt_idx" ON "CarrierTrackingEvent"("occurredAt");
CREATE INDEX IF NOT EXISTS "CarrierTrackingEvent_status_idx" ON "CarrierTrackingEvent"("status");

-- Foreign keys
ALTER TABLE "CarrierTrackingIntegration" ADD CONSTRAINT "CarrierTrackingIntegration_carrierId_fkey" FOREIGN KEY ("carrierId") REFERENCES "Carrier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CarrierTrackingEvent" ADD CONSTRAINT "CarrierTrackingEvent_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CarrierTrackingEvent" ADD CONSTRAINT "CarrierTrackingEvent_carrierId_fkey" FOREIGN KEY ("carrierId") REFERENCES "Carrier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CarrierTrackingEvent" ADD CONSTRAINT "CarrierTrackingEvent_integrationId_fkey" FOREIGN KEY ("integrationId") REFERENCES "CarrierTrackingIntegration"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
