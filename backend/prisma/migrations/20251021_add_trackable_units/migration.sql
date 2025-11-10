-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'Default Organization',
    "trackingMode" TEXT NOT NULL DEFAULT 'item',
    "trackableUnitType" TEXT NOT NULL DEFAULT 'box',
    "customUnitName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrackableUnit" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "unitType" TEXT NOT NULL,
    "customTypeName" TEXT,
    "sequenceNumber" INTEGER NOT NULL,
    "barcode" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrackableUnit_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "OrderLineItem" ADD COLUMN "trackableUnitId" TEXT;

-- CreateIndex
CREATE INDEX "TrackableUnit_orderId_idx" ON "TrackableUnit"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "TrackableUnit_orderId_sequenceNumber_key" ON "TrackableUnit"("orderId", "sequenceNumber");

-- AddForeignKey
ALTER TABLE "OrderLineItem" ADD CONSTRAINT "OrderLineItem_trackableUnitId_fkey" FOREIGN KEY ("trackableUnitId") REFERENCES "TrackableUnit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrackableUnit" ADD CONSTRAINT "TrackableUnit_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Insert default organization settings (only if table is empty)
INSERT INTO "Organization" (id, name, "trackingMode", "trackableUnitType", "createdAt", "updatedAt")
SELECT gen_random_uuid(), 'Default Organization', 'item', 'box', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "Organization");
