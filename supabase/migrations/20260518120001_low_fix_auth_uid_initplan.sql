-- Migration: low_fix_auth_uid_initplan
-- Severity: LOW (L2)
-- Problem: Two INSERT policies use bare auth.uid() in WITH CHECK instead of
--          (SELECT auth.uid()). Bare auth.uid() is re-evaluated for every
--          candidate row rather than once per query — suboptimal at scale.
--          Affected policies:
--            generation_failures — "insert own failures"
--            payment_issues      — "users insert own payment issues"
--          Both have WITH CHECK: ((auth.uid() = user_id) OR (user_id IS NULL))
-- Fix: Drop and recreate each policy with (SELECT auth.uid()) in WITH CHECK.
--      INSERT policies have no USING clause — only WITH CHECK applies.
--      The OR (user_id IS NULL) branch is preserved; it allows the serverless
--      functions to log failures without a user context (e.g. pre-auth errors).

DROP POLICY IF EXISTS "insert own failures"          ON public.generation_failures;
DROP POLICY IF EXISTS "users insert own payment issues" ON public.payment_issues;

CREATE POLICY "insert own failures"
  ON public.generation_failures
  FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT auth.uid()) = user_id
    OR user_id IS NULL
  );

CREATE POLICY "users insert own payment issues"
  ON public.payment_issues
  FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT auth.uid()) = user_id
    OR user_id IS NULL
  );

-- ── Verification ──────────────────────────────────────────────────────────────
-- SELECT tablename, policyname, cmd, with_check
-- FROM pg_policies
-- WHERE schemaname = 'public'
--   AND tablename IN ('generation_failures','payment_issues')
-- ORDER BY tablename;
-- Expected with_check for both:
--   "((( SELECT auth.uid()) = user_id) OR (user_id IS NULL))"
