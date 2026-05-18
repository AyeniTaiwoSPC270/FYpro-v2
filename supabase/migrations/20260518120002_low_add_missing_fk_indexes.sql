-- Migration: low_add_missing_fk_indexes
-- Severity: LOW (L3)
-- Problem: Three FK columns have no covering index. Without an index, any
--          query that filters or joins on these columns requires a full table
--          scan. Confirmed by Supabase performance advisor.
--          Affected:
--            defense_credits.source_referral_id → referrals.id
--            payment_issues.user_id             → users.id (after DROP COLUMN
--              removed user_email, user_id FK becomes the key lookup column)
--            payments.project_id                → projects.id
-- Fix: Add a btree index on each column.

CREATE INDEX IF NOT EXISTS idx_defense_credits_source_referral_id
  ON public.defense_credits(source_referral_id);

CREATE INDEX IF NOT EXISTS idx_payment_issues_user_id
  ON public.payment_issues(user_id);

CREATE INDEX IF NOT EXISTS idx_payments_project_id
  ON public.payments(project_id);

-- ── Verification ──────────────────────────────────────────────────────────────
-- SELECT indexname, tablename, indexdef
-- FROM pg_indexes
-- WHERE schemaname = 'public'
--   AND indexname IN (
--     'idx_defense_credits_source_referral_id',
--     'idx_payment_issues_user_id',
--     'idx_payments_project_id'
--   )
-- ORDER BY tablename;
-- Expected: 3 rows, one per index.
