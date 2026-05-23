-- Migration: admin_select_policies
-- Problem: The security audit added RESTRICTIVE "server_only" policies with
--          USING (false) on daily_usage and response_times. RESTRICTIVE policies
--          form a hard AND with every permissive policy — so even though
--          admin_select_* permissive policies exist (from migrations/0018), the
--          RESTRICTIVE USING(false) gate blocks the admin user too.
--
--          Console confirms: requestsToday: 0, avgLatencyMs: null, activeSessions: 0
--          All three values come from response_times and daily_usage queries
--          returning null/empty because the anon client is blocked.
--
-- Fix:     Replace USING (false) with USING (is_admin()) on both RESTRICTIVE
--          policies. Non-admins still fail the restrictive check and are blocked.
--          The admin user passes the restrictive gate, then the permissive
--          admin_select_* policy grants access.
--
--          Also adds idempotent admin SELECT policies for every table queried
--          by fetchRtMetrics: generation_failures, payments, users.
--          These have no RESTRICTIVE policy but may be missing the permissive
--          policy if migrations/0018 was not fully applied.
--
-- Assumes: admin_users table and is_admin() function already exist
--          (created by migrations/0018_admin_realtime_policies.sql).

-- ── 1. Fix RESTRICTIVE policies that block all admin access ───────────────────

-- daily_usage was blocked by 20260518110005_medium_drop_daily_usage_policy.sql
DROP POLICY IF EXISTS "server_only" ON public.daily_usage;
CREATE POLICY "server_only" ON public.daily_usage
  AS RESTRICTIVE TO authenticated
  USING (is_admin());

-- response_times was blocked by 20260518110000_medium_server_only_rls.sql
DROP POLICY IF EXISTS "server_only" ON public.response_times;
CREATE POLICY "server_only" ON public.response_times
  AS RESTRICTIVE TO authenticated
  USING (is_admin());

-- ── 2. Admin SELECT policies — idempotent (DROP IF EXISTS + CREATE) ───────────

DROP POLICY IF EXISTS "admin_select_daily_usage" ON public.daily_usage;
CREATE POLICY "admin_select_daily_usage" ON public.daily_usage
  FOR SELECT TO authenticated
  USING (is_admin());

DROP POLICY IF EXISTS "admin_select_response_times" ON public.response_times;
CREATE POLICY "admin_select_response_times" ON public.response_times
  FOR SELECT TO authenticated
  USING (is_admin());

DROP POLICY IF EXISTS "admin_select_generation_failures" ON public.generation_failures;
CREATE POLICY "admin_select_generation_failures" ON public.generation_failures
  FOR SELECT TO authenticated
  USING (is_admin());

DROP POLICY IF EXISTS "admin_select_payments" ON public.payments;
CREATE POLICY "admin_select_payments" ON public.payments
  FOR SELECT TO authenticated
  USING (is_admin());

DROP POLICY IF EXISTS "admin_select_users" ON public.users;
CREATE POLICY "admin_select_users" ON public.users
  FOR SELECT TO authenticated
  USING (is_admin());

-- ── Verification ──────────────────────────────────────────────────────────────
-- 1. Confirm RESTRICTIVE policies now use is_admin() not false:
--    SELECT tablename, policyname, permissive, qual
--    FROM pg_policies
--    WHERE schemaname = 'public'
--      AND tablename IN ('daily_usage', 'response_times')
--      AND policyname = 'server_only';
--    Expected: permissive = 'RESTRICTIVE', qual contains 'is_admin()'
--
-- 2. Confirm admin SELECT policies exist on all 5 tables:
--    SELECT tablename, policyname
--    FROM pg_policies
--    WHERE schemaname = 'public'
--      AND policyname LIKE 'admin_select_%'
--    ORDER BY tablename;
--    Expected: 5 rows — daily_usage, generation_failures, payments,
--                        response_times, users
