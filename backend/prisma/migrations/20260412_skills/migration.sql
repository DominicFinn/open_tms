-- Skill Configuration (org-level setup for skills that need API keys etc.)
CREATE TABLE "SkillConfig" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "skillType" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "config" JSONB NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SkillConfig_pkey" PRIMARY KEY ("id")
);

-- Skill Chains (reusable action sequences with branching)
CREATE TABLE "SkillChain" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "steps" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SkillChain_pkey" PRIMARY KEY ("id")
);

-- Add skill chain support to AutomationRule
ALTER TABLE "AutomationRule" ADD COLUMN "skillChainId" TEXT;
ALTER TABLE "AutomationRule" ADD COLUMN "inlineSteps" JSONB;

-- Indexes
CREATE INDEX "SkillConfig_orgId_idx" ON "SkillConfig"("orgId");
CREATE INDEX "SkillConfig_skillType_idx" ON "SkillConfig"("skillType");
CREATE UNIQUE INDEX "SkillConfig_orgId_skillType_name_key" ON "SkillConfig"("orgId", "skillType", "name");

CREATE INDEX "SkillChain_orgId_idx" ON "SkillChain"("orgId");

-- Foreign keys
ALTER TABLE "SkillConfig" ADD CONSTRAINT "SkillConfig_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SkillChain" ADD CONSTRAINT "SkillChain_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
