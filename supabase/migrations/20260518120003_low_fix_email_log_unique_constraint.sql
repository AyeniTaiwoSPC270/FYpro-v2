-- Migration: low_fix_email_log_unique_constraint
-- Severity: LOW (L5)
-- Problem: email_log_unique is a full unique index on (user_id, email_type)
--          with no WHERE predicate. A failed send (status = 'failed') locks
--          out all future attempts for that (user, type) pair — the retry
--          INSERT collides with the unique constraint and is rejected with
--          error code 23505. Users who had a failed welcome or nudge email
--          can never receive it.
-- Fix: Replace the unconditional unique index with a partial index scoped to
--      status = 'sent'. Failed rows no longer block retries. The idempotency
--      guarantee is preserved for successful sends — a second successful send
--      to the same (user, type) is still rejected.
-- Note: Existing rows with status = 'sent' are already unique per the old
--       constraint, so no data migration is needed.

DROP INDEX IF EXISTS public.email_log_unique;

CREATE UNIQUE INDEX email_log_unique
  ON public.email_log(user_id, email_type)
  WHERE status = 'sent';

-- ── Verification ──────────────────────────────────────────────────────────────
-- SELECT indexname, indexdef
-- FROM pg_indexes
-- WHERE schemaname = 'public'
--   AND tablename = 'email_log'
--   AND indexname = 'email_log_unique';
-- Expected indexdef includes: WHERE (status = 'sent')
