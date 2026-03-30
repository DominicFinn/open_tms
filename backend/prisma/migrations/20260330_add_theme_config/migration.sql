-- Theme & Branding on Organization
ALTER TABLE "Organization" ADD COLUMN "logoStorageKey" TEXT;
ALTER TABLE "Organization" ADD COLUMN "logoMimeType" TEXT;
ALTER TABLE "Organization" ADD COLUMN "themeConfig" JSONB;
ALTER TABLE "Organization" ADD COLUMN "themeUpdatedAt" TIMESTAMP(3);
