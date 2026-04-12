-- CreateTable
CREATE TABLE "LaneRoute" (
    "id" TEXT NOT NULL,
    "laneId" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "encodedPolyline" TEXT NOT NULL,
    "waypoints" JSONB NOT NULL,
    "distanceMeters" INTEGER NOT NULL,
    "durationSeconds" INTEGER NOT NULL,
    "summary" TEXT,
    "corridorMeters" INTEGER NOT NULL DEFAULT 5000,
    "provider" TEXT NOT NULL DEFAULT 'google',
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LaneRoute_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LaneRoute_laneId_key" ON "LaneRoute"("laneId");

-- CreateIndex
CREATE INDEX "LaneRoute_orgId_idx" ON "LaneRoute"("orgId");

-- AddForeignKey
ALTER TABLE "LaneRoute" ADD CONSTRAINT "LaneRoute_laneId_fkey" FOREIGN KEY ("laneId") REFERENCES "Lane"("id") ON DELETE CASCADE ON UPDATE CASCADE;
