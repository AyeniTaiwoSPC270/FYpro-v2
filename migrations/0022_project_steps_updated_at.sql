-- Migration: 0022_project_steps_updated_at.sql
-- Adds updated_at column to project_steps so upserts are auditable.

ALTER TABLE public.project_steps
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now() NOT NULL;

-- Backfill existing rows to match created_at
UPDATE public.project_steps
  SET updated_at = created_at
  WHERE updated_at IS DISTINCT FROM created_at;

-- Trigger to auto-update updated_at on every UPDATE
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_project_steps_updated_at ON public.project_steps;
CREATE TRIGGER trg_project_steps_updated_at
  BEFORE UPDATE ON public.project_steps
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
