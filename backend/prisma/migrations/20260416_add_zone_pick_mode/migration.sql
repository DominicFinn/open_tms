-- Zone Pick Mode (sequential / parallel) for zone picking strategy

ALTER TABLE "WaveTemplate" ADD COLUMN IF NOT EXISTS "zonePickMode" TEXT;
ALTER TABLE "Wave" ADD COLUMN IF NOT EXISTS "zonePickMode" TEXT;
ALTER TABLE "PickTask" ADD COLUMN IF NOT EXISTS "zoneSequence" INTEGER;
ALTER TABLE "PickTask" ADD COLUMN IF NOT EXISTS "startedAt" TIMESTAMP(3);
ALTER TABLE "PickTask" ADD COLUMN IF NOT EXISTS "completedAt" TIMESTAMP(3);
