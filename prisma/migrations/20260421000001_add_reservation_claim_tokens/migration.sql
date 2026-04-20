-- CreateTable
CREATE TABLE "reservation_claim_tokens" (
    "id" TEXT NOT NULL,
    "reservationId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "consumedAt" TIMESTAMP(3),
    "consumedByUserId" TEXT,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "reservation_claim_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "reservation_claim_tokens_token_key" ON "reservation_claim_tokens"("token");

-- CreateIndex
CREATE INDEX "reservation_claim_tokens_reservationId_idx" ON "reservation_claim_tokens"("reservationId");

-- AddForeignKey
ALTER TABLE "reservation_claim_tokens" ADD CONSTRAINT "reservation_claim_tokens_reservationId_fkey"
  FOREIGN KEY ("reservationId") REFERENCES "reservations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
