-- AlterTable: make yurtId nullable for deferred yurt assignment
ALTER TABLE "reservations" ALTER COLUMN "yurtId" DROP NOT NULL;

-- AddColumns: tracking fields for yurt assignment workflow
ALTER TABLE "reservations" ADD COLUMN "yurtAssignedAt" TIMESTAMP(3);
ALTER TABLE "reservations" ADD COLUMN "yurtNotifiedAt" TIMESTAMP(3);

-- DropIndex: remove unique constraint on (yurtId, date) since yurtId can now be null
DROP INDEX IF EXISTS "reservations_yurtId_date_key";
