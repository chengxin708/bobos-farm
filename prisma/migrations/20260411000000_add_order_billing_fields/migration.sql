-- AlterEnum
ALTER TYPE "OrderStatus" ADD VALUE 'BILLED';
ALTER TYPE "OrderStatus" ADD VALUE 'PAID';

-- AlterTable
ALTER TABLE "orders" ADD COLUMN "finalTotal" DECIMAL(65,30),
ADD COLUMN "discount" DECIMAL(65,30) DEFAULT 0,
ADD COLUMN "paymentMethod" TEXT,
ADD COLUMN "paidAt" TIMESTAMP(3);
