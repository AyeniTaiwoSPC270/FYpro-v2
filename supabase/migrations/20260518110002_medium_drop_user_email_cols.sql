-- Migration: medium_drop_user_email_cols
-- Severity: MEDIUM (M4)
-- Problem: generation_failures.user_email and payment_issues.user_email store
--          plaintext email addresses. Emails are PII and should never be stored
--          when user_id already exists as a lookup key. No SELECT policy exists
--          for clients on either table, but the data appears in DB exports,
--          backups, and any Supabase dashboard access — violating data minimisation.
-- Fix: Drop both columns. Admin queries that need the email JOIN to auth.users
--      via user_id through service_role. The email is still used at runtime
--      in Resend/Telegram alerts — just not persisted to the database.
-- Code change: api/admin.js line ~1000 removes user_email from the
--              payment_issues insert (handled separately in the same commit).

ALTER TABLE public.generation_failures
  DROP COLUMN IF EXISTS user_email;

ALTER TABLE public.payment_issues
  DROP COLUMN IF EXISTS user_email;

-- ── Verification ──────────────────────────────────────────────────────────────
-- SELECT table_name, column_name
-- FROM information_schema.columns
-- WHERE table_schema = 'public'
--   AND table_name IN ('generation_failures','payment_issues')
--   AND column_name = 'user_email';
-- Expected: zero rows.
