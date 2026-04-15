-- Customer Portal: CustomerUser model for customer self-service access

CREATE TABLE IF NOT EXISTS "CustomerUser" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'viewer',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerUser_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "CustomerUser_email_key" ON "CustomerUser"("email");
CREATE INDEX IF NOT EXISTS "CustomerUser_customerId_idx" ON "CustomerUser"("customerId");
CREATE INDEX IF NOT EXISTS "CustomerUser_email_idx" ON "CustomerUser"("email");

ALTER TABLE "CustomerUser" DROP CONSTRAINT IF EXISTS "CustomerUser_customerId_fkey";
ALTER TABLE "CustomerUser" ADD CONSTRAINT "CustomerUser_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
