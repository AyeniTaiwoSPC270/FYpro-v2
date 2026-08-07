-- Migration 0043: ai_call_log
-- Per-call AI cost/token/cache/trace ledger (W3 — see
-- docs/specs/2026-08-03-w3-cost-telemetry-design.md). One row per Anthropic call
-- or cache hit, written by api/_lib/ai-cost-log.js (service role only).
-- Pruned to 90 days by api/admin.js action=prune-ai-cost-log (cron-job.org).
-- Run in Supabase SQL Editor. Verify RLS check at the bottom.

CREATE TABLE public.ai_call_log (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid        REFERENCES auth.users(id),
  feature       text        NOT NULL,
  model         text        NOT NULL,
  tokens_in     integer     NOT NULL DEFAULT 0,
  tokens_out    integer     NOT NULL DEFAULT 0,
  cost_usd      numeric     NOT NULL DEFAULT 0,
  cache_hit     boolean     NOT NULL DEFAULT false,
  trace_id      text,
  duration_ms   integer,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ai_call_log_created_idx ON public.ai_call_log(created_at DESC);
CREATE INDEX ai_call_log_feature_idx ON public.ai_call_log(feature, created_at DESC);
CREATE INDEX ai_call_log_user_idx    ON public.ai_call_log(user_id, created_at DESC);

ALTER TABLE public.ai_call_log ENABLE ROW LEVEL SECURITY;
-- No policies: written only by supabaseAdmin (service role, bypasses RLS).
-- There is no legitimate client-side read or write path.

-- Verify: must return zero rows
-- SELECT tablename FROM pg_tables WHERE schemaname='public' AND rowsecurity = false;
