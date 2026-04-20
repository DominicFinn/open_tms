-- Standard pallet types catalogue
CREATE TABLE IF NOT EXISTS "PalletType" (
  "id"              TEXT PRIMARY KEY,
  "code"            TEXT NOT NULL,
  "name"            TEXT NOT NULL,
  "description"     TEXT,
  "lengthMm"        INTEGER NOT NULL,
  "widthMm"         INTEGER NOT NULL,
  "heightMm"        INTEGER NOT NULL,
  "tareWeightGrams" INTEGER NOT NULL,
  "maxLoadGrams"    INTEGER NOT NULL,
  "maxStackHeightMm" INTEGER,
  "material"        TEXT NOT NULL,
  "reusable"        BOOLEAN NOT NULL DEFAULT TRUE,
  "isoCertified"    BOOLEAN NOT NULL DEFAULT FALSE,
  "stackable"       BOOLEAN NOT NULL DEFAULT TRUE,
  "active"          BOOLEAN NOT NULL DEFAULT TRUE,
  "imageUrl"        TEXT,
  "orgId"           TEXT NOT NULL,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT NOW(),
  "updatedAt"       TIMESTAMP(3) NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS "PalletType_orgId_code_key" ON "PalletType"("orgId", "code");
CREATE INDEX IF NOT EXISTS "PalletType_orgId_idx" ON "PalletType"("orgId");
CREATE INDEX IF NOT EXISTS "PalletType_active_idx" ON "PalletType"("active");

-- Link pallet-type TrackableUnits to a PalletType row
ALTER TABLE "TrackableUnit" ADD COLUMN IF NOT EXISTS "palletTypeId" TEXT;
CREATE INDEX IF NOT EXISTS "TrackableUnit_palletTypeId_idx" ON "TrackableUnit"("palletTypeId");
