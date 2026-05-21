-- Add avatar_url column to users table (was missing from initial schema)
-- The auth callback upsert conditionally includes this field for Google OAuth users
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS avatar_url text;
