-- Add pickup/delivery window fields and ShipmentType feature.

-- 1. Window fields on Shipment
ALTER TABLE "Shipment"
  ADD COLUMN IF NOT EXISTS "pickupWindowStart" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "pickupWindowEnd" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "deliveryWindowStart" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "deliveryWindowEnd" TIMESTAMP(3);

-- 2. ShipmentType table
CREATE TABLE IF NOT EXISTS "ShipmentType" (
  "id"              TEXT NOT NULL,
  "name"            TEXT NOT NULL,
  "icon"            TEXT NOT NULL DEFAULT 'local_shipping',
  "color"           TEXT NOT NULL DEFAULT '#6366F1',
  "description"     TEXT,
  "defaults"        JSONB NOT NULL DEFAULT '{}',
  "requiredFields"  TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "isBuiltIn"       BOOLEAN NOT NULL DEFAULT false,
  "archived"        BOOLEAN NOT NULL DEFAULT false,
  "archivedAt"      TIMESTAMP(3),
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ShipmentType_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ShipmentType_name_key" ON "ShipmentType"("name");
CREATE INDEX IF NOT EXISTS "ShipmentType_archived_idx" ON "ShipmentType"("archived");

-- 3. Link Shipment to ShipmentType (nullable FK, SET NULL on delete)
ALTER TABLE "Shipment"
  ADD COLUMN IF NOT EXISTS "shipmentTypeId" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'Shipment_shipmentTypeId_fkey'
  ) THEN
    ALTER TABLE "Shipment"
      ADD CONSTRAINT "Shipment_shipmentTypeId_fkey"
      FOREIGN KEY ("shipmentTypeId") REFERENCES "ShipmentType"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS "Shipment_shipmentTypeId_idx" ON "Shipment"("shipmentTypeId");
