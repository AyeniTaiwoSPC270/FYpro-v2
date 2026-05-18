-- Migration: medium_drop_daily_usage_policy
-- Severity: MEDIUM (M7)
-- Problem: daily_usage has a policy named "service role only" but it is
--          applied to role {authenticated} with qual = false — not to
--          service_role. The policy name claims server-only access but
--          the role assignment is wrong. This is misleading and fragile:
--          if someone edits the qual to true, authenticated clients get
--          full access to all daily cost/usage data.
--          The correct pattern for a server-only table is RLS enabled
--          with zero client policies. service_role always bypasses RLS
--          entirely and needs no policy entry.
-- Fix: Drop the misleading policy. The zero-policy default already blocks
--      all client access. The server_only RESTRICTIVE policies added in
--      migration 20260518110000 provide an explicit hard gate.

DROP POLICY IF EXISTS "service role only" ON public.daily_usage;

-- Add the same RESTRICTIVE server_only policy for consistency with
-- auth_attempts, response_times, and system_logs.
CREATE POLICY "server_only"
  ON public.daily_usage
  AS RESTRICTIVE TO authenticated
  USING (false);

-- ── Verification ──────────────────────────────────────────────────────────────
-- SELECT policyname, permissive, roles, cmd, qual
-- FROM pg_policies
-- WHERE schemaname = 'public' AND tablename = 'daily_usage';
-- Expected: exactly one row — "server_only" | RESTRICTIVE | {authenticated} | ALL | false
-- The old "service role only" PERMISSIVE policy must NOT appear.
