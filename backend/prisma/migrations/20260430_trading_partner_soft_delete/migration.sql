-- Add soft-delete columns to TradingPartner so deletes preserve a trace.

ALTER TABLE "TradingPartner"
  ADD COLUMN "deletedAt" TIMESTAMP(3),
  ADD COLUMN "deletedBy" TEXT;

CREATE INDEX "TradingPartner_deletedAt_idx" ON "TradingPartner"("deletedAt");
