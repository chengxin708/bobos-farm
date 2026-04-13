-- AlterTable
ALTER TABLE "users" ADD COLUMN "marketingOptIn" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "users" ADD COLUMN "unsubscribeToken" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "users_unsubscribeToken_key" ON "users"("unsubscribeToken");
