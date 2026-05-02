-- Migration 0002 — UNIQUE constraint on (project_id, step_type)
-- Required before Day 19 migration begins.
-- Without this, re-running a step creates duplicate rows instead of overwriting.
-- Run in Supabase SQL Editor. Safe to run on an empty table.

ALTER TABLE public.project_steps
  ADD CONSTRAINT project_steps_unique_per_step
  UNIQUE (project_id, step_type);
