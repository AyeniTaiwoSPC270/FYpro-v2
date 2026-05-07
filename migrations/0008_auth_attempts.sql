-- Migration 0008: auth_attempts
-- Run in Supabase SQL Editor before deploying api/auth.js.

CREATE TABLE IF NOT EXISTS public.auth_attempts (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  email      text,
  ip         text,
  action     text        NOT NULL CHECK (action IN ('login', 'signup', 'forgot_password')),
  success    boolean     NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.auth_attempts ENABLE ROW LEVEL SECURITY;
-- No client policies — table inaccessible via anon/authenticated SDK.
-- All reads and writes go through supabaseAdmin (service role).

CREATE INDEX IF NOT EXISTS idx_auth_attempts_ip         ON public.auth_attempts(ip);
CREATE INDEX IF NOT EXISTS idx_auth_attempts_created_at ON public.auth_attempts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_auth_attempts_fails
  ON public.auth_attempts(ip, created_at DESC) WHERE success = false;
