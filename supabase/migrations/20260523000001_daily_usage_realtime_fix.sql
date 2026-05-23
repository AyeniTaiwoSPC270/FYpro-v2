-- Migration: daily_usage_realtime_fix
-- Problem: Supabase Realtime postgres_changes does not fire when daily_usage
--          is updated via the increment_daily_usage RPC function. Two root causes:
--          1. REPLICA IDENTITY DEFAULT only writes the PK to WAL on UPDATE, giving
--             Realtime insufficient data to broadcast the changed columns.
--          2. RPC functions run as service_role which bypasses the normal WAL
--             replication publication filter path that Realtime uses.
-- Fix 1: Set REPLICA IDENTITY FULL so every UPDATE writes the complete row to WAL.
-- Fix 2: Add pg_notify('daily_usage_updated', ...) inside the function as a
--         secondary notification signal the broadcast fallback can listen for.
-- Note: Existing security attributes (SECURITY DEFINER, search_path, EXECUTE grants)
--       are fully preserved. Only the UPSERT body gains the pg_notify call.

-- ── 1. Enable full row replication for daily_usage ────────────────────────────
ALTER TABLE public.daily_usage REPLICA IDENTITY FULL;

-- ── 2. Rebuild function with pg_notify after the UPSERT ──────────────────────
CREATE OR REPLACE FUNCTION public.increment_daily_usage(
  p_tokens_in  integer,
  p_tokens_out integer,
  p_cost_usd   numeric,
  p_requests   integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO daily_usage (date, total_tokens_in, total_tokens_out, total_cost_usd, request_count)
  VALUES (CURRENT_DATE, p_tokens_in, p_tokens_out, p_cost_usd, p_requests)
  ON CONFLICT (date)
  DO UPDATE SET
    total_tokens_in  = daily_usage.total_tokens_in  + EXCLUDED.total_tokens_in,
    total_tokens_out = daily_usage.total_tokens_out + EXCLUDED.total_tokens_out,
    total_cost_usd   = daily_usage.total_cost_usd   + EXCLUDED.total_cost_usd,
    request_count    = daily_usage.request_count    + EXCLUDED.request_count,
    updated_at       = now();

  PERFORM pg_notify('daily_usage_updated', (
    SELECT row_to_json(r)::text
    FROM daily_usage r
    WHERE r.date = CURRENT_DATE
    LIMIT 1
  ));
END;
$$;

-- ── Verification ──────────────────────────────────────────────────────────────
-- 1. Confirm REPLICA IDENTITY FULL:
--    SELECT relreplident FROM pg_class WHERE relname = 'daily_usage';
--    Expected: 'f'  (d = default, f = full, n = nothing, i = index)
--
-- 2. Confirm function still has SECURITY DEFINER + search_path:
--    SELECT proname, prosecdef, proconfig
--    FROM pg_proc
--    WHERE pronamespace = 'public'::regnamespace AND proname = 'increment_daily_usage';
--    Expected: prosecdef = true, proconfig includes 'search_path=public'
--
-- 3. Confirm service_role EXECUTE grant survived (idempotent — no REVOKE issued):
--    SELECT grantee, privilege_type
--    FROM information_schema.role_routine_grants
--    WHERE routine_schema = 'public' AND routine_name = 'increment_daily_usage'
--      AND grantee = 'service_role';
--    Expected: one row — service_role | EXECUTE
