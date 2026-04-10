-- Read models for Carrier, Customer, Lane + Issue/Triage system

-- CarrierReadModel
CREATE TABLE "CarrierReadModel" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "mcNumber" TEXT,
    "dotNumber" TEXT,
    "contactEmail" TEXT,
    "status" TEXT NOT NULL,
    "validationTier" TEXT,
    "vehicleCount" INTEGER NOT NULL DEFAULT 0,
    "driverCount" INTEGER NOT NULL DEFAULT 0,
    "activeLaneCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CarrierReadModel_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "CarrierReadModel_orgId_idx" ON "CarrierReadModel"("orgId");
CREATE INDEX "CarrierReadModel_status_idx" ON "CarrierReadModel"("status");
CREATE INDEX "CarrierReadModel_name_idx" ON "CarrierReadModel"("name");

-- CustomerReadModel
CREATE TABLE "CustomerReadModel" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contactEmail" TEXT,
    "activeOrderCount" INTEGER NOT NULL DEFAULT 0,
    "totalOrderCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CustomerReadModel_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "CustomerReadModel_orgId_idx" ON "CustomerReadModel"("orgId");
CREATE INDEX "CustomerReadModel_name_idx" ON "CustomerReadModel"("name");

-- LaneReadModel
CREATE TABLE "LaneReadModel" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "originName" TEXT,
    "originCity" TEXT,
    "destinationName" TEXT,
    "destinationCity" TEXT,
    "serviceLevel" TEXT NOT NULL,
    "distance" DOUBLE PRECISION,
    "carrierCount" INTEGER NOT NULL DEFAULT 0,
    "activeShipmentCount" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "LaneReadModel_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "LaneReadModel_orgId_idx" ON "LaneReadModel"("orgId");
CREATE INDEX "LaneReadModel_status_idx" ON "LaneReadModel"("status");

-- Issue (write model)
CREATE TABLE "Issue" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'open',
    "priority" TEXT NOT NULL DEFAULT 'medium',
    "category" TEXT NOT NULL,
    "sourceEntityType" TEXT,
    "sourceEntityId" TEXT,
    "sourceEventId" TEXT,
    "assigneeId" TEXT,
    "assigneeName" TEXT,
    "escalatedTo" TEXT,
    "escalatedAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "resolvedBy" TEXT,
    "resolution" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Issue_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Issue_orgId_idx" ON "Issue"("orgId");
CREATE INDEX "Issue_status_idx" ON "Issue"("status");
CREATE INDEX "Issue_priority_idx" ON "Issue"("priority");
CREATE INDEX "Issue_sourceEntityType_sourceEntityId_idx" ON "Issue"("sourceEntityType", "sourceEntityId");
CREATE INDEX "Issue_assigneeId_idx" ON "Issue"("assigneeId");
CREATE INDEX "Issue_createdAt_idx" ON "Issue"("createdAt");

-- IssueReadModel
CREATE TABLE "IssueReadModel" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "priority" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "sourceEntityType" TEXT,
    "sourceEntityId" TEXT,
    "assigneeName" TEXT,
    "escalatedTo" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "IssueReadModel_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "IssueReadModel_orgId_idx" ON "IssueReadModel"("orgId");
CREATE INDEX "IssueReadModel_status_idx" ON "IssueReadModel"("status");
CREATE INDEX "IssueReadModel_priority_idx" ON "IssueReadModel"("priority");
CREATE INDEX "IssueReadModel_assigneeName_idx" ON "IssueReadModel"("assigneeName");
CREATE INDEX "IssueReadModel_createdAt_idx" ON "IssueReadModel"("createdAt");

-- Projection checkpoints for tracking last processed event per projection
CREATE TABLE "ProjectionCheckpoint" (
    "projectionName" TEXT NOT NULL,
    "lastEventId" TEXT NOT NULL,
    "lastEventTime" TIMESTAMP(3) NOT NULL,
    "processedCount" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ProjectionCheckpoint_pkey" PRIMARY KEY ("projectionName")
);
