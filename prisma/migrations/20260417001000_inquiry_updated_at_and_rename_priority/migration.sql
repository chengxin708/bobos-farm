-- Rename enum type (Postgres global namespace cleanup)
ALTER TYPE "Priority" RENAME TO "InquiryPriority";

-- Add updatedAt to Inquiry (needed for staleness cron in M3)
ALTER TABLE "inquiries" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
