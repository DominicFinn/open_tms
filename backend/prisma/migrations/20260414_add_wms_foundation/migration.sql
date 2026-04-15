-- WMS Foundation Migration
-- Adds warehouse zones, bins, indoor anchors, inventory tracking, receiving,
-- putaway, waves, picking, packing, and loading/staging models.

-- ═══════════════════════════════════════════════════════════════
-- TrackableUnit WMS fields
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE "TrackableUnit" ADD COLUMN IF NOT EXISTS "currentBinId" TEXT;
ALTER TABLE "TrackableUnit" ADD COLUMN IF NOT EXISTS "parentUnitId" TEXT;
ALTER TABLE "TrackableUnit" ADD COLUMN IF NOT EXISTS "currentZoneId" TEXT;
ALTER TABLE "TrackableUnit" ADD COLUMN IF NOT EXISTS "lotNumber" TEXT;
ALTER TABLE "TrackableUnit" ADD COLUMN IF NOT EXISTS "expiryDate" TIMESTAMP(3);
ALTER TABLE "TrackableUnit" ADD COLUMN IF NOT EXISTS "receivedAt" TIMESTAMP(3);
ALTER TABLE "TrackableUnit" ADD COLUMN IF NOT EXISTS "ownerCustomerId" TEXT;
ALTER TABLE "TrackableUnit" ADD COLUMN IF NOT EXISTS "qualityStatus" TEXT NOT NULL DEFAULT 'available';

CREATE INDEX IF NOT EXISTS "TrackableUnit_currentBinId_idx" ON "TrackableUnit"("currentBinId");
CREATE INDEX IF NOT EXISTS "TrackableUnit_currentZoneId_idx" ON "TrackableUnit"("currentZoneId");
CREATE INDEX IF NOT EXISTS "TrackableUnit_parentUnitId_idx" ON "TrackableUnit"("parentUnitId");
CREATE INDEX IF NOT EXISTS "TrackableUnit_ownerCustomerId_idx" ON "TrackableUnit"("ownerCustomerId");
CREATE INDEX IF NOT EXISTS "TrackableUnit_lotNumber_idx" ON "TrackableUnit"("lotNumber");

-- ═══════════════════════════════════════════════════════════════
-- WarehouseZone
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS "WarehouseZone" (
    "id" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "zoneType" TEXT NOT NULL,
    "temperatureZone" TEXT,
    "hazmatCertified" BOOLEAN NOT NULL DEFAULT false,
    "maxWeightKg" DOUBLE PRECISION,
    "maxVolumeCbm" DOUBLE PRECISION,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "orgId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WarehouseZone_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "WarehouseZone_locationId_idx" ON "WarehouseZone"("locationId");
CREATE INDEX IF NOT EXISTS "WarehouseZone_orgId_idx" ON "WarehouseZone"("orgId");
CREATE INDEX IF NOT EXISTS "WarehouseZone_zoneType_idx" ON "WarehouseZone"("zoneType");

-- ═══════════════════════════════════════════════════════════════
-- WarehouseAisle
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS "WarehouseAisle" (
    "id" TEXT NOT NULL,
    "zoneId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WarehouseAisle_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "WarehouseAisle_zoneId_idx" ON "WarehouseAisle"("zoneId");
CREATE INDEX IF NOT EXISTS "WarehouseAisle_locationId_idx" ON "WarehouseAisle"("locationId");

-- ═══════════════════════════════════════════════════════════════
-- WarehouseBin
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS "WarehouseBin" (
    "id" TEXT NOT NULL,
    "zoneId" TEXT NOT NULL,
    "aisleId" TEXT,
    "locationId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "binType" TEXT NOT NULL,
    "maxWeightKg" DOUBLE PRECISION,
    "maxVolumeCbm" DOUBLE PRECISION,
    "maxPalletPositions" INTEGER,
    "temperatureZone" TEXT,
    "hazmatCertified" BOOLEAN NOT NULL DEFAULT false,
    "level" INTEGER,
    "walkSequence" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "currentWeightKg" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "currentVolumeCbm" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "currentPalletCount" INTEGER NOT NULL DEFAULT 0,
    "orgId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WarehouseBin_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "WarehouseBin_locationId_label_key" ON "WarehouseBin"("locationId", "label");
CREATE INDEX IF NOT EXISTS "WarehouseBin_zoneId_idx" ON "WarehouseBin"("zoneId");
CREATE INDEX IF NOT EXISTS "WarehouseBin_locationId_idx" ON "WarehouseBin"("locationId");
CREATE INDEX IF NOT EXISTS "WarehouseBin_orgId_idx" ON "WarehouseBin"("orgId");
CREATE INDEX IF NOT EXISTS "WarehouseBin_binType_idx" ON "WarehouseBin"("binType");
CREATE INDEX IF NOT EXISTS "WarehouseBin_walkSequence_idx" ON "WarehouseBin"("walkSequence");

-- ═══════════════════════════════════════════════════════════════
-- IndoorZoneAnchor
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS "IndoorZoneAnchor" (
    "id" TEXT NOT NULL,
    "zoneId" TEXT NOT NULL,
    "anchorType" TEXT NOT NULL,
    "bleUuid" TEXT,
    "bleMajor" INTEGER,
    "bleMinor" INTEGER,
    "bleRssiThreshold" INTEGER,
    "wifiSsid" TEXT,
    "wifiBssid" TEXT,
    "uwbAnchorId" TEXT,
    "name" TEXT,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "orgId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IndoorZoneAnchor_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "IndoorZoneAnchor_zoneId_idx" ON "IndoorZoneAnchor"("zoneId");
CREATE INDEX IF NOT EXISTS "IndoorZoneAnchor_orgId_idx" ON "IndoorZoneAnchor"("orgId");

-- ═══════════════════════════════════════════════════════════════
-- ProductUom
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS "ProductUom" (
    "id" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "uomCode" TEXT NOT NULL,
    "parentUomCode" TEXT,
    "conversionFactor" INTEGER NOT NULL DEFAULT 1,
    "lengthMm" INTEGER,
    "widthMm" INTEGER,
    "heightMm" INTEGER,
    "weightGrams" INTEGER,
    "barcodeGtin" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "orgId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductUom_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ProductUom_orgId_sku_uomCode_key" ON "ProductUom"("orgId", "sku", "uomCode");
CREATE INDEX IF NOT EXISTS "ProductUom_orgId_idx" ON "ProductUom"("orgId");
CREATE INDEX IF NOT EXISTS "ProductUom_sku_idx" ON "ProductUom"("sku");
CREATE INDEX IF NOT EXISTS "ProductUom_barcodeGtin_idx" ON "ProductUom"("barcodeGtin");

-- ═══════════════════════════════════════════════════════════════
-- InventoryRecord
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS "InventoryRecord" (
    "id" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "binId" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "uomCode" TEXT NOT NULL DEFAULT 'EA',
    "quantityOnHand" INTEGER NOT NULL DEFAULT 0,
    "quantityAllocated" INTEGER NOT NULL DEFAULT 0,
    "quantityAvailable" INTEGER NOT NULL DEFAULT 0,
    "quantityOnHold" INTEGER NOT NULL DEFAULT 0,
    "ownerCustomerId" TEXT,
    "lotNumber" TEXT,
    "expiryDate" TIMESTAMP(3),
    "lastCountedAt" TIMESTAMP(3),
    "orgId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryRecord_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "InventoryRecord_binId_sku_uomCode_lotNumber_ownerCustomerId_key" ON "InventoryRecord"("binId", "sku", "uomCode", "lotNumber", "ownerCustomerId");
CREATE INDEX IF NOT EXISTS "InventoryRecord_locationId_idx" ON "InventoryRecord"("locationId");
CREATE INDEX IF NOT EXISTS "InventoryRecord_orgId_idx" ON "InventoryRecord"("orgId");
CREATE INDEX IF NOT EXISTS "InventoryRecord_sku_idx" ON "InventoryRecord"("sku");
CREATE INDEX IF NOT EXISTS "InventoryRecord_ownerCustomerId_idx" ON "InventoryRecord"("ownerCustomerId");

-- ═══════════════════════════════════════════════════════════════
-- InventoryTransaction
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS "InventoryTransaction" (
    "id" TEXT NOT NULL,
    "inventoryRecordId" TEXT NOT NULL,
    "transactionType" TEXT NOT NULL,
    "quantityChange" INTEGER NOT NULL,
    "previousQuantity" INTEGER NOT NULL,
    "newQuantity" INTEGER NOT NULL,
    "referenceType" TEXT,
    "referenceId" TEXT,
    "reasonCode" TEXT,
    "performedBy" TEXT,
    "trackableUnitId" TEXT,
    "orgId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventoryTransaction_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "InventoryTransaction_inventoryRecordId_idx" ON "InventoryTransaction"("inventoryRecordId");
CREATE INDEX IF NOT EXISTS "InventoryTransaction_orgId_idx" ON "InventoryTransaction"("orgId");
CREATE INDEX IF NOT EXISTS "InventoryTransaction_transactionType_idx" ON "InventoryTransaction"("transactionType");
CREATE INDEX IF NOT EXISTS "InventoryTransaction_createdAt_idx" ON "InventoryTransaction"("createdAt");

-- ═══════════════════════════════════════════════════════════════
-- Allocation
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS "Allocation" (
    "id" TEXT NOT NULL,
    "orderLineItemId" TEXT NOT NULL,
    "inventoryRecordId" TEXT NOT NULL,
    "trackableUnitId" TEXT,
    "quantity" INTEGER NOT NULL,
    "uomCode" TEXT NOT NULL DEFAULT 'EA',
    "state" TEXT NOT NULL DEFAULT 'soft',
    "lotNumber" TEXT,
    "allocatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "orgId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Allocation_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Allocation_orderLineItemId_idx" ON "Allocation"("orderLineItemId");
CREATE INDEX IF NOT EXISTS "Allocation_inventoryRecordId_idx" ON "Allocation"("inventoryRecordId");
CREATE INDEX IF NOT EXISTS "Allocation_orgId_idx" ON "Allocation"("orgId");
CREATE INDEX IF NOT EXISTS "Allocation_state_idx" ON "Allocation"("state");

-- ═══════════════════════════════════════════════════════════════
-- ReceivingAppointment
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS "ReceivingAppointment" (
    "id" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "inboundShipmentId" TEXT,
    "dockBinId" TEXT,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "scheduledEndAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'scheduled',
    "carrierName" TEXT,
    "trailerNumber" TEXT,
    "sealNumber" TEXT,
    "asnReference" TEXT,
    "orgId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReceivingAppointment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ReceivingAppointment_locationId_idx" ON "ReceivingAppointment"("locationId");
CREATE INDEX IF NOT EXISTS "ReceivingAppointment_orgId_idx" ON "ReceivingAppointment"("orgId");
CREATE INDEX IF NOT EXISTS "ReceivingAppointment_scheduledAt_idx" ON "ReceivingAppointment"("scheduledAt");
CREATE INDEX IF NOT EXISTS "ReceivingAppointment_status_idx" ON "ReceivingAppointment"("status");

-- ═══════════════════════════════════════════════════════════════
-- ReceivingTask
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS "ReceivingTask" (
    "id" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "appointmentId" TEXT,
    "inboundShipmentId" TEXT,
    "dockBinId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "receivingType" TEXT NOT NULL,
    "crossDock" BOOLEAN NOT NULL DEFAULT false,
    "assignedToUserId" TEXT,
    "orgId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReceivingTask_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ReceivingTask_locationId_idx" ON "ReceivingTask"("locationId");
CREATE INDEX IF NOT EXISTS "ReceivingTask_orgId_idx" ON "ReceivingTask"("orgId");
CREATE INDEX IF NOT EXISTS "ReceivingTask_status_idx" ON "ReceivingTask"("status");

-- ═══════════════════════════════════════════════════════════════
-- ReceivingLine
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS "ReceivingLine" (
    "id" TEXT NOT NULL,
    "receivingTaskId" TEXT NOT NULL,
    "orderLineItemId" TEXT,
    "trackableUnitId" TEXT,
    "sku" TEXT NOT NULL,
    "uomCode" TEXT NOT NULL DEFAULT 'EA',
    "expectedQuantity" INTEGER,
    "receivedQuantity" INTEGER NOT NULL DEFAULT 0,
    "damagedQuantity" INTEGER NOT NULL DEFAULT 0,
    "inspectionStatus" TEXT NOT NULL DEFAULT 'pending',
    "lotNumber" TEXT,
    "expiryDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReceivingLine_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ReceivingLine_receivingTaskId_idx" ON "ReceivingLine"("receivingTaskId");

-- ═══════════════════════════════════════════════════════════════
-- PutawayRule
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS "PutawayRule" (
    "id" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 50,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "skuPattern" TEXT,
    "temperatureRequirement" TEXT,
    "hazmat" BOOLEAN,
    "customerId" TEXT,
    "velocityClass" TEXT,
    "unitType" TEXT,
    "crossDockSortBy" TEXT,
    "targetType" TEXT NOT NULL,
    "targetZoneId" TEXT,
    "targetBinId" TEXT,
    "preferLevel" TEXT,
    "orgId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PutawayRule_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "PutawayRule_locationId_idx" ON "PutawayRule"("locationId");
CREATE INDEX IF NOT EXISTS "PutawayRule_orgId_idx" ON "PutawayRule"("orgId");
CREATE INDEX IF NOT EXISTS "PutawayRule_priority_idx" ON "PutawayRule"("priority");

-- ═══════════════════════════════════════════════════════════════
-- PutawayTask
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS "PutawayTask" (
    "id" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "receivingTaskId" TEXT,
    "trackableUnitId" TEXT NOT NULL,
    "sourceBinId" TEXT,
    "targetBinId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "putawayType" TEXT NOT NULL,
    "assignedToUserId" TEXT,
    "orgId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PutawayTask_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "PutawayTask_locationId_idx" ON "PutawayTask"("locationId");
CREATE INDEX IF NOT EXISTS "PutawayTask_orgId_idx" ON "PutawayTask"("orgId");
CREATE INDEX IF NOT EXISTS "PutawayTask_status_idx" ON "PutawayTask"("status");
CREATE INDEX IF NOT EXISTS "PutawayTask_trackableUnitId_idx" ON "PutawayTask"("trackableUnitId");

-- ═══════════════════════════════════════════════════════════════
-- WaveTemplate
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS "WaveTemplate" (
    "id" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "groupingRules" JSONB,
    "cutoffTime" TEXT,
    "pickStrategy" TEXT NOT NULL DEFAULT 'discrete',
    "minOrders" INTEGER,
    "maxOrders" INTEGER,
    "maxLabourHours" DOUBLE PRECISION,
    "priority" INTEGER NOT NULL DEFAULT 50,
    "releaseSchedule" TEXT,
    "autoRelease" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "orgId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WaveTemplate_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "WaveTemplate_locationId_idx" ON "WaveTemplate"("locationId");
CREATE INDEX IF NOT EXISTS "WaveTemplate_orgId_idx" ON "WaveTemplate"("orgId");

-- ═══════════════════════════════════════════════════════════════
-- Wave
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS "Wave" (
    "id" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "templateId" TEXT,
    "waveNumber" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'planning',
    "pickStrategy" TEXT NOT NULL DEFAULT 'discrete',
    "groupingCriteria" JSONB,
    "orderCount" INTEGER NOT NULL DEFAULT 0,
    "lineCount" INTEGER NOT NULL DEFAULT 0,
    "projectedCompletionAt" TIMESTAMP(3),
    "cutoffAt" TIMESTAMP(3),
    "orgId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Wave_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Wave_orgId_waveNumber_key" ON "Wave"("orgId", "waveNumber");
CREATE INDEX IF NOT EXISTS "Wave_locationId_idx" ON "Wave"("locationId");
CREATE INDEX IF NOT EXISTS "Wave_orgId_idx" ON "Wave"("orgId");
CREATE INDEX IF NOT EXISTS "Wave_status_idx" ON "Wave"("status");

-- ═══════════════════════════════════════════════════════════════
-- WaveOrder
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS "WaveOrder" (
    "id" TEXT NOT NULL,
    "waveId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "WaveOrder_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "WaveOrder_waveId_orderId_key" ON "WaveOrder"("waveId", "orderId");
CREATE INDEX IF NOT EXISTS "WaveOrder_waveId_idx" ON "WaveOrder"("waveId");
CREATE INDEX IF NOT EXISTS "WaveOrder_orderId_idx" ON "WaveOrder"("orderId");

-- ═══════════════════════════════════════════════════════════════
-- PickTask
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS "PickTask" (
    "id" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "waveId" TEXT,
    "orderId" TEXT,
    "assignedToUserId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "pickType" TEXT NOT NULL,
    "zoneId" TEXT,
    "totalLines" INTEGER NOT NULL DEFAULT 0,
    "completedLines" INTEGER NOT NULL DEFAULT 0,
    "orgId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PickTask_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "PickTask_locationId_idx" ON "PickTask"("locationId");
CREATE INDEX IF NOT EXISTS "PickTask_orgId_idx" ON "PickTask"("orgId");
CREATE INDEX IF NOT EXISTS "PickTask_waveId_idx" ON "PickTask"("waveId");
CREATE INDEX IF NOT EXISTS "PickTask_status_idx" ON "PickTask"("status");

-- ═══════════════════════════════════════════════════════════════
-- PickLine
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS "PickLine" (
    "id" TEXT NOT NULL,
    "pickTaskId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "orderLineItemId" TEXT NOT NULL,
    "inventoryRecordId" TEXT NOT NULL,
    "binId" TEXT NOT NULL,
    "trackableUnitId" TEXT,
    "sku" TEXT NOT NULL,
    "uomCode" TEXT NOT NULL DEFAULT 'EA',
    "requestedQuantity" INTEGER NOT NULL,
    "pickedQuantity" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "walkSequence" INTEGER NOT NULL DEFAULT 0,
    "lotNumber" TEXT,
    "shortPickAction" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PickLine_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "PickLine_pickTaskId_idx" ON "PickLine"("pickTaskId");
CREATE INDEX IF NOT EXISTS "PickLine_binId_idx" ON "PickLine"("binId");
CREATE INDEX IF NOT EXISTS "PickLine_walkSequence_idx" ON "PickLine"("walkSequence");

-- ═══════════════════════════════════════════════════════════════
-- PackTask
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS "PackTask" (
    "id" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "pickTaskId" TEXT,
    "assignedToUserId" TEXT,
    "packStationBinId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "orgId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PackTask_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "PackTask_locationId_idx" ON "PackTask"("locationId");
CREATE INDEX IF NOT EXISTS "PackTask_orgId_idx" ON "PackTask"("orgId");
CREATE INDEX IF NOT EXISTS "PackTask_orderId_idx" ON "PackTask"("orderId");
CREATE INDEX IF NOT EXISTS "PackTask_status_idx" ON "PackTask"("status");

-- ═══════════════════════════════════════════════════════════════
-- PackLine
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS "PackLine" (
    "id" TEXT NOT NULL,
    "packTaskId" TEXT NOT NULL,
    "orderLineItemId" TEXT NOT NULL,
    "trackableUnitId" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "expectedQuantity" INTEGER NOT NULL,
    "packedQuantity" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PackLine_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "PackLine_packTaskId_idx" ON "PackLine"("packTaskId");

-- ═══════════════════════════════════════════════════════════════
-- CartonCatalogue
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS "CartonCatalogue" (
    "id" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "lengthMm" INTEGER NOT NULL,
    "widthMm" INTEGER NOT NULL,
    "heightMm" INTEGER NOT NULL,
    "maxWeightGrams" INTEGER NOT NULL,
    "unitCostCents" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "orgId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CartonCatalogue_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "CartonCatalogue_locationId_idx" ON "CartonCatalogue"("locationId");
CREATE INDEX IF NOT EXISTS "CartonCatalogue_orgId_idx" ON "CartonCatalogue"("orgId");

-- ═══════════════════════════════════════════════════════════════
-- StagingAssignment
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS "StagingAssignment" (
    "id" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "shipmentId" TEXT,
    "trackableUnitId" TEXT NOT NULL,
    "stagingBinId" TEXT NOT NULL,
    "loadSequence" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'staged',
    "orgId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StagingAssignment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "StagingAssignment_locationId_idx" ON "StagingAssignment"("locationId");
CREATE INDEX IF NOT EXISTS "StagingAssignment_orgId_idx" ON "StagingAssignment"("orgId");
CREATE INDEX IF NOT EXISTS "StagingAssignment_orderId_idx" ON "StagingAssignment"("orderId");
CREATE INDEX IF NOT EXISTS "StagingAssignment_shipmentId_idx" ON "StagingAssignment"("shipmentId");
CREATE INDEX IF NOT EXISTS "StagingAssignment_status_idx" ON "StagingAssignment"("status");

-- ═══════════════════════════════════════════════════════════════
-- Foreign Keys
-- ═══════════════════════════════════════════════════════════════

-- TrackableUnit FKs
ALTER TABLE "TrackableUnit" ADD CONSTRAINT "TrackableUnit_currentBinId_fkey" FOREIGN KEY ("currentBinId") REFERENCES "WarehouseBin"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TrackableUnit" ADD CONSTRAINT "TrackableUnit_parentUnitId_fkey" FOREIGN KEY ("parentUnitId") REFERENCES "TrackableUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TrackableUnit" ADD CONSTRAINT "TrackableUnit_currentZoneId_fkey" FOREIGN KEY ("currentZoneId") REFERENCES "WarehouseZone"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TrackableUnit" ADD CONSTRAINT "TrackableUnit_ownerCustomerId_fkey" FOREIGN KEY ("ownerCustomerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- WarehouseZone FKs
ALTER TABLE "WarehouseZone" ADD CONSTRAINT "WarehouseZone_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- WarehouseAisle FKs
ALTER TABLE "WarehouseAisle" ADD CONSTRAINT "WarehouseAisle_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "WarehouseZone"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WarehouseAisle" ADD CONSTRAINT "WarehouseAisle_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- WarehouseBin FKs
ALTER TABLE "WarehouseBin" ADD CONSTRAINT "WarehouseBin_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "WarehouseZone"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WarehouseBin" ADD CONSTRAINT "WarehouseBin_aisleId_fkey" FOREIGN KEY ("aisleId") REFERENCES "WarehouseAisle"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "WarehouseBin" ADD CONSTRAINT "WarehouseBin_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- IndoorZoneAnchor FKs
ALTER TABLE "IndoorZoneAnchor" ADD CONSTRAINT "IndoorZoneAnchor_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "WarehouseZone"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- InventoryRecord FKs
ALTER TABLE "InventoryRecord" ADD CONSTRAINT "InventoryRecord_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InventoryRecord" ADD CONSTRAINT "InventoryRecord_binId_fkey" FOREIGN KEY ("binId") REFERENCES "WarehouseBin"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InventoryRecord" ADD CONSTRAINT "InventoryRecord_ownerCustomerId_fkey" FOREIGN KEY ("ownerCustomerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- InventoryTransaction FKs
ALTER TABLE "InventoryTransaction" ADD CONSTRAINT "InventoryTransaction_inventoryRecordId_fkey" FOREIGN KEY ("inventoryRecordId") REFERENCES "InventoryRecord"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InventoryTransaction" ADD CONSTRAINT "InventoryTransaction_trackableUnitId_fkey" FOREIGN KEY ("trackableUnitId") REFERENCES "TrackableUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Allocation FKs
ALTER TABLE "Allocation" ADD CONSTRAINT "Allocation_orderLineItemId_fkey" FOREIGN KEY ("orderLineItemId") REFERENCES "OrderLineItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Allocation" ADD CONSTRAINT "Allocation_inventoryRecordId_fkey" FOREIGN KEY ("inventoryRecordId") REFERENCES "InventoryRecord"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Allocation" ADD CONSTRAINT "Allocation_trackableUnitId_fkey" FOREIGN KEY ("trackableUnitId") REFERENCES "TrackableUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ReceivingAppointment FKs
ALTER TABLE "ReceivingAppointment" ADD CONSTRAINT "ReceivingAppointment_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReceivingAppointment" ADD CONSTRAINT "ReceivingAppointment_dockBinId_fkey" FOREIGN KEY ("dockBinId") REFERENCES "WarehouseBin"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ReceivingTask FKs
ALTER TABLE "ReceivingTask" ADD CONSTRAINT "ReceivingTask_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReceivingTask" ADD CONSTRAINT "ReceivingTask_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "ReceivingAppointment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ReceivingTask" ADD CONSTRAINT "ReceivingTask_dockBinId_fkey" FOREIGN KEY ("dockBinId") REFERENCES "WarehouseBin"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ReceivingLine FKs
ALTER TABLE "ReceivingLine" ADD CONSTRAINT "ReceivingLine_receivingTaskId_fkey" FOREIGN KEY ("receivingTaskId") REFERENCES "ReceivingTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReceivingLine" ADD CONSTRAINT "ReceivingLine_trackableUnitId_fkey" FOREIGN KEY ("trackableUnitId") REFERENCES "TrackableUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- PutawayRule FKs
ALTER TABLE "PutawayRule" ADD CONSTRAINT "PutawayRule_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- PutawayTask FKs
ALTER TABLE "PutawayTask" ADD CONSTRAINT "PutawayTask_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PutawayTask" ADD CONSTRAINT "PutawayTask_receivingTaskId_fkey" FOREIGN KEY ("receivingTaskId") REFERENCES "ReceivingTask"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PutawayTask" ADD CONSTRAINT "PutawayTask_trackableUnitId_fkey" FOREIGN KEY ("trackableUnitId") REFERENCES "TrackableUnit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PutawayTask" ADD CONSTRAINT "PutawayTask_sourceBinId_fkey" FOREIGN KEY ("sourceBinId") REFERENCES "WarehouseBin"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PutawayTask" ADD CONSTRAINT "PutawayTask_targetBinId_fkey" FOREIGN KEY ("targetBinId") REFERENCES "WarehouseBin"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- WaveTemplate FKs
ALTER TABLE "WaveTemplate" ADD CONSTRAINT "WaveTemplate_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Wave FKs
ALTER TABLE "Wave" ADD CONSTRAINT "Wave_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Wave" ADD CONSTRAINT "Wave_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "WaveTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- WaveOrder FKs
ALTER TABLE "WaveOrder" ADD CONSTRAINT "WaveOrder_waveId_fkey" FOREIGN KEY ("waveId") REFERENCES "Wave"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- PickTask FKs
ALTER TABLE "PickTask" ADD CONSTRAINT "PickTask_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PickTask" ADD CONSTRAINT "PickTask_waveId_fkey" FOREIGN KEY ("waveId") REFERENCES "Wave"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PickTask" ADD CONSTRAINT "PickTask_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "WarehouseZone"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- PickLine FKs
ALTER TABLE "PickLine" ADD CONSTRAINT "PickLine_pickTaskId_fkey" FOREIGN KEY ("pickTaskId") REFERENCES "PickTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PickLine" ADD CONSTRAINT "PickLine_inventoryRecordId_fkey" FOREIGN KEY ("inventoryRecordId") REFERENCES "InventoryRecord"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PickLine" ADD CONSTRAINT "PickLine_binId_fkey" FOREIGN KEY ("binId") REFERENCES "WarehouseBin"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PickLine" ADD CONSTRAINT "PickLine_trackableUnitId_fkey" FOREIGN KEY ("trackableUnitId") REFERENCES "TrackableUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- PackTask FKs
ALTER TABLE "PackTask" ADD CONSTRAINT "PackTask_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PackTask" ADD CONSTRAINT "PackTask_pickTaskId_fkey" FOREIGN KEY ("pickTaskId") REFERENCES "PickTask"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PackTask" ADD CONSTRAINT "PackTask_packStationBinId_fkey" FOREIGN KEY ("packStationBinId") REFERENCES "WarehouseBin"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- PackLine FKs
ALTER TABLE "PackLine" ADD CONSTRAINT "PackLine_packTaskId_fkey" FOREIGN KEY ("packTaskId") REFERENCES "PackTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PackLine" ADD CONSTRAINT "PackLine_trackableUnitId_fkey" FOREIGN KEY ("trackableUnitId") REFERENCES "TrackableUnit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- StagingAssignment FKs
ALTER TABLE "StagingAssignment" ADD CONSTRAINT "StagingAssignment_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StagingAssignment" ADD CONSTRAINT "StagingAssignment_trackableUnitId_fkey" FOREIGN KEY ("trackableUnitId") REFERENCES "TrackableUnit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StagingAssignment" ADD CONSTRAINT "StagingAssignment_stagingBinId_fkey" FOREIGN KEY ("stagingBinId") REFERENCES "WarehouseBin"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
