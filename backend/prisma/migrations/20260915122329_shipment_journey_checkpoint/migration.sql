/*
  Warnings:

  - You are about to drop the column `returnLabelUrl` on the `Rma` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "CarrierCutoff" DROP CONSTRAINT "CarrierCutoff_carrierId_fkey";

-- DropForeignKey
ALTER TABLE "CustomerWebhook" DROP CONSTRAINT "CustomerWebhook_customerId_fkey";

-- DropForeignKey
ALTER TABLE "CustomerWebhookDelivery" DROP CONSTRAINT "CustomerWebhookDelivery_webhookId_fkey";

-- DropForeignKey
ALTER TABLE "PackAudit" DROP CONSTRAINT "PackAudit_packTaskId_fkey";

-- DropForeignKey
ALTER TABLE "Shipment" DROP CONSTRAINT "Shipment_destinationId_fkey";

-- DropForeignKey
ALTER TABLE "Shipment" DROP CONSTRAINT "Shipment_originId_fkey";

-- DropIndex
DROP INDEX "Carrier_deletedAt_idx";

-- DropIndex
DROP INDEX "Rma_returnCarrierId_idx";

-- DropIndex
DROP INDEX "Rma_returnTrackingNumber_idx";

-- DropIndex
DROP INDEX "Shipment_shipmentTypeId_idx";

-- DropIndex
DROP INDEX "TrackableUnit_packagingTypeId_idx";

-- DropIndex
DROP INDEX "WaveTemplate_autoRelease_active_idx";

-- AlterTable
ALTER TABLE "CarrierCutoff" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "CustomerWebhook" ALTER COLUMN "events" DROP DEFAULT,
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "PackagingType" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Rma" DROP COLUMN "returnLabelUrl";

-- AlterTable
ALTER TABLE "ShipmentShareLink" ALTER COLUMN "sections" DROP DEFAULT;

-- AlterTable
ALTER TABLE "ShipmentType" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- CreateTable
CREATE TABLE "ShipmentJourneyCheckpoint" (
    "id" TEXT NOT NULL,
    "shipmentId" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "checkpointIndex" INTEGER NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "distanceAlongRouteMeters" INTEGER NOT NULL,
    "fractionComplete" DOUBLE PRECISION NOT NULL,
    "eventTime" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShipmentJourneyCheckpoint_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ShipmentJourneyCheckpoint_shipmentId_idx" ON "ShipmentJourneyCheckpoint"("shipmentId");

-- CreateIndex
CREATE INDEX "ShipmentJourneyCheckpoint_orgId_idx" ON "ShipmentJourneyCheckpoint"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "ShipmentJourneyCheckpoint_shipmentId_checkpointIndex_key" ON "ShipmentJourneyCheckpoint"("shipmentId", "checkpointIndex");

-- AddForeignKey
ALTER TABLE "CustomerWebhook" ADD CONSTRAINT "CustomerWebhook_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerWebhookDelivery" ADD CONSTRAINT "CustomerWebhookDelivery_webhookId_fkey" FOREIGN KEY ("webhookId") REFERENCES "CustomerWebhook"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shipment" ADD CONSTRAINT "Shipment_originId_fkey" FOREIGN KEY ("originId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shipment" ADD CONSTRAINT "Shipment_destinationId_fkey" FOREIGN KEY ("destinationId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CarrierCutoff" ADD CONSTRAINT "CarrierCutoff_carrierId_fkey" FOREIGN KEY ("carrierId") REFERENCES "Carrier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShipmentJourneyCheckpoint" ADD CONSTRAINT "ShipmentJourneyCheckpoint_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackAudit" ADD CONSTRAINT "PackAudit_packTaskId_fkey" FOREIGN KEY ("packTaskId") REFERENCES "PackTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;
