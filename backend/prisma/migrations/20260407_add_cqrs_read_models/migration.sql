-- CQRS Read Models
-- Denormalized projection tables populated by event handlers.
-- These serve list/query endpoints without joins on the normalized write model.

-- OrderReadModel: serves GET /api/v1/orders list
CREATE TABLE "OrderReadModel" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "orderNumber" TEXT NOT NULL,
    "poNumber" TEXT,
    "status" TEXT NOT NULL,
    "deliveryStatus" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "originName" TEXT,
    "originCity" TEXT,
    "originState" TEXT,
    "destinationName" TEXT,
    "destinationCity" TEXT,
    "destinationState" TEXT,
    "shipmentReference" TEXT,
    "shipmentId" TEXT,
    "carrierName" TEXT,
    "serviceLevel" TEXT,
    "temperatureRequired" BOOLEAN NOT NULL DEFAULT false,
    "hazmat" BOOLEAN NOT NULL DEFAULT false,
    "trackableUnitCount" INTEGER NOT NULL DEFAULT 0,
    "lineItemCount" INTEGER NOT NULL DEFAULT 0,
    "totalWeight" DOUBLE PRECISION,
    "requestedDeliveryDate" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "exceptionType" TEXT,
    "importSource" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrderReadModel_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OrderReadModel_orderNumber_key" ON "OrderReadModel"("orderNumber");
CREATE INDEX "OrderReadModel_orgId_idx" ON "OrderReadModel"("orgId");
CREATE INDEX "OrderReadModel_status_idx" ON "OrderReadModel"("status");
CREATE INDEX "OrderReadModel_deliveryStatus_idx" ON "OrderReadModel"("deliveryStatus");
CREATE INDEX "OrderReadModel_customerId_idx" ON "OrderReadModel"("customerId");
CREATE INDEX "OrderReadModel_createdAt_idx" ON "OrderReadModel"("createdAt");
CREATE INDEX "OrderReadModel_shipmentId_idx" ON "OrderReadModel"("shipmentId");

-- ShipmentReadModel: serves GET /api/v1/shipments list
CREATE TABLE "ShipmentReadModel" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "originName" TEXT,
    "originCity" TEXT,
    "originState" TEXT,
    "destinationName" TEXT,
    "destinationCity" TEXT,
    "destinationState" TEXT,
    "carrierName" TEXT,
    "carrierId" TEXT,
    "laneName" TEXT,
    "laneId" TEXT,
    "proNumber" TEXT,
    "pickupDate" TIMESTAMP(3),
    "deliveryDate" TIMESTAMP(3),
    "orderCount" INTEGER NOT NULL DEFAULT 0,
    "stopCount" INTEGER NOT NULL DEFAULT 0,
    "currentLat" DOUBLE PRECISION,
    "currentLng" DOUBLE PRECISION,
    "lastLocationAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShipmentReadModel_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ShipmentReadModel_reference_key" ON "ShipmentReadModel"("reference");
CREATE INDEX "ShipmentReadModel_orgId_idx" ON "ShipmentReadModel"("orgId");
CREATE INDEX "ShipmentReadModel_status_idx" ON "ShipmentReadModel"("status");
CREATE INDEX "ShipmentReadModel_customerId_idx" ON "ShipmentReadModel"("customerId");
CREATE INDEX "ShipmentReadModel_carrierId_idx" ON "ShipmentReadModel"("carrierId");
CREATE INDEX "ShipmentReadModel_createdAt_idx" ON "ShipmentReadModel"("createdAt");
