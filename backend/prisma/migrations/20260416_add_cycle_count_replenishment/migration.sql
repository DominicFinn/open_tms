-- Cycle Counting and Replenishment Rules

CREATE TABLE IF NOT EXISTS "CycleCount" (
    "id" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "countType" TEXT NOT NULL,
    "zoneId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'planned',
    "assignedToUserId" TEXT,
    "plannedAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "totalBins" INTEGER NOT NULL DEFAULT 0,
    "countedBins" INTEGER NOT NULL DEFAULT 0,
    "varianceCount" INTEGER NOT NULL DEFAULT 0,
    "orgId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CycleCount_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "CycleCount_locationId_idx" ON "CycleCount"("locationId");
CREATE INDEX IF NOT EXISTS "CycleCount_orgId_idx" ON "CycleCount"("orgId");
CREATE INDEX IF NOT EXISTS "CycleCount_status_idx" ON "CycleCount"("status");

CREATE TABLE IF NOT EXISTS "CycleCountLine" (
    "id" TEXT NOT NULL,
    "cycleCountId" TEXT NOT NULL,
    "binId" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "uomCode" TEXT NOT NULL DEFAULT 'EA',
    "expectedQuantity" INTEGER NOT NULL,
    "countedQuantity" INTEGER,
    "variance" INTEGER,
    "inventoryRecordId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "countedByUserId" TEXT,
    "countedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CycleCountLine_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "CycleCountLine_cycleCountId_idx" ON "CycleCountLine"("cycleCountId");
CREATE INDEX IF NOT EXISTS "CycleCountLine_binId_idx" ON "CycleCountLine"("binId");
CREATE INDEX IF NOT EXISTS "CycleCountLine_status_idx" ON "CycleCountLine"("status");

ALTER TABLE "CycleCountLine" ADD CONSTRAINT "CycleCountLine_cycleCountId_fkey" FOREIGN KEY ("cycleCountId") REFERENCES "CycleCount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "ReplenishmentRule" (
    "id" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "pickFaceBinId" TEXT NOT NULL,
    "bulkZoneId" TEXT NOT NULL,
    "minQuantity" INTEGER NOT NULL,
    "maxQuantity" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "orgId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ReplenishmentRule_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ReplenishmentRule_locationId_idx" ON "ReplenishmentRule"("locationId");
CREATE INDEX IF NOT EXISTS "ReplenishmentRule_orgId_idx" ON "ReplenishmentRule"("orgId");
CREATE INDEX IF NOT EXISTS "ReplenishmentRule_sku_idx" ON "ReplenishmentRule"("sku");
