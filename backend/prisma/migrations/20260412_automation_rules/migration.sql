-- Add matchedConditions to AgentDecision (conditions extracted from LLM in unified format)
ALTER TABLE "AgentDecision" ADD COLUMN "matchedConditions" JSONB;

-- Automation Rules (deterministic rules promoted from agent decisions)
CREATE TABLE "AutomationRule" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 50,
    "eventPattern" TEXT NOT NULL,
    "conditions" JSONB NOT NULL,
    "actionType" TEXT NOT NULL,
    "actionConfig" JSONB NOT NULL,
    "sourceDecisionId" TEXT,
    "executionCount" INTEGER NOT NULL DEFAULT 0,
    "lastExecutedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AutomationRule_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AutomationExecutionLog" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "ruleName" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "actionType" TEXT NOT NULL,
    "actionResult" JSONB,
    "conditionsMatched" BOOLEAN NOT NULL,
    "evaluationMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AutomationExecutionLog_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE INDEX "AutomationRule_orgId_enabled_idx" ON "AutomationRule"("orgId", "enabled");
CREATE INDEX "AutomationRule_eventPattern_idx" ON "AutomationRule"("eventPattern");
CREATE INDEX "AutomationRule_priority_idx" ON "AutomationRule"("priority");

CREATE INDEX "AutomationExecutionLog_orgId_idx" ON "AutomationExecutionLog"("orgId");
CREATE INDEX "AutomationExecutionLog_ruleId_idx" ON "AutomationExecutionLog"("ruleId");
CREATE INDEX "AutomationExecutionLog_createdAt_idx" ON "AutomationExecutionLog"("createdAt");

-- Foreign keys
ALTER TABLE "AutomationRule" ADD CONSTRAINT "AutomationRule_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AutomationExecutionLog" ADD CONSTRAINT "AutomationExecutionLog_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "AutomationRule"("id") ON DELETE CASCADE ON UPDATE CASCADE;
