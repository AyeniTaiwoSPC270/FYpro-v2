-- Migration: generation_failures
-- Run in Supabase SQL Editor (Dashboard → SQL Editor → New query)

CREATE TABLE IF NOT EXISTS generation_failures (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  user_email    text,
  feature       text NOT NULL,
  error_type    text NOT NULL,
  error_message text,
  input_preview text CHECK (char_length(input_preview) <= 200),
  created_at    timestamptz DEFAULT now(),
  resolved      boolean DEFAULT false
);

ALTER TABLE generation_failures ENABLE ROW LEVEL SECURITY;

-- Authenticated users can INSERT their own rows (or null user_id for pre-auth errors).
-- No SELECT/UPDATE/DELETE for clients — admin reads via service role.
CREATE POLICY "insert own failures"
  ON generation_failures FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

-- Index for the admin dashboard queries
CREATE INDEX IF NOT EXISTS idx_gen_failures_created_at ON generation_failures(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_gen_failures_user_id    ON generation_failures(user_id);
