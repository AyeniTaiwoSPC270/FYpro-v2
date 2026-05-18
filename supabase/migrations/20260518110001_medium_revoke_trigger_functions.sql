-- Migration: medium_revoke_trigger_functions
-- Severity: MEDIUM (M3)
-- Problem: enforce_defense_ready(), generate_cert_number(), and
--          generate_referral_code() are SECURITY DEFINER trigger functions
--          exposed as callable RPCs via /rest/v1/rpc/*.
--          These should only fire as triggers — never be called directly.
--          Risks:
--            generate_referral_code: runs an unbounded loop querying users;
--              callable as a low-cost amplification vector.
--            generate_cert_number: probes the defense_certificates_seq counter.
--            enforce_defense_ready: callable with empty args; runs as
--              superuser (SECURITY DEFINER) against user_progress.
-- Fix: Revoke EXECUTE from anon and authenticated.
--      Trigger execution is unaffected — triggers always fire as the
--      function owner regardless of EXECUTE grants on client roles.

REVOKE EXECUTE ON FUNCTION public.enforce_defense_ready()
  FROM anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.generate_cert_number()
  FROM anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.generate_referral_code()
  FROM anon, authenticated;

-- ── Verification ──────────────────────────────────────────────────────────────
-- SELECT routine_name, grantee
-- FROM information_schema.role_routine_grants
-- WHERE routine_schema = 'public'
--   AND routine_name IN (
--     'enforce_defense_ready','generate_cert_number','generate_referral_code'
--   )
--   AND grantee IN ('anon','authenticated','public');
-- Expected: zero rows.
-- Triggers still fire — confirm:
-- SELECT trigger_name FROM information_schema.triggers
-- WHERE trigger_schema = 'public'
--   OR (event_object_schema = 'auth' AND trigger_name = 'on_auth_user_created');
