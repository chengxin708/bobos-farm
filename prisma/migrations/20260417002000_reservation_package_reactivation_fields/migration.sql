-- Add package-based pricing field
ALTER TABLE "reservations" ADD COLUMN "packageCount" INTEGER;

-- Add re-activation tracking for expired admin holds
ALTER TABLE "reservations" ADD COLUMN "reactivatedAt" TIMESTAMP(3);
ALTER TABLE "reservations" ADD COLUMN "reactivatedByUserId" TEXT;

-- FK for re-activator
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_reactivatedByUserId_fkey"
  FOREIGN KEY ("reactivatedByUserId") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
