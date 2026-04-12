-- CreateTable
CREATE TABLE "AgentDecision" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "agentType" TEXT NOT NULL,
    "modelProvider" TEXT,
    "modelId" TEXT,
    "triggerType" TEXT NOT NULL,
    "triggerEventType" TEXT,
    "triggerEventId" TEXT,
    "entityType" TEXT,
    "entityId" TEXT,
    "summary" TEXT NOT NULL,
    "reasoning" TEXT NOT NULL,
    "context" JSONB NOT NULL,
    "conversationLog" JSONB,
    "confidence" DOUBLE PRECISION,
    "actionType" TEXT NOT NULL,
    "actionPayload" JSONB,
    "actionEntityType" TEXT,
    "actionEntityId" TEXT,
    "outcomeStatus" TEXT NOT NULL DEFAULT 'pending',
    "outcomeNotes" TEXT,
    "outcomeRecordedAt" TIMESTAMP(3),
    "outcomeRecordedBy" TEXT,
    "promotedToAutomation" BOOLEAN NOT NULL DEFAULT false,
    "promotedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgentDecision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentDecisionReadModel" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "agentType" TEXT NOT NULL,
    "modelProvider" TEXT,
    "modelId" TEXT,
    "triggerType" TEXT NOT NULL,
    "triggerEventType" TEXT,
    "entityType" TEXT,
    "entityId" TEXT,
    "summary" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION,
    "actionType" TEXT NOT NULL,
    "actionEntityType" TEXT,
    "actionEntityId" TEXT,
    "outcomeStatus" TEXT NOT NULL DEFAULT 'pending',
    "promotedToAutomation" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgentDecisionReadModel_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AgentDecision_orgId_idx" ON "AgentDecision"("orgId");
CREATE INDEX "AgentDecision_agentType_idx" ON "AgentDecision"("agentType");
CREATE INDEX "AgentDecision_entityType_entityId_idx" ON "AgentDecision"("entityType", "entityId");
CREATE INDEX "AgentDecision_actionType_idx" ON "AgentDecision"("actionType");
CREATE INDEX "AgentDecision_outcomeStatus_idx" ON "AgentDecision"("outcomeStatus");
CREATE INDEX "AgentDecision_triggerEventType_idx" ON "AgentDecision"("triggerEventType");
CREATE INDEX "AgentDecision_createdAt_idx" ON "AgentDecision"("createdAt");
CREATE INDEX "AgentDecision_promotedToAutomation_idx" ON "AgentDecision"("promotedToAutomation");

CREATE INDEX "AgentDecisionReadModel_orgId_idx" ON "AgentDecisionReadModel"("orgId");
CREATE INDEX "AgentDecisionReadModel_agentType_idx" ON "AgentDecisionReadModel"("agentType");
CREATE INDEX "AgentDecisionReadModel_actionType_idx" ON "AgentDecisionReadModel"("actionType");
CREATE INDEX "AgentDecisionReadModel_outcomeStatus_idx" ON "AgentDecisionReadModel"("outcomeStatus");
CREATE INDEX "AgentDecisionReadModel_createdAt_idx" ON "AgentDecisionReadModel"("createdAt");

-- AddForeignKey
ALTER TABLE "AgentDecision" ADD CONSTRAINT "AgentDecision_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AgentDecisionReadModel" ADD CONSTRAINT "AgentDecisionReadModel_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
