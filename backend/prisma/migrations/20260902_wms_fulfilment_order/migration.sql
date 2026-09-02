-- WmsFulfilmentOrder — the warehouse's own record of what it has been asked to ship.
--
-- Table role: read model. Built from TMS order events today (WmsFulfilmentOrderProjection),
-- and directly from a 940, an API call or a manifest in a standalone FinnWMS.
--
-- The link back to the demand's origin is a soft (sourceType, sourceId) pair rather than a
-- foreign key, because a WMS-only install has no Order table to point at. Same reasoning for
-- sourceLineId on the line table.

-- CreateTable
CREATE TABLE "WmsFulfilmentOrder" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL DEFAULT 'tms_order',
    "sourceId" TEXT NOT NULL,
    "orderNumber" TEXT NOT NULL,
    "poNumber" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "customerId" TEXT,
    "customerName" TEXT,
    "originLocationId" TEXT,
    "serviceLevel" TEXT,
    "temperatureControl" TEXT,
    "hazmat" BOOLEAN NOT NULL DEFAULT false,
    "requestedPickupDate" TIMESTAMP(3),
    "requestedDeliveryDate" TIMESTAMP(3),
    "lineCount" INTEGER NOT NULL DEFAULT 0,
    "totalQuantity" INTEGER NOT NULL DEFAULT 0,
    "sourceCreatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WmsFulfilmentOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WmsFulfilmentOrderLine" (
    "id" TEXT NOT NULL,
    "fulfilmentOrderId" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "sourceLineId" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "description" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "unitOfMeasure" TEXT NOT NULL DEFAULT 'each',
    "weight" DOUBLE PRECISION,
    "hazmat" BOOLEAN NOT NULL DEFAULT false,
    "temperature" TEXT,

    CONSTRAINT "WmsFulfilmentOrderLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WmsFulfilmentOrder_orgId_status_idx" ON "WmsFulfilmentOrder"("orgId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "WmsFulfilmentOrder_orgId_sourceType_sourceId_key" ON "WmsFulfilmentOrder"("orgId", "sourceType", "sourceId");

-- CreateIndex
CREATE INDEX "WmsFulfilmentOrderLine_orgId_sku_idx" ON "WmsFulfilmentOrderLine"("orgId", "sku");

-- CreateIndex
CREATE UNIQUE INDEX "WmsFulfilmentOrderLine_fulfilmentOrderId_sourceLineId_key" ON "WmsFulfilmentOrderLine"("fulfilmentOrderId", "sourceLineId");

-- AddForeignKey
ALTER TABLE "WmsFulfilmentOrderLine" ADD CONSTRAINT "WmsFulfilmentOrderLine_fulfilmentOrderId_fkey" FOREIGN KEY ("fulfilmentOrderId") REFERENCES "WmsFulfilmentOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
