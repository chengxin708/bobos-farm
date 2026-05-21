-- Drop redundant non-unique index on quick_receipts.token
-- (token already has UNIQUE constraint via @unique which creates quick_receipts_token_key)
DROP INDEX IF EXISTS "quick_receipts_token_idx";
