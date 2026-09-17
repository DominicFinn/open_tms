-- CreateTable
CREATE TABLE "Geofence" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "name" TEXT,
    "shapeType" TEXT NOT NULL,
    "geometry" JSONB NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "Geofence_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Geofence_orgId_idx" ON "Geofence"("orgId");

-- CreateIndex
CREATE INDEX "Geofence_entityType_entityId_idx" ON "Geofence"("entityType", "entityId");
