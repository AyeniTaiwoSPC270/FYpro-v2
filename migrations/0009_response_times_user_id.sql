-- Migration: add user_id to response_times
-- Enables active-session tracking in the admin vitals widget.
-- Run in Supabase SQL Editor before deploying the api/claude.js changes.

ALTER TABLE response_times
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_response_times_user_id ON response_times(user_id);
