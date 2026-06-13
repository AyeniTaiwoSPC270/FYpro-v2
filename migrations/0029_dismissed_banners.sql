-- migrations/0029_dismissed_banners.sql
-- Stores dismissed announcement IDs per user for cross-device persistence.
-- Existing rows get an empty array by default — no backfill needed.
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS dismissed_banners text[] DEFAULT '{}';
