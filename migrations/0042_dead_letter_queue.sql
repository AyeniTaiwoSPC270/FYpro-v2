-- Migration 0042: dead_letter_queue
-- Records fire-and-forget side effects (Telegram alerts, nurture email triggers,
-- notification inserts) that failed even after retrying — see
-- api/_lib/reliable-async.js and
-- docs/architecture/2026-08-02-w2-failure-policy-decision-table.md.
-- Run in Supabase SQL Editor. Verify RLS check at the bottom.

CREATE TABLE public.dead_letter_queue (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  feature       text        NOT NULL,
  payload       jsonb,
  error_message text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  resolved_at   timestamptz
);

CREATE INDEX dead_letter_queue_created_idx ON public.dead_letter_queue(created_at DESC);
CREATE INDEX dead_letter_queue_feature_idx ON public.dead_letter_queue(feature);

ALTER TABLE public.dead_letter_queue ENABLE ROW LEVEL SECURITY;
-- No policies: this table is written only by supabaseAdmin (service role,
-- which bypasses RLS). There is no legitimate client-side read or write path.

-- Verify: must return zero rows
-- SELECT tablename FROM pg_tables WHERE schemaname='public' AND rowsecurity = false;
