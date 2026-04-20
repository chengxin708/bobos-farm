-- Step 0: Safety backfill — ensure every reservation with a yurtId
-- has a matching reservation_yurts row. The original backfill ran on
-- 2026-04-17; reservations created since then don't have rows yet
-- because nothing in the code currently writes to this table.
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
    WHERE "reservationId" = reservations.id
      AND "yurtId" = reservations."yurtId"
  );

-- Step 1: Add nullable column
ALTER TABLE "orders" ADD COLUMN "reservationYurtId" TEXT;

-- Step 2: Backfill orders → their reservation's unique reservation_yurts row
UPDATE "orders" o
SET "reservationYurtId" = ry.id
FROM "reservation_yurts" ry
WHERE ry."reservationId" = o."reservationId"
  AND o."reservationYurtId" IS NULL;

-- Step 3: Enforce NOT NULL (fails loudly if any order still unmatched — shouldn't happen
-- because every reservation with an order must have had a yurtId assigned)
ALTER TABLE "orders" ALTER COLUMN "reservationYurtId" SET NOT NULL;

-- Step 4: Unique (each reservation_yurts row has at most one order)
CREATE UNIQUE INDEX "orders_reservationYurtId_key" ON "orders"("reservationYurtId");

-- Step 5: FK to reservation_yurts (cascade when yurt assignment is deleted)
ALTER TABLE "orders" ADD CONSTRAINT "orders_reservationYurtId_fkey"
  FOREIGN KEY ("reservationYurtId") REFERENCES "reservation_yurts"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- Step 6: Drop old unique on reservationId (Orders are now N-per-reservation)
DROP INDEX "orders_reservationId_key";

-- Step 7: Replace with regular lookup index
CREATE INDEX "orders_reservationId_idx" ON "orders"("reservationId");
