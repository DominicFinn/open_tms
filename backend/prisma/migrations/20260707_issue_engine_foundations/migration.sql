-- Deterministic Issue Engine — Stage 0 foundations.
-- Adds Issue Type + latching to issues, and the append-only IssueSignal ledger.

-- Issue: type registry key + latching snapshot
ALTER TABLE "Issue" ADD COLUMN IF NOT EXISTS "issueType" TEXT;
ALTER TABLE "Issue" ADD COLUMN IF NOT EXISTS "latched" BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS "Issue_issueType_idx" ON "Issue"("issueType");
CREATE INDEX IF NOT EXISTS "Issue_orgId_issueType_status_idx" ON "Issue"("orgId", "issueType", "status");
CREATE INDEX IF NOT EXISTS "Issue_sourceEntityType_sourceEntityId_status_idx" ON "Issue"("sourceEntityType", "sourceEntityId", "status");

-- IssueReadModel: mirror the new fields for reporting
ALTER TABLE "IssueReadModel" ADD COLUMN IF NOT EXISTS "issueType" TEXT;
ALTER TABLE "IssueReadModel" ADD COLUMN IF NOT EXISTS "latched" BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS "IssueReadModel_orgId_issueType_status_idx" ON "IssueReadModel"("orgId", "issueType", "status");

-- IssueSignal ledger
CREATE TABLE IF NOT EXISTS "IssueSignal" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "issueType" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "sourceEntityType" TEXT NOT NULL,
    "sourceEntityId" TEXT NOT NULL,
    "priority" TEXT NOT NULL,
    "sourceEventId" TEXT,
    "issueId" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "IssueSignal_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "IssueSignal_orgId_idx" ON "IssueSignal"("orgId");
CREATE INDEX IF NOT EXISTS "IssueSignal_issueType_sourceEntityId_occurredAt_idx" ON "IssueSignal"("issueType", "sourceEntityId", "occurredAt");
CREATE INDEX IF NOT EXISTS "IssueSignal_sourceEntityType_sourceEntityId_occurredAt_idx" ON "IssueSignal"("sourceEntityType", "sourceEntityId", "occurredAt");
CREATE INDEX IF NOT EXISTS "IssueSignal_issueId_idx" ON "IssueSignal"("issueId");
CREATE INDEX IF NOT EXISTS "IssueSignal_orgId_occurredAt_idx" ON "IssueSignal"("orgId", "occurredAt");

DO $$ BEGIN
  ALTER TABLE "IssueSignal" ADD CONSTRAINT "IssueSignal_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "IssueSignal" ADD CONSTRAINT "IssueSignal_issueId_fkey" FOREIGN KEY ("issueId") REFERENCES "Issue"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
