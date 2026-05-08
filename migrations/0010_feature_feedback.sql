-- Migration 0010: feature_feedback
-- Stores thumbs-up / thumbs-down ratings per AI generation result.
-- Run in Supabase SQL Editor. Verify with RLS check at the bottom.

-- ── Table ──────────────────────────────────────────────────────────────────────

CREATE TABLE public.feature_feedback (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  feature     text        NOT NULL CHECK (feature IN (
                'topic_validator','chapter_architect','methodology_advisor',
                'writing_planner','literature_map','abstract_generator',
                'instrument_builder','project_reviewer','defense_simulator'
              )),
  rating      smallint    NOT NULL CHECK (rating IN (-1, 1)),
  context_id  text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX feature_feedback_user_idx    ON public.feature_feedback(user_id);
CREATE INDEX feature_feedback_feature_idx ON public.feature_feedback(feature);
CREATE INDEX feature_feedback_created_idx ON public.feature_feedback(created_at DESC);

-- ── RLS ────────────────────────────────────────────────────────────────────────

ALTER TABLE public.feature_feedback ENABLE ROW LEVEL SECURITY;

-- Users can INSERT their own feedback only.
CREATE POLICY "user inserts own feedback"
  ON public.feature_feedback
  FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

-- Users can SELECT their own feedback only (used for idempotency checks server-side).
-- Client-side idempotency uses localStorage; this policy is a belt-and-braces guard.
CREATE POLICY "user reads own feedback"
  ON public.feature_feedback
  FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

-- No UPDATE or DELETE policies for authenticated — rows are immutable from the client.
-- Admin aggregates are read via service_role in /api/admin?action=feedback-summary.

-- ── Verification ───────────────────────────────────────────────────────────────

-- Run after applying this migration. Must return zero rows.
-- SELECT tablename FROM pg_tables
-- WHERE schemaname='public' AND rowsecurity = false;
