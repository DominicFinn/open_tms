-- Add LLM configuration to Organization
ALTER TABLE "Organization" ADD COLUMN "llmProvider" TEXT;
ALTER TABLE "Organization" ADD COLUMN "llmApiKey" TEXT;
ALTER TABLE "Organization" ADD COLUMN "llmModel" TEXT;
ALTER TABLE "Organization" ADD COLUMN "llmEnabled" BOOLEAN NOT NULL DEFAULT false;

-- Add token usage tracking to AgentDecision
ALTER TABLE "AgentDecision" ADD COLUMN "inputTokens" INTEGER;
ALTER TABLE "AgentDecision" ADD COLUMN "outputTokens" INTEGER;
ALTER TABLE "AgentDecision" ADD COLUMN "durationMs" INTEGER;

-- Add token usage tracking to AgentDecisionReadModel
ALTER TABLE "AgentDecisionReadModel" ADD COLUMN "inputTokens" INTEGER;
ALTER TABLE "AgentDecisionReadModel" ADD COLUMN "outputTokens" INTEGER;
ALTER TABLE "AgentDecisionReadModel" ADD COLUMN "durationMs" INTEGER;
