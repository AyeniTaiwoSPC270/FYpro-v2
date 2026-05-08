-- user_onboarding: tracks per-user dismissal state for onboarding nudges.
-- Client can SELECT, INSERT, and UPDATE their own row.
-- No DELETE policy — the row persists once created.
CREATE TABLE public.user_onboarding (
  user_id                              uuid        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  topic_validator_nudge_dismissed_at   timestamptz,
  created_at                           timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_onboarding ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user reads own onboarding" ON public.user_onboarding
  FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);

-- WITH CHECK required on INSERT to prevent a user inserting a row for another user_id.
CREATE POLICY "user inserts own onboarding" ON public.user_onboarding
  FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

-- WITH CHECK required on UPDATE to prevent ownership transfer.
CREATE POLICY "user updates own onboarding" ON public.user_onboarding
  FOR UPDATE TO authenticated
  USING  ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

-- No DELETE policy — users do not need to delete this row.

-- Verification (run after applying): must return zero rows.
-- SELECT tablename FROM pg_tables WHERE schemaname='public' AND rowsecurity = false;
