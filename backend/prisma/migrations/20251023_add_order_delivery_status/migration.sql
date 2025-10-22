-- Add delivery status tracking to Order table
ALTER TABLE "Order" ADD COLUMN "deliveryStatus" TEXT NOT NULL DEFAULT 'unassigned';
ALTER TABLE "Order" ADD COLUMN "deliveredAt" TIMESTAMP(3);
ALTER TABLE "Order" ADD COLUMN "deliveryConfirmedBy" TEXT;
ALTER TABLE "Order" ADD COLUMN "deliveryMethod" TEXT;
ALTER TABLE "Order" ADD COLUMN "deliveryNotes" TEXT;
ALTER TABLE "Order" ADD COLUMN "exceptionType" TEXT;
ALTER TABLE "Order" ADD COLUMN "exceptionNotes" TEXT;
ALTER TABLE "Order" ADD COLUMN "exceptionResolvedAt" TIMESTAMP(3);
ALTER TABLE "Order" ADD COLUMN "deliveryStopId" TEXT;

-- Create ShipmentStop table for multi-stop route support
CREATE TABLE "ShipmentStop" (
    "id" TEXT NOT NULL,
    "shipmentId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "sequenceNumber" INTEGER NOT NULL,
    "stopType" TEXT NOT NULL DEFAULT 'delivery',
    "estimatedArrival" TIMESTAMP(3),
    "actualArrival" TIMESTAMP(3),
    "estimatedDeparture" TIMESTAMP(3),
    "actualDeparture" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'pending',
    "geofenceRadius" DOUBLE PRECISION,
    "geofenceEnabled" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "instructions" TEXT,
    "signatureUrl" TEXT,
    "photoUrls" JSONB,
    "proofOfDelivery" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShipmentStop_pkey" PRIMARY KEY ("id")
);

-- Create unique constraint on shipmentId and sequenceNumber
CREATE UNIQUE INDEX "ShipmentStop_shipmentId_sequenceNumber_key" ON "ShipmentStop"("shipmentId", "sequenceNumber");

-- Create indexes for performance
CREATE INDEX "ShipmentStop_shipmentId_idx" ON "ShipmentStop"("shipmentId");
CREATE INDEX "ShipmentStop_locationId_idx" ON "ShipmentStop"("locationId");
CREATE INDEX "ShipmentStop_status_idx" ON "ShipmentStop"("status");

-- Add foreign key constraints
ALTER TABLE "ShipmentStop" ADD CONSTRAINT "ShipmentStop_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ShipmentStop" ADD CONSTRAINT "ShipmentStop_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Add foreign key from Order to ShipmentStop
ALTER TABLE "Order" ADD CONSTRAINT "Order_deliveryStopId_fkey" FOREIGN KEY ("deliveryStopId") REFERENCES "ShipmentStop"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Create index on Order deliveryStatus for filtering
CREATE INDEX "Order_deliveryStatus_idx" ON "Order"("deliveryStatus");
