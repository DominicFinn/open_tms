-- CargoScan
CREATE TABLE IF NOT EXISTS "CargoScan" (
    "id" TEXT NOT NULL, "shipmentId" TEXT NOT NULL, "shipmentStopId" TEXT NOT NULL,
    "trackableUnitId" TEXT NOT NULL, "scanType" TEXT NOT NULL, "scanMethod" TEXT NOT NULL,
    "scannedBy" TEXT, "lat" DOUBLE PRECISION, "lng" DOUBLE PRECISION,
    "expected" BOOLEAN, "notes" TEXT,
    "scannedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CargoScan_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "CargoScan_shipmentId_idx" ON "CargoScan"("shipmentId");
CREATE INDEX IF NOT EXISTS "CargoScan_shipmentStopId_idx" ON "CargoScan"("shipmentStopId");
CREATE INDEX IF NOT EXISTS "CargoScan_trackableUnitId_idx" ON "CargoScan"("trackableUnitId");
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='CargoScan_shipmentId_fkey') THEN ALTER TABLE "CargoScan" ADD CONSTRAINT "CargoScan_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON UPDATE CASCADE; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='CargoScan_shipmentStopId_fkey') THEN ALTER TABLE "CargoScan" ADD CONSTRAINT "CargoScan_shipmentStopId_fkey" FOREIGN KEY ("shipmentStopId") REFERENCES "ShipmentStop"("id") ON UPDATE CASCADE; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='CargoScan_trackableUnitId_fkey') THEN ALTER TABLE "CargoScan" ADD CONSTRAINT "CargoScan_trackableUnitId_fkey" FOREIGN KEY ("trackableUnitId") REFERENCES "TrackableUnit"("id") ON UPDATE CASCADE; END IF;
END $$;

-- CarrierUser
CREATE TABLE IF NOT EXISTS "CarrierUser" (
    "id" TEXT NOT NULL, "carrierId" TEXT NOT NULL, "email" TEXT NOT NULL, "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL, "role" TEXT, "active" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CarrierUser_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "CarrierUser_email_key" ON "CarrierUser"("email");
CREATE INDEX IF NOT EXISTS "CarrierUser_carrierId_idx" ON "CarrierUser"("carrierId");
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='CarrierUser_carrierId_fkey') THEN ALTER TABLE "CarrierUser" ADD CONSTRAINT "CarrierUser_carrierId_fkey" FOREIGN KEY ("carrierId") REFERENCES "Carrier"("id") ON UPDATE CASCADE; END IF;
END $$;

-- Issue
CREATE TABLE IF NOT EXISTS "Issue" (
    "id" TEXT NOT NULL, "orgId" TEXT NOT NULL, "title" TEXT NOT NULL, "description" TEXT,
    "priority" TEXT, "category" TEXT NOT NULL, "status" TEXT NOT NULL DEFAULT 'open',
    "sourceEntityType" TEXT, "sourceEntityId" TEXT, "assigneeId" TEXT, "assigneeName" TEXT,
    "resolution" TEXT, "escalatedTo" TEXT, "escalatedAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3), "resolvedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Issue_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "Issue_orgId_idx" ON "Issue"("orgId");
CREATE INDEX IF NOT EXISTS "Issue_status_idx" ON "Issue"("status");
CREATE INDEX IF NOT EXISTS "Issue_source_idx" ON "Issue"("sourceEntityType", "sourceEntityId");
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='Issue_orgId_fkey') THEN ALTER TABLE "Issue" ADD CONSTRAINT "Issue_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON UPDATE CASCADE; END IF;
END $$;

-- Tender
CREATE TABLE IF NOT EXISTS "Tender" (
    "id" TEXT NOT NULL, "shipmentId" TEXT NOT NULL, "reference" TEXT NOT NULL,
    "strategy" TEXT NOT NULL, "status" TEXT NOT NULL DEFAULT 'draft',
    "tenderDurationMinutes" INTEGER NOT NULL, "targetRate" DOUBLE PRECISION,
    "currency" TEXT NOT NULL DEFAULT 'USD', "equipmentType" TEXT,
    "notes" TEXT, "specialInstructions" TEXT, "createdBy" TEXT,
    "openedAt" TIMESTAMP(3), "awardedAt" TIMESTAMP(3), "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Tender_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "Tender_reference_key" ON "Tender"("reference");
CREATE INDEX IF NOT EXISTS "Tender_shipmentId_idx" ON "Tender"("shipmentId");
CREATE INDEX IF NOT EXISTS "Tender_status_idx" ON "Tender"("status");
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='Tender_shipmentId_fkey') THEN ALTER TABLE "Tender" ADD CONSTRAINT "Tender_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON UPDATE CASCADE; END IF;
END $$;

-- TenderOffer
CREATE TABLE IF NOT EXISTS "TenderOffer" (
    "id" TEXT NOT NULL, "tenderId" TEXT NOT NULL, "carrierId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending', "sequence" INTEGER, "waterfallSequence" INTEGER,
    "sentAt" TIMESTAMP(3), "expiresAt" TIMESTAMP(3), "viewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TenderOffer_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "TenderOffer_tenderId_idx" ON "TenderOffer"("tenderId");
CREATE INDEX IF NOT EXISTS "TenderOffer_carrierId_idx" ON "TenderOffer"("carrierId");
CREATE UNIQUE INDEX IF NOT EXISTS "TenderOffer_tenderId_carrierId_key" ON "TenderOffer"("tenderId", "carrierId");
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='TenderOffer_tenderId_fkey') THEN ALTER TABLE "TenderOffer" ADD CONSTRAINT "TenderOffer_tenderId_fkey" FOREIGN KEY ("tenderId") REFERENCES "Tender"("id") ON UPDATE CASCADE; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='TenderOffer_carrierId_fkey') THEN ALTER TABLE "TenderOffer" ADD CONSTRAINT "TenderOffer_carrierId_fkey" FOREIGN KEY ("carrierId") REFERENCES "Carrier"("id") ON UPDATE CASCADE; END IF;
END $$;

-- TenderBid
CREATE TABLE IF NOT EXISTS "TenderBid" (
    "id" TEXT NOT NULL, "tenderId" TEXT NOT NULL, "tenderOfferId" TEXT NOT NULL,
    "carrierId" TEXT NOT NULL, "rate" DOUBLE PRECISION NOT NULL, "currency" TEXT,
    "transitDays" INTEGER, "equipmentType" TEXT, "notes" TEXT,
    "submittedById" TEXT, "sourceType" TEXT, "edi990Content" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TenderBid_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "TenderBid_tenderId_idx" ON "TenderBid"("tenderId");
CREATE INDEX IF NOT EXISTS "TenderBid_tenderOfferId_idx" ON "TenderBid"("tenderOfferId");
CREATE INDEX IF NOT EXISTS "TenderBid_carrierId_idx" ON "TenderBid"("carrierId");
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='TenderBid_tenderId_fkey') THEN ALTER TABLE "TenderBid" ADD CONSTRAINT "TenderBid_tenderId_fkey" FOREIGN KEY ("tenderId") REFERENCES "Tender"("id") ON UPDATE CASCADE; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='TenderBid_tenderOfferId_fkey') THEN ALTER TABLE "TenderBid" ADD CONSTRAINT "TenderBid_tenderOfferId_fkey" FOREIGN KEY ("tenderOfferId") REFERENCES "TenderOffer"("id") ON UPDATE CASCADE; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='TenderBid_carrierId_fkey') THEN ALTER TABLE "TenderBid" ADD CONSTRAINT "TenderBid_carrierId_fkey" FOREIGN KEY ("carrierId") REFERENCES "Carrier"("id") ON UPDATE CASCADE; END IF;
END $$;

-- TradingPartner
CREATE TABLE IF NOT EXISTS "TradingPartner" (
    "id" TEXT NOT NULL, "name" TEXT NOT NULL, "entityType" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true, "customerId" TEXT, "carrierId" TEXT,
    "sftpHost" TEXT, "sftpPort" INTEGER, "sftpUsername" TEXT, "sftpPassword" TEXT, "sftpPrivateKey" TEXT,
    "httpUrl" TEXT, "httpAuthType" TEXT, "httpAuthHeader" TEXT, "httpAuthValue" TEXT,
    "senderId" TEXT, "receiverId" TEXT, "ediVersion" TEXT,
    "inboundEnabled" BOOLEAN NOT NULL DEFAULT false, "inboundDir" TEXT, "inboundFilePattern" TEXT,
    "pollingInterval" INTEGER, "pollingCron" TEXT,
    "outboundEnabled" BOOLEAN NOT NULL DEFAULT false, "outboundDir" TEXT, "outboundTransport" TEXT, "outboundFileNaming" TEXT,
    "lastPolledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TradingPartner_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "TradingPartner_customerId_key" ON "TradingPartner"("customerId");
CREATE UNIQUE INDEX IF NOT EXISTS "TradingPartner_carrierId_key" ON "TradingPartner"("carrierId");
CREATE INDEX IF NOT EXISTS "TradingPartner_customerId_idx" ON "TradingPartner"("customerId");
CREATE INDEX IF NOT EXISTS "TradingPartner_carrierId_idx" ON "TradingPartner"("carrierId");
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='TradingPartner_customerId_fkey') THEN ALTER TABLE "TradingPartner" ADD CONSTRAINT "TradingPartner_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON UPDATE CASCADE ON DELETE SET NULL; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='TradingPartner_carrierId_fkey') THEN ALTER TABLE "TradingPartner" ADD CONSTRAINT "TradingPartner_carrierId_fkey" FOREIGN KEY ("carrierId") REFERENCES "Carrier"("id") ON UPDATE CASCADE ON DELETE SET NULL; END IF;
END $$;

-- TradingPartnerTransaction
CREATE TABLE IF NOT EXISTS "TradingPartnerTransaction" (
    "id" TEXT NOT NULL, "partnerId" TEXT NOT NULL, "transactionType" TEXT NOT NULL,
    "direction" TEXT NOT NULL, "enabled" BOOLEAN NOT NULL DEFAULT true,
    "fieldMapping" JSONB, "autoProcess" BOOLEAN NOT NULL DEFAULT false,
    "ack997Required" BOOLEAN NOT NULL DEFAULT false, "filePattern" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TradingPartnerTransaction_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "TradingPartnerTransaction_partnerId_idx" ON "TradingPartnerTransaction"("partnerId");
CREATE UNIQUE INDEX IF NOT EXISTS "TradingPartnerTransaction_unique" ON "TradingPartnerTransaction"("partnerId", "transactionType", "direction");
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='TradingPartnerTransaction_partnerId_fkey') THEN ALTER TABLE "TradingPartnerTransaction" ADD CONSTRAINT "TradingPartnerTransaction_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "TradingPartner"("id") ON UPDATE CASCADE; END IF;
END $$;

-- ArrivalCriteria
CREATE TABLE IF NOT EXISTS "ArrivalCriteria" (
    "id" TEXT NOT NULL, "locationId" TEXT NOT NULL, "criteriaType" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true, "priority" INTEGER NOT NULL DEFAULT 0, "name" TEXT,
    "radiusMeters" INTEGER, "lat" DOUBLE PRECISION, "lng" DOUBLE PRECISION,
    "wifiSsid" TEXT, "wifiBssid" TEXT,
    "bleUuid" TEXT, "bleMajor" INTEGER, "bleMinor" INTEGER,
    "bleRssiThreshold" INTEGER, "bleAnchorId" TEXT, "bleReaderLocation" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ArrivalCriteria_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "ArrivalCriteria_locationId_idx" ON "ArrivalCriteria"("locationId");
CREATE INDEX IF NOT EXISTS "ArrivalCriteria_active_idx" ON "ArrivalCriteria"("active");
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='ArrivalCriteria_locationId_fkey') THEN ALTER TABLE "ArrivalCriteria" ADD CONSTRAINT "ArrivalCriteria_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON UPDATE CASCADE; END IF;
END $$;

-- CargoDiscrepancy
CREATE TABLE IF NOT EXISTS "CargoDiscrepancy" (
    "id" TEXT NOT NULL, "shipmentId" TEXT NOT NULL, "trackableUnitId" TEXT NOT NULL,
    "discrepancyType" TEXT NOT NULL, "severity" TEXT NOT NULL DEFAULT 'medium',
    "status" TEXT NOT NULL DEFAULT 'open', "expectedStopId" TEXT, "actualStopId" TEXT,
    "detectedBy" TEXT, "description" TEXT NOT NULL, "notes" TEXT,
    "resolution" TEXT, "resolvedBy" TEXT, "resolvedAt" TIMESTAMP(3),
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CargoDiscrepancy_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "CargoDiscrepancy_shipmentId_idx" ON "CargoDiscrepancy"("shipmentId");
CREATE INDEX IF NOT EXISTS "CargoDiscrepancy_trackableUnitId_idx" ON "CargoDiscrepancy"("trackableUnitId");
CREATE INDEX IF NOT EXISTS "CargoDiscrepancy_status_idx" ON "CargoDiscrepancy"("status");
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='CargoDiscrepancy_shipmentId_fkey') THEN ALTER TABLE "CargoDiscrepancy" ADD CONSTRAINT "CargoDiscrepancy_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON UPDATE CASCADE; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='CargoDiscrepancy_trackableUnitId_fkey') THEN ALTER TABLE "CargoDiscrepancy" ADD CONSTRAINT "CargoDiscrepancy_trackableUnitId_fkey" FOREIGN KEY ("trackableUnitId") REFERENCES "TrackableUnit"("id") ON UPDATE CASCADE; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='CargoDiscrepancy_expectedStopId_fkey') THEN ALTER TABLE "CargoDiscrepancy" ADD CONSTRAINT "CargoDiscrepancy_expectedStopId_fkey" FOREIGN KEY ("expectedStopId") REFERENCES "ShipmentStop"("id") ON UPDATE CASCADE ON DELETE SET NULL; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='CargoDiscrepancy_actualStopId_fkey') THEN ALTER TABLE "CargoDiscrepancy" ADD CONSTRAINT "CargoDiscrepancy_actualStopId_fkey" FOREIGN KEY ("actualStopId") REFERENCES "ShipmentStop"("id") ON UPDATE CASCADE ON DELETE SET NULL; END IF;
END $$;

-- EdiTransactionLog
CREATE TABLE IF NOT EXISTS "EdiTransactionLog" (
    "id" TEXT NOT NULL, "partnerId" TEXT NOT NULL, "transactionType" TEXT NOT NULL,
    "direction" TEXT NOT NULL, "status" TEXT NOT NULL DEFAULT 'pending',
    "fileName" TEXT, "fileSize" INTEGER, "fileContent" TEXT, "url" TEXT,
    "responseCode" INTEGER, "errorMessage" TEXT,
    "shipmentId" TEXT, "tenderId" TEXT, "orderId" TEXT, "shipmentReference" TEXT,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "EdiTransactionLog_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "EdiTransactionLog_partnerId_idx" ON "EdiTransactionLog"("partnerId");
CREATE INDEX IF NOT EXISTS "EdiTransactionLog_transactionType_idx" ON "EdiTransactionLog"("transactionType");
CREATE INDEX IF NOT EXISTS "EdiTransactionLog_status_idx" ON "EdiTransactionLog"("status");
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='EdiTransactionLog_partnerId_fkey') THEN ALTER TABLE "EdiTransactionLog" ADD CONSTRAINT "EdiTransactionLog_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "TradingPartner"("id") ON UPDATE CASCADE; END IF;
END $$;

-- ProjectionCheckpoint
CREATE TABLE IF NOT EXISTS "ProjectionCheckpoint" (
    "id" TEXT NOT NULL, "projectionName" TEXT NOT NULL,
    "lastEventId" TEXT, "lastEventTime" TIMESTAMP(3), "lastProcessedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'active', "errorCount" INTEGER NOT NULL DEFAULT 0, "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ProjectionCheckpoint_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "ProjectionCheckpoint_projectionName_key" ON "ProjectionCheckpoint"("projectionName");

-- CarrierReadModel
CREATE TABLE IF NOT EXISTS "CarrierReadModel" (
    "id" TEXT NOT NULL, "orgId" TEXT NOT NULL, "name" TEXT NOT NULL,
    "mcNumber" TEXT, "dotNumber" TEXT, "contactEmail" TEXT, "status" TEXT NOT NULL,
    "validationTier" TEXT, "vehicleCount" INTEGER NOT NULL DEFAULT 0,
    "driverCount" INTEGER NOT NULL DEFAULT 0, "activeLaneCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL, "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CarrierReadModel_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "CarrierReadModel_orgId_idx" ON "CarrierReadModel"("orgId");
CREATE INDEX IF NOT EXISTS "CarrierReadModel_status_idx" ON "CarrierReadModel"("status");

-- CustomerReadModel
CREATE TABLE IF NOT EXISTS "CustomerReadModel" (
    "id" TEXT NOT NULL, "orgId" TEXT NOT NULL, "name" TEXT NOT NULL, "contactEmail" TEXT,
    "activeOrderCount" INTEGER NOT NULL DEFAULT 0, "totalOrderCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL, "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CustomerReadModel_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "CustomerReadModel_orgId_idx" ON "CustomerReadModel"("orgId");

-- IssueReadModel
CREATE TABLE IF NOT EXISTS "IssueReadModel" (
    "id" TEXT NOT NULL, "orgId" TEXT NOT NULL, "title" TEXT NOT NULL, "status" TEXT NOT NULL,
    "priority" TEXT, "category" TEXT, "sourceEntityType" TEXT, "sourceEntityId" TEXT,
    "assigneeName" TEXT, "escalatedTo" TEXT, "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL, "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "IssueReadModel_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "IssueReadModel_orgId_idx" ON "IssueReadModel"("orgId");
CREATE INDEX IF NOT EXISTS "IssueReadModel_status_idx" ON "IssueReadModel"("status");

-- LaneReadModel
CREATE TABLE IF NOT EXISTS "LaneReadModel" (
    "id" TEXT NOT NULL, "orgId" TEXT NOT NULL, "name" TEXT NOT NULL,
    "originName" TEXT NOT NULL, "originCity" TEXT NOT NULL,
    "destinationName" TEXT NOT NULL, "destinationCity" TEXT NOT NULL,
    "serviceLevel" TEXT, "distance" INTEGER, "carrierCount" INTEGER NOT NULL DEFAULT 0,
    "activeShipmentCount" INTEGER NOT NULL DEFAULT 0, "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL, "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "LaneReadModel_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "LaneReadModel_orgId_idx" ON "LaneReadModel"("orgId");
CREATE INDEX IF NOT EXISTS "LaneReadModel_status_idx" ON "LaneReadModel"("status");

-- OrderReadModel
CREATE TABLE IF NOT EXISTS "OrderReadModel" (
    "id" TEXT NOT NULL, "orgId" TEXT NOT NULL, "orderNumber" TEXT NOT NULL, "poNumber" TEXT,
    "status" TEXT NOT NULL, "deliveryStatus" TEXT NOT NULL,
    "customerId" TEXT NOT NULL, "customerName" TEXT NOT NULL,
    "originName" TEXT, "originCity" TEXT, "originState" TEXT,
    "destinationName" TEXT, "destinationCity" TEXT, "destinationState" TEXT,
    "shipmentId" TEXT, "shipmentReference" TEXT, "serviceLevel" TEXT,
    "temperatureRequired" BOOLEAN NOT NULL DEFAULT false, "hazmat" BOOLEAN NOT NULL DEFAULT false,
    "trackableUnitCount" INTEGER NOT NULL DEFAULT 0, "lineItemCount" INTEGER NOT NULL DEFAULT 0,
    "totalWeight" DOUBLE PRECISION, "requestedDeliveryDate" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3), "exceptionType" TEXT, "importSource" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL, "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "OrderReadModel_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "OrderReadModel_orderNumber_key" ON "OrderReadModel"("orderNumber");
CREATE INDEX IF NOT EXISTS "OrderReadModel_orgId_idx" ON "OrderReadModel"("orgId");
CREATE INDEX IF NOT EXISTS "OrderReadModel_customerId_idx" ON "OrderReadModel"("customerId");
CREATE INDEX IF NOT EXISTS "OrderReadModel_status_idx" ON "OrderReadModel"("status");
CREATE INDEX IF NOT EXISTS "OrderReadModel_deliveryStatus_idx" ON "OrderReadModel"("deliveryStatus");

-- ShipmentReadModel
CREATE TABLE IF NOT EXISTS "ShipmentReadModel" (
    "id" TEXT NOT NULL, "orgId" TEXT NOT NULL, "reference" TEXT NOT NULL, "status" TEXT NOT NULL,
    "customerId" TEXT NOT NULL, "customerName" TEXT NOT NULL,
    "originName" TEXT, "originCity" TEXT, "originState" TEXT,
    "destinationName" TEXT, "destinationCity" TEXT, "destinationState" TEXT,
    "carrierId" TEXT, "carrierName" TEXT, "laneId" TEXT, "laneName" TEXT,
    "proNumber" TEXT, "pickupDate" TIMESTAMP(3), "deliveryDate" TIMESTAMP(3),
    "currentLat" DOUBLE PRECISION, "currentLng" DOUBLE PRECISION, "lastLocationAt" TIMESTAMP(3),
    "orderCount" INTEGER NOT NULL DEFAULT 0, "stopCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL, "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ShipmentReadModel_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "ShipmentReadModel_reference_key" ON "ShipmentReadModel"("reference");
CREATE INDEX IF NOT EXISTS "ShipmentReadModel_orgId_idx" ON "ShipmentReadModel"("orgId");
CREATE INDEX IF NOT EXISTS "ShipmentReadModel_customerId_idx" ON "ShipmentReadModel"("customerId");
CREATE INDEX IF NOT EXISTS "ShipmentReadModel_carrierId_idx" ON "ShipmentReadModel"("carrierId");
CREATE INDEX IF NOT EXISTS "ShipmentReadModel_laneId_idx" ON "ShipmentReadModel"("laneId");
CREATE INDEX IF NOT EXISTS "ShipmentReadModel_status_idx" ON "ShipmentReadModel"("status");
