-- Informational tag describing what a lane stop is for
-- (pickup | dropoff | cross_dock | fuel | rest | hub | customs | other).
-- Doesn't affect routing/rating.

ALTER TABLE "LaneStop" ADD COLUMN "purpose" TEXT;
