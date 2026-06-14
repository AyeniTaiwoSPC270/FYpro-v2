-- Migration: 0030_project_mode
-- Adds a 'mode' discriminator to projects so Express projects are separable
-- from normal (Student/Defence Pack) projects. Run in Supabase SQL Editor.

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS mode text NOT NULL DEFAULT 'standard';

ALTER TABLE projects
  DROP CONSTRAINT IF EXISTS projects_mode_check;

ALTER TABLE projects
  ADD CONSTRAINT projects_mode_check CHECK (mode IN ('standard', 'express'));

CREATE INDEX IF NOT EXISTS projects_user_mode_idx ON projects (user_id, mode);
