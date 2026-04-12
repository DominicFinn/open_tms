-- Triage Centre & Issue Management Overhaul
-- Adds: Comment, IssueLabel, IssueLabelAssignment, KanbanView models
-- Modifies: Issue (snooze, needsCapa, closedAt fields), IssueReadModel (enriched fields)

-- Issue model: add snooze, needsCapa, closure fields
ALTER TABLE "Issue" ADD COLUMN "snoozedUntil" TIMESTAMP(3);
ALTER TABLE "Issue" ADD COLUMN "snoozedBy" TEXT;
ALTER TABLE "Issue" ADD COLUMN "snoozedReason" TEXT;
ALTER TABLE "Issue" ADD COLUMN "needsCapa" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Issue" ADD COLUMN "closedAt" TIMESTAMP(3);
ALTER TABLE "Issue" ADD COLUMN "closedBy" TEXT;

CREATE INDEX "Issue_needsCapa_idx" ON "Issue"("needsCapa");
CREATE INDEX "Issue_snoozedUntil_idx" ON "Issue"("snoozedUntil");

-- IssueReadModel: add enriched fields
ALTER TABLE "IssueReadModel" ADD COLUMN "description" TEXT;
ALTER TABLE "IssueReadModel" ADD COLUMN "sourceEventId" TEXT;
ALTER TABLE "IssueReadModel" ADD COLUMN "assigneeId" TEXT;
ALTER TABLE "IssueReadModel" ADD COLUMN "escalatedAt" TIMESTAMP(3);
ALTER TABLE "IssueReadModel" ADD COLUMN "resolution" TEXT;
ALTER TABLE "IssueReadModel" ADD COLUMN "snoozedUntil" TIMESTAMP(3);
ALTER TABLE "IssueReadModel" ADD COLUMN "snoozedBy" TEXT;
ALTER TABLE "IssueReadModel" ADD COLUMN "needsCapa" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "IssueReadModel" ADD COLUMN "labels" JSONB;
ALTER TABLE "IssueReadModel" ADD COLUMN "closedAt" TIMESTAMP(3);
ALTER TABLE "IssueReadModel" ADD COLUMN "commentCount" INTEGER NOT NULL DEFAULT 0;

CREATE INDEX "IssueReadModel_needsCapa_idx" ON "IssueReadModel"("needsCapa");
CREATE INDEX "IssueReadModel_snoozedUntil_idx" ON "IssueReadModel"("snoozedUntil");

-- Comment model (polymorphic: issue, shipment, order, trackable_unit)
CREATE TABLE "Comment" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "authorId" TEXT,
    "authorName" TEXT NOT NULL,
    "authorType" TEXT NOT NULL DEFAULT 'user',
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Comment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Comment_orgId_idx" ON "Comment"("orgId");
CREATE INDEX "Comment_entityType_entityId_idx" ON "Comment"("entityType", "entityId");
CREATE INDEX "Comment_createdAt_idx" ON "Comment"("createdAt");

-- IssueLabel model
CREATE TABLE "IssueLabel" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#6B7280',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IssueLabel_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "IssueLabel_orgId_name_key" ON "IssueLabel"("orgId", "name");
CREATE INDEX "IssueLabel_orgId_idx" ON "IssueLabel"("orgId");

-- IssueLabelAssignment (join table)
CREATE TABLE "IssueLabelAssignment" (
    "id" TEXT NOT NULL,
    "issueId" TEXT NOT NULL,
    "labelId" TEXT NOT NULL,

    CONSTRAINT "IssueLabelAssignment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "IssueLabelAssignment_issueId_labelId_key" ON "IssueLabelAssignment"("issueId", "labelId");
CREATE INDEX "IssueLabelAssignment_issueId_idx" ON "IssueLabelAssignment"("issueId");
CREATE INDEX "IssueLabelAssignment_labelId_idx" ON "IssueLabelAssignment"("labelId");

ALTER TABLE "IssueLabelAssignment" ADD CONSTRAINT "IssueLabelAssignment_issueId_fkey" FOREIGN KEY ("issueId") REFERENCES "Issue"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "IssueLabelAssignment" ADD CONSTRAINT "IssueLabelAssignment_labelId_fkey" FOREIGN KEY ("labelId") REFERENCES "IssueLabel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- KanbanView model (shared org-wide saved views)
CREATE TABLE "KanbanView" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "filters" JSONB NOT NULL,
    "groupBy" TEXT NOT NULL DEFAULT 'status',
    "sortBy" TEXT NOT NULL DEFAULT 'createdAt',
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KanbanView_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "KanbanView_orgId_idx" ON "KanbanView"("orgId");
