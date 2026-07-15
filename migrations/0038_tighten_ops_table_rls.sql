-- 0038_tighten_ops_table_rls.sql
--
-- Closes an authenticated-user data leak found by the RLS audit (2026-07-15).
--
-- Three internal ops tables each carried a SELECT policy with `USING (true)`
-- scoped to the `authenticated` role, i.e. EVERY signed-in user (every student)
-- could read the entire table straight from the browser. The admin dashboard
-- (src/pages/admin/Health.jsx) reads these tables client-side, but each table
-- ALSO already has an `admin_select_*` policy scoped to `is_admin()`, so admin
-- reads keep working after these broad policies are dropped. The dashboard is
-- only client-gated (adminOnly), so the DB was the real enforcement gap —
-- exactly the "client-side enforcement only" failure CLAUDE.md §6 warns against.
--
-- Worst offender: generation_failures.input_preview stores the first 100 chars
-- of other users' project inputs alongside their user_id.
--
-- Access after this migration:
--   admin (is_admin())      → SELECT via existing admin_select_* policies (unchanged)
--   service_role            → full access (unchanged)
--   non-admin authenticated → SELECT blocked (the fix)
--   client INSERT paths     → unchanged (separate INSERT policies remain)

DROP POLICY IF EXISTS "authenticated_can_read_daily_usage"        ON public.daily_usage;
DROP POLICY IF EXISTS "authenticated_can_read_generation_failures" ON public.generation_failures;
DROP POLICY IF EXISTS "authenticated_can_read_response_times"      ON public.response_times;

-- Verify (should return zero rows):
--   SELECT tablename, policyname FROM pg_policies
--   WHERE schemaname = 'public' AND cmd = 'SELECT'
--     AND btrim(coalesce(qual, 'true')) = 'true'
--     AND tablename IN ('daily_usage','generation_failures','response_times');
