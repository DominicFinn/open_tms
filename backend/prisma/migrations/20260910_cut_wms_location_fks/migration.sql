-- Phase 2a batch 6c (#280): cut the Location foreign keys from the WMS models.
--
-- The module rule is that no foreign key crosses the tms/wms boundary and references there are
-- soft string ids. locationId stays as exactly that. With the constraints gone, a schema without a
-- Location table resolves, which is what a standalone FinnWMS needs.
--
-- The columns do NOT go here, and cannot yet. InventoryRecord.locationId is still NOT NULL and the
-- inventory module has no facility, so putaway completion, returns and wave release all still need
-- a real Location; CompletePutaway also resolves a scanned bin by (locationId, label). Giving
-- inventory a facility is Phase 4, and the columns go with it.

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

