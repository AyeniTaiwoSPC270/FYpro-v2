-- Migration: Admin Realtime SELECT policies
-- Enables Supabase Realtime subscriptions from the admin dashboard frontend.
-- The anon client (with a valid session) cannot read these tables by default;
-- service_role was the only reader. Adding is_admin() policies unlocks direct
-- queries and Realtime channel events for the admin user only.
--
-- After running this migration, seed the admin user:
--   INSERT INTO admin_users (user_id)
--   SELECT id FROM auth.users WHERE email = 'your-admin@email.com'
--   ON CONFLICT DO NOTHING;

-- ── 1. admin_users table ─────────────────────────────────────────────
-- Stores which auth.users are admins. Service role writes only.
CREATE TABLE IF NOT EXISTS admin_users (
  user_id    uuid        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

-- Admin can see their own row (lets them verify they're registered).
CREATE POLICY "admin_users_self_select" ON admin_users
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- No INSERT/UPDATE/DELETE for clients — service_role only.

-- ── 2. is_admin() helper ─────────────────────────────────────────────
-- SECURITY DEFINER so it can bypass RLS on admin_users itself.
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM admin_users WHERE user_id = auth.uid()
  );
$$;

-- ── 3. SELECT policies for real-time metric tables ───────────────────

-- response_times — latency, active sessions, last API call
-- (was: no client policies — service role only)
CREATE POLICY "admin_select_response_times" ON response_times
  FOR SELECT TO authenticated
  USING (is_admin());

-- daily_usage — requests today
-- (was: no client policies — service role only)
CREATE POLICY "admin_select_daily_usage" ON daily_usage
  FOR SELECT TO authenticated
  USING (is_admin());

-- generation_failures — failures today + live feed
-- (was: INSERT own failures only; no SELECT for clients)
CREATE POLICY "admin_select_generation_failures" ON generation_failures
  FOR SELECT TO authenticated
  USING (is_admin());

-- payments — revenue today + live feed
-- (was: SELECT own rows only; admin needs all rows)
CREATE POLICY "admin_select_payments" ON payments
  FOR SELECT TO authenticated
  USING (is_admin());

-- users — live feed signups
-- (was: SELECT/UPDATE own row only; admin needs all rows)
CREATE POLICY "admin_select_users" ON users
  FOR SELECT TO authenticated
  USING (is_admin());
