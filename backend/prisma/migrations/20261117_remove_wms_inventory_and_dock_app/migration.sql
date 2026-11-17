-- Open TMS goes back to a TMS only (#392, #394).
--
-- Drops the warehouse management and inventory tables, the dock app's tables and columns, the
-- event bridge cursor for the .NET WMS service, and the warehouse columns on TrackableUnit and
-- RmaLine. This destroys warehouse and inventory data, which is intended. The last commit that
-- carries the removed code is tagged `last-with-wms`.

-- The .NET WMS service kept its own objects in a `wms` schema (the DbUp journal, the outbox, and a
-- view over "Facility"). They only exist where that service ran, and the view has to go before
-- the table under it does.
DROP SCHEMA IF EXISTS wms CASCADE;

-- The service's two NOLOGIN roles are cluster-wide. A role that still holds privileges in another
-- database on the same server cannot be dropped from here, and that must not fail the migration,
-- so a refusal is reported and left for an operator.
DO $$
DECLARE
  service_role text;
BEGIN
  FOREACH service_role IN ARRAY ARRAY['wms_app', 'wms_outbox_reader'] LOOP
    BEGIN
      EXECUTE format('DROP ROLE IF EXISTS %I', service_role);
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Role % was left in place: %', service_role, SQLERRM;
    END;
  END LOOP;
END $$;

-- pg-boss keeps its cron schedules in its own schema, which it creates at runtime. Left alone,
-- the wave auto-release schedule would queue a job every five minutes with nothing to consume it.
DO $$
BEGIN
  IF to_regclass('pgboss.schedule') IS NOT NULL THEN
    DELETE FROM pgboss.schedule WHERE name = 'wave-auto-release';
  END IF;
END $$;

-- The `warehouse` system role only granted warehouse work, and system roles cannot be deleted
-- through the app. Its assignments go with it by cascade.
DELETE FROM "Role" WHERE "name" = 'warehouse' AND "isSystem" = true;

-- DropForeignKey
ALTER TABLE "MagicLink" DROP CONSTRAINT "MagicLink_userId_fkey";

-- DropForeignKey
ALTER TABLE "LoginAuditLog" DROP CONSTRAINT "LoginAuditLog_userId_fkey";

-- DropForeignKey
ALTER TABLE "InventoryRecord" DROP CONSTRAINT "InventoryRecord_binId_fkey";

-- DropForeignKey
ALTER TABLE "InventoryTransaction" DROP CONSTRAINT "InventoryTransaction_inventoryRecordId_fkey";

-- DropForeignKey
ALTER TABLE "InventoryTransaction" DROP CONSTRAINT "InventoryTransaction_handlingUnitId_fkey";

-- DropForeignKey
ALTER TABLE "InventoryTransaction" DROP CONSTRAINT "InventoryTransaction_trackableUnitId_fkey";

-- DropForeignKey
ALTER TABLE "InventoryObservation" DROP CONSTRAINT "InventoryObservation_binId_fkey";

-- DropForeignKey
ALTER TABLE "InventoryObservation" DROP CONSTRAINT "InventoryObservation_inventoryRecordId_fkey";

-- DropForeignKey
ALTER TABLE "Allocation" DROP CONSTRAINT "Allocation_inventoryRecordId_fkey";

-- DropForeignKey
ALTER TABLE "Allocation" DROP CONSTRAINT "Allocation_handlingUnitId_fkey";

-- DropForeignKey
ALTER TABLE "Allocation" DROP CONSTRAINT "Allocation_trackableUnitId_fkey";

-- DropForeignKey
ALTER TABLE "TrackableUnit" DROP CONSTRAINT "TrackableUnit_currentBinId_fkey";

-- DropForeignKey
ALTER TABLE "TrackableUnit" DROP CONSTRAINT "TrackableUnit_parentUnitId_fkey";

-- DropForeignKey
ALTER TABLE "TrackableUnit" DROP CONSTRAINT "TrackableUnit_currentZoneId_fkey";

-- DropForeignKey
ALTER TABLE "TrackableUnit" DROP CONSTRAINT "TrackableUnit_ownerCustomerId_fkey";

-- DropForeignKey
ALTER TABLE "ShipmentAccessory" DROP CONSTRAINT "ShipmentAccessory_shipmentId_fkey";

-- DropForeignKey
ALTER TABLE "ShipmentFlag" DROP CONSTRAINT "ShipmentFlag_shipmentId_fkey";

-- DropForeignKey
ALTER TABLE "WarehouseZone" DROP CONSTRAINT "WarehouseZone_facilityId_fkey";

-- DropForeignKey
ALTER TABLE "WarehouseAisle" DROP CONSTRAINT "WarehouseAisle_zoneId_fkey";

-- DropForeignKey
ALTER TABLE "WarehouseAisle" DROP CONSTRAINT "WarehouseAisle_facilityId_fkey";

-- DropForeignKey
ALTER TABLE "WarehouseBin" DROP CONSTRAINT "WarehouseBin_zoneId_fkey";

-- DropForeignKey
ALTER TABLE "WarehouseBin" DROP CONSTRAINT "WarehouseBin_aisleId_fkey";

-- DropForeignKey
ALTER TABLE "WarehouseBin" DROP CONSTRAINT "WarehouseBin_facilityId_fkey";

-- DropForeignKey
ALTER TABLE "IndoorZoneAnchor" DROP CONSTRAINT "IndoorZoneAnchor_zoneId_fkey";

-- DropForeignKey
ALTER TABLE "ReceivingAppointment" DROP CONSTRAINT "ReceivingAppointment_facilityId_fkey";

-- DropForeignKey
ALTER TABLE "ReceivingAppointment" DROP CONSTRAINT "ReceivingAppointment_dockBinId_fkey";

-- DropForeignKey
ALTER TABLE "ReceivingTask" DROP CONSTRAINT "ReceivingTask_facilityId_fkey";

-- DropForeignKey
ALTER TABLE "ReceivingTask" DROP CONSTRAINT "ReceivingTask_appointmentId_fkey";

-- DropForeignKey
ALTER TABLE "ReceivingTask" DROP CONSTRAINT "ReceivingTask_dockBinId_fkey";

-- DropForeignKey
ALTER TABLE "ReceivingLine" DROP CONSTRAINT "ReceivingLine_receivingTaskId_fkey";

-- DropForeignKey
ALTER TABLE "ReceivingLine" DROP CONSTRAINT "ReceivingLine_handlingUnitId_fkey";

-- DropForeignKey
ALTER TABLE "ReceivingLine" DROP CONSTRAINT "ReceivingLine_trackableUnitId_fkey";

-- DropForeignKey
ALTER TABLE "PutawayRule" DROP CONSTRAINT "PutawayRule_facilityId_fkey";

-- DropForeignKey
ALTER TABLE "PutawayTask" DROP CONSTRAINT "PutawayTask_facilityId_fkey";

-- DropForeignKey
ALTER TABLE "PutawayTask" DROP CONSTRAINT "PutawayTask_receivingTaskId_fkey";

-- DropForeignKey
ALTER TABLE "PutawayTask" DROP CONSTRAINT "PutawayTask_handlingUnitId_fkey";

-- DropForeignKey
ALTER TABLE "PutawayTask" DROP CONSTRAINT "PutawayTask_trackableUnitId_fkey";

-- DropForeignKey
ALTER TABLE "PutawayTask" DROP CONSTRAINT "PutawayTask_sourceBinId_fkey";

-- DropForeignKey
ALTER TABLE "PutawayTask" DROP CONSTRAINT "PutawayTask_targetBinId_fkey";

-- DropForeignKey
ALTER TABLE "WaveTemplate" DROP CONSTRAINT "WaveTemplate_facilityId_fkey";

-- DropForeignKey
ALTER TABLE "Wave" DROP CONSTRAINT "Wave_facilityId_fkey";

-- DropForeignKey
ALTER TABLE "Wave" DROP CONSTRAINT "Wave_templateId_fkey";

-- DropForeignKey
ALTER TABLE "WaveOrder" DROP CONSTRAINT "WaveOrder_waveId_fkey";

-- DropForeignKey
ALTER TABLE "PickTask" DROP CONSTRAINT "PickTask_facilityId_fkey";

-- DropForeignKey
ALTER TABLE "PickTask" DROP CONSTRAINT "PickTask_waveId_fkey";

-- DropForeignKey
ALTER TABLE "PickTask" DROP CONSTRAINT "PickTask_zoneId_fkey";

-- DropForeignKey
ALTER TABLE "PickLine" DROP CONSTRAINT "PickLine_pickTaskId_fkey";

-- DropForeignKey
ALTER TABLE "PickLine" DROP CONSTRAINT "PickLine_inventoryRecordId_fkey";

-- DropForeignKey
ALTER TABLE "PickLine" DROP CONSTRAINT "PickLine_binId_fkey";

-- DropForeignKey
ALTER TABLE "PickLine" DROP CONSTRAINT "PickLine_handlingUnitId_fkey";

-- DropForeignKey
ALTER TABLE "PickLine" DROP CONSTRAINT "PickLine_trackableUnitId_fkey";

-- DropForeignKey
ALTER TABLE "PackTask" DROP CONSTRAINT "PackTask_facilityId_fkey";

-- DropForeignKey
ALTER TABLE "PackTask" DROP CONSTRAINT "PackTask_pickTaskId_fkey";

-- DropForeignKey
ALTER TABLE "PackTask" DROP CONSTRAINT "PackTask_packStationBinId_fkey";

-- DropForeignKey
ALTER TABLE "PackLine" DROP CONSTRAINT "PackLine_packTaskId_fkey";

-- DropForeignKey
ALTER TABLE "PackLine" DROP CONSTRAINT "PackLine_handlingUnitId_fkey";

-- DropForeignKey
ALTER TABLE "PackLine" DROP CONSTRAINT "PackLine_trackableUnitId_fkey";

-- DropForeignKey
ALTER TABLE "PackAudit" DROP CONSTRAINT "PackAudit_packTaskId_fkey";

-- DropForeignKey
ALTER TABLE "CartonCatalogue" DROP CONSTRAINT "CartonCatalogue_facilityId_fkey";

-- DropForeignKey
ALTER TABLE "StagingAssignment" DROP CONSTRAINT "StagingAssignment_facilityId_fkey";

-- DropForeignKey
ALTER TABLE "StagingAssignment" DROP CONSTRAINT "StagingAssignment_handlingUnitId_fkey";

-- DropForeignKey
ALTER TABLE "StagingAssignment" DROP CONSTRAINT "StagingAssignment_trackableUnitId_fkey";

-- DropForeignKey
ALTER TABLE "StagingAssignment" DROP CONSTRAINT "StagingAssignment_stagingBinId_fkey";

-- DropForeignKey
ALTER TABLE "LoadPlan" DROP CONSTRAINT "LoadPlan_facilityId_fkey";

-- DropForeignKey
ALTER TABLE "LoadPlanLine" DROP CONSTRAINT "LoadPlanLine_loadPlanId_fkey";

-- DropForeignKey
ALTER TABLE "LoadPlanLine" DROP CONSTRAINT "LoadPlanLine_handlingUnitId_fkey";

-- DropForeignKey
ALTER TABLE "CycleCount" DROP CONSTRAINT "CycleCount_facilityId_fkey";

-- DropForeignKey
ALTER TABLE "CycleCountLine" DROP CONSTRAINT "CycleCountLine_cycleCountId_fkey";

-- DropForeignKey
ALTER TABLE "ReplenishmentRule" DROP CONSTRAINT "ReplenishmentRule_facilityId_fkey";

-- DropForeignKey
ALTER TABLE "WmsFulfilmentOrderLine" DROP CONSTRAINT "WmsFulfilmentOrderLine_fulfilmentOrderId_fkey";

-- DropForeignKey
ALTER TABLE "HandlingUnit" DROP CONSTRAINT "HandlingUnit_currentBinId_fkey";

-- DropForeignKey
ALTER TABLE "HandlingUnit" DROP CONSTRAINT "HandlingUnit_currentZoneId_fkey";

-- DropForeignKey
ALTER TABLE "HandlingUnit" DROP CONSTRAINT "HandlingUnit_parentHandlingUnitId_fkey";

-- DropForeignKey
ALTER TABLE "HandlingUnitLine" DROP CONSTRAINT "HandlingUnitLine_handlingUnitId_fkey";

-- DropForeignKey
ALTER TABLE "ManifestUpload" DROP CONSTRAINT "ManifestUpload_facilityId_fkey";

-- DropForeignKey
ALTER TABLE "ManifestUpload" DROP CONSTRAINT "ManifestUpload_templateId_fkey";

-- DropIndex
DROP INDEX "TrackableUnit_currentBinId_idx";

-- DropIndex
DROP INDEX "TrackableUnit_currentZoneId_idx";

-- DropIndex
DROP INDEX "TrackableUnit_parentUnitId_idx";

-- DropIndex
DROP INDEX "TrackableUnit_ownerCustomerId_idx";

-- DropIndex
DROP INDEX "TrackableUnit_lotNumber_idx";

-- AlterTable
ALTER TABLE "Location" DROP COLUMN "preferredLocationId";

-- AlterTable
ALTER TABLE "Organization" DROP COLUMN "magicLinksEnabled",
DROP COLUMN "warehouseScanMode";

-- AlterTable
ALTER TABLE "User" DROP COLUMN "preferredLocationId";

-- AlterTable
ALTER TABLE "Shipment" DROP COLUMN "launchedAt",
DROP COLUMN "launchedBy";

-- AlterTable
ALTER TABLE "TrackableUnit" DROP COLUMN "currentBinId",
DROP COLUMN "currentZoneId",
DROP COLUMN "expiryDate",
DROP COLUMN "lotNumber",
DROP COLUMN "ownerCustomerId",
DROP COLUMN "parentUnitId",
DROP COLUMN "qualityStatus",
DROP COLUMN "receivedAt";

-- AlterTable
ALTER TABLE "RmaLine" DROP COLUMN "currentBinId";

-- DropTable
DROP TABLE "EventBridgeCursor";

-- DropTable
DROP TABLE "MagicLink";

-- DropTable
DROP TABLE "LoginAuditLog";

-- DropTable
DROP TABLE "ProductUom";

-- DropTable
DROP TABLE "InventoryRecord";

-- DropTable
DROP TABLE "InventoryTransaction";

-- DropTable
DROP TABLE "InventoryObservation";

-- DropTable
DROP TABLE "Allocation";

-- DropTable
DROP TABLE "ShipmentAccessory";

-- DropTable
DROP TABLE "ShipmentFlag";

-- DropTable
DROP TABLE "ConnectivityLog";

-- DropTable
DROP TABLE "Facility";

-- DropTable
DROP TABLE "WarehouseZone";

-- DropTable
DROP TABLE "WarehouseAisle";

-- DropTable
DROP TABLE "WarehouseBin";

-- DropTable
DROP TABLE "IndoorZoneAnchor";

-- DropTable
DROP TABLE "ReceivingAppointment";

-- DropTable
DROP TABLE "ReceivingTask";

-- DropTable
DROP TABLE "ReceivingLine";

-- DropTable
DROP TABLE "PutawayRule";

-- DropTable
DROP TABLE "PutawayTask";

-- DropTable
DROP TABLE "WaveTemplate";

-- DropTable
DROP TABLE "Wave";

-- DropTable
DROP TABLE "WaveOrder";

-- DropTable
DROP TABLE "PickTask";

-- DropTable
DROP TABLE "PickLine";

-- DropTable
DROP TABLE "PackTask";

-- DropTable
DROP TABLE "PackLine";

-- DropTable
DROP TABLE "PackAudit";

-- DropTable
DROP TABLE "CartonCatalogue";

-- DropTable
DROP TABLE "StagingAssignment";

-- DropTable
DROP TABLE "LoadPlan";

-- DropTable
DROP TABLE "LoadPlanLine";

-- DropTable
DROP TABLE "CycleCount";

-- DropTable
DROP TABLE "CycleCountLine";

-- DropTable
DROP TABLE "ReplenishmentRule";

-- DropTable
DROP TABLE "WmsFulfilmentOrder";

-- DropTable
DROP TABLE "WmsFulfilmentOrderLine";

-- DropTable
DROP TABLE "HandlingUnit";

-- DropTable
DROP TABLE "HandlingUnitLine";

-- DropTable
DROP TABLE "ManifestTemplate";

-- DropTable
DROP TABLE "ManifestUpload";

