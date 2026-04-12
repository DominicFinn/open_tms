-- SLA System: Service Level Agreement policies, rules, and evaluation tracking

-- SLA Policy: named collection of SLA rules, scoped to org or specific customer
CREATE TABLE "SlaPolicy" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "customerId" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SlaPolicy_pkey" PRIMARY KEY ("id")
);

-- SLA Rule: individual threshold within a policy
CREATE TABLE "SlaRule" (
    "id" TEXT NOT NULL,
    "policyId" TEXT NOT NULL,
    "ruleType" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "warningThresholdMinutes" INTEGER,
    "breachThresholdMinutes" INTEGER,
    "criticalThresholdMinutes" INTEGER,
    "issuePriority" TEXT,
    "issueCategory" TEXT,
    "maxDeliveryMinutes" INTEGER,
    "maxDwellMinutes" INTEGER,
    "dwellLocationType" TEXT,
    "maxOccurrences" INTEGER,
    "maxExcursionMinutes" INTEGER,
    "autoCreateIssue" BOOLEAN NOT NULL DEFAULT true,
    "issuePriorityOnBreach" TEXT NOT NULL DEFAULT 'high',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SlaRule_pkey" PRIMARY KEY ("id")
);

-- SLA Evaluation: tracks each individual SLA check against a specific entity
CREATE TABLE "SlaEvaluation" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "ruleType" TEXT NOT NULL,
    "ruleName" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "entityReference" TEXT,
    "policyId" TEXT NOT NULL,
    "customerId" TEXT,
    "slaStartedAt" TIMESTAMP(3) NOT NULL,
    "slaDueAt" TIMESTAMP(3),
    "warningAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'active',
    "remainingMinutes" INTEGER,
    "breachedAt" TIMESTAMP(3),
    "breachDurationMinutes" INTEGER,
    "metAt" TIMESTAMP(3),
    "issueId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SlaEvaluation_pkey" PRIMARY KEY ("id")
);

-- Indexes for SlaPolicy
CREATE INDEX "SlaPolicy_orgId_idx" ON "SlaPolicy"("orgId");
CREATE INDEX "SlaPolicy_customerId_idx" ON "SlaPolicy"("customerId");
CREATE UNIQUE INDEX "SlaPolicy_orgId_customerId_key" ON "SlaPolicy"("orgId", "customerId");

-- Indexes for SlaRule
CREATE INDEX "SlaRule_policyId_idx" ON "SlaRule"("policyId");
CREATE INDEX "SlaRule_ruleType_idx" ON "SlaRule"("ruleType");

-- Indexes for SlaEvaluation
CREATE INDEX "SlaEvaluation_orgId_idx" ON "SlaEvaluation"("orgId");
CREATE INDEX "SlaEvaluation_entityType_entityId_idx" ON "SlaEvaluation"("entityType", "entityId");
CREATE INDEX "SlaEvaluation_status_idx" ON "SlaEvaluation"("status");
CREATE INDEX "SlaEvaluation_slaDueAt_idx" ON "SlaEvaluation"("slaDueAt");
CREATE INDEX "SlaEvaluation_customerId_idx" ON "SlaEvaluation"("customerId");
CREATE INDEX "SlaEvaluation_ruleType_idx" ON "SlaEvaluation"("ruleType");
CREATE UNIQUE INDEX "SlaEvaluation_ruleId_entityType_entityId_key" ON "SlaEvaluation"("ruleId", "entityType", "entityId");

-- Foreign keys
ALTER TABLE "SlaPolicy" ADD CONSTRAINT "SlaPolicy_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SlaRule" ADD CONSTRAINT "SlaRule_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "SlaPolicy"("id") ON DELETE CASCADE ON UPDATE CASCADE;
