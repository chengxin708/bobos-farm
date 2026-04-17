-- Create link table
CREATE TABLE "reservation_yurts" (
    "id" TEXT NOT NULL,
    "reservationId" TEXT NOT NULL,
    "yurtId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reservation_yurts_pkey" PRIMARY KEY ("id")
);

-- Unique composite constraint
CREATE UNIQUE INDEX "reservation_yurts_reservationId_yurtId_key" ON "reservation_yurts"("reservationId", "yurtId");

-- Secondary index for yurt-side queries
CREATE INDEX "reservation_yurts_yurtId_idx" ON "reservation_yurts"("yurtId");

-- FK: reservation
ALTER TABLE "reservation_yurts" ADD CONSTRAINT "reservation_yurts_reservationId_fkey"
  FOREIGN KEY ("reservationId") REFERENCES "reservations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- FK: yurt
ALTER TABLE "reservation_yurts" ADD CONSTRAINT "reservation_yurts_yurtId_fkey"
  FOREIGN KEY ("yurtId") REFERENCES "yurts"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
