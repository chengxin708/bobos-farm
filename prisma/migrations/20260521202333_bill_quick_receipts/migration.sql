-- Migration: bill_quick_receipts
-- Creates quick_receipts and quick_receipt_items tables for the bill subdomain

-- CreateTable
CREATE TABLE "quick_receipts" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "customerPhone" TEXT,
    "notes" TEXT,
    "taxRate" DOUBLE PRECISION NOT NULL,
    "subtotalCents" INTEGER NOT NULL,
    "discountCents" INTEGER NOT NULL DEFAULT 0,
    "taxCents" INTEGER NOT NULL,
    "totalCents" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quick_receipts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quick_receipt_items" (
    "id" TEXT NOT NULL,
    "receiptId" TEXT NOT NULL,
    "menuItemId" TEXT,
    "nameEnSnap" TEXT NOT NULL,
    "nameZhSnap" TEXT,
    "priceCents" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "quick_receipt_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "quick_receipts_token_key" ON "quick_receipts"("token");

-- CreateIndex
CREATE INDEX "quick_receipts_createdAt_idx" ON "quick_receipts"("createdAt");

-- CreateIndex
CREATE INDEX "quick_receipts_token_idx" ON "quick_receipts"("token");

-- CreateIndex
CREATE INDEX "quick_receipt_items_receiptId_idx" ON "quick_receipt_items"("receiptId");

-- AddForeignKey
ALTER TABLE "quick_receipt_items" ADD CONSTRAINT "quick_receipt_items_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES "quick_receipts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
