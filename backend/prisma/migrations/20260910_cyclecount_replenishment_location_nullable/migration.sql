-- Phase 2a batch 6b (#248): the two WMS models #245 missed.
--
-- CycleCount and ReplenishmentRule carry locationId without a Location relation, so they were
-- outside the list that migration built from the relation fields. Same reasoning as #245: a
-- command cannot stop writing locationId while the column is NOT NULL.

-- AlterTable
ALTER TABLE "CycleCount" ALTER COLUMN "locationId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "ReplenishmentRule" ALTER COLUMN "locationId" DROP NOT NULL;

