-- Inventory management first slice (#233): a lightweight, non-authoritative record of
-- "at time T, someone observed X at location Y" from an ad hoc scan/spot-check. Distinct from
-- CycleCount (formal, stateful audit) and InventoryTransaction (system-driven ledger).
-- Table role: ledger (insert-only, never edited).

-- CreateTable
CREATE TABLE "InventoryObservation" (
    "id" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "binId" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "uomCode" TEXT NOT NULL DEFAULT 'EA',
    "observedQuantity" INTEGER,
    "lotNumber" TEXT,
    "notes" TEXT,
    "observedByUserId" TEXT,
    "observedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "inventoryRecordId" TEXT,
    "cycleCountLineId" TEXT,
    "orgId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventoryObservation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
-- Serves InventoryObservationRepository.listRecent(orgId, locationId): the org-scoped,
-- location-filtered, most-recent-first list behind GET /api/v1/inventory/observations.
CREATE INDEX "InventoryObservation_orgId_locationId_observedAt_idx" ON "InventoryObservation"("orgId", "locationId", "observedAt");

-- AddForeignKey
ALTER TABLE "InventoryObservation" ADD CONSTRAINT "InventoryObservation_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryObservation" ADD CONSTRAINT "InventoryObservation_binId_fkey" FOREIGN KEY ("binId") REFERENCES "WarehouseBin"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryObservation" ADD CONSTRAINT "InventoryObservation_inventoryRecordId_fkey" FOREIGN KEY ("inventoryRecordId") REFERENCES "InventoryRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable
-- Which scoped session a magic link mints on validation: 'warehouse' (existing WMS task
-- surface) or 'inventory' (new lighter inventory-app surface, #233).
ALTER TABLE "MagicLink" ADD COLUMN     "scope" TEXT NOT NULL DEFAULT 'warehouse';
