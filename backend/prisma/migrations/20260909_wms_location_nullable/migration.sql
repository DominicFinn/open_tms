-- Phase 2a batch 6a (#245): make locationId nullable on the WMS models.
--
-- A command cannot stop writing locationId while the column is NOT NULL, and a standalone FinnWMS
-- has no Location to write at all. This is the prerequisite for moving the write path onto
-- facilityId; nothing stops writing locationId in this migration, so it is behaviour-neutral.
--
-- The foreign keys are recreated as ON DELETE SET NULL rather than RESTRICT, which is what an
-- optional relation means: deleting a Location no longer refuses because warehouse rows point at
-- it, it detaches them. Those rows keep their facilityId, which is the reference that matters from
-- here on. The keys go entirely in 6b.

-- DropForeignKey
ALTER TABLE "WarehouseZone" DROP CONSTRAINT "WarehouseZone_locationId_fkey";

-- DropForeignKey
ALTER TABLE "WarehouseAisle" DROP CONSTRAINT "WarehouseAisle_locationId_fkey";

-- DropForeignKey
ALTER TABLE "WarehouseBin" DROP CONSTRAINT "WarehouseBin_locationId_fkey";

-- DropForeignKey
ALTER TABLE "ReceivingAppointment" DROP CONSTRAINT "ReceivingAppointment_locationId_fkey";

-- DropForeignKey
ALTER TABLE "ReceivingTask" DROP CONSTRAINT "ReceivingTask_locationId_fkey";

-- DropForeignKey
ALTER TABLE "PutawayRule" DROP CONSTRAINT "PutawayRule_locationId_fkey";

-- DropForeignKey
ALTER TABLE "PutawayTask" DROP CONSTRAINT "PutawayTask_locationId_fkey";

-- DropForeignKey
ALTER TABLE "WaveTemplate" DROP CONSTRAINT "WaveTemplate_locationId_fkey";

-- DropForeignKey
ALTER TABLE "Wave" DROP CONSTRAINT "Wave_locationId_fkey";

-- DropForeignKey
ALTER TABLE "PickTask" DROP CONSTRAINT "PickTask_locationId_fkey";

-- DropForeignKey
ALTER TABLE "PackTask" DROP CONSTRAINT "PackTask_locationId_fkey";

-- DropForeignKey
ALTER TABLE "StagingAssignment" DROP CONSTRAINT "StagingAssignment_locationId_fkey";

-- AlterTable
ALTER TABLE "WarehouseZone" ALTER COLUMN "locationId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "WarehouseAisle" ALTER COLUMN "locationId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "WarehouseBin" ALTER COLUMN "locationId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "ReceivingAppointment" ALTER COLUMN "locationId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "ReceivingTask" ALTER COLUMN "locationId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "PutawayRule" ALTER COLUMN "locationId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "PutawayTask" ALTER COLUMN "locationId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "WaveTemplate" ALTER COLUMN "locationId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Wave" ALTER COLUMN "locationId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "PickTask" ALTER COLUMN "locationId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "PackTask" ALTER COLUMN "locationId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "CartonCatalogue" ALTER COLUMN "locationId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "StagingAssignment" ALTER COLUMN "locationId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "LoadPlan" ALTER COLUMN "locationId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "WarehouseZone" ADD CONSTRAINT "WarehouseZone_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarehouseAisle" ADD CONSTRAINT "WarehouseAisle_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarehouseBin" ADD CONSTRAINT "WarehouseBin_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReceivingAppointment" ADD CONSTRAINT "ReceivingAppointment_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReceivingTask" ADD CONSTRAINT "ReceivingTask_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PutawayRule" ADD CONSTRAINT "PutawayRule_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PutawayTask" ADD CONSTRAINT "PutawayTask_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WaveTemplate" ADD CONSTRAINT "WaveTemplate_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Wave" ADD CONSTRAINT "Wave_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PickTask" ADD CONSTRAINT "PickTask_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackTask" ADD CONSTRAINT "PackTask_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StagingAssignment" ADD CONSTRAINT "StagingAssignment_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;

