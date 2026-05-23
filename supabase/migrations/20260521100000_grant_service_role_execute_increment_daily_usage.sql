-- Migration: grant_service_role_execute_increment_daily_usage
-- Problem: The security audit (20260518100004) revoked EXECUTE on
--          increment_daily_usage from anon and authenticated. If the original
--          grant was to PUBLIC (the PostgreSQL default for new functions),
--          revoking from anon/authenticated is safe and service_role retains
--          access via PUBLIC. However if the PUBLIC grant was ever removed
--          by a prior Supabase security pass or dashboard operation — not
--          captured in these migration files — service_role loses EXECUTE too.
--          Since supabaseAdmin.rpc('increment_daily_usage', ...) silently
--          catches errors, the failure is invisible: daily_usage rows stop
--          being written and the spend-cap check reads stale data.
-- Fix: Explicitly GRANT EXECUTE to service_role.
--      This is idempotent — if service_role already has access (via PUBLIC)
--      adding an explicit grant is a no-op from a permission standpoint.
--      After this migration, service_role's access is independent of whatever
--      PUBLIC's state is, so future REVOKE FROM PUBLIC cannot break it.

GRANT EXECUTE ON FUNCTION public.increment_daily_usage(integer, integer, numeric, integer)
  TO service_role;

-- ── Verification ──────────────────────────────────────────────────────────────
-- Run in Supabase SQL Editor after applying:
--
-- SELECT grantee, privilege_type
-- FROM information_schema.role_routine_grants
-- WHERE routine_schema = 'public'
--   AND routine_name   = 'increment_daily_usage'
--   AND grantee        = 'service_role';
--
-- Expected: one row — service_role | EXECUTE
--
-- Then trigger a Writing Planner API call and confirm:
-- SELECT date, request_count, total_cost_usd, updated_at
-- FROM daily_usage
-- WHERE date = CURRENT_DATE;
-- Expected: a row with request_count ≥ 1 and updated_at within the last minute.
