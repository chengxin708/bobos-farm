-- Fix data-safety bug: deleting a yurt was cascade-deleting every historical reservation.
-- Change Reservation → Yurt FK from CASCADE to RESTRICT.
ALTER TABLE "reservations" DROP CONSTRAINT IF EXISTS "reservations_yurtId_fkey";
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_yurtId_fkey"
  FOREIGN KEY ("yurtId") REFERENCES "yurts"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
