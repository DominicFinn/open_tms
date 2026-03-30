-- S3/Binary file storage support
-- BinaryStore: fallback storage when S3 is not configured
-- Attachment: file attachments on any entity
-- GeneratedDocument: add storageKey/storageBackend, make fileContent optional

-- BinaryStore table (database fallback for binary content)
CREATE TABLE "BinaryStore" (
    "key" TEXT NOT NULL,
    "content" BYTEA NOT NULL,
    "size" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BinaryStore_pkey" PRIMARY KEY ("key")
);

-- Attachment table (file attachments on any entity)
CREATE TABLE "Attachment" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "storageKey" TEXT NOT NULL,
    "storageBackend" TEXT NOT NULL DEFAULT 's3',
    "uploadedBy" TEXT,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Attachment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Attachment_entityType_entityId_idx" ON "Attachment"("entityType", "entityId");
CREATE INDEX "Attachment_createdAt_idx" ON "Attachment"("createdAt");

-- GeneratedDocument: add storage fields, make fileContent optional
ALTER TABLE "GeneratedDocument" ADD COLUMN "storageKey" TEXT;
ALTER TABLE "GeneratedDocument" ADD COLUMN "storageBackend" TEXT NOT NULL DEFAULT 'database';
ALTER TABLE "GeneratedDocument" ALTER COLUMN "fileContent" DROP NOT NULL;
