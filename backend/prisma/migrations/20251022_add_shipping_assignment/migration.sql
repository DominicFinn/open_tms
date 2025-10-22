-- Add special requirements to Order table
ALTER TABLE "Order" ADD COLUMN "serviceLevel" TEXT NOT NULL DEFAULT 'LTL';
ALTER TABLE "Order" ADD COLUMN "temperatureControl" TEXT NOT NULL DEFAULT 'ambient';
ALTER TABLE "Order" ADD COLUMN "requiresHazmat" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Order" ADD COLUMN "specialRequirements" JSONB;

-- Add capabilities to Lane table
ALTER TABLE "Lane" ADD COLUMN "serviceLevel" TEXT NOT NULL DEFAULT 'LTL';
ALTER TABLE "Lane" ADD COLUMN "supportsTemperatureControl" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Lane" ADD COLUMN "supportsHazmat" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Lane" ADD COLUMN "maxWeight" DOUBLE PRECISION;
ALTER TABLE "Lane" ADD COLUMN "maxVolume" DOUBLE PRECISION;

-- CreateTable PendingLaneRequest
CREATE TABLE "PendingLaneRequest" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "orderId" TEXT NOT NULL,
    "originId" TEXT NOT NULL,
    "destinationId" TEXT NOT NULL,
    "serviceLevel" TEXT NOT NULL,
    "requiresTemperatureControl" BOOLEAN NOT NULL DEFAULT false,
    "requiresHazmat" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "resolvedAt" TIMESTAMP(3),
    "resolvedById" TEXT,
    "createdLaneId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PendingLaneRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PendingLaneRequest_orderId_idx" ON "PendingLaneRequest"("orderId");

-- CreateIndex
CREATE INDEX "PendingLaneRequest_status_idx" ON "PendingLaneRequest"("status");

-- CreateIndex
CREATE INDEX "PendingLaneRequest_originId_destinationId_idx" ON "PendingLaneRequest"("originId", "destinationId");

-- AddForeignKey
ALTER TABLE "PendingLaneRequest" ADD CONSTRAINT "PendingLaneRequest_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PendingLaneRequest" ADD CONSTRAINT "PendingLaneRequest_originId_fkey" FOREIGN KEY ("originId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PendingLaneRequest" ADD CONSTRAINT "PendingLaneRequest_destinationId_fkey" FOREIGN KEY ("destinationId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
