-- Warehouse App: Magic Links, Login Audit, Accessories, Flags, Connectivity

-- Add warehouse preferences to User
ALTER TABLE "User" ADD COLUMN "preferredLocationId" TEXT;

-- Add warehouse preferences to Location (via custom fields already exists)
-- No change needed

-- Add warehouse app settings to Organization
ALTER TABLE "Organization" ADD COLUMN "magicLinksEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Organization" ADD COLUMN "warehouseScanMode" TEXT NOT NULL DEFAULT 'hid';

-- Add warehouse launch fields to Shipment
ALTER TABLE "Shipment" ADD COLUMN "launchedAt" TIMESTAMP(3);
ALTER TABLE "Shipment" ADD COLUMN "launchedBy" TEXT;

-- Magic Link table
CREATE TABLE "MagicLink" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MagicLink_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MagicLink_tokenHash_key" ON "MagicLink"("tokenHash");
CREATE INDEX "MagicLink_userId_idx" ON "MagicLink"("userId");
CREATE INDEX "MagicLink_tokenHash_idx" ON "MagicLink"("tokenHash");

ALTER TABLE "MagicLink" ADD CONSTRAINT "MagicLink_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Login Audit Log table
CREATE TABLE "LoginAuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "success" BOOLEAN NOT NULL DEFAULT true,
    "failReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoginAuditLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "LoginAuditLog_userId_idx" ON "LoginAuditLog"("userId");
CREATE INDEX "LoginAuditLog_createdAt_idx" ON "LoginAuditLog"("createdAt");
CREATE INDEX "LoginAuditLog_method_idx" ON "LoginAuditLog"("method");

ALTER TABLE "LoginAuditLog" ADD CONSTRAINT "LoginAuditLog_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Shipment Accessory table (door seals, BLE sensors, etc.)
CREATE TABLE "ShipmentAccessory" (
    "id" TEXT NOT NULL,
    "shipmentId" TEXT NOT NULL,
    "accessoryType" TEXT NOT NULL,
    "alias" TEXT,
    "identifier" TEXT,
    "isIoT" BOOLEAN NOT NULL DEFAULT false,
    "deviceId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShipmentAccessory_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ShipmentAccessory_shipmentId_idx" ON "ShipmentAccessory"("shipmentId");
CREATE INDEX "ShipmentAccessory_deviceId_idx" ON "ShipmentAccessory"("deviceId");

ALTER TABLE "ShipmentAccessory" ADD CONSTRAINT "ShipmentAccessory_shipmentId_fkey"
    FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Shipment Flag table
CREATE TABLE "ShipmentFlag" (
    "id" TEXT NOT NULL,
    "shipmentId" TEXT NOT NULL,
    "flaggedBy" TEXT NOT NULL,
    "flaggedByName" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "resolvedBy" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShipmentFlag_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ShipmentFlag_shipmentId_idx" ON "ShipmentFlag"("shipmentId");
CREATE INDEX "ShipmentFlag_resolved_idx" ON "ShipmentFlag"("resolved");

ALTER TABLE "ShipmentFlag" ADD CONSTRAINT "ShipmentFlag_shipmentId_fkey"
    FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Connectivity Log table (WiFi issues tracking)
CREATE TABLE "ConnectivityLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "deviceInfo" TEXT,
    "eventType" TEXT NOT NULL,
    "locationId" TEXT,
    "duration" INTEGER,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConnectivityLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ConnectivityLog_createdAt_idx" ON "ConnectivityLog"("createdAt");
CREATE INDEX "ConnectivityLog_locationId_idx" ON "ConnectivityLog"("locationId");
