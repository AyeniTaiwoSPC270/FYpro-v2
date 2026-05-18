-- Migration: low_merge_referrals_select_policies
-- Severity: LOW (L1)
-- Problem: referrals has two separate PERMISSIVE SELECT policies for the
--          authenticated role:
--            "referrer reads own referrals"  (uid = referrer_user_id)
--            "referred reads own row"        (uid = referred_user_id)
--          PostgreSQL evaluates all PERMISSIVE policies and ORs the results.
--          Two policies mean two separate scans per query — unnecessary overhead.
-- Fix: Merge into one policy with a combined OR expression.
--      The service_role write policy is untouched.

DROP POLICY IF EXISTS "referrer reads own referrals" ON public.referrals;
DROP POLICY IF EXISTS "referred reads own row"       ON public.referrals;

CREATE POLICY "user reads own referral rows"
  ON public.referrals
  FOR SELECT TO authenticated
  USING (
    (SELECT auth.uid()) = referrer_user_id
    OR
    (SELECT auth.uid()) = referred_user_id
  );

-- ── Verification ──────────────────────────────────────────────────────────────
-- SELECT policyname, cmd, qual
-- FROM pg_policies
-- WHERE schemaname = 'public' AND tablename = 'referrals'
-- ORDER BY cmd;
-- Expected SELECT rows: exactly one — "user reads own referral rows"
-- Expected ALL row:     "service role writes referrals" (untouched)
