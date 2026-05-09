-- Migration 0014: Schedule email-nurture Edge Function via pg_cron
-- Run this in Supabase SQL Editor after deploying the edge function.
--
-- IMPORTANT: Replace YOUR_CRON_SECRET_HERE below with your actual CRON_SECRET value
-- from Supabase Dashboard → Edge Functions → email-nurture → Secrets.
-- Do NOT commit this file to git after filling in the secret.

-- Enable extensions (safe to run if already enabled)
create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net  with schema extensions;

-- Grant required permissions (needed on some Supabase setups)
grant usage on schema cron to postgres;
grant all privileges on all tables in schema cron to postgres;

-- Remove any existing schedule with this name before (re)creating
select cron.unschedule('email-nurture-daily') where exists (
  select 1 from cron.job where jobname = 'email-nurture-daily'
);

-- Schedule: 9am UTC daily = 10am Lagos time (WAT = UTC+1)
select cron.schedule(
  'email-nurture-daily',
  '0 9 * * *',
  $$
  select net.http_post(
    url     := 'https://ayvunikgfwpylfrkpalj.supabase.co/functions/v1/email-nurture',
    headers := '{"Authorization": "Bearer YOUR_CRON_SECRET_HERE", "Content-Type": "application/json"}'::jsonb,
    body    := '{}'::jsonb
  );
  $$
);
