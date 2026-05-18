-- Migration: revoke_increment_daily_usage_execute
-- Severity: HIGH (H3)
-- Problem: increment_daily_usage is a SECURITY DEFINER function callable by
--          any authenticated user via POST /rest/v1/rpc/increment_daily_usage.
--          A malicious user can pass arbitrary token counts and cost values to:
--            1. Trigger false Telegram spend cap alerts at 80%/100%
--            2. Inflate total_cost_usd past DAILY_CAP_USD and lock the app
--               for all users for the rest of the UTC day
--          This function must only be called from serverless functions
--          that have already verified the Claude API response and computed
--          real token counts.
-- Fix: Revoke EXECUTE from anon and authenticated.
--      service_role (used by all /api/* functions) is unaffected.

REVOKE EXECUTE ON FUNCTION public.increment_daily_usage(integer, integer, numeric, integer)
  FROM anon, authenticated;

-- ── Verification ──────────────────────────────────────────────────────────────
-- After applying:
--
-- SELECT grantee, privilege_type
-- FROM information_schema.role_routine_grants
-- WHERE routine_schema = 'public'
--   AND routine_name   = 'increment_daily_usage'
--   AND grantee IN ('anon', 'authenticated', 'public');
--
-- Expected: zero rows.
