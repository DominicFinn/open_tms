-- Cold Chain Profiles removed: temperature/humidity ranges now always derive
-- from order temperatureControl defaults (see ColdChainService.TEMP_DEFAULTS).

-- DropForeignKey
ALTER TABLE "Shipment" DROP CONSTRAINT "Shipment_coldChainProfileId_fkey";

-- AlterTable
ALTER TABLE "Shipment" DROP COLUMN "coldChainProfileId";

-- DropTable
DROP TABLE "ColdChainProfile";
