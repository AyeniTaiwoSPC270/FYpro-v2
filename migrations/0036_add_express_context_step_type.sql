-- Migration 0036: Add 'express_context' to project_steps.step_type CHECK constraint.
--
-- Root cause: ExpressOnboarding.jsx needs to persist methodology and chapter
-- count (fields with no column on the projects table) in a project_steps row.
-- Without this step_type, saveStep('express_context', ...) violates the CHECK
-- constraint and silently loses the data.
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
    'defense_prep',
    'defense_brief',
    'express_context'
  ));

-- Verification: run after applying. Must return the row with all 15 values.
-- SELECT pg_get_constraintdef(oid)
-- FROM pg_constraint
-- WHERE conname = 'project_steps_step_type_check';
