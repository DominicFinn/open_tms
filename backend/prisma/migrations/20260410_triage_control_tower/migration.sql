-- Triage Control Tower: Extend Issue model + add IssueActivity + TriageBoard

-- Issue model extensions
ALTER TABLE "Issue" ADD COLUMN IF NOT EXISTS "priority" INTEGER NOT NULL DEFAULT 3;
ALTER TABLE "Issue" ADD COLUMN IF NOT EXISTS "tags" JSONB;
ALTER TABLE "Issue" ADD COLUMN IF NOT EXISTS "laneId" TEXT;
ALTER TABLE "Issue" ADD COLUMN IF NOT EXISTS "region" TEXT;
ALTER TABLE "Issue" ADD COLUMN IF NOT EXISTS "resolvedBy" TEXT;
ALTER TABLE "Issue" ADD COLUMN IF NOT EXISTS "resolutionNotes" TEXT;
ALTER TABLE "Issue" ADD COLUMN IF NOT EXISTS "timeToFirstResponse" INTEGER;
ALTER TABLE "Issue" ADD COLUMN IF NOT EXISTS "timeToResolution" INTEGER;
ALTER TABLE "Issue" ADD COLUMN IF NOT EXISTS "lastActivityAt" TIMESTAMP(3);
ALTER TABLE "Issue" ADD COLUMN IF NOT EXISTS "activityCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Issue" ADD COLUMN IF NOT EXISTS "signalScore" INTEGER NOT NULL DEFAULT 50;
ALTER TABLE "Issue" ADD COLUMN IF NOT EXISTS "correlatedEvents" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Issue" ADD COLUMN IF NOT EXISTS "isNoise" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Issue" ADD COLUMN IF NOT EXISTS "noiseReason" TEXT;

-- New indexes on Issue
CREATE INDEX IF NOT EXISTS "Issue_priority_idx" ON "Issue"("priority");
CREATE INDEX IF NOT EXISTS "Issue_customerId_idx" ON "Issue"("customerId");
CREATE INDEX IF NOT EXISTS "Issue_carrierId_idx" ON "Issue"("carrierId");
CREATE INDEX IF NOT EXISTS "Issue_laneId_idx" ON "Issue"("laneId");
CREATE INDEX IF NOT EXISTS "Issue_region_idx" ON "Issue"("region");
CREATE INDEX IF NOT EXISTS "Issue_signalScore_idx" ON "Issue"("signalScore");
CREATE INDEX IF NOT EXISTS "Issue_isNoise_idx" ON "Issue"("isNoise");
CREATE INDEX IF NOT EXISTS "Issue_lastActivityAt_idx" ON "Issue"("lastActivityAt");

-- IssueActivity model (timeline of all changes)
CREATE TABLE IF NOT EXISTS "IssueActivity" (
    "id" TEXT NOT NULL,
    "issueId" TEXT NOT NULL,
    "actorId" TEXT,
    "actorName" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IssueActivity_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "IssueActivity_issueId_createdAt_idx" ON "IssueActivity"("issueId", "createdAt");
ALTER TABLE "IssueActivity" ADD CONSTRAINT "IssueActivity_issueId_fkey" FOREIGN KEY ("issueId") REFERENCES "Issue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- TriageBoard model (saved filters / custom boards)
CREATE TABLE IF NOT EXISTS "TriageBoard" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "icon" TEXT,
    "createdBy" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isShared" BOOLEAN NOT NULL DEFAULT true,
    "filterStatus" JSONB,
    "filterSeverity" JSONB,
    "filterPriority" JSONB,
    "filterCategory" JSONB,
    "filterCustomerId" TEXT,
    "filterCarrierId" TEXT,
    "filterLaneId" TEXT,
    "filterRegion" JSONB,
    "filterTempControlled" BOOLEAN,
    "filterHazmat" BOOLEAN,
    "filterAssigneeId" TEXT,
    "filterSource" JSONB,
    "filterDateRange" TEXT,
    "filterQuery" TEXT,
    "filterSignalScoreMin" INTEGER,
    "filterShowNoise" BOOLEAN NOT NULL DEFAULT false,
    "viewMode" TEXT NOT NULL DEFAULT 'kanban',
    "sortBy" TEXT NOT NULL DEFAULT 'createdAt',
    "sortOrder" TEXT NOT NULL DEFAULT 'desc',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TriageBoard_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "TriageBoard_orgId_idx" ON "TriageBoard"("orgId");
CREATE INDEX IF NOT EXISTS "TriageBoard_createdBy_idx" ON "TriageBoard"("createdBy");
