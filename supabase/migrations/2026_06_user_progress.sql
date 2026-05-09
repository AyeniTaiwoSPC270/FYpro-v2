-- Migration: user_progress table + Defense Ready enforcement trigger
-- Run in Supabase SQL Editor. After running, verify with:
--   SELECT tablename FROM pg_tables WHERE schemaname='public' AND rowsecurity = false;
--   Must return zero rows.

-- ─── Table ─────────────────────────────────────────────────────────────────────

CREATE TABLE public.user_progress (
  user_id                           UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  topic_validator_completed_at      TIMESTAMPTZ,
  chapter_architect_completed_at    TIMESTAMPTZ,
  methodology_advisor_completed_at  TIMESTAMPTZ,
  writing_planner_completed_at      TIMESTAMPTZ,
  project_reviewer_completed_at     TIMESTAMPTZ,
  defense_prep_completed_at         TIMESTAMPTZ,
  defense_simulator_first_run_at    TIMESTAMPTZ,
  defense_ready_awarded_at          TIMESTAMPTZ,
  updated_at                        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── RLS ───────────────────────────────────────────────────────────────────────

ALTER TABLE public.user_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user reads own progress"
  ON public.user_progress FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

CREATE POLICY "user inserts own progress"
  ON public.user_progress FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "user updates own progress"
  ON public.user_progress FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

-- ─── Defense Ready enforcement trigger ────────────────────────────────────────
-- defense_ready_awarded_at may only be set when all six steps AND one defense
-- session are present. This is the server-side gate; client logic is a UX aid only.

CREATE OR REPLACE FUNCTION enforce_defense_ready()
RETURNS trigger AS $$
BEGIN
  IF NEW.defense_ready_awarded_at IS NOT NULL AND OLD.defense_ready_awarded_at IS NULL THEN
    IF NEW.topic_validator_completed_at IS NULL OR
       NEW.chapter_architect_completed_at IS NULL OR
       NEW.methodology_advisor_completed_at IS NULL OR
       NEW.writing_planner_completed_at IS NULL OR
       NEW.project_reviewer_completed_at IS NULL OR
       NEW.defense_prep_completed_at IS NULL OR
       NEW.defense_simulator_first_run_at IS NULL THEN
      RAISE EXCEPTION 'Defense Ready badge requires all six steps and one defense session';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER user_progress_defense_ready_check
BEFORE UPDATE ON public.user_progress
FOR EACH ROW EXECUTE FUNCTION enforce_defense_ready();

-- ─── Verification (run these after applying; both must return 0 rows) ──────────

-- SELECT tablename FROM pg_tables WHERE schemaname='public' AND rowsecurity = false;
-- SELECT t.tablename FROM pg_tables t
--   LEFT JOIN pg_policies p ON p.tablename = t.tablename AND p.schemaname = 'public'
--   WHERE t.schemaname = 'public' AND t.rowsecurity = true
--   GROUP BY t.tablename HAVING COUNT(p.policyname) = 0;
