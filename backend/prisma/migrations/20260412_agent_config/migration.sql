-- Agent Configuration (configurable prompts & behaviour)
CREATE TABLE "AgentConfig" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "agentType" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "subscribedEvents" JSONB,
    "activeVersionId" TEXT,
    "temperature" DOUBLE PRECISION,
    "maxTokens" INTEGER,
    "confidenceThreshold" DOUBLE PRECISION,
    "deduplicationWindowMinutes" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AgentConfig_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AgentConfigVersion" (
    "id" TEXT NOT NULL,
    "configId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "systemPrompt" TEXT NOT NULL,
    "changeNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,
    CONSTRAINT "AgentConfigVersion_pkey" PRIMARY KEY ("id")
);

-- Add config traceability to AgentDecision
ALTER TABLE "AgentDecision" ADD COLUMN "agentConfigId" TEXT;
ALTER TABLE "AgentDecision" ADD COLUMN "promptVersionId" TEXT;

-- Indexes
CREATE INDEX "AgentConfig_orgId_idx" ON "AgentConfig"("orgId");
CREATE INDEX "AgentConfig_agentType_idx" ON "AgentConfig"("agentType");
CREATE UNIQUE INDEX "AgentConfig_orgId_agentType_key" ON "AgentConfig"("orgId", "agentType");

CREATE INDEX "AgentConfigVersion_configId_idx" ON "AgentConfigVersion"("configId");
CREATE UNIQUE INDEX "AgentConfigVersion_configId_versionNumber_key" ON "AgentConfigVersion"("configId", "versionNumber");

-- Foreign keys
ALTER TABLE "AgentConfig" ADD CONSTRAINT "AgentConfig_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AgentConfigVersion" ADD CONSTRAINT "AgentConfigVersion_configId_fkey" FOREIGN KEY ("configId") REFERENCES "AgentConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;
