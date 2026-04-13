-- EDI Log Consolidation Migration
-- Makes partnerId optional on EdiTransactionLog and adds fields to replace EdiFile model

-- Make partnerId nullable (for manual imports without a trading partner)
ALTER TABLE "EdiTransactionLog" ALTER COLUMN "partnerId" DROP NOT NULL;

-- Add default to transport (was required, now has default for API/manual entries)
ALTER TABLE "EdiTransactionLog" ALTER COLUMN "transport" SET DEFAULT 'api';

-- Add parse result fields (replaces EdiFile.parsedData)
ALTER TABLE "EdiTransactionLog" ADD COLUMN "parsedData" JSONB;
ALTER TABLE "EdiTransactionLog" ADD COLUMN "transactionCount" INTEGER NOT NULL DEFAULT 0;

-- Add entity tracking fields (replaces EdiFile.ordersCreated/orderIds)
ALTER TABLE "EdiTransactionLog" ADD COLUMN "entitiesCreated" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "EdiTransactionLog" ADD COLUMN "entityIds" JSONB;
ALTER TABLE "EdiTransactionLog" ADD COLUMN "source" TEXT NOT NULL DEFAULT 'api';

-- Add invoice linking fields
ALTER TABLE "EdiTransactionLog" ADD COLUMN "invoiceId" TEXT;
ALTER TABLE "EdiTransactionLog" ADD COLUMN "invoiceNumber" TEXT;

-- Add index on source
CREATE INDEX "EdiTransactionLog_source_idx" ON "EdiTransactionLog"("source");
