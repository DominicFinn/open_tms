-- AlterTable: Add cargo tracking fields to TrackableUnit
ALTER TABLE "TrackableUnit" ADD COLUMN "currentStopId" TEXT;
ALTER TABLE "TrackableUnit" ADD COLUMN "condition" TEXT NOT NULL DEFAULT 'good';
ALTER TABLE "TrackableUnit" ADD COLUMN "lastScannedAt" TIMESTAMP(3);

-- CreateTable: CargoScan
CREATE TABLE "CargoScan" (
    "id" TEXT NOT NULL,
    "trackableUnitId" TEXT NOT NULL,
    "shipmentStopId" TEXT NOT NULL,
    "shipmentId" TEXT NOT NULL,
    "scanType" TEXT NOT NULL,
    "scanMethod" TEXT NOT NULL,
    "scannedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "scannedBy" TEXT,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "expected" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CargoScan_pkey" PRIMARY KEY ("id")
);

-- CreateTable: CargoDiscrepancy
CREATE TABLE "CargoDiscrepancy" (
    "id" TEXT NOT NULL,
    "shipmentId" TEXT NOT NULL,
    "trackableUnitId" TEXT NOT NULL,
    "discrepancyType" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'high',
    "expectedStopId" TEXT,
    "actualStopId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'open',
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "detectedBy" TEXT NOT NULL DEFAULT 'system',
    "resolvedAt" TIMESTAMP(3),
    "resolvedBy" TEXT,
    "resolution" TEXT,
    "description" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CargoDiscrepancy_pkey" PRIMARY KEY ("id")
);

-- CreateIndexes: CargoScan
CREATE INDEX "CargoScan_trackableUnitId_idx" ON "CargoScan"("trackableUnitId");
CREATE INDEX "CargoScan_shipmentStopId_idx" ON "CargoScan"("shipmentStopId");
CREATE INDEX "CargoScan_shipmentId_idx" ON "CargoScan"("shipmentId");
CREATE INDEX "CargoScan_scannedAt_idx" ON "CargoScan"("scannedAt");

-- CreateIndexes: CargoDiscrepancy
CREATE INDEX "CargoDiscrepancy_shipmentId_idx" ON "CargoDiscrepancy"("shipmentId");
CREATE INDEX "CargoDiscrepancy_trackableUnitId_idx" ON "CargoDiscrepancy"("trackableUnitId");
CREATE INDEX "CargoDiscrepancy_status_idx" ON "CargoDiscrepancy"("status");
CREATE INDEX "CargoDiscrepancy_discrepancyType_idx" ON "CargoDiscrepancy"("discrepancyType");
CREATE INDEX "CargoDiscrepancy_detectedAt_idx" ON "CargoDiscrepancy"("detectedAt");

-- CreateIndex: TrackableUnit.currentStopId
CREATE INDEX "TrackableUnit_currentStopId_idx" ON "TrackableUnit"("currentStopId");

-- AddForeignKeys
ALTER TABLE "TrackableUnit" ADD CONSTRAINT "TrackableUnit_currentStopId_fkey" FOREIGN KEY ("currentStopId") REFERENCES "ShipmentStop"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CargoScan" ADD CONSTRAINT "CargoScan_trackableUnitId_fkey" FOREIGN KEY ("trackableUnitId") REFERENCES "TrackableUnit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CargoScan" ADD CONSTRAINT "CargoScan_shipmentStopId_fkey" FOREIGN KEY ("shipmentStopId") REFERENCES "ShipmentStop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CargoScan" ADD CONSTRAINT "CargoScan_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CargoDiscrepancy" ADD CONSTRAINT "CargoDiscrepancy_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CargoDiscrepancy" ADD CONSTRAINT "CargoDiscrepancy_trackableUnitId_fkey" FOREIGN KEY ("trackableUnitId") REFERENCES "TrackableUnit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CargoDiscrepancy" ADD CONSTRAINT "CargoDiscrepancy_expectedStopId_fkey" FOREIGN KEY ("expectedStopId") REFERENCES "ShipmentStop"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CargoDiscrepancy" ADD CONSTRAINT "CargoDiscrepancy_actualStopId_fkey" FOREIGN KEY ("actualStopId") REFERENCES "ShipmentStop"("id") ON DELETE SET NULL ON UPDATE CASCADE;
