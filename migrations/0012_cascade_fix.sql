-- Migration 0012: Ensure ON DELETE CASCADE for all user-related FK constraints.
-- Run in Supabase SQL Editor. Idempotent — safe to run multiple times.
--
-- When an admin deletes a row from auth.users, this migration guarantees the
-- full cascade chain fires:
--
--   auth.users
--     └─ public.users                  (ON DELETE CASCADE)
--          ├─ user_entitlements         (ON DELETE CASCADE)
--          ├─ projects                  (ON DELETE CASCADE)
--          │    └─ project_steps        (via user_id on project_steps)
--          ├─ project_steps             (ON DELETE CASCADE — user_id)
--          ├─ defense_sessions          (ON DELETE CASCADE)
--          ├─ defense_turns             (ON DELETE CASCADE)
--          └─ payments                  (ON DELETE CASCADE)
--     └─ user_onboarding               (ON DELETE CASCADE — references auth.users directly)
--     └─ user_progress                 (ON DELETE CASCADE — references auth.users directly)
--     └─ email_preferences             (ON DELETE CASCADE — references auth.users directly)
--     └─ email_log                     (ON DELETE CASCADE — references auth.users directly)
--     └─ feature_feedback              (ON DELETE CASCADE — references auth.users directly)
--     └─ defense_credits               (ON DELETE CASCADE — references auth.users directly)
--     └─ defense_certificates          (ON DELETE CASCADE — references auth.users directly)
--     └─ referrals.referrer_user_id    (ON DELETE CASCADE — references auth.users directly)
--     └─ referrals.referred_user_id    (ON DELETE CASCADE — references auth.users directly)
--
-- The DO block below:
--   1. Finds any FK on a listed (table, column) pair whose delete_rule is not CASCADE.
--   2. Drops it.
--   3. Recreates it with ON DELETE CASCADE.
-- If the constraint already has CASCADE, the block does nothing for that pair.

DO $$
DECLARE
  v_cname text;
BEGIN

  -- ── public.users.id → auth.users(id) ─────────────────────────────────────────
  SELECT rc.constraint_name INTO v_cname
  FROM information_schema.referential_constraints rc
  JOIN information_schema.key_column_usage kcu
    ON rc.constraint_name = kcu.constraint_name AND rc.constraint_schema = kcu.table_schema
  WHERE kcu.table_schema = 'public' AND kcu.table_name = 'users'
    AND kcu.column_name = 'id' AND rc.delete_rule <> 'CASCADE'
  LIMIT 1;
  IF FOUND THEN
    EXECUTE format('ALTER TABLE public.users DROP CONSTRAINT %I', v_cname);
    EXECUTE 'ALTER TABLE public.users ADD CONSTRAINT users_id_cascade_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE';
    RAISE NOTICE '[cascade-fix] Fixed public.users.id → auth.users ON DELETE CASCADE';
  END IF;

  -- ── user_entitlements.user_id → public.users(id) ─────────────────────────────
  SELECT rc.constraint_name INTO v_cname
  FROM information_schema.referential_constraints rc
  JOIN information_schema.key_column_usage kcu
    ON rc.constraint_name = kcu.constraint_name AND rc.constraint_schema = kcu.table_schema
  WHERE kcu.table_schema = 'public' AND kcu.table_name = 'user_entitlements'
    AND kcu.column_name = 'user_id' AND rc.delete_rule <> 'CASCADE'
  LIMIT 1;
  IF FOUND THEN
    EXECUTE format('ALTER TABLE public.user_entitlements DROP CONSTRAINT %I', v_cname);
    EXECUTE 'ALTER TABLE public.user_entitlements ADD CONSTRAINT user_entitlements_user_id_cascade_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE';
    RAISE NOTICE '[cascade-fix] Fixed user_entitlements.user_id ON DELETE CASCADE';
  END IF;

  -- ── projects.user_id → public.users(id) ──────────────────────────────────────
  SELECT rc.constraint_name INTO v_cname
  FROM information_schema.referential_constraints rc
  JOIN information_schema.key_column_usage kcu
    ON rc.constraint_name = kcu.constraint_name AND rc.constraint_schema = kcu.table_schema
  WHERE kcu.table_schema = 'public' AND kcu.table_name = 'projects'
    AND kcu.column_name = 'user_id' AND rc.delete_rule <> 'CASCADE'
  LIMIT 1;
  IF FOUND THEN
    EXECUTE format('ALTER TABLE public.projects DROP CONSTRAINT %I', v_cname);
    EXECUTE 'ALTER TABLE public.projects ADD CONSTRAINT projects_user_id_cascade_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE';
    RAISE NOTICE '[cascade-fix] Fixed projects.user_id ON DELETE CASCADE';
  END IF;

  -- ── project_steps.user_id → public.users(id) ─────────────────────────────────
  SELECT rc.constraint_name INTO v_cname
  FROM information_schema.referential_constraints rc
  JOIN information_schema.key_column_usage kcu
    ON rc.constraint_name = kcu.constraint_name AND rc.constraint_schema = kcu.table_schema
  WHERE kcu.table_schema = 'public' AND kcu.table_name = 'project_steps'
    AND kcu.column_name = 'user_id' AND rc.delete_rule <> 'CASCADE'
  LIMIT 1;
  IF FOUND THEN
    EXECUTE format('ALTER TABLE public.project_steps DROP CONSTRAINT %I', v_cname);
    EXECUTE 'ALTER TABLE public.project_steps ADD CONSTRAINT project_steps_user_id_cascade_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE';
    RAISE NOTICE '[cascade-fix] Fixed project_steps.user_id ON DELETE CASCADE';
  END IF;

  -- ── defense_sessions.user_id → public.users(id) ──────────────────────────────
  SELECT rc.constraint_name INTO v_cname
  FROM information_schema.referential_constraints rc
  JOIN information_schema.key_column_usage kcu
    ON rc.constraint_name = kcu.constraint_name AND rc.constraint_schema = kcu.table_schema
  WHERE kcu.table_schema = 'public' AND kcu.table_name = 'defense_sessions'
    AND kcu.column_name = 'user_id' AND rc.delete_rule <> 'CASCADE'
  LIMIT 1;
  IF FOUND THEN
    EXECUTE format('ALTER TABLE public.defense_sessions DROP CONSTRAINT %I', v_cname);
    EXECUTE 'ALTER TABLE public.defense_sessions ADD CONSTRAINT defense_sessions_user_id_cascade_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE';
    RAISE NOTICE '[cascade-fix] Fixed defense_sessions.user_id ON DELETE CASCADE';
  END IF;

  -- ── defense_turns.user_id → public.users(id) ─────────────────────────────────
  SELECT rc.constraint_name INTO v_cname
  FROM information_schema.referential_constraints rc
  JOIN information_schema.key_column_usage kcu
    ON rc.constraint_name = kcu.constraint_name AND rc.constraint_schema = kcu.table_schema
  WHERE kcu.table_schema = 'public' AND kcu.table_name = 'defense_turns'
    AND kcu.column_name = 'user_id' AND rc.delete_rule <> 'CASCADE'
  LIMIT 1;
  IF FOUND THEN
    EXECUTE format('ALTER TABLE public.defense_turns DROP CONSTRAINT %I', v_cname);
    EXECUTE 'ALTER TABLE public.defense_turns ADD CONSTRAINT defense_turns_user_id_cascade_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE';
    RAISE NOTICE '[cascade-fix] Fixed defense_turns.user_id ON DELETE CASCADE';
  END IF;

  -- ── payments.user_id → public.users(id) ──────────────────────────────────────
  SELECT rc.constraint_name INTO v_cname
  FROM information_schema.referential_constraints rc
  JOIN information_schema.key_column_usage kcu
    ON rc.constraint_name = kcu.constraint_name AND rc.constraint_schema = kcu.table_schema
  WHERE kcu.table_schema = 'public' AND kcu.table_name = 'payments'
    AND kcu.column_name = 'user_id' AND rc.delete_rule <> 'CASCADE'
  LIMIT 1;
  IF FOUND THEN
    EXECUTE format('ALTER TABLE public.payments DROP CONSTRAINT %I', v_cname);
    EXECUTE 'ALTER TABLE public.payments ADD CONSTRAINT payments_user_id_cascade_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE';
    RAISE NOTICE '[cascade-fix] Fixed payments.user_id ON DELETE CASCADE';
  END IF;

  -- ── user_onboarding.user_id → auth.users(id) ─────────────────────────────────
  SELECT rc.constraint_name INTO v_cname
  FROM information_schema.referential_constraints rc
  JOIN information_schema.key_column_usage kcu
    ON rc.constraint_name = kcu.constraint_name AND rc.constraint_schema = kcu.table_schema
  WHERE kcu.table_schema = 'public' AND kcu.table_name = 'user_onboarding'
    AND kcu.column_name = 'user_id' AND rc.delete_rule <> 'CASCADE'
  LIMIT 1;
  IF FOUND THEN
    EXECUTE format('ALTER TABLE public.user_onboarding DROP CONSTRAINT %I', v_cname);
    EXECUTE 'ALTER TABLE public.user_onboarding ADD CONSTRAINT user_onboarding_user_id_cascade_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE';
    RAISE NOTICE '[cascade-fix] Fixed user_onboarding.user_id ON DELETE CASCADE';
  END IF;

  -- ── user_progress.user_id → auth.users(id) ───────────────────────────────────
  SELECT rc.constraint_name INTO v_cname
  FROM information_schema.referential_constraints rc
  JOIN information_schema.key_column_usage kcu
    ON rc.constraint_name = kcu.constraint_name AND rc.constraint_schema = kcu.table_schema
  WHERE kcu.table_schema = 'public' AND kcu.table_name = 'user_progress'
    AND kcu.column_name = 'user_id' AND rc.delete_rule <> 'CASCADE'
  LIMIT 1;
  IF FOUND THEN
    EXECUTE format('ALTER TABLE public.user_progress DROP CONSTRAINT %I', v_cname);
    EXECUTE 'ALTER TABLE public.user_progress ADD CONSTRAINT user_progress_user_id_cascade_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE';
    RAISE NOTICE '[cascade-fix] Fixed user_progress.user_id ON DELETE CASCADE';
  END IF;

  -- ── email_preferences.user_id → auth.users(id) ───────────────────────────────
  SELECT rc.constraint_name INTO v_cname
  FROM information_schema.referential_constraints rc
  JOIN information_schema.key_column_usage kcu
    ON rc.constraint_name = kcu.constraint_name AND rc.constraint_schema = kcu.table_schema
  WHERE kcu.table_schema = 'public' AND kcu.table_name = 'email_preferences'
    AND kcu.column_name = 'user_id' AND rc.delete_rule <> 'CASCADE'
  LIMIT 1;
  IF FOUND THEN
    EXECUTE format('ALTER TABLE public.email_preferences DROP CONSTRAINT %I', v_cname);
    EXECUTE 'ALTER TABLE public.email_preferences ADD CONSTRAINT email_preferences_user_id_cascade_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE';
    RAISE NOTICE '[cascade-fix] Fixed email_preferences.user_id ON DELETE CASCADE';
  END IF;

  -- ── email_log.user_id → auth.users(id) ───────────────────────────────────────
  SELECT rc.constraint_name INTO v_cname
  FROM information_schema.referential_constraints rc
  JOIN information_schema.key_column_usage kcu
    ON rc.constraint_name = kcu.constraint_name AND rc.constraint_schema = kcu.table_schema
  WHERE kcu.table_schema = 'public' AND kcu.table_name = 'email_log'
    AND kcu.column_name = 'user_id' AND rc.delete_rule <> 'CASCADE'
  LIMIT 1;
  IF FOUND THEN
    EXECUTE format('ALTER TABLE public.email_log DROP CONSTRAINT %I', v_cname);
    EXECUTE 'ALTER TABLE public.email_log ADD CONSTRAINT email_log_user_id_cascade_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE';
    RAISE NOTICE '[cascade-fix] Fixed email_log.user_id ON DELETE CASCADE';
  END IF;

  -- ── feature_feedback.user_id → auth.users(id) ────────────────────────────────
  SELECT rc.constraint_name INTO v_cname
  FROM information_schema.referential_constraints rc
  JOIN information_schema.key_column_usage kcu
    ON rc.constraint_name = kcu.constraint_name AND rc.constraint_schema = kcu.table_schema
  WHERE kcu.table_schema = 'public' AND kcu.table_name = 'feature_feedback'
    AND kcu.column_name = 'user_id' AND rc.delete_rule <> 'CASCADE'
  LIMIT 1;
  IF FOUND THEN
    EXECUTE format('ALTER TABLE public.feature_feedback DROP CONSTRAINT %I', v_cname);
    EXECUTE 'ALTER TABLE public.feature_feedback ADD CONSTRAINT feature_feedback_user_id_cascade_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE';
    RAISE NOTICE '[cascade-fix] Fixed feature_feedback.user_id ON DELETE CASCADE';
  END IF;

  -- ── defense_credits.user_id → auth.users(id) ─────────────────────────────────
  SELECT rc.constraint_name INTO v_cname
  FROM information_schema.referential_constraints rc
  JOIN information_schema.key_column_usage kcu
    ON rc.constraint_name = kcu.constraint_name AND rc.constraint_schema = kcu.table_schema
  WHERE kcu.table_schema = 'public' AND kcu.table_name = 'defense_credits'
    AND kcu.column_name = 'user_id' AND rc.delete_rule <> 'CASCADE'
  LIMIT 1;
  IF FOUND THEN
    EXECUTE format('ALTER TABLE public.defense_credits DROP CONSTRAINT %I', v_cname);
    EXECUTE 'ALTER TABLE public.defense_credits ADD CONSTRAINT defense_credits_user_id_cascade_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE';
    RAISE NOTICE '[cascade-fix] Fixed defense_credits.user_id ON DELETE CASCADE';
  END IF;

  -- ── defense_certificates.user_id → auth.users(id) ────────────────────────────
  SELECT rc.constraint_name INTO v_cname
  FROM information_schema.referential_constraints rc
  JOIN information_schema.key_column_usage kcu
    ON rc.constraint_name = kcu.constraint_name AND rc.constraint_schema = kcu.table_schema
  WHERE kcu.table_schema = 'public' AND kcu.table_name = 'defense_certificates'
    AND kcu.column_name = 'user_id' AND rc.delete_rule <> 'CASCADE'
  LIMIT 1;
  IF FOUND THEN
    EXECUTE format('ALTER TABLE public.defense_certificates DROP CONSTRAINT %I', v_cname);
    EXECUTE 'ALTER TABLE public.defense_certificates ADD CONSTRAINT defense_certificates_user_id_cascade_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE';
    RAISE NOTICE '[cascade-fix] Fixed defense_certificates.user_id ON DELETE CASCADE';
  END IF;

  -- ── referrals.referrer_user_id → auth.users(id) ──────────────────────────────
  SELECT rc.constraint_name INTO v_cname
  FROM information_schema.referential_constraints rc
  JOIN information_schema.key_column_usage kcu
    ON rc.constraint_name = kcu.constraint_name AND rc.constraint_schema = kcu.table_schema
  WHERE kcu.table_schema = 'public' AND kcu.table_name = 'referrals'
    AND kcu.column_name = 'referrer_user_id' AND rc.delete_rule <> 'CASCADE'
  LIMIT 1;
  IF FOUND THEN
    EXECUTE format('ALTER TABLE public.referrals DROP CONSTRAINT %I', v_cname);
    EXECUTE 'ALTER TABLE public.referrals ADD CONSTRAINT referrals_referrer_cascade_fkey FOREIGN KEY (referrer_user_id) REFERENCES auth.users(id) ON DELETE CASCADE';
    RAISE NOTICE '[cascade-fix] Fixed referrals.referrer_user_id ON DELETE CASCADE';
  END IF;

  -- ── referrals.referred_user_id → auth.users(id) ──────────────────────────────
  SELECT rc.constraint_name INTO v_cname
  FROM information_schema.referential_constraints rc
  JOIN information_schema.key_column_usage kcu
    ON rc.constraint_name = kcu.constraint_name AND rc.constraint_schema = kcu.table_schema
  WHERE kcu.table_schema = 'public' AND kcu.table_name = 'referrals'
    AND kcu.column_name = 'referred_user_id' AND rc.delete_rule <> 'CASCADE'
  LIMIT 1;
  IF FOUND THEN
    EXECUTE format('ALTER TABLE public.referrals DROP CONSTRAINT %I', v_cname);
    EXECUTE 'ALTER TABLE public.referrals ADD CONSTRAINT referrals_referred_cascade_fkey FOREIGN KEY (referred_user_id) REFERENCES auth.users(id) ON DELETE CASCADE';
    RAISE NOTICE '[cascade-fix] Fixed referrals.referred_user_id ON DELETE CASCADE';
  END IF;

END;
$$;

-- ── Verification (run after applying; must return zero rows) ──────────────────

-- Every row below confirms a CASCADE exists. Zero rows = missing CASCADE.
-- SELECT
--   tc.table_name,
--   kcu.column_name,
--   rc.delete_rule
-- FROM information_schema.referential_constraints rc
-- JOIN information_schema.key_column_usage kcu
--   ON rc.constraint_name = kcu.constraint_name AND rc.constraint_schema = kcu.table_schema
-- JOIN information_schema.table_constraints tc
--   ON tc.constraint_name = rc.constraint_name AND tc.table_schema = kcu.table_schema
-- WHERE kcu.table_schema = 'public'
--   AND kcu.column_name IN ('user_id', 'referrer_user_id', 'referred_user_id')
--   OR (kcu.table_name = 'users' AND kcu.column_name = 'id')
-- ORDER BY tc.table_name, kcu.column_name;
-- Expected: delete_rule = 'CASCADE' for every row.
