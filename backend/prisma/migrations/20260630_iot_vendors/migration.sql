-- Per-org IoT vendor on/off registry. System Loco is vendor #1.
CREATE TABLE "IotVendor" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "vendorKey" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "webhookSecret" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "IotVendor_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "IotVendor_orgId_vendorKey_key" ON "IotVendor"("orgId", "vendorKey");
CREATE INDEX "IotVendor_orgId_idx" ON "IotVendor"("orgId");

-- Backfill a System Loco vendor row (enabled) for every existing organization,
-- preserving current webhook processing behaviour.
INSERT INTO "IotVendor" ("id", "orgId", "vendorKey", "name", "enabled", "createdAt", "updatedAt")
SELECT gen_random_uuid(), o."id", 'system_loco', 'System Loco', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "Organization" o;
