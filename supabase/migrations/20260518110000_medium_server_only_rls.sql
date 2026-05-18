-- Migration: medium_server_only_rls
-- Severity: MEDIUM (M1)
-- Problem: auth_attempts, response_times, and system_logs have RLS enabled
--          but zero policies. This works correctly (service_role bypasses RLS,
--          so serverless functions still write; clients are blocked by default).
--          However the zero-policy state is fragile: a mistakenly added
--          permissive policy would immediately open these tables to all clients.
-- Fix: Add explicit RESTRICTIVE deny-all policies that document server-only
--      intent. A RESTRICTIVE policy forms a hard AND with any future permissive
--      policy, so even a mistaken "allow all" policy cannot override this gate.
-- Note: service_role is never affected by RLS policies — it bypasses entirely.

CREATE POLICY "server_only"
  ON public.auth_attempts
  AS RESTRICTIVE TO authenticated
  USING (false);

CREATE POLICY "server_only"
  ON public.response_times
  AS RESTRICTIVE TO authenticated
  USING (false);

CREATE POLICY "server_only"
  ON public.system_logs
  AS RESTRICTIVE TO authenticated
  USING (false);

-- ── Verification ──────────────────────────────────────────────────────────────
-- SELECT tablename, policyname, permissive
-- FROM pg_policies
-- WHERE schemaname = 'public'
--   AND tablename IN ('auth_attempts', 'response_times', 'system_logs');
-- Expected: one "server_only" RESTRICTIVE policy per table.
