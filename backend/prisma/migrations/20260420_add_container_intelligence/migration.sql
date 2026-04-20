-- Container intelligence fields on CartonCatalogue
ALTER TABLE "CartonCatalogue" ADD COLUMN IF NOT EXISTS "temperatureZone" TEXT NOT NULL DEFAULT 'any';
ALTER TABLE "CartonCatalogue" ADD COLUMN IF NOT EXISTS "insulated" BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE "CartonCatalogue" ADD COLUMN IF NOT EXISTS "insulationHours" INTEGER;
ALTER TABLE "CartonCatalogue" ADD COLUMN IF NOT EXISTS "tamperEvident" BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE "CartonCatalogue" ADD COLUMN IF NOT EXISTS "valueClass" TEXT NOT NULL DEFAULT 'any';
ALTER TABLE "CartonCatalogue" ADD COLUMN IF NOT EXISTS "hazmatRated" BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE "CartonCatalogue" ADD COLUMN IF NOT EXISTS "hazmatClasses" TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE "CartonCatalogue" ADD COLUMN IF NOT EXISTS "materialType" TEXT NOT NULL DEFAULT 'corrugated';

CREATE INDEX IF NOT EXISTS "CartonCatalogue_active_idx" ON "CartonCatalogue"("active");
CREATE INDEX IF NOT EXISTS "CartonCatalogue_temperatureZone_idx" ON "CartonCatalogue"("temperatureZone");
