-- Migration: fix_user_entitlements_rls
-- Severity: CRITICAL (C1)
-- Problem: users_insert_run_counts and users_update_run_counts use role {public},
--          which includes anon AND authenticated. The UPDATE policy has no column
--          restriction, so any authenticated user can set paid_features,
--          defense_packs_remaining, or banned_until on their own row — free premium exploit.
-- Fix: Drop both policies. All writes to user_entitlements must go through
--      service_role only (serverless functions after HMAC-verified payment).
--      The SELECT policy "entitlements select own" is kept — users must be able
--      to read their own entitlements to gate features in the frontend.

DROP POLICY IF EXISTS users_insert_run_counts ON public.user_entitlements;
DROP POLICY IF EXISTS users_update_run_counts ON public.user_entitlements;

-- ── Verification ──────────────────────────────────────────────────────────────
-- After applying, run this to confirm only the SELECT policy remains:
--
-- SELECT policyname, roles, cmd
-- FROM pg_policies
-- WHERE schemaname = 'public' AND tablename = 'user_entitlements';
--
-- Expected: exactly one row — "entitlements select own" | {authenticated} | SELECT
-- The INSERT and UPDATE policies must NOT appear.
