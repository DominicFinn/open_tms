-- Add soft-delete columns to Comment so author/admin deletes preserve a trace.

ALTER TABLE "Comment"
  ADD COLUMN "deletedAt" TIMESTAMP(3),
  ADD COLUMN "deletedBy" TEXT;

CREATE INDEX "Comment_deletedAt_idx" ON "Comment"("deletedAt");
