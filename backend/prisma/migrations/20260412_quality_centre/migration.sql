-- Quality Centre: Aggregated issue summary read model
CREATE TABLE "QualityIssueSummary" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "dimensionType" TEXT NOT NULL,
    "dimensionId" TEXT NOT NULL,
    "dimensionName" TEXT NOT NULL,
    "totalIssues" INTEGER NOT NULL DEFAULT 0,
    "exceptionCount" INTEGER NOT NULL DEFAULT 0,
    "delayCount" INTEGER NOT NULL DEFAULT 0,
    "damageCount" INTEGER NOT NULL DEFAULT 0,
    "complianceCount" INTEGER NOT NULL DEFAULT 0,
    "otherCount" INTEGER NOT NULL DEFAULT 0,
    "criticalCount" INTEGER NOT NULL DEFAULT 0,
    "highCount" INTEGER NOT NULL DEFAULT 0,
    "mediumCount" INTEGER NOT NULL DEFAULT 0,
    "lowCount" INTEGER NOT NULL DEFAULT 0,
    "openCount" INTEGER NOT NULL DEFAULT 0,
    "inProgressCount" INTEGER NOT NULL DEFAULT 0,
    "resolvedCount" INTEGER NOT NULL DEFAULT 0,
    "closedCount" INTEGER NOT NULL DEFAULT 0,
    "capaCount" INTEGER NOT NULL DEFAULT 0,
    "avgResolutionHours" DOUBLE PRECISION,
    "lastIssueAt" TIMESTAMP(3),
    "periodStart" TIMESTAMP(3),
    "periodEnd" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QualityIssueSummary_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "QualityIssueSummary_orgId_dimensionType_dimensionId_key" ON "QualityIssueSummary"("orgId", "dimensionType", "dimensionId");
CREATE INDEX "QualityIssueSummary_orgId_dimensionType_idx" ON "QualityIssueSummary"("orgId", "dimensionType");
CREATE INDEX "QualityIssueSummary_orgId_totalIssues_idx" ON "QualityIssueSummary"("orgId", "totalIssues");
CREATE INDEX "QualityIssueSummary_lastIssueAt_idx" ON "QualityIssueSummary"("lastIssueAt");

-- CAPA Follow-Up Notes
CREATE TABLE "CAPAFollowUp" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "capaReportId" TEXT NOT NULL,
    "followUpType" TEXT NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'pending',
    "notes" TEXT,
    "outcome" TEXT,
    "actionItems" TEXT,
    "assigneeId" TEXT,
    "assigneeName" TEXT,
    "completedById" TEXT,
    "completedByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,

    CONSTRAINT "CAPAFollowUp_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CAPAFollowUp_orgId_idx" ON "CAPAFollowUp"("orgId");
CREATE INDEX "CAPAFollowUp_capaReportId_idx" ON "CAPAFollowUp"("capaReportId");
CREATE INDEX "CAPAFollowUp_dueDate_idx" ON "CAPAFollowUp"("dueDate");
CREATE INDEX "CAPAFollowUp_status_idx" ON "CAPAFollowUp"("status");

ALTER TABLE "CAPAFollowUp" ADD CONSTRAINT "CAPAFollowUp_capaReportId_fkey"
    FOREIGN KEY ("capaReportId") REFERENCES "CAPAReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- SOP Checklists
CREATE TABLE "SOPChecklist" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "sopReference" TEXT,
    "category" TEXT NOT NULL,
    "frequency" TEXT NOT NULL DEFAULT 'annual',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "version" INTEGER NOT NULL DEFAULT 1,
    "nextDueDate" TIMESTAMP(3),
    "lastCompletedAt" TIMESTAMP(3),
    "lastCompletedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,

    CONSTRAINT "SOPChecklist_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SOPChecklist_orgId_idx" ON "SOPChecklist"("orgId");
CREATE INDEX "SOPChecklist_category_idx" ON "SOPChecklist"("category");
CREATE INDEX "SOPChecklist_status_idx" ON "SOPChecklist"("status");
CREATE INDEX "SOPChecklist_nextDueDate_idx" ON "SOPChecklist"("nextDueDate");

-- SOP Checklist Items
CREATE TABLE "SOPChecklistItem" (
    "id" TEXT NOT NULL,
    "checklistId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "section" TEXT,
    "question" TEXT NOT NULL,
    "guidance" TEXT,
    "evidenceRequired" BOOLEAN NOT NULL DEFAULT false,
    "isCritical" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SOPChecklistItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SOPChecklistItem_checklistId_idx" ON "SOPChecklistItem"("checklistId");

ALTER TABLE "SOPChecklistItem" ADD CONSTRAINT "SOPChecklistItem_checklistId_fkey"
    FOREIGN KEY ("checklistId") REFERENCES "SOPChecklist"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- SOP Audits (instances of completing a checklist)
CREATE TABLE "SOPAudit" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "checklistId" TEXT NOT NULL,
    "auditNumber" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'in_progress',
    "auditorId" TEXT,
    "auditorName" TEXT,
    "auditDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "score" DOUBLE PRECISION,
    "passCount" INTEGER NOT NULL DEFAULT 0,
    "failCount" INTEGER NOT NULL DEFAULT 0,
    "naCount" INTEGER NOT NULL DEFAULT 0,
    "findings" TEXT,
    "correctiveActions" TEXT,
    "completedAt" TIMESTAMP(3),
    "reviewedById" TEXT,
    "reviewedByName" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SOPAudit_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SOPAudit_orgId_idx" ON "SOPAudit"("orgId");
CREATE INDEX "SOPAudit_checklistId_idx" ON "SOPAudit"("checklistId");
CREATE INDEX "SOPAudit_status_idx" ON "SOPAudit"("status");
CREATE INDEX "SOPAudit_auditDate_idx" ON "SOPAudit"("auditDate");

ALTER TABLE "SOPAudit" ADD CONSTRAINT "SOPAudit_checklistId_fkey"
    FOREIGN KEY ("checklistId") REFERENCES "SOPChecklist"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- SOP Audit Responses
CREATE TABLE "SOPAuditResponse" (
    "id" TEXT NOT NULL,
    "auditId" TEXT NOT NULL,
    "checklistItemId" TEXT NOT NULL,
    "result" TEXT NOT NULL,
    "notes" TEXT,
    "evidenceRef" TEXT,
    "correctiveAction" TEXT,
    "respondedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedById" TEXT,
    "respondedByName" TEXT,

    CONSTRAINT "SOPAuditResponse_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SOPAuditResponse_auditId_idx" ON "SOPAuditResponse"("auditId");
CREATE INDEX "SOPAuditResponse_checklistItemId_idx" ON "SOPAuditResponse"("checklistItemId");

ALTER TABLE "SOPAuditResponse" ADD CONSTRAINT "SOPAuditResponse_auditId_fkey"
    FOREIGN KEY ("auditId") REFERENCES "SOPAudit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SOPAuditResponse" ADD CONSTRAINT "SOPAuditResponse_checklistItemId_fkey"
    FOREIGN KEY ("checklistItemId") REFERENCES "SOPChecklistItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
