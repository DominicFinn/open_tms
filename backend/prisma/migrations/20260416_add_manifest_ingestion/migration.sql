-- Manifest Ingestion for WMS Receiving

CREATE TABLE IF NOT EXISTS "ManifestTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "headerChecksum" TEXT NOT NULL,
    "columnMapping" JSONB NOT NULL,
    "fileType" TEXT NOT NULL DEFAULT 'csv',
    "delimiter" TEXT,
    "hasHeaderRow" BOOLEAN NOT NULL DEFAULT true,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "orgId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ManifestTemplate_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ManifestTemplate_orgId_headerChecksum_key" ON "ManifestTemplate"("orgId", "headerChecksum");
CREATE INDEX IF NOT EXISTS "ManifestTemplate_orgId_idx" ON "ManifestTemplate"("orgId");

CREATE TABLE IF NOT EXISTS "ManifestUpload" (
    "id" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileStorageKey" TEXT,
    "status" TEXT NOT NULL DEFAULT 'uploaded',
    "templateId" TEXT,
    "receivingTaskId" TEXT,
    "totalRows" INTEGER NOT NULL DEFAULT 0,
    "processedRows" INTEGER NOT NULL DEFAULT 0,
    "errorRows" INTEGER NOT NULL DEFAULT 0,
    "errors" JSONB,
    "detectedHeaders" JSONB,
    "supplierName" TEXT,
    "reference" TEXT,
    "orgId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ManifestUpload_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ManifestUpload_orgId_idx" ON "ManifestUpload"("orgId");
CREATE INDEX IF NOT EXISTS "ManifestUpload_locationId_idx" ON "ManifestUpload"("locationId");
CREATE INDEX IF NOT EXISTS "ManifestUpload_status_idx" ON "ManifestUpload"("status");

ALTER TABLE "ManifestUpload" ADD CONSTRAINT "ManifestUpload_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "ManifestTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
