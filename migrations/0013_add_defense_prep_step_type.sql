-- Migration 0013: Add 'defense_prep' to project_steps.step_type CHECK constraint.
--
-- Root cause: DefensePrep.jsx calls saveStep('defense_prep', ...) but the
-- CHECK constraint was never updated to include this value, causing a
-- "project_steps_step_type_check" violation every time a defense session is saved.
--
-- Fix: drop and recreate the constraint with the full list of valid step types.
-- No existing data is affected — 'defense_prep' rows could not have been inserted
-- under the old constraint, so there are no rows to migrate.
--
-- Run in Supabase SQL Editor. Safe to run multiple times (DROP IF EXISTS).

ALTER TABLE public.project_steps
  DROP CONSTRAINT IF EXISTS project_steps_step_type_check;

ALTER TABLE public.project_steps
  ADD CONSTRAINT project_steps_step_type_check
  CHECK (step_type IN (
    'topic_validator',
    'chapter_architect',
    'literature_map',
    'abstract_generator',
    'methodology_advisor',
    'instrument_builder',
    'writing_planner',
    'project_reviewer',
    'red_flag_detector',
    'supervisor_email',
    'meeting_prep',
    'defense_prep'
  ));

-- Verification: run after applying. Must return the row with all 12 values.
-- SELECT pg_get_constraintdef(oid)
-- FROM pg_constraint
-- WHERE conname = 'project_steps_step_type_check';
