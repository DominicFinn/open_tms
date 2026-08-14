-- Triage Centre — signal scoring, noise suppression, and SLA/response metrics.
--
-- Extends the existing Issue Engine rather than introducing a parallel model.
-- Signal scoring is derived from the IssueSignal ledger that already exists:
-- an issue's score starts at its type's base confidence and is boosted by each
-- corroborating signal. Low-scoring issues are flagged as noise so they can be
-- filtered out of the working queues (latched safety types are never
-- suppressed — see IssueEngineHandler).

-- Issue: scoring + noise
ALTER TABLE "Issue" ADD COLUMN IF NOT EXISTS "signalScore" INTEGER NOT NULL DEFAULT 50;
ALTER TABLE "Issue" ADD COLUMN IF NOT EXISTS "signalCount" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Issue" ADD COLUMN IF NOT EXISTS "isNoise" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Issue" ADD COLUMN IF NOT EXISTS "noiseReason" TEXT;

-- Issue: SLA + response metrics
ALTER TABLE "Issue" ADD COLUMN IF NOT EXISTS "slaDeadline" TIMESTAMP(3);
ALTER TABLE "Issue" ADD COLUMN IF NOT EXISTS "slaBreach" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Issue" ADD COLUMN IF NOT EXISTS "firstResponseAt" TIMESTAMP(3);
ALTER TABLE "Issue" ADD COLUMN IF NOT EXISTS "timeToFirstResponseMins" INTEGER;
ALTER TABLE "Issue" ADD COLUMN IF NOT EXISTS "timeToResolutionMins" INTEGER;
ALTER TABLE "Issue" ADD COLUMN IF NOT EXISTS "lastActivityAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "Issue_signalScore_idx" ON "Issue"("signalScore");
CREATE INDEX IF NOT EXISTS "Issue_isNoise_idx" ON "Issue"("isNoise");
CREATE INDEX IF NOT EXISTS "Issue_slaBreach_idx" ON "Issue"("slaBreach");
CREATE INDEX IF NOT EXISTS "Issue_orgId_isNoise_status_idx" ON "Issue"("orgId", "isNoise", "status");
CREATE INDEX IF NOT EXISTS "Issue_orgId_slaDeadline_idx" ON "Issue"("orgId", "slaDeadline");

-- IssueReadModel: mirror everything the triage queues filter/sort on
ALTER TABLE "IssueReadModel" ADD COLUMN IF NOT EXISTS "signalScore" INTEGER NOT NULL DEFAULT 50;
ALTER TABLE "IssueReadModel" ADD COLUMN IF NOT EXISTS "signalCount" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "IssueReadModel" ADD COLUMN IF NOT EXISTS "isNoise" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "IssueReadModel" ADD COLUMN IF NOT EXISTS "noiseReason" TEXT;
ALTER TABLE "IssueReadModel" ADD COLUMN IF NOT EXISTS "slaDeadline" TIMESTAMP(3);
ALTER TABLE "IssueReadModel" ADD COLUMN IF NOT EXISTS "slaBreach" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "IssueReadModel" ADD COLUMN IF NOT EXISTS "firstResponseAt" TIMESTAMP(3);
ALTER TABLE "IssueReadModel" ADD COLUMN IF NOT EXISTS "timeToFirstResponseMins" INTEGER;
ALTER TABLE "IssueReadModel" ADD COLUMN IF NOT EXISTS "timeToResolutionMins" INTEGER;
ALTER TABLE "IssueReadModel" ADD COLUMN IF NOT EXISTS "lastActivityAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "IssueReadModel_signalScore_idx" ON "IssueReadModel"("signalScore");
CREATE INDEX IF NOT EXISTS "IssueReadModel_isNoise_idx" ON "IssueReadModel"("isNoise");
CREATE INDEX IF NOT EXISTS "IssueReadModel_orgId_isNoise_status_idx" ON "IssueReadModel"("orgId", "isNoise", "status");
CREATE INDEX IF NOT EXISTS "IssueReadModel_orgId_slaBreach_idx" ON "IssueReadModel"("orgId", "slaBreach");
CREATE INDEX IF NOT EXISTS "IssueReadModel_orgId_slaDeadline_idx" ON "IssueReadModel"("orgId", "slaDeadline");

-- KanbanView doubles as the Triage Centre's saved boards. `filters` is already
-- Json so the widened triage filter shape needs no column change; these two
-- give boards an icon and a shared/private flag for the board picker.
ALTER TABLE "KanbanView" ADD COLUMN IF NOT EXISTS "icon" TEXT;
ALTER TABLE "KanbanView" ADD COLUMN IF NOT EXISTS "isShared" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "KanbanView" ADD COLUMN IF NOT EXISTS "viewMode" TEXT NOT NULL DEFAULT 'kanban';
