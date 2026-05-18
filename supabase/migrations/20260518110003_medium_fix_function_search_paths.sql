-- Migration: medium_fix_function_search_paths
-- Severity: MEDIUM (M5)
-- Problem: increment_daily_usage and enforce_defense_ready have mutable
--          search_path (no SET search_path clause). A SECURITY DEFINER function
--          with mutable search_path can be exploited if a rogue schema object
--          (e.g. a shadowing function in a user-controlled schema) is placed
--          ahead of pg_catalog or public in the search path.
-- Fix: Add SET search_path = public to both functions.
--      Function bodies are preserved exactly — only the search_path is added.
-- Note: enforce_defense_ready is also the trigger function for
--       user_progress_defense_ready_check — the trigger is unaffected.

CREATE OR REPLACE FUNCTION public.increment_daily_usage(
  p_tokens_in  integer,
  p_tokens_out integer,
  p_cost_usd   numeric,
  p_requests   integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO daily_usage (date, total_tokens_in, total_tokens_out, total_cost_usd, request_count)
  VALUES (CURRENT_DATE, p_tokens_in, p_tokens_out, p_cost_usd, p_requests)
  ON CONFLICT (date)
  DO UPDATE SET
    total_tokens_in  = daily_usage.total_tokens_in  + EXCLUDED.total_tokens_in,
    total_tokens_out = daily_usage.total_tokens_out + EXCLUDED.total_tokens_out,
    total_cost_usd   = daily_usage.total_cost_usd   + EXCLUDED.total_cost_usd,
    request_count    = daily_usage.request_count    + EXCLUDED.request_count,
    updated_at       = now();
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_defense_ready()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;

-- ── Verification ──────────────────────────────────────────────────────────────
-- SELECT routine_name, security_type
-- FROM information_schema.routines
-- WHERE routine_schema = 'public'
--   AND routine_name IN ('increment_daily_usage','enforce_defense_ready');
-- Both should show security_type = 'DEFINER'.
-- Confirm search_path via pg_proc:
-- SELECT proname, proconfig
-- FROM pg_proc
-- WHERE pronamespace = 'public'::regnamespace
--   AND proname IN ('increment_daily_usage','enforce_defense_ready');
-- Expected: proconfig includes 'search_path=public' for both.
