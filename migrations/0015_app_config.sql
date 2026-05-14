-- App-level config table for maintenance mode and other global settings.
-- Writes go through service_role only. Authenticated users can SELECT.

CREATE TABLE IF NOT EXISTS app_config (
  key        text        PRIMARY KEY,
  value      text        NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Seed default rows — idempotent
INSERT INTO app_config (key, value)
VALUES
  ('maintenance_mode',    'false'),
  ('maintenance_message', '')
ON CONFLICT (key) DO NOTHING;

-- RLS
ALTER TABLE app_config ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read all config rows
CREATE POLICY "app_config_select" ON app_config
  FOR SELECT
  TO authenticated
  USING (true);

-- No INSERT/UPDATE/DELETE policies for non-service-role roles.
-- All writes go through supabaseAdmin (service_role) which bypasses RLS.
