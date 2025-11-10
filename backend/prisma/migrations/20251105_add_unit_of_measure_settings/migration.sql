-- AlterTable
ALTER TABLE "Organization" ADD COLUMN "weightUnit" TEXT NOT NULL DEFAULT 'kg';
ALTER TABLE "Organization" ADD COLUMN "dimUnit" TEXT NOT NULL DEFAULT 'cm';
