-- Adds scores column to defense_turns so per-examiner scores can be
-- stored alongside each Q&A turn for the Past Sessions history view.

ALTER TABLE public.defense_turns
  ADD COLUMN IF NOT EXISTS scores jsonb NOT NULL DEFAULT '[]'::jsonb;
