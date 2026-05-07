-- Migration: response_times
-- Run in Supabase SQL Editor after 0004

CREATE TABLE IF NOT EXISTS response_times (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  feature     text NOT NULL,
  duration_ms integer NOT NULL,
  created_at  timestamptz DEFAULT now()
);

ALTER TABLE response_times ENABLE ROW LEVEL SECURITY;
-- No client policies — service role only (written by api/claude.js)

CREATE INDEX IF NOT EXISTS idx_response_times_created_at ON response_times(created_at DESC);
