ALTER TABLE "WaveTemplate" ADD COLUMN IF NOT EXISTS "lastAutoReleasedAt" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "WaveTemplate_autoRelease_active_idx" ON "WaveTemplate"("autoRelease", "active");
