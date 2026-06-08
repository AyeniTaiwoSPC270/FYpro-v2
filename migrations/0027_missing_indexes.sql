-- Migration: 0027_missing_indexes.sql
-- Fills index gaps identified in June 2026 architecture audit.
-- Both tables are queried on every admin dashboard load, every Telegram
-- /stats command, and every 4h error-check cron — but had no non-pkey indexes.

-- system_logs: error-check cron + /stats query filter on severity + resolved,
-- optionally with a created_at range.
CREATE INDEX IF NOT EXISTS idx_system_logs_severity_resolved_created
  ON public.system_logs (severity, resolved, created_at DESC);

-- system_logs: general admin fetch ordered newest-first.
CREATE INDEX IF NOT EXISTS idx_system_logs_created_at
  ON public.system_logs (created_at DESC);

-- payments: every revenue query, today's count, and the orphaned-payment check
-- all filter by status. Composite with created_at covers the time-ranged variants.
CREATE INDEX IF NOT EXISTS idx_payments_status_created_at
  ON public.payments (status, created_at DESC);
