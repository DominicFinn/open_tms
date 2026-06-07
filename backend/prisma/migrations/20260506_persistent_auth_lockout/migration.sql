-- Persist auth lockout state to the DB so that failed login attempts and lockout
-- windows survive process restarts and stay consistent across horizontally
-- scaled instances. The User model already had these columns; mirror them on
-- CarrierUser and CustomerUser.

ALTER TABLE "CarrierUser"
  ADD COLUMN "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "lockedUntil" TIMESTAMP(3);

ALTER TABLE "CustomerUser"
  ADD COLUMN "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "lockedUntil" TIMESTAMP(3);
