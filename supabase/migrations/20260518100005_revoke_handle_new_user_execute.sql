-- Migration: revoke_handle_new_user_execute
-- Severity: HIGH (H4)
-- Problem: handle_new_user() is a SECURITY DEFINER trigger function that
--          inserts into public.users and public.user_entitlements.
--          It is exposed as a callable RPC at:
--            POST /rest/v1/rpc/handle_new_user
--          Direct calls will fail due to the unique constraint on users.id,
--          but this is not a safe guarantee — it relies on a side-effect
--          rather than an access control rule.
-- Fix: Revoke EXECUTE from anon and authenticated.
--      The trigger on auth.users (on_auth_user_created) is not affected —
--      triggers always fire as the function owner regardless of grants.
--      New user signup flow is unaffected.

REVOKE EXECUTE ON FUNCTION public.handle_new_user()
  FROM anon, authenticated;

-- ── Verification ──────────────────────────────────────────────────────────────
-- After applying:
--
-- SELECT grantee, privilege_type
-- FROM information_schema.role_routine_grants
-- WHERE routine_schema = 'public'
--   AND routine_name   = 'handle_new_user'
--   AND grantee IN ('anon', 'authenticated', 'public');
--
-- Expected: zero rows.
--
-- Signup still works — verify by checking the trigger still exists:
-- SELECT trigger_name, event_object_schema, event_object_table
-- FROM information_schema.triggers
-- WHERE trigger_name = 'on_auth_user_created';
-- Expected: on_auth_user_created | auth | users
