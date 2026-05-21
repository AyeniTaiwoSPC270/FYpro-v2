-- Migration: add_avatar_url_to_users
-- Problem: The auth callback in AuthConfirm.jsx tries to upsert avatar_url
--          into public.users for Google OAuth users, but the column was never
--          created, causing a 400 error on every Google sign-in.
-- Fix: Add avatar_url as a nullable text column. IF NOT EXISTS makes this
--      idempotent — safe to run again if the column was added manually.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS avatar_url text;

-- ── Verification ──────────────────────────────────────────────────────────────
-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns
-- WHERE table_schema = 'public'
--   AND table_name = 'users'
--   AND column_name = 'avatar_url';
-- Expected: one row, data_type = 'text', is_nullable = 'YES'.
