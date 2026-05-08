-- email_log: idempotency record of every email sent.
-- service_role only — users do not read this from the client.
CREATE TABLE public.email_log (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email_type text        NOT NULL
                         CHECK (email_type IN ('welcome','defense_nudge','urgency_reminder')),
  sent_at    timestamptz NOT NULL DEFAULT now(),
  resend_id  text,
  status     text        NOT NULL DEFAULT 'sent'
                         CHECK (status IN ('sent','failed'))
);

-- Idempotency: second INSERT for the same (user, type) fails with code 23505.
-- /api/send-nurture-email catches this and returns { ok: true, alreadySent: true }.
CREATE UNIQUE INDEX email_log_unique     ON public.email_log(user_id, email_type);
CREATE INDEX        email_log_sent_at_idx ON public.email_log(sent_at DESC);

ALTER TABLE public.email_log ENABLE ROW LEVEL SECURITY;

-- No client policies — service_role only.
CREATE POLICY "service role only" ON public.email_log
  FOR ALL TO service_role USING (true) WITH CHECK (true);
