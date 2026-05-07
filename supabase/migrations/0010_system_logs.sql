-- supabase/migrations/0010_system_logs.sql
CREATE TABLE system_logs (
  id            uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at    timestamptz DEFAULT now(),
  severity      text        CHECK (severity = ANY (ARRAY['error','warning','info'])),
  feature       text        NOT NULL,
  plain_message text        NOT NULL,
  raw_detail    jsonb,
  source        text        CHECK (source = ANY (ARRAY['ai','auth','payment','database','sentry','system'])),
  resolved      boolean     DEFAULT false
);

-- RLS enabled with no client-visible policies.
-- All reads and writes go through supabaseAdmin (service_role), which bypasses RLS.
-- No authenticated user can query this table directly.
ALTER TABLE system_logs ENABLE ROW LEVEL SECURITY;
