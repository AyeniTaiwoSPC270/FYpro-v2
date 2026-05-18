-- Migration: revoke_nurture_users_execute
-- Severity: CRITICAL (C2)
-- Problem: get_eligible_nurture_users is a SECURITY DEFINER function that queries
--          auth.users and returns user_id, email, and full_name for all users
--          eligible for nurture emails. Supabase grants anon and authenticated
--          EXECUTE by default on public schema functions.
--          Any unauthenticated request to:
--            POST /rest/v1/rpc/get_eligible_nurture_users
--            {"p_email_type":"welcome","p_min_days":0}
--          returns a list of real user emails and names — full PII data leak.
-- Fix: Revoke EXECUTE from both roles. This function is only called by the
--      Supabase Edge Function (email-nurture) and the Vercel send-nurture-email
--      endpoint, both of which connect via service_role key.
--      service_role is not affected by REVOKE.

REVOKE EXECUTE ON FUNCTION public.get_eligible_nurture_users(text, integer)
  FROM anon, authenticated;

-- ── Verification ──────────────────────────────────────────────────────────────
-- After applying, run this to confirm no public EXECUTE grant remains:
--
-- SELECT grantee, privilege_type
-- FROM information_schema.role_routine_grants
-- WHERE routine_schema = 'public'
--   AND routine_name   = 'get_eligible_nurture_users'
--   AND grantee IN ('anon', 'authenticated', 'public');
--
-- Expected: zero rows.
-- service_role will still be able to call this function (it bypasses grants).
