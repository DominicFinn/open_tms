-- Carrier Tendering: new models and modifications to existing models

-- Add SCAC code to Carrier
ALTER TABLE "Carrier" ADD COLUMN "scacCode" TEXT;

-- Add contract rate fields to LaneCarrier
ALTER TABLE "LaneCarrier" ADD COLUMN "rateType" TEXT;
ALTER TABLE "LaneCarrier" ADD COLUMN "contractStartDate" TIMESTAMP(3);
ALTER TABLE "LaneCarrier" ADD COLUMN "contractEndDate" TIMESTAMP(3);
ALTER TABLE "LaneCarrier" ADD COLUMN "fuelSurchargePercent" DOUBLE PRECISION;
ALTER TABLE "LaneCarrier" ADD COLUMN "accessorialRates" JSONB;
ALTER TABLE "LaneCarrier" ADD COLUMN "isContractRate" BOOLEAN NOT NULL DEFAULT false;

-- Add EDI tender fields to EdiPartner
ALTER TABLE "EdiPartner" ADD COLUMN "ediTenderEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "EdiPartner" ADD COLUMN "ediOutboundDir" TEXT;

-- CarrierUser table
CREATE TABLE "CarrierUser" (
    "id" TEXT NOT NULL,
    "carrierId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'dispatcher',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CarrierUser_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CarrierUser_email_key" ON "CarrierUser"("email");
CREATE INDEX "CarrierUser_carrierId_idx" ON "CarrierUser"("carrierId");
CREATE INDEX "CarrierUser_email_idx" ON "CarrierUser"("email");

ALTER TABLE "CarrierUser" ADD CONSTRAINT "CarrierUser_carrierId_fkey"
    FOREIGN KEY ("carrierId") REFERENCES "Carrier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Tender table
CREATE TABLE "Tender" (
    "id" TEXT NOT NULL,
    "shipmentId" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "strategy" TEXT NOT NULL DEFAULT 'broadcast',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "tenderDurationMinutes" INTEGER NOT NULL DEFAULT 120,
    "targetRate" DOUBLE PRECISION,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "equipmentType" TEXT,
    "notes" TEXT,
    "specialInstructions" TEXT,
    "openedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "awardedAt" TIMESTAMP(3),
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tender_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Tender_reference_key" ON "Tender"("reference");
CREATE INDEX "Tender_shipmentId_idx" ON "Tender"("shipmentId");
CREATE INDEX "Tender_status_idx" ON "Tender"("status");
CREATE INDEX "Tender_reference_idx" ON "Tender"("reference");
CREATE INDEX "Tender_createdAt_idx" ON "Tender"("createdAt");

ALTER TABLE "Tender" ADD CONSTRAINT "Tender_shipmentId_fkey"
    FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- TenderOffer table
CREATE TABLE "TenderOffer" (
    "id" TEXT NOT NULL,
    "tenderId" TEXT NOT NULL,
    "carrierId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "sentAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "viewedAt" TIMESTAMP(3),
    "ediSent" BOOLEAN NOT NULL DEFAULT false,
    "edi204Content" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TenderOffer_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TenderOffer_tenderId_carrierId_key" ON "TenderOffer"("tenderId", "carrierId");
CREATE INDEX "TenderOffer_tenderId_idx" ON "TenderOffer"("tenderId");
CREATE INDEX "TenderOffer_carrierId_idx" ON "TenderOffer"("carrierId");
CREATE INDEX "TenderOffer_status_idx" ON "TenderOffer"("status");
CREATE INDEX "TenderOffer_expiresAt_idx" ON "TenderOffer"("expiresAt");

ALTER TABLE "TenderOffer" ADD CONSTRAINT "TenderOffer_tenderId_fkey"
    FOREIGN KEY ("tenderId") REFERENCES "Tender"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TenderOffer" ADD CONSTRAINT "TenderOffer_carrierId_fkey"
    FOREIGN KEY ("carrierId") REFERENCES "Carrier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- TenderBid table
CREATE TABLE "TenderBid" (
    "id" TEXT NOT NULL,
    "tenderId" TEXT NOT NULL,
    "tenderOfferId" TEXT NOT NULL,
    "carrierId" TEXT NOT NULL,
    "rate" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "transitDays" INTEGER,
    "equipmentType" TEXT,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'submitted',
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedAt" TIMESTAMP(3),
    "submittedById" TEXT,
    "sourceType" TEXT NOT NULL DEFAULT 'portal',
    "edi990Content" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TenderBid_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TenderBid_tenderOfferId_carrierId_key" ON "TenderBid"("tenderOfferId", "carrierId");
CREATE INDEX "TenderBid_tenderId_idx" ON "TenderBid"("tenderId");
CREATE INDEX "TenderBid_carrierId_idx" ON "TenderBid"("carrierId");
CREATE INDEX "TenderBid_status_idx" ON "TenderBid"("status");
CREATE INDEX "TenderBid_submittedAt_idx" ON "TenderBid"("submittedAt");

ALTER TABLE "TenderBid" ADD CONSTRAINT "TenderBid_tenderId_fkey"
    FOREIGN KEY ("tenderId") REFERENCES "Tender"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TenderBid" ADD CONSTRAINT "TenderBid_tenderOfferId_fkey"
    FOREIGN KEY ("tenderOfferId") REFERENCES "TenderOffer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TenderBid" ADD CONSTRAINT "TenderBid_carrierId_fkey"
    FOREIGN KEY ("carrierId") REFERENCES "Carrier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TenderBid" ADD CONSTRAINT "TenderBid_submittedById_fkey"
    FOREIGN KEY ("submittedById") REFERENCES "CarrierUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
