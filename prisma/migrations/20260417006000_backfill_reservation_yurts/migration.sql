-- Backfill 1: Every Reservation with yurtId gets a ReservationYurt row
INSERT INTO "reservation_yurts" ("id", "reservationId", "yurtId", "sortOrder", "createdAt")
SELECT
  'ry_' || substr(md5(random()::text || clock_timestamp()::text), 1, 24),
  id,
  "yurtId",
  0,
  NOW()
FROM reservations
WHERE "yurtId" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "reservation_yurts"
    WHERE "reservationId" = reservations.id AND "yurtId" = reservations."yurtId"
  );

-- Backfill 2: Existing reservations get packageCount = 1
UPDATE reservations SET "packageCount" = 1 WHERE "packageCount" IS NULL;
