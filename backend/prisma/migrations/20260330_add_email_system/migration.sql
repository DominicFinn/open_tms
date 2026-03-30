-- Add email configuration to Organization
ALTER TABLE "Organization" ADD COLUMN "emailProvider" TEXT NOT NULL DEFAULT 'console';
ALTER TABLE "Organization" ADD COLUMN "smtpHost" TEXT;
ALTER TABLE "Organization" ADD COLUMN "smtpPort" INTEGER;
ALTER TABLE "Organization" ADD COLUMN "smtpSecure" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Organization" ADD COLUMN "smtpUser" TEXT;
ALTER TABLE "Organization" ADD COLUMN "smtpPassword" TEXT;
ALTER TABLE "Organization" ADD COLUMN "emailFromAddress" TEXT;
ALTER TABLE "Organization" ADD COLUMN "emailFromName" TEXT;
ALTER TABLE "Organization" ADD COLUMN "emailEnabled" BOOLEAN NOT NULL DEFAULT false;

-- Create EmailTemplate table
CREATE TABLE "EmailTemplate" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "description" TEXT,
    "subject" TEXT NOT NULL,
    "htmlBody" TEXT NOT NULL,
    "textBody" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailTemplate_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE INDEX "EmailTemplate_eventType_idx" ON "EmailTemplate"("eventType");
CREATE UNIQUE INDEX "EmailTemplate_organizationId_eventType_key" ON "EmailTemplate"("organizationId", "eventType");

-- Foreign key
ALTER TABLE "EmailTemplate" ADD CONSTRAINT "EmailTemplate_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
