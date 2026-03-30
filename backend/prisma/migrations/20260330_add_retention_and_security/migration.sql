-- Add retention expiry to Attachment
ALTER TABLE "Attachment" ADD COLUMN "retentionExpiresAt" TIMESTAMP(3);

-- Add retention expiry to GeneratedDocument
ALTER TABLE "GeneratedDocument" ADD COLUMN "retentionExpiresAt" TIMESTAMP(3);

-- Set default retention of 10 years for existing records
UPDATE "Attachment" SET "retentionExpiresAt" = "createdAt" + INTERVAL '10 years' WHERE "retentionExpiresAt" IS NULL;
UPDATE "GeneratedDocument" SET "retentionExpiresAt" = "createdAt" + INTERVAL '10 years' WHERE "retentionExpiresAt" IS NULL;

-- Index for retention cleanup queries
CREATE INDEX "Attachment_retentionExpiresAt_idx" ON "Attachment"("retentionExpiresAt");
CREATE INDEX "GeneratedDocument_retentionExpiresAt_idx" ON "GeneratedDocument"("retentionExpiresAt");
