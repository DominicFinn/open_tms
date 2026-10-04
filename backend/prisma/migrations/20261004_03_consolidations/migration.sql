-- Consolidations (#329): one truck run carrying several shipments.
--
-- Table roles:
--   Consolidation          authoritative mutable. No secondary index: lists read the read model;
--                          the (orgId, reference) unique is a natural key.
--   ConsolidationStop      authoritative mutable child. (consolidationId, sequenceNumber) serves
--                          ConsolidationRepository's ordered stop load.
--   ConsolidationShipment  join. shipmentId unique enforces one consolidation per shipment and
--                          serves "which consolidation is this shipment on"; (consolidationId,
--                          addedAt) serves loading a consolidation's shipments in order.
--   ConsolidationReadModel read model. (orgId, archived, createdAt) serves ConsolidationRepository.list.
--
-- ShipmentStop stays at 3 secondary indexes: (shipmentId) is dropped because the
-- (shipmentId, sequenceNumber) unique already serves it, and (consolidationStopId) serves finding
-- the shipment stops a consolidation stop drives (tracking, #329 slice 3) and the SET NULL FK.

-- DropIndex
DROP INDEX "ShipmentStop_shipmentId_idx";

-- AlterTable
ALTER TABLE "ShipmentStop" ADD COLUMN     "consolidationStopId" TEXT;

-- CreateTable
CREATE TABLE "Consolidation" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "carrierId" TEXT,
    "notes" TEXT,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Consolidation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConsolidationStop" (
    "id" TEXT NOT NULL,
    "consolidationId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "sequenceNumber" INTEGER NOT NULL,
    "stopType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConsolidationStop_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConsolidationShipment" (
    "id" TEXT NOT NULL,
    "consolidationId" TEXT NOT NULL,
    "shipmentId" TEXT NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConsolidationShipment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConsolidationReadModel" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "carrierName" TEXT,
    "shipmentCount" INTEGER NOT NULL DEFAULT 0,
    "customerCount" INTEGER NOT NULL DEFAULT 0,
    "customerNames" TEXT[],
    "stopCount" INTEGER NOT NULL DEFAULT 0,
    "firstStopName" TEXT,
    "lastStopName" TEXT,
    "pickupDate" TIMESTAMP(3),
    "deliveryDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConsolidationReadModel_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Consolidation_orgId_reference_key" ON "Consolidation"("orgId", "reference");

-- CreateIndex
CREATE INDEX "ConsolidationStop_consolidationId_sequenceNumber_idx" ON "ConsolidationStop"("consolidationId", "sequenceNumber");

-- CreateIndex
CREATE UNIQUE INDEX "ConsolidationShipment_shipmentId_key" ON "ConsolidationShipment"("shipmentId");

-- CreateIndex
CREATE INDEX "ConsolidationShipment_consolidationId_addedAt_idx" ON "ConsolidationShipment"("consolidationId", "addedAt");

-- CreateIndex
CREATE INDEX "ConsolidationReadModel_orgId_archived_createdAt_idx" ON "ConsolidationReadModel"("orgId", "archived", "createdAt");

-- CreateIndex
CREATE INDEX "ShipmentStop_consolidationStopId_idx" ON "ShipmentStop"("consolidationStopId");

-- AddForeignKey
ALTER TABLE "ShipmentStop" ADD CONSTRAINT "ShipmentStop_consolidationStopId_fkey" FOREIGN KEY ("consolidationStopId") REFERENCES "ConsolidationStop"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Consolidation" ADD CONSTRAINT "Consolidation_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Consolidation" ADD CONSTRAINT "Consolidation_carrierId_fkey" FOREIGN KEY ("carrierId") REFERENCES "Carrier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsolidationStop" ADD CONSTRAINT "ConsolidationStop_consolidationId_fkey" FOREIGN KEY ("consolidationId") REFERENCES "Consolidation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsolidationStop" ADD CONSTRAINT "ConsolidationStop_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsolidationShipment" ADD CONSTRAINT "ConsolidationShipment_consolidationId_fkey" FOREIGN KEY ("consolidationId") REFERENCES "Consolidation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsolidationShipment" ADD CONSTRAINT "ConsolidationShipment_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsolidationReadModel" ADD CONSTRAINT "ConsolidationReadModel_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

