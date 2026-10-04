-- A device can be assigned to a consolidation; its pings fan out to every shipment on it (#329).
--
-- DeviceAssignment (authoritative mutable, low write rate) goes from 3 to 4 secondary indexes.
-- (consolidationId) serves listing a consolidation's devices (ConsolidationRepository.findDetail,
-- reconcileDevices) and the SET NULL FK; no existing index leads with it. Ping resolution still
-- uses (deviceId, active).

-- AlterTable
ALTER TABLE "DeviceAssignment" ADD COLUMN     "consolidationId" TEXT;

-- CreateIndex
CREATE INDEX "DeviceAssignment_consolidationId_idx" ON "DeviceAssignment"("consolidationId");

-- AddForeignKey
ALTER TABLE "DeviceAssignment" ADD CONSTRAINT "DeviceAssignment_consolidationId_fkey" FOREIGN KEY ("consolidationId") REFERENCES "Consolidation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

