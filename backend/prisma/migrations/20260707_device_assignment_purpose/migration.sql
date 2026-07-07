-- Informational tag describing why a device is attached to a shipment/order
-- (cargo_condition | security | location | general). Doesn't affect alerting.

-- AlterTable
ALTER TABLE "DeviceAssignment" ADD COLUMN "purpose" TEXT;
