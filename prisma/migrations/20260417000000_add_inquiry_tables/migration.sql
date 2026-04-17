-- CreateEnum
CREATE TYPE "InquiryStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'AWAITING_CUSTOMER', 'CONVERTED', 'CLOSED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "Priority" AS ENUM ('NORMAL', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "InquiryCommentType" AS ENUM ('INTERNAL_NOTE', 'PHONE_LOG', 'EMAIL_LOG', 'WECHAT_LOG', 'SYSTEM');

-- CreateTable
CREATE TABLE "inquiries" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "preferredDate" DATE NOT NULL,
    "guestCountMin" INTEGER NOT NULL,
    "guestCountMax" INTEGER NOT NULL,
    "packageHint" INTEGER,
    "note" TEXT,
    "priority" "Priority" NOT NULL DEFAULT 'NORMAL',
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" "InquiryStatus" NOT NULL DEFAULT 'PENDING',
    "closedReason" TEXT,
    "assignedAdminId" TEXT,
    "reservationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "firstContactedAt" TIMESTAMP(3),
    "convertedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),

    CONSTRAINT "inquiries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inquiry_comments" (
    "id" TEXT NOT NULL,
    "inquiryId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "type" "InquiryCommentType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inquiry_comments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "inquiries_reservationId_key" ON "inquiries"("reservationId");

-- CreateIndex
CREATE INDEX "inquiries_status_createdAt_idx" ON "inquiries"("status", "createdAt");

-- CreateIndex
CREATE INDEX "inquiries_assignedAdminId_idx" ON "inquiries"("assignedAdminId");

-- CreateIndex
CREATE INDEX "inquiries_preferredDate_idx" ON "inquiries"("preferredDate");

-- CreateIndex
CREATE INDEX "inquiry_comments_inquiryId_createdAt_idx" ON "inquiry_comments"("inquiryId", "createdAt");

-- AddForeignKey
ALTER TABLE "inquiries" ADD CONSTRAINT "inquiries_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inquiries" ADD CONSTRAINT "inquiries_assignedAdminId_fkey" FOREIGN KEY ("assignedAdminId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inquiries" ADD CONSTRAINT "inquiries_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "reservations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inquiry_comments" ADD CONSTRAINT "inquiry_comments_inquiryId_fkey" FOREIGN KEY ("inquiryId") REFERENCES "inquiries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inquiry_comments" ADD CONSTRAINT "inquiry_comments_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

