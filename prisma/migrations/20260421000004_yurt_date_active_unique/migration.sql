-- Prevent two active reservations from holding the same (yurtId, date).
-- Partial so it ignores cancelled/expired rows and NULL yurtId (pending
-- admin holds). Concurrent POSTs that race past the code-level conflict
-- check will be blocked here with a Prisma P2002 error (caught in the
-- API layer and converted to HTTP 409).
CREATE UNIQUE INDEX IF NOT EXISTS "reservation_yurt_date_active"
  ON "reservations" ("yurtId", "date")
  WHERE "status" NOT IN ('CANCELLED', 'CANCELLED_PENDING_REFUND', 'EXPIRED')
    AND "yurtId" IS NOT NULL;
