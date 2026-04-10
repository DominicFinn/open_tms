-- CreateTable: Issue (Triage Centre)
CREATE TABLE IF NOT EXISTS "Issue" (
    "id" TEXT NOT NULL,
    "issueNumber" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "orgId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'new',
    "severity" TEXT NOT NULL DEFAULT 'medium',
    "category" TEXT,
    "shipmentId" TEXT,
    "orderId" TEXT,
    "carrierId" TEXT,
    "customerId" TEXT,
    "assigneeId" TEXT,
    "assigneeName" TEXT,
    "escalatedAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "source" TEXT NOT NULL DEFAULT 'manual',
    "sourceEventId" TEXT,
    "slaDeadline" TIMESTAMP(3),
    "slaBreach" BOOLEAN NOT NULL DEFAULT false,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Issue_pkey" PRIMARY KEY ("id")
);

-- CreateTable: IssueComment
CREATE TABLE IF NOT EXISTS "IssueComment" (
    "id" TEXT NOT NULL,
    "issueId" TEXT NOT NULL,
    "authorId" TEXT,
    "authorName" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IssueComment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Issue_issueNumber_key" ON "Issue"("issueNumber");
CREATE INDEX IF NOT EXISTS "Issue_orgId_status_idx" ON "Issue"("orgId", "status");
CREATE INDEX IF NOT EXISTS "Issue_status_idx" ON "Issue"("status");
CREATE INDEX IF NOT EXISTS "Issue_severity_idx" ON "Issue"("severity");
CREATE INDEX IF NOT EXISTS "Issue_assigneeId_idx" ON "Issue"("assigneeId");
CREATE INDEX IF NOT EXISTS "Issue_shipmentId_idx" ON "Issue"("shipmentId");
CREATE INDEX IF NOT EXISTS "Issue_orderId_idx" ON "Issue"("orderId");
CREATE INDEX IF NOT EXISTS "Issue_createdAt_idx" ON "Issue"("createdAt");
CREATE INDEX IF NOT EXISTS "IssueComment_issueId_createdAt_idx" ON "IssueComment"("issueId", "createdAt");

-- AddForeignKey
ALTER TABLE "IssueComment" ADD CONSTRAINT "IssueComment_issueId_fkey" FOREIGN KEY ("issueId") REFERENCES "Issue"("id") ON DELETE CASCADE ON UPDATE CASCADE;
