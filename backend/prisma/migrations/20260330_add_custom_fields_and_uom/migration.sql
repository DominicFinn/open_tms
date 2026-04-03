-- Custom Field Versioning

CREATE TABLE "CustomFieldVersion" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "description" TEXT,
    "createdBy" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CustomFieldVersion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CustomFieldDefinition" (
    "id" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "fieldKey" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "fieldType" TEXT NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "defaultValue" TEXT,
    "config" JSONB,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CustomFieldDefinition_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CustomFieldAudit" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "versionId" TEXT,
    "previousVersionId" TEXT,
    "changes" JSONB,
    "performedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CustomFieldAudit_pkey" PRIMARY KEY ("id")
);

-- Unique constraints
CREATE UNIQUE INDEX "CustomFieldVersion_entityType_version_key" ON "CustomFieldVersion"("entityType", "version");
CREATE UNIQUE INDEX "CustomFieldDefinition_versionId_fieldKey_key" ON "CustomFieldDefinition"("versionId", "fieldKey");

-- Indexes
CREATE INDEX "CustomFieldVersion_entityType_active_idx" ON "CustomFieldVersion"("entityType", "active");
CREATE INDEX "CustomFieldDefinition_versionId_idx" ON "CustomFieldDefinition"("versionId");
CREATE INDEX "CustomFieldAudit_entityType_idx" ON "CustomFieldAudit"("entityType");
CREATE INDEX "CustomFieldAudit_createdAt_idx" ON "CustomFieldAudit"("createdAt");

-- Foreign keys
ALTER TABLE "CustomFieldDefinition" ADD CONSTRAINT "CustomFieldDefinition_versionId_fkey"
    FOREIGN KEY ("versionId") REFERENCES "CustomFieldVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Add custom field columns to entity tables
ALTER TABLE "Customer" ADD COLUMN "customFieldVersionId" TEXT;
ALTER TABLE "Customer" ADD COLUMN "customFieldValues" JSONB;

ALTER TABLE "Location" ADD COLUMN "customFieldVersionId" TEXT;
ALTER TABLE "Location" ADD COLUMN "customFieldValues" JSONB;

ALTER TABLE "Shipment" ADD COLUMN "customFieldVersionId" TEXT;
ALTER TABLE "Shipment" ADD COLUMN "customFieldValues" JSONB;

ALTER TABLE "Carrier" ADD COLUMN "customFieldVersionId" TEXT;
ALTER TABLE "Carrier" ADD COLUMN "customFieldValues" JSONB;

ALTER TABLE "Order" ADD COLUMN "customFieldVersionId" TEXT;
ALTER TABLE "Order" ADD COLUMN "customFieldValues" JSONB;

-- Extended Unit of Measure on Organization
ALTER TABLE "Organization" ADD COLUMN "temperatureUnit" TEXT NOT NULL DEFAULT 'C';
ALTER TABLE "Organization" ADD COLUMN "distanceUnit" TEXT NOT NULL DEFAULT 'km';

-- Note: User-level UoM preferences are managed by the auth-service schema
