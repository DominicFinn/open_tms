-- Load Planning for outbound shipment building

CREATE TABLE IF NOT EXISTS "LoadPlan" (
    "id" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "shipmentId" TEXT,
    "dockBinId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'planning',
    "sealNumber" TEXT,
    "trailerNumber" TEXT,
    "carrierId" TEXT,
    "totalUnits" INTEGER NOT NULL DEFAULT 0,
    "loadedUnits" INTEGER NOT NULL DEFAULT 0,
    "completedAt" TIMESTAMP(3),
    "bolDocumentId" TEXT,
    "orgId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "LoadPlan_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "LoadPlan_locationId_idx" ON "LoadPlan"("locationId");
CREATE INDEX IF NOT EXISTS "LoadPlan_orgId_idx" ON "LoadPlan"("orgId");
CREATE INDEX IF NOT EXISTS "LoadPlan_shipmentId_idx" ON "LoadPlan"("shipmentId");
CREATE INDEX IF NOT EXISTS "LoadPlan_status_idx" ON "LoadPlan"("status");

CREATE TABLE IF NOT EXISTS "LoadPlanLine" (
    "id" TEXT NOT NULL,
    "loadPlanId" TEXT NOT NULL,
    "stagingAssignmentId" TEXT,
    "trackableUnitId" TEXT,
    "orderId" TEXT NOT NULL,
    "loadSequence" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "LoadPlanLine_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "LoadPlanLine_loadPlanId_idx" ON "LoadPlanLine"("loadPlanId");
CREATE INDEX IF NOT EXISTS "LoadPlanLine_loadSequence_idx" ON "LoadPlanLine"("loadSequence");

ALTER TABLE "LoadPlanLine" ADD CONSTRAINT "LoadPlanLine_loadPlanId_fkey" FOREIGN KEY ("loadPlanId") REFERENCES "LoadPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
