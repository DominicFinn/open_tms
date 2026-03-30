-- Add document template and generated document models
-- Also add BOL sequence counter to Organization

-- DocumentTemplate
CREATE TABLE "DocumentTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "documentType" TEXT NOT NULL,
    "description" TEXT,
    "htmlTemplate" TEXT NOT NULL,
    "config" JSONB,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocumentTemplate_pkey" PRIMARY KEY ("id")
);

-- GeneratedDocument
CREATE TABLE "GeneratedDocument" (
    "id" TEXT NOT NULL,
    "documentType" TEXT NOT NULL,
    "documentNumber" TEXT,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL DEFAULT 'application/pdf',
    "fileSize" INTEGER,
    "fileContent" BYTEA NOT NULL,
    "templateId" TEXT,
    "shipmentId" TEXT,
    "orderId" TEXT,
    "carrierId" TEXT,
    "customerId" TEXT,
    "generatedBy" TEXT,
    "metadata" JSONB,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GeneratedDocument_pkey" PRIMARY KEY ("id")
);

-- Add BOL sequence number to Organization
ALTER TABLE "Organization" ADD COLUMN "bolSequenceNumber" INTEGER NOT NULL DEFAULT 0;

-- Indexes
CREATE INDEX "DocumentTemplate_documentType_idx" ON "DocumentTemplate"("documentType");
CREATE INDEX "DocumentTemplate_active_idx" ON "DocumentTemplate"("active");
CREATE INDEX "GeneratedDocument_shipmentId_idx" ON "GeneratedDocument"("shipmentId");
CREATE INDEX "GeneratedDocument_orderId_idx" ON "GeneratedDocument"("orderId");
CREATE INDEX "GeneratedDocument_carrierId_idx" ON "GeneratedDocument"("carrierId");
CREATE INDEX "GeneratedDocument_customerId_idx" ON "GeneratedDocument"("customerId");
CREATE INDEX "GeneratedDocument_documentType_idx" ON "GeneratedDocument"("documentType");
CREATE INDEX "GeneratedDocument_createdAt_idx" ON "GeneratedDocument"("createdAt");

-- Foreign key
ALTER TABLE "GeneratedDocument" ADD CONSTRAINT "GeneratedDocument_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "DocumentTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
