-- 0032_onboarding_questions.sql
-- Adds onboarding-question columns to user_onboarding.
-- All nullable — a skipped question leaves its column NULL.
-- No new RLS policies needed: existing SELECT/INSERT/UPDATE own-row
-- policies on user_onboarding already cover these columns.

ALTER TABLE public.user_onboarding
  ADD COLUMN IF NOT EXISTS referral_source        text,
  ADD COLUMN IF NOT EXISTS expected_defence_band  text
    CONSTRAINT user_onboarding_defence_band_check
    CHECK (expected_defence_band IN ('<1m','1-3m','3-6m','unsure')),
  ADD COLUMN IF NOT EXISTS primary_goal           text
    CONSTRAINT user_onboarding_goal_check
    CHECK (primary_goal IN ('validate_topic','build_chapters','plan_writing','defence_practice')),
  ADD COLUMN IF NOT EXISTS notify_email           boolean,
  ADD COLUMN IF NOT EXISTS notify_push            boolean,
  ADD COLUMN IF NOT EXISTS walkthrough_seen_at    timestamptz;

-- Verification: must return 0 rows.
-- SELECT tablename FROM pg_tables WHERE schemaname='public' AND rowsecurity = false;
