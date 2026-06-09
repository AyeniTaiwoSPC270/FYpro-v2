-- FYPro Staging Schema
-- Generated 2026-06-09 from production
-- Run this entire script in the staging Supabase SQL Editor (one paste, then Run)
-- It is safe to re-run: all statements use IF NOT EXISTS / OR REPLACE

-- ============================================================
-- 1. EXTENSIONS
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- 2. SEQUENCE (certificate numbers: FYP-2026-000001)
-- ============================================================
CREATE SEQUENCE IF NOT EXISTS public.defense_certificates_seq
  START WITH 1 INCREMENT BY 1;

-- ============================================================
-- 3. TRIGGER FUNCTIONS with no table dependencies
--    (needed before tables so triggers can reference them,
--     but these functions don't query any tables themselves)
-- ============================================================

CREATE OR REPLACE FUNCTION public.set_updated_at()
  RETURNS trigger
  LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.generate_cert_number()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
BEGIN
  NEW.certificate_number :=
    'FYP-' ||
    to_char(now(), 'YYYY') ||
    '-' ||
    lpad(nextval('defense_certificates_seq')::text, 6, '0');
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_defense_ready()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.defense_ready_awarded_at IS NOT NULL AND OLD.defense_ready_awarded_at IS NULL THEN
    IF NEW.topic_validator_completed_at IS NULL OR
       NEW.chapter_architect_completed_at IS NULL OR
       NEW.methodology_advisor_completed_at IS NULL OR
       NEW.writing_planner_completed_at IS NULL OR
       NEW.project_reviewer_completed_at IS NULL OR
       NEW.defense_prep_completed_at IS NULL OR
       NEW.defense_simulator_first_run_at IS NULL THEN
      RAISE EXCEPTION 'Defense Ready badge requires all six steps and one defense session';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- ============================================================
-- 4. TABLES
-- ============================================================

CREATE TABLE IF NOT EXISTS public.admin_users (
  user_id uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.app_config (
  key text NOT NULL,
  value text DEFAULT ''::text NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.auth_attempts (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  email text,
  ip text,
  action text NOT NULL,
  success boolean NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.daily_usage (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  date date NOT NULL,
  total_tokens_in integer DEFAULT 0 NOT NULL,
  total_tokens_out integer DEFAULT 0 NOT NULL,
  total_cost_usd numeric DEFAULT 0 NOT NULL,
  request_count integer DEFAULT 0 NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.institutions (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  name text NOT NULL,
  short_name text NOT NULL,
  faculty text,
  contract_status text DEFAULT 'inactive'::text NOT NULL,
  contract_start date,
  contract_end date,
  student_cap integer,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.users (
  id uuid NOT NULL,
  email text NOT NULL,
  full_name text,
  faculty text,
  department text,
  level text,
  institution_id uuid,
  role text DEFAULT 'student'::text NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  university_name text,
  referral_code text,
  avatar_url text,
  university text
);

CREATE TABLE IF NOT EXISTS public.user_entitlements (
  user_id uuid NOT NULL,
  paid_features jsonb DEFAULT '[]'::jsonb NOT NULL,
  paid_until timestamp with time zone,
  defense_packs_remaining integer DEFAULT 0 NOT NULL,
  total_lifetime_paid_ngn integer DEFAULT 0 NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  run_counts jsonb DEFAULT '{}'::jsonb,
  banned_until timestamp with time zone
);

CREATE TABLE IF NOT EXISTS public.projects (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  title text,
  status text DEFAULT 'draft'::text NOT NULL,
  current_step text DEFAULT 'topic_validator'::text NOT NULL,
  faculty text,
  department text,
  level text,
  supervisor_id uuid,
  institution_id uuid,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.project_steps (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  project_id uuid NOT NULL,
  user_id uuid NOT NULL,
  step_type text NOT NULL,
  result_json jsonb NOT NULL,
  input_summary text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.referrals (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  referrer_user_id uuid NOT NULL,
  referred_user_id uuid NOT NULL,
  status text DEFAULT 'pending'::text NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  qualified_at timestamp with time zone,
  rewarded_at timestamp with time zone
);

CREATE TABLE IF NOT EXISTS public.defense_sessions (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  project_id uuid NOT NULL,
  user_id uuid NOT NULL,
  examiner_persona text NOT NULL,
  status text DEFAULT 'in_progress'::text NOT NULL,
  total_score integer,
  turns_count integer DEFAULT 0 NOT NULL,
  started_at timestamp with time zone DEFAULT now() NOT NULL,
  completed_at timestamp with time zone,
  certificate_requested_at timestamp with time zone
);

CREATE TABLE IF NOT EXISTS public.defense_turns (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  session_id uuid NOT NULL,
  user_id uuid NOT NULL,
  turn_number integer NOT NULL,
  examiner_question text NOT NULL,
  student_answer text,
  score integer,
  feedback text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  scores jsonb DEFAULT '[]'::jsonb NOT NULL
);

CREATE TABLE IF NOT EXISTS public.defense_certificates (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  defense_session_id uuid,
  score numeric NOT NULL,
  topic_title text NOT NULL,
  recipient_name text NOT NULL,
  issued_at timestamp with time zone DEFAULT now() NOT NULL,
  certificate_number text NOT NULL
);

CREATE TABLE IF NOT EXISTS public.defense_credits (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  reason text NOT NULL,
  source_referral_id uuid,
  consumed boolean DEFAULT false NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  consumed_at timestamp with time zone
);

CREATE TABLE IF NOT EXISTS public.payments (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid,
  project_id uuid,
  paystack_reference text NOT NULL,
  amount_kobo integer NOT NULL,
  tier text NOT NULL,
  status text NOT NULL,
  webhook_verified_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.email_log (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  email_type text NOT NULL,
  sent_at timestamp with time zone DEFAULT now() NOT NULL,
  resend_id text,
  status text DEFAULT 'sent'::text NOT NULL
);

CREATE TABLE IF NOT EXISTS public.email_preferences (
  user_id uuid NOT NULL,
  welcome_enabled boolean DEFAULT true NOT NULL,
  defense_nudge_enabled boolean DEFAULT true NOT NULL,
  urgency_reminder_enabled boolean DEFAULT true NOT NULL,
  unsubscribed_all boolean DEFAULT false NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  type text NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  read boolean DEFAULT false NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  subscription jsonb NOT NULL,
  last_nudged_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.user_achievements (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  achievement_key text NOT NULL,
  earned_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.user_onboarding (
  user_id uuid NOT NULL,
  topic_validator_nudge_dismissed_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.user_progress (
  user_id uuid NOT NULL,
  topic_validator_completed_at timestamp with time zone,
  chapter_architect_completed_at timestamp with time zone,
  methodology_advisor_completed_at timestamp with time zone,
  writing_planner_completed_at timestamp with time zone,
  project_reviewer_completed_at timestamp with time zone,
  defense_prep_completed_at timestamp with time zone,
  defense_simulator_first_run_at timestamp with time zone,
  defense_ready_awarded_at timestamp with time zone,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.generation_failures (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid,
  feature text NOT NULL,
  error_type text NOT NULL,
  error_message text,
  input_preview text,
  created_at timestamp with time zone DEFAULT now(),
  resolved boolean DEFAULT false
);

CREATE TABLE IF NOT EXISTS public.payment_issues (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid,
  transaction_ref text NOT NULL,
  description text,
  created_at timestamp with time zone DEFAULT now(),
  resolved boolean DEFAULT false
);

CREATE TABLE IF NOT EXISTS public.feature_feedback (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  feature text NOT NULL,
  rating smallint NOT NULL,
  context_id text,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.response_times (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  feature text NOT NULL,
  duration_ms integer NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  user_id uuid
);

CREATE TABLE IF NOT EXISTS public.system_logs (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  severity text NOT NULL,
  feature text NOT NULL,
  plain_message text NOT NULL,
  raw_detail jsonb,
  source text NOT NULL,
  resolved boolean DEFAULT false
);

CREATE TABLE IF NOT EXISTS public.auth_attempts (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  email text,
  ip text,
  action text NOT NULL,
  success boolean NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

-- ============================================================
-- 5. FUNCTIONS THAT REFERENCE TABLES
--    (tables now exist, so these are safe to create)
-- ============================================================

CREATE OR REPLACE FUNCTION public.is_admin()
  RETURNS boolean
  LANGUAGE sql
  STABLE SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM admin_users WHERE user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.generate_referral_code()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
DECLARE
  candidate TEXT;
  found     BOOLEAN;
BEGIN
  IF NEW.referral_code IS NULL THEN
    LOOP
      candidate := upper(substring(md5(random()::text || clock_timestamp()::text) FROM 1 FOR 6));
      SELECT EXISTS(SELECT 1 FROM public.users WHERE referral_code = candidate) INTO found;
      EXIT WHEN NOT found;
    END LOOP;
    NEW.referral_code := candidate;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.users (id, email, role)
  VALUES (NEW.id, NEW.email, 'student');

  INSERT INTO public.user_entitlements (user_id)
  VALUES (NEW.id);

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.increment_daily_usage(
  p_tokens_in integer,
  p_tokens_out integer,
  p_cost_usd numeric,
  p_requests integer
)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
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

CREATE OR REPLACE FUNCTION public.get_eligible_nurture_users(p_email_type text, p_min_days integer)
  RETURNS TABLE(user_id uuid, email text, name text)
  LANGUAGE sql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
  SELECT
    au.id        AS user_id,
    au.email     AS email,
    pu.full_name AS name
  FROM auth.users au
  LEFT JOIN public.users pu ON pu.id = au.id
  WHERE au.email IS NOT NULL
    AND (au.email_confirmed_at IS NOT NULL OR au.confirmed_at IS NOT NULL)
    AND COALESCE(au.email_confirmed_at, au.confirmed_at) <= now() - (p_min_days || ' days')::interval
    AND NOT EXISTS (
      SELECT 1 FROM public.email_log el
      WHERE el.user_id   = au.id
        AND el.email_type = p_email_type
    );
$$;

-- Grant execute to service_role
GRANT EXECUTE ON FUNCTION public.increment_daily_usage TO service_role;
GRANT EXECUTE ON FUNCTION public.get_eligible_nurture_users TO service_role;
GRANT EXECUTE ON FUNCTION public.handle_new_user TO service_role;

-- ============================================================
-- 7. PRIMARY KEYS, UNIQUE CONSTRAINTS, FOREIGN KEYS
-- ============================================================

ALTER TABLE public.admin_users ADD CONSTRAINT admin_users_pkey PRIMARY KEY (user_id);
ALTER TABLE public.app_config ADD CONSTRAINT app_config_pkey PRIMARY KEY (key);
ALTER TABLE public.auth_attempts ADD CONSTRAINT auth_attempts_pkey PRIMARY KEY (id);
ALTER TABLE public.daily_usage ADD CONSTRAINT daily_usage_date_key UNIQUE (date);
ALTER TABLE public.daily_usage ADD CONSTRAINT daily_usage_pkey PRIMARY KEY (id);
ALTER TABLE public.defense_certificates ADD CONSTRAINT defense_certificates_certificate_number_key UNIQUE (certificate_number);
ALTER TABLE public.defense_certificates ADD CONSTRAINT defense_certificates_pkey PRIMARY KEY (id);
ALTER TABLE public.defense_credits ADD CONSTRAINT defense_credits_pkey PRIMARY KEY (id);
ALTER TABLE public.defense_sessions ADD CONSTRAINT defense_sessions_pkey PRIMARY KEY (id);
ALTER TABLE public.defense_turns ADD CONSTRAINT defense_turns_pkey PRIMARY KEY (id);
ALTER TABLE public.email_log ADD CONSTRAINT email_log_pkey PRIMARY KEY (id);
ALTER TABLE public.email_log ADD CONSTRAINT email_log_user_email_type_unique UNIQUE (user_id, email_type);
ALTER TABLE public.email_preferences ADD CONSTRAINT email_preferences_pkey PRIMARY KEY (user_id);
ALTER TABLE public.feature_feedback ADD CONSTRAINT feature_feedback_pkey PRIMARY KEY (id);
ALTER TABLE public.generation_failures ADD CONSTRAINT generation_failures_pkey PRIMARY KEY (id);
ALTER TABLE public.institutions ADD CONSTRAINT institutions_pkey PRIMARY KEY (id);
ALTER TABLE public.notifications ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);
ALTER TABLE public.payment_issues ADD CONSTRAINT payment_issues_pkey PRIMARY KEY (id);
ALTER TABLE public.payments ADD CONSTRAINT payments_paystack_reference_key UNIQUE (paystack_reference);
ALTER TABLE public.payments ADD CONSTRAINT payments_pkey PRIMARY KEY (id);
ALTER TABLE public.project_steps ADD CONSTRAINT project_steps_pkey PRIMARY KEY (id);
ALTER TABLE public.project_steps ADD CONSTRAINT project_steps_unique_per_step UNIQUE (project_id, step_type);
ALTER TABLE public.projects ADD CONSTRAINT projects_pkey PRIMARY KEY (id);
ALTER TABLE public.push_subscriptions ADD CONSTRAINT push_subscriptions_pkey PRIMARY KEY (id);
ALTER TABLE public.push_subscriptions ADD CONSTRAINT push_subscriptions_user_id_key UNIQUE (user_id);
ALTER TABLE public.referrals ADD CONSTRAINT referrals_pkey PRIMARY KEY (id);
ALTER TABLE public.response_times ADD CONSTRAINT response_times_pkey PRIMARY KEY (id);
ALTER TABLE public.system_logs ADD CONSTRAINT system_logs_pkey PRIMARY KEY (id);
ALTER TABLE public.user_achievements ADD CONSTRAINT user_achievements_pkey PRIMARY KEY (id);
ALTER TABLE public.user_achievements ADD CONSTRAINT user_achievements_user_id_achievement_key_key UNIQUE (user_id, achievement_key);
ALTER TABLE public.user_entitlements ADD CONSTRAINT user_entitlements_pkey PRIMARY KEY (user_id);
ALTER TABLE public.user_onboarding ADD CONSTRAINT user_onboarding_pkey PRIMARY KEY (user_id);
ALTER TABLE public.user_progress ADD CONSTRAINT user_progress_pkey PRIMARY KEY (user_id);
ALTER TABLE public.users ADD CONSTRAINT users_pkey PRIMARY KEY (id);
ALTER TABLE public.users ADD CONSTRAINT users_referral_code_key UNIQUE (referral_code);

-- Foreign keys (after all tables exist)
ALTER TABLE public.defense_certificates ADD CONSTRAINT defense_certificates_defense_session_id_fkey FOREIGN KEY (defense_session_id) REFERENCES public.defense_sessions(id) ON DELETE SET NULL;
ALTER TABLE public.defense_credits ADD CONSTRAINT defense_credits_source_referral_id_fkey FOREIGN KEY (source_referral_id) REFERENCES public.referrals(id) ON DELETE SET NULL;
ALTER TABLE public.defense_sessions ADD CONSTRAINT defense_sessions_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;
ALTER TABLE public.defense_sessions ADD CONSTRAINT defense_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
ALTER TABLE public.defense_turns ADD CONSTRAINT defense_turns_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.defense_sessions(id) ON DELETE CASCADE;
ALTER TABLE public.defense_turns ADD CONSTRAINT defense_turns_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
ALTER TABLE public.payments ADD CONSTRAINT payments_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE SET NULL;
ALTER TABLE public.payments ADD CONSTRAINT payments_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.project_steps ADD CONSTRAINT project_steps_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;
ALTER TABLE public.project_steps ADD CONSTRAINT project_steps_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
ALTER TABLE public.projects ADD CONSTRAINT projects_institution_id_fkey FOREIGN KEY (institution_id) REFERENCES public.institutions(id) ON DELETE SET NULL;
ALTER TABLE public.projects ADD CONSTRAINT projects_supervisor_id_fkey FOREIGN KEY (supervisor_id) REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.projects ADD CONSTRAINT projects_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
ALTER TABLE public.push_subscriptions ADD CONSTRAINT push_subscriptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
ALTER TABLE public.user_achievements ADD CONSTRAINT user_achievements_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
ALTER TABLE public.user_entitlements ADD CONSTRAINT user_entitlements_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
ALTER TABLE public.users ADD CONSTRAINT users_institution_id_fkey FOREIGN KEY (institution_id) REFERENCES public.institutions(id) ON DELETE SET NULL;

-- ============================================================
-- 8. ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;
CREATE POLICY admin_users_self_select ON public.admin_users AS PERMISSIVE FOR SELECT TO authenticated USING ((user_id = auth.uid()));

ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY app_config_select ON public.app_config AS PERMISSIVE FOR SELECT TO authenticated USING (true);

ALTER TABLE public.auth_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY server_only ON public.auth_attempts AS RESTRICTIVE FOR ALL TO authenticated USING (false);

ALTER TABLE public.daily_usage ENABLE ROW LEVEL SECURITY;
CREATE POLICY admin_select_daily_usage ON public.daily_usage AS PERMISSIVE FOR SELECT TO authenticated USING (is_admin());
CREATE POLICY authenticated_can_read_daily_usage ON public.daily_usage AS PERMISSIVE FOR SELECT TO authenticated USING (true);
CREATE POLICY server_only ON public.daily_usage AS PERMISSIVE FOR ALL TO public USING (is_admin()) WITH CHECK (is_admin());

ALTER TABLE public.defense_certificates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service role inserts" ON public.defense_certificates AS PERMISSIVE FOR INSERT TO service_role WITH CHECK (true);
CREATE POLICY "user reads own certs" ON public.defense_certificates AS PERMISSIVE FOR SELECT TO authenticated USING ((( SELECT auth.uid() AS uid) = user_id));

ALTER TABLE public.defense_credits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service role writes credits" ON public.defense_credits AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "user reads own credits" ON public.defense_credits AS PERMISSIVE FOR SELECT TO authenticated USING ((( SELECT auth.uid() AS uid) = user_id));

ALTER TABLE public.defense_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "defense_sessions insert own" ON public.defense_sessions AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (((( SELECT auth.uid() AS uid) = user_id) AND (project_id IN ( SELECT projects.id FROM projects WHERE (projects.user_id = ( SELECT auth.uid() AS uid))))));
CREATE POLICY "defense_sessions select own" ON public.defense_sessions AS PERMISSIVE FOR SELECT TO authenticated USING ((( SELECT auth.uid() AS uid) = user_id));
CREATE POLICY "defense_sessions update own" ON public.defense_sessions AS PERMISSIVE FOR UPDATE TO authenticated USING ((( SELECT auth.uid() AS uid) = user_id)) WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));

ALTER TABLE public.defense_turns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "defense_turns insert own" ON public.defense_turns AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (((( SELECT auth.uid() AS uid) = user_id) AND (session_id IN ( SELECT defense_sessions.id FROM defense_sessions WHERE (defense_sessions.user_id = ( SELECT auth.uid() AS uid))))));
CREATE POLICY "defense_turns select own" ON public.defense_turns AS PERMISSIVE FOR SELECT TO authenticated USING ((( SELECT auth.uid() AS uid) = user_id));

ALTER TABLE public.email_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service role only" ON public.email_log AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE public.email_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user inserts own prefs" ON public.email_preferences AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));
CREATE POLICY "user reads own prefs" ON public.email_preferences AS PERMISSIVE FOR SELECT TO authenticated USING ((( SELECT auth.uid() AS uid) = user_id));
CREATE POLICY "user updates own prefs" ON public.email_preferences AS PERMISSIVE FOR UPDATE TO authenticated USING ((( SELECT auth.uid() AS uid) = user_id)) WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));

ALTER TABLE public.feature_feedback ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user inserts own feedback" ON public.feature_feedback AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));
CREATE POLICY "user reads own feedback" ON public.feature_feedback AS PERMISSIVE FOR SELECT TO authenticated USING ((( SELECT auth.uid() AS uid) = user_id));

ALTER TABLE public.generation_failures ENABLE ROW LEVEL SECURITY;
CREATE POLICY admin_select_generation_failures ON public.generation_failures AS PERMISSIVE FOR SELECT TO authenticated USING (is_admin());
CREATE POLICY authenticated_can_read_generation_failures ON public.generation_failures AS PERMISSIVE FOR SELECT TO authenticated USING (true);
CREATE POLICY "insert own failures" ON public.generation_failures AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (((( SELECT auth.uid() AS uid) = user_id) OR (user_id IS NULL)));

ALTER TABLE public.institutions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "institutions readable by authenticated" ON public.institutions AS PERMISSIVE FOR SELECT TO authenticated USING (true);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY users_insert_own_notifications ON public.notifications AS PERMISSIVE FOR INSERT TO public WITH CHECK ((user_id = auth.uid()));
CREATE POLICY users_read_own_notifications ON public.notifications AS PERMISSIVE FOR SELECT TO public USING ((user_id = auth.uid()));
CREATE POLICY users_update_own_notifications ON public.notifications AS PERMISSIVE FOR UPDATE TO public USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));

ALTER TABLE public.payment_issues ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users insert own payment issues" ON public.payment_issues AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (((( SELECT auth.uid() AS uid) = user_id) OR (user_id IS NULL)));

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY admin_select_payments ON public.payments AS PERMISSIVE FOR SELECT TO authenticated USING (is_admin());
CREATE POLICY "payments select own" ON public.payments AS PERMISSIVE FOR SELECT TO authenticated USING ((( SELECT auth.uid() AS uid) = user_id));

ALTER TABLE public.project_steps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "project_steps delete own" ON public.project_steps AS PERMISSIVE FOR DELETE TO authenticated USING ((( SELECT auth.uid() AS uid) = user_id));
CREATE POLICY "project_steps insert own" ON public.project_steps AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (((( SELECT auth.uid() AS uid) = user_id) AND (project_id IN ( SELECT projects.id FROM projects WHERE (projects.user_id = ( SELECT auth.uid() AS uid))))));
CREATE POLICY "project_steps select own" ON public.project_steps AS PERMISSIVE FOR SELECT TO authenticated USING ((( SELECT auth.uid() AS uid) = user_id));
CREATE POLICY "project_steps update own" ON public.project_steps AS PERMISSIVE FOR UPDATE TO authenticated USING ((( SELECT auth.uid() AS uid) = user_id)) WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "projects delete own" ON public.projects AS PERMISSIVE FOR DELETE TO authenticated USING ((( SELECT auth.uid() AS uid) = user_id));
CREATE POLICY "projects insert own" ON public.projects AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (((( SELECT auth.uid() AS uid) = user_id) AND (supervisor_id IS NULL) AND (institution_id IS NULL)));
CREATE POLICY "projects select own" ON public.projects AS PERMISSIVE FOR SELECT TO authenticated USING ((( SELECT auth.uid() AS uid) = user_id));
CREATE POLICY "projects update own" ON public.projects AS PERMISSIVE FOR UPDATE TO authenticated USING ((( SELECT auth.uid() AS uid) = user_id)) WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users manage own subscription" ON public.push_subscriptions AS PERMISSIVE FOR ALL TO public USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));

ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service role writes referrals" ON public.referrals AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "user reads own referral rows" ON public.referrals AS PERMISSIVE FOR SELECT TO authenticated USING (((( SELECT auth.uid() AS uid) = referrer_user_id) OR (( SELECT auth.uid() AS uid) = referred_user_id)));

ALTER TABLE public.response_times ENABLE ROW LEVEL SECURITY;
CREATE POLICY admin_select_response_times ON public.response_times AS PERMISSIVE FOR SELECT TO authenticated USING (is_admin());
CREATE POLICY authenticated_can_read_response_times ON public.response_times AS PERMISSIVE FOR SELECT TO authenticated USING (true);
CREATE POLICY server_only ON public.response_times AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE public.system_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY server_only ON public.system_logs AS RESTRICTIVE FOR ALL TO authenticated USING (false);

ALTER TABLE public.user_achievements ENABLE ROW LEVEL SECURITY;
CREATE POLICY user_achievements_select_own ON public.user_achievements AS PERMISSIVE FOR SELECT TO public USING ((auth.uid() = user_id));

ALTER TABLE public.user_entitlements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "entitlements select own" ON public.user_entitlements AS PERMISSIVE FOR SELECT TO authenticated USING ((( SELECT auth.uid() AS uid) = user_id));

ALTER TABLE public.user_onboarding ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user inserts own onboarding" ON public.user_onboarding AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));
CREATE POLICY "user reads own onboarding" ON public.user_onboarding AS PERMISSIVE FOR SELECT TO authenticated USING ((( SELECT auth.uid() AS uid) = user_id));
CREATE POLICY "user updates own onboarding" ON public.user_onboarding AS PERMISSIVE FOR UPDATE TO authenticated USING ((( SELECT auth.uid() AS uid) = user_id)) WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));

ALTER TABLE public.user_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user inserts own progress" ON public.user_progress AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));
CREATE POLICY "user reads own progress" ON public.user_progress AS PERMISSIVE FOR SELECT TO authenticated USING ((( SELECT auth.uid() AS uid) = user_id));
CREATE POLICY "user updates own progress" ON public.user_progress AS PERMISSIVE FOR UPDATE TO authenticated USING ((( SELECT auth.uid() AS uid) = user_id)) WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
CREATE POLICY admin_select_users ON public.users AS PERMISSIVE FOR SELECT TO authenticated USING (is_admin());
CREATE POLICY "users insert self" ON public.users AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (((( SELECT auth.uid() AS uid) = id) AND (role = 'student'::text) AND (institution_id IS NULL)));
CREATE POLICY "users select own" ON public.users AS PERMISSIVE FOR SELECT TO authenticated USING ((( SELECT auth.uid() AS uid) = id));
CREATE POLICY "users update own profile" ON public.users AS PERMISSIVE FOR UPDATE TO authenticated USING ((( SELECT auth.uid() AS uid) = id)) WITH CHECK ((( SELECT auth.uid() AS uid) = id));

-- ============================================================
-- 9. INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_auth_attempts_created_at ON public.auth_attempts USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_auth_attempts_fails ON public.auth_attempts USING btree (ip, created_at DESC) WHERE (success = false);
CREATE INDEX IF NOT EXISTS idx_auth_attempts_ip ON public.auth_attempts USING btree (ip);
CREATE INDEX IF NOT EXISTS idx_daily_usage_date ON public.daily_usage USING btree (date);
CREATE INDEX IF NOT EXISTS defense_certificates_session_idx ON public.defense_certificates USING btree (defense_session_id);
CREATE INDEX IF NOT EXISTS defense_certificates_user_idx ON public.defense_certificates USING btree (user_id);
CREATE INDEX IF NOT EXISTS defense_credits_user_idx ON public.defense_credits USING btree (user_id, consumed);
CREATE INDEX IF NOT EXISTS idx_defense_credits_source_referral_id ON public.defense_credits USING btree (source_referral_id);
CREATE INDEX IF NOT EXISTS idx_defense_sessions_project_id ON public.defense_sessions USING btree (project_id);
CREATE INDEX IF NOT EXISTS idx_defense_sessions_user_id ON public.defense_sessions USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_defense_turns_session_id ON public.defense_turns USING btree (session_id);
CREATE INDEX IF NOT EXISTS idx_defense_turns_user_id ON public.defense_turns USING btree (user_id);
CREATE INDEX IF NOT EXISTS email_log_sent_at_idx ON public.email_log USING btree (sent_at DESC);
CREATE INDEX IF NOT EXISTS email_log_unique ON public.email_log USING btree (user_id, email_type) WHERE (status = 'sent'::text);
CREATE INDEX IF NOT EXISTS feature_feedback_created_idx ON public.feature_feedback USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS feature_feedback_feature_idx ON public.feature_feedback USING btree (feature);
CREATE INDEX IF NOT EXISTS feature_feedback_user_idx ON public.feature_feedback USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_gen_failures_created_at ON public.generation_failures USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_gen_failures_user_id ON public.generation_failures USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_institutions_short_name ON public.institutions USING btree (short_name);
CREATE INDEX IF NOT EXISTS notifications_user_created_idx ON public.notifications USING btree (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payment_issues_user_id ON public.payment_issues USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_payments_paystack_reference ON public.payments USING btree (paystack_reference);
CREATE INDEX IF NOT EXISTS idx_payments_project_id ON public.payments USING btree (project_id);
CREATE INDEX IF NOT EXISTS idx_payments_status_created_at ON public.payments USING btree (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payments_user_id ON public.payments USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_project_steps_project_id ON public.project_steps USING btree (project_id);
CREATE INDEX IF NOT EXISTS idx_project_steps_step_type ON public.project_steps USING btree (step_type);
CREATE INDEX IF NOT EXISTS idx_project_steps_user_id ON public.project_steps USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_projects_institution_id ON public.projects USING btree (institution_id);
CREATE INDEX IF NOT EXISTS idx_projects_supervisor_id ON public.projects USING btree (supervisor_id);
CREATE INDEX IF NOT EXISTS idx_projects_user_id ON public.projects USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_projects_user_id_updated_at ON public.projects USING btree (user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS referrals_referred_unique ON public.referrals USING btree (referred_user_id);
CREATE INDEX IF NOT EXISTS referrals_referrer_idx ON public.referrals USING btree (referrer_user_id);
CREATE INDEX IF NOT EXISTS referrals_status_idx ON public.referrals USING btree (status);
CREATE INDEX IF NOT EXISTS idx_response_times_created_at ON public.response_times USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_response_times_user_id ON public.response_times USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_system_logs_created_at ON public.system_logs USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_system_logs_severity_resolved_created ON public.system_logs USING btree (severity, resolved, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_users_institution_id ON public.users USING btree (institution_id);
CREATE INDEX IF NOT EXISTS idx_users_role ON public.users USING btree (role);

-- ============================================================
-- 10. TRIGGERS
-- ============================================================

CREATE OR REPLACE TRIGGER trg_cert_number
  BEFORE INSERT ON public.defense_certificates
  FOR EACH ROW EXECUTE FUNCTION public.generate_cert_number();

CREATE OR REPLACE TRIGGER trg_project_steps_updated_at
  BEFORE UPDATE ON public.project_steps
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE TRIGGER user_progress_defense_ready_check
  BEFORE UPDATE ON public.user_progress
  FOR EACH ROW EXECUTE FUNCTION public.enforce_defense_ready();

CREATE OR REPLACE TRIGGER users_referral_code_gen
  BEFORE INSERT ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.generate_referral_code();

-- ============================================================
-- 11. AUTH TRIGGER (creates public.users + user_entitlements on signup)
-- ============================================================

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- DONE. Verify with:
-- SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename;
-- SELECT tablename FROM pg_tables WHERE schemaname='public' AND rowsecurity = false;
-- (second query must return 0 rows)
-- ============================================================
