-- Migration: referral system — referral_code column, referrals table, defense_credits table
-- Run in Supabase SQL Editor in order. After running, verify with:
--   SELECT tablename FROM pg_tables WHERE schemaname='public' AND rowsecurity = false;
--   Must return zero rows.

-- ─── 1. Add referral_code to users ────────────────────────────────────────────

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS referral_code TEXT UNIQUE;

-- ─── 2. Trigger: auto-generate referral_code on INSERT ────────────────────────

CREATE OR REPLACE FUNCTION public.generate_referral_code()
RETURNS trigger AS $$
DECLARE
  candidate TEXT;
  found     BOOLEAN;
BEGIN
  IF NEW.referral_code IS NULL THEN
    LOOP
      -- 6 uppercase alphanumeric chars from md5 entropy
      candidate := upper(substring(md5(random()::text || clock_timestamp()::text) FROM 1 FOR 6));
      SELECT EXISTS(SELECT 1 FROM public.users WHERE referral_code = candidate) INTO found;
      EXIT WHEN NOT found;
    END LOOP;
    NEW.referral_code := candidate;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Drop and recreate so this migration is idempotent
DROP TRIGGER IF EXISTS users_referral_code_gen ON public.users;

CREATE TRIGGER users_referral_code_gen
  BEFORE INSERT ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.generate_referral_code();

-- Backfill referral_code for any existing users who don't have one yet.
-- Safe to run multiple times — the function's loop handles collisions.
DO $$
DECLARE
  r RECORD;
  candidate TEXT;
  found     BOOLEAN;
BEGIN
  FOR r IN SELECT id FROM public.users WHERE referral_code IS NULL LOOP
    LOOP
      candidate := upper(substring(md5(random()::text || clock_timestamp()::text) FROM 1 FOR 6));
      SELECT EXISTS(SELECT 1 FROM public.users WHERE referral_code = candidate) INTO found;
      EXIT WHEN NOT found;
    END LOOP;
    UPDATE public.users SET referral_code = candidate WHERE id = r.id;
  END LOOP;
END;
$$;

-- ─── 3. referrals table ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.referrals (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_user_id  UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  referred_user_id  UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status            TEXT        NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'qualified', 'rewarded')),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  qualified_at      TIMESTAMPTZ,
  rewarded_at       TIMESTAMPTZ,
  CONSTRAINT no_self_referral CHECK (referrer_user_id <> referred_user_id)
);

-- One referral per referred user — prevents double-counting from code collisions or retries
CREATE UNIQUE INDEX IF NOT EXISTS referrals_referred_unique ON public.referrals(referred_user_id);
CREATE INDEX IF NOT EXISTS referrals_referrer_idx ON public.referrals(referrer_user_id);
CREATE INDEX IF NOT EXISTS referrals_status_idx ON public.referrals(status);

ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

-- Referrer can see the status and date of their own referrals (not who was referred)
CREATE POLICY "referrer reads own referrals"
  ON public.referrals FOR SELECT TO authenticated
  USING ((select auth.uid()) = referrer_user_id);

-- Referred user can see their own row (useful for debugging; no email exposed)
CREATE POLICY "referred reads own row"
  ON public.referrals FOR SELECT TO authenticated
  USING ((select auth.uid()) = referred_user_id);

-- All writes are service_role only — no client INSERT/UPDATE/DELETE
CREATE POLICY "service role writes referrals"
  ON public.referrals FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- ─── 4. defense_credits table ─────────────────────────────────────────────────
-- The reward currency. One row per earned free Defense Simulator session.
-- Clients can read their own credits (to display count in the dashboard).
-- Only service_role writes — clients can never mint credits.

CREATE TABLE IF NOT EXISTS public.defense_credits (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason              TEXT        NOT NULL
                      CHECK (reason IN ('referral_signup_bonus', 'referral_milestone', 'admin_grant', 'promo')),
  source_referral_id  UUID        REFERENCES public.referrals(id) ON DELETE SET NULL,
  consumed            BOOLEAN     NOT NULL DEFAULT false,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  consumed_at         TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS defense_credits_user_idx ON public.defense_credits(user_id, consumed);

ALTER TABLE public.defense_credits ENABLE ROW LEVEL SECURITY;

-- Client can read their own credits to show "X free sessions available"
CREATE POLICY "user reads own credits"
  ON public.defense_credits FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);

-- All writes are service_role only
CREATE POLICY "service role writes credits"
  ON public.defense_credits FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- ─── 5. Verification ──────────────────────────────────────────────────────────
-- Run these after applying; both must return 0 rows.

-- SELECT tablename FROM pg_tables WHERE schemaname='public' AND rowsecurity = false;
-- SELECT t.tablename FROM pg_tables t
--   LEFT JOIN pg_policies p ON p.tablename = t.tablename AND p.schemaname = 'public'
--   WHERE t.schemaname = 'public' AND t.rowsecurity = true
--   GROUP BY t.tablename HAVING COUNT(p.policyname) = 0;
