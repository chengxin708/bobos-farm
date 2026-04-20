-- AlterTable
ALTER TABLE "users" ADD COLUMN "mergedIntoUserId" TEXT;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_mergedIntoUserId_fkey"
  FOREIGN KEY ("mergedIntoUserId") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
