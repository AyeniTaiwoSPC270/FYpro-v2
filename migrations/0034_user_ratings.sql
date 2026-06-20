-- Migration 0034: user_ratings
-- Stores proactive star ratings + open-ended suggestions from the rating modal.
-- Separate from feature_feedback (thumbs) — different schema and purpose.
-- Run in Supabase SQL Editor. Verify RLS check at the bottom.

CREATE TABLE public.user_ratings (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stars              smallint    NOT NULL CHECK (stars BETWEEN 1 AND 5),
  trigger_type       text        NOT NULL CHECK (trigger_type IN ('defense_simulator', 'steps_milestone')),
  feature            text        NOT NULL,
  suggestion_feature text,
  suggestion_ui      text,
  created_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX user_ratings_user_idx    ON public.user_ratings(user_id);
CREATE INDEX user_ratings_created_idx ON public.user_ratings(created_at DESC);

ALTER TABLE public.user_ratings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user inserts own rating"
  ON public.user_ratings FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "user reads own rating"
  ON public.user_ratings FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);

-- Verify: must return zero rows
-- SELECT tablename FROM pg_tables WHERE schemaname='public' AND rowsecurity = false;
