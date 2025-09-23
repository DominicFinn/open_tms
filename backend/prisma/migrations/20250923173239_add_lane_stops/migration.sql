-- CreateTable
CREATE TABLE "LaneStop" (
    "id" TEXT NOT NULL,
    "laneId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LaneStop_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LaneStop_laneId_order_key" ON "LaneStop"("laneId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "LaneStop_laneId_locationId_key" ON "LaneStop"("laneId", "locationId");

-- AddForeignKey
ALTER TABLE "LaneStop" ADD CONSTRAINT "LaneStop_laneId_fkey" FOREIGN KEY ("laneId") REFERENCES "Lane"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LaneStop" ADD CONSTRAINT "LaneStop_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
