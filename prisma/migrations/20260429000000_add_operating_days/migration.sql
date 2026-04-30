-- CreateEnum
CREATE TYPE "OperatingDayMode" AS ENUM ('OPEN', 'PRIVATE_EVENT', 'CLOSED');

-- CreateTable
CREATE TABLE "operating_day" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "mode" "OperatingDayMode" NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,

    CONSTRAINT "operating_day_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "operating_day_date_key" ON "operating_day"("date");
