-- Migration 0035: user_reports
-- Stores user-submitted issue reports (error reports + general feedback).
-- Run in Supabase SQL Editor. Verify RLS check at the bottom.

CREATE TABLE public.user_reports (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type        text        NOT NULL CHECK (type IN ('error', 'general')),
  description text        NOT NULL,
  context     jsonb       NOT NULL DEFAULT '{}',
  status      text        NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'acknowledged', 'resolved')),
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX user_reports_user_idx    ON public.user_reports(user_id);
CREATE INDEX user_reports_status_idx  ON public.user_reports(status);
CREATE INDEX user_reports_created_idx ON public.user_reports(created_at DESC);

ALTER TABLE public.user_reports ENABLE ROW LEVEL SECURITY;

-- Users can insert their own reports only.
CREATE POLICY "user inserts own reports"
  ON public.user_reports
  FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

-- Users can read their own reports only.
CREATE POLICY "user reads own reports"
  ON public.user_reports
  FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

-- No client UPDATE or DELETE — status changes go through service_role via API.

-- ── Verification ────────────────────────────────────────────────────────────────
-- Run after applying. Must return zero rows.
-- SELECT tablename FROM pg_tables WHERE schemaname='public' AND rowsecurity = false;
