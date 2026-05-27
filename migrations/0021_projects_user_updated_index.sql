-- Migration: 0021_projects_user_updated_index.sql
-- Speeds up loadUserState() which queries projects by user_id ordered by updated_at DESC.
-- CONCURRENTLY means this does not block reads/writes while building.

-- Note: CONCURRENTLY removed — Supabase migrations run inside a transaction block.
CREATE INDEX IF NOT EXISTS idx_projects_user_id_updated_at
  ON public.projects (user_id, updated_at DESC);
