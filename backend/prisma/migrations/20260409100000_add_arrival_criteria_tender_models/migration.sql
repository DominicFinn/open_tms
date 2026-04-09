-- CreateTable: ArrivalCriteria
CREATE TABLE "ArrivalCriteria" (
    "id" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "criteriaType" TEXT NOT NULL,
    "radiusMeters" DOUBLE PRECISION,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "wifiSsid" TEXT,
    "wifiBssid" TEXT,
    "bleUuid" TEXT,
    "bleMajor" INTEGER,
    "bleMinor" INTEGER,
    "bleRssiThreshold" INTEGER,
    "name" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ArrivalCriteria_pkey" PRIMARY KEY ("id")
);

-- CreateTable: Tender
CREATE TABLE "Tender" (
    "id" TEXT NOT NULL,
    "shipmentId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "publishedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "publishMethod" TEXT NOT NULL DEFAULT 'manual',
    "awardedCarrierId" TEXT,
    "awardedAt" TIMESTAMP(3),
    "awardedPrice" DOUBLE PRECISION,
    "awardedCurrency" TEXT NOT NULL DEFAULT 'USD',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tender_pkey" PRIMARY KEY ("id")
);

-- CreateTable: TenderResponse
CREATE TABLE "TenderResponse" (
    "id" TEXT NOT NULL,
    "tenderId" TEXT NOT NULL,
    "carrierId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "price" DOUBLE PRECISION,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "notes" TEXT,
    "transitDays" INTEGER,
    "respondedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TenderResponse_pkey" PRIMARY KEY ("id")
);

-- Organization: add tendering settings
ALTER TABLE "Organization" ADD COLUMN "autoTenderEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Organization" ADD COLUMN "defaultGeofenceRadiusMeters" DOUBLE PRECISION NOT NULL DEFAULT 200;

-- CreateIndex: ArrivalCriteria
CREATE INDEX "ArrivalCriteria_locationId_idx" ON "ArrivalCriteria"("locationId");
CREATE INDEX "ArrivalCriteria_criteriaType_idx" ON "ArrivalCriteria"("criteriaType");
CREATE INDEX "ArrivalCriteria_locationId_active_idx" ON "ArrivalCriteria"("locationId", "active");

-- CreateIndex: Tender
CREATE UNIQUE INDEX "Tender_shipmentId_key" ON "Tender"("shipmentId");
CREATE INDEX "Tender_status_idx" ON "Tender"("status");
CREATE INDEX "Tender_shipmentId_idx" ON "Tender"("shipmentId");

-- CreateIndex: TenderResponse
CREATE UNIQUE INDEX "TenderResponse_tenderId_carrierId_key" ON "TenderResponse"("tenderId", "carrierId");
CREATE INDEX "TenderResponse_tenderId_idx" ON "TenderResponse"("tenderId");
CREATE INDEX "TenderResponse_carrierId_idx" ON "TenderResponse"("carrierId");
CREATE INDEX "TenderResponse_status_idx" ON "TenderResponse"("status");

-- AddForeignKey: ArrivalCriteria
ALTER TABLE "ArrivalCriteria" ADD CONSTRAINT "ArrivalCriteria_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: Tender
ALTER TABLE "Tender" ADD CONSTRAINT "Tender_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Tender" ADD CONSTRAINT "Tender_awardedCarrierId_fkey" FOREIGN KEY ("awardedCarrierId") REFERENCES "Carrier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: TenderResponse
ALTER TABLE "TenderResponse" ADD CONSTRAINT "TenderResponse_tenderId_fkey" FOREIGN KEY ("tenderId") REFERENCES "Tender"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TenderResponse" ADD CONSTRAINT "TenderResponse_carrierId_fkey" FOREIGN KEY ("carrierId") REFERENCES "Carrier"("id") ON DELETE CASCADE ON UPDATE CASCADE;
