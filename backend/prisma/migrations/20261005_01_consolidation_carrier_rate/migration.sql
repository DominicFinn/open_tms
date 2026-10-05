-- The carrier's rate for a whole consolidation, in integer cents, allocated to its shipments by
-- weight (#329). Consolidation stays an authoritative mutable row; no index change.

-- AlterTable
ALTER TABLE "Consolidation" ADD COLUMN     "carrierRateCents" INTEGER,
ADD COLUMN     "currency" TEXT NOT NULL DEFAULT 'USD';

