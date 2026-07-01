-- Cold chain profiles no longer exist; these columns are a snapshot of the
-- shipment's effective range at capture time, not a named profile.

-- AlterTable
ALTER TABLE "ImmutableTemperatureLog" RENAME COLUMN "profileMinTemp" TO "effectiveMinTemp";
ALTER TABLE "ImmutableTemperatureLog" RENAME COLUMN "profileMaxTemp" TO "effectiveMaxTemp";
ALTER TABLE "ImmutableTemperatureLog" RENAME COLUMN "profileAlertMinTemp" TO "effectiveAlertMinTemp";
ALTER TABLE "ImmutableTemperatureLog" RENAME COLUMN "profileAlertMaxTemp" TO "effectiveAlertMaxTemp";
ALTER TABLE "ImmutableTemperatureLog" DROP COLUMN "profileName";
