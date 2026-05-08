-- email_preferences: per-user opt-out controls.
-- Authenticated users can SELECT, INSERT, UPDATE their own row.
-- No DELETE policy — the row persists; unsubscribed_all = true is the signal.
CREATE TABLE public.email_preferences (
  user_id                  uuid        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  welcome_enabled          boolean     NOT NULL DEFAULT true,
  defense_nudge_enabled    boolean     NOT NULL DEFAULT true,
  urgency_reminder_enabled boolean     NOT NULL DEFAULT true,
  unsubscribed_all         boolean     NOT NULL DEFAULT false,
  updated_at               timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.email_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user reads own prefs" ON public.email_preferences
  FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);

-- WITH CHECK on UPDATE is required — prevents user_id transfer attack.
CREATE POLICY "user updates own prefs" ON public.email_preferences
  FOR UPDATE TO authenticated
  USING  ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "user inserts own prefs" ON public.email_preferences
  FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);
