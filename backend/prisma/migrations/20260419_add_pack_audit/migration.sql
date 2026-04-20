CREATE TABLE IF NOT EXISTS "PackAudit" (
  "id"                        TEXT PRIMARY KEY,
  "packTaskId"                TEXT NOT NULL REFERENCES "PackTask"("id") ON DELETE CASCADE,
  "cartonCatalogueId"         TEXT,

  "expectedWeightGrams"       INTEGER NOT NULL,
  "expectedLengthMm"          INTEGER,
  "expectedWidthMm"           INTEGER,
  "expectedHeightMm"          INTEGER,

  "actualWeightGrams"         INTEGER NOT NULL,
  "actualLengthMm"            INTEGER,
  "actualWidthMm"             INTEGER,
  "actualHeightMm"            INTEGER,

  "weightVariancePercent"     DECIMAL(6,2),
  "dimWeightVariancePercent"  DECIMAL(6,2),

  "weightTolerancePercent"    DECIMAL(5,2) NOT NULL,

  "verdict"                   TEXT NOT NULL,
  "notes"                     TEXT,

  "issueId"                   TEXT,
  "auditorId"                 TEXT,
  "orgId"                     TEXT NOT NULL,
  "createdAt"                 TIMESTAMP(3) NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "PackAudit_orgId_idx" ON "PackAudit"("orgId");
CREATE INDEX IF NOT EXISTS "PackAudit_packTaskId_idx" ON "PackAudit"("packTaskId");
CREATE INDEX IF NOT EXISTS "PackAudit_verdict_idx" ON "PackAudit"("verdict");
CREATE INDEX IF NOT EXISTS "PackAudit_createdAt_idx" ON "PackAudit"("createdAt");
