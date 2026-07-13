-- Migration 0037: defense score is server-authoritative
--
-- Security fix (audit HIGH — certificate forgery):
-- defense_sessions.total_score / status and defense_turns.scores were writable
-- directly by the browser (RLS allowed self-updates with no column restriction),
-- so any authenticated user could set total_score = 10 from the console and mint a
-- real certificate at /api/certificate without defending anything.
--
-- This migration adds BEFORE triggers that reject writes to those columns from the
-- client Postgres roles ('authenticated' / 'anon'). The service_role connection used
-- by our serverless finalize-defense endpoint (and turn persistence in /api/ai) runs
-- as current_user = 'service_role' and is allowed through. Migrations / dashboard run
-- as 'postgres' / 'supabase_admin' and are also allowed.
--
-- RLS policies are left in place (clients may still SELECT their rows and create an
-- in-progress session row); the triggers are the column-level guard.
--
-- Run in the Supabase SQL Editor. Verify with the checks at the bottom.

-- ── defense_sessions: only the server may set status / total_score ───────────────
CREATE OR REPLACE FUNCTION public.reject_client_defense_session_score_change()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Browser clients run as 'authenticated' (or 'anon'); the serverless finalize
  -- endpoint runs as 'service_role' and is exempt, as are migration/admin roles.
  IF current_user IN ('anon', 'authenticated') THEN
    IF TG_OP = 'INSERT' THEN
      -- Clients may only open a fresh, unscored, in-progress session.
      IF COALESCE(NEW.status, 'in_progress') <> 'in_progress' THEN
        RAISE EXCEPTION 'defense_sessions may only be created with status in_progress';
      END IF;
      IF NEW.total_score IS NOT NULL THEN
        RAISE EXCEPTION 'defense_sessions.total_score may only be set by the server';
      END IF;
    ELSIF TG_OP = 'UPDATE' THEN
      IF NEW.status IS DISTINCT FROM OLD.status THEN
        RAISE EXCEPTION 'defense_sessions.status may only be changed by the server (finalize-defense)';
      END IF;
      IF NEW.total_score IS DISTINCT FROM OLD.total_score THEN
        RAISE EXCEPTION 'defense_sessions.total_score may only be changed by the server (finalize-defense)';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_defense_sessions_protect_score ON public.defense_sessions;
CREATE TRIGGER trg_defense_sessions_protect_score
  BEFORE INSERT OR UPDATE ON public.defense_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.reject_client_defense_session_score_change();

-- ── defense_turns: only the server may write per-turn scores ─────────────────────
CREATE OR REPLACE FUNCTION public.reject_client_defense_turn_scores()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Clients may still hold a transcript row, but the scores that finalize-defense
  -- averages into total_score must come from the server. A null or empty array is
  -- allowed; any real scores from a client role are rejected.
  IF current_user IN ('anon', 'authenticated') THEN
    IF NEW.scores IS NOT NULL AND NEW.scores <> '[]'::jsonb THEN
      RAISE EXCEPTION 'defense_turns.scores may only be set by the server';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_defense_turns_protect_scores ON public.defense_turns;
CREATE TRIGGER trg_defense_turns_protect_scores
  BEFORE INSERT OR UPDATE ON public.defense_turns
  FOR EACH ROW
  EXECUTE FUNCTION public.reject_client_defense_turn_scores();

-- ── Verification ────────────────────────────────────────────────────────────────
-- 1. Triggers exist:
--    SELECT tgname FROM pg_trigger
--    WHERE tgname IN ('trg_defense_sessions_protect_score','trg_defense_turns_protect_scores');
-- 2. As an authenticated user (anon key + JWT), this must now FAIL:
--    UPDATE defense_sessions SET total_score = 10, status = 'completed' WHERE id = '<own id>';
-- 3. RLS still enabled everywhere (must return zero rows):
--    SELECT tablename FROM pg_tables WHERE schemaname='public' AND rowsecurity = false;
