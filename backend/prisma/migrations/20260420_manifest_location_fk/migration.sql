-- Add the missing Location FK on ManifestUpload so the Prisma relation can join directly
ALTER TABLE "ManifestUpload"
  ADD CONSTRAINT "ManifestUpload_locationId_fkey"
  FOREIGN KEY ("locationId") REFERENCES "Location"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
