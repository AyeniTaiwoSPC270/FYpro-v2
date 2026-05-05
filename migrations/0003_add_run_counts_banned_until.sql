-- Migration 0003: add run_counts and banned_until to user_entitlements
-- Run this in the Supabase SQL Editor before deploying.

-- run_counts: tracks how many times each feature has been used per user.
-- Used by useRunLimit.js (frontend gate) and admin dashboard feature usage chart.
ALTER TABLE user_entitlements
ADD COLUMN IF NOT EXISTS run_counts JSONB DEFAULT '{}'::jsonb;

-- banned_until: set to a future timestamp to deny access via ProtectedRoute.
-- Used by ProtectedRoute.jsx (ban check on every page load) and /api/admin?action=ban-user.
ALTER TABLE user_entitlements
ADD COLUMN IF NOT EXISTS banned_until TIMESTAMPTZ DEFAULT NULL;
