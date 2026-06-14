-- Migration: 0031_achievements_project_scope
-- Scopes achievements to a project so Express achievements never mix with the
-- normal account's. project_id IS NULL = global/normal (existing rows unchanged).
-- Run in Supabase SQL Editor.

ALTER TABLE user_achievements
  ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES projects(id) ON DELETE CASCADE;

-- Drop the old global UNIQUE (user_id, achievement_key) — auto-named by Postgres.
ALTER TABLE user_achievements
  DROP CONSTRAINT IF EXISTS user_achievements_user_id_achievement_key_key;

-- Global achievements: one per (user, key) when project_id is NULL.
CREATE UNIQUE INDEX IF NOT EXISTS user_achievements_global_uniq
  ON user_achievements (user_id, achievement_key)
  WHERE project_id IS NULL;

-- Scoped achievements: one per (user, key, project) when project_id is set.
CREATE UNIQUE INDEX IF NOT EXISTS user_achievements_scoped_uniq
  ON user_achievements (user_id, achievement_key, project_id)
  WHERE project_id IS NOT NULL;
