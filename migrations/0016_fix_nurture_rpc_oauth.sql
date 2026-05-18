-- Migration 0016: Fix get_eligible_nurture_users to include Google OAuth users.
-- Google OAuth users have confirmed_at set but email_confirmed_at may be NULL
-- in some Supabase/GoTrue configurations, because email_confirmed_at only records
-- confirmation via Supabase's own email link — not OAuth provider verification.
-- This caused all OAuth users to be silently excluded from every nurture email.
-- Fix: use COALESCE(email_confirmed_at, confirmed_at) so both auth methods qualify.

CREATE OR REPLACE FUNCTION public.get_eligible_nurture_users(
  p_email_type text,
  p_min_days   integer
)
RETURNS TABLE (
  user_id uuid,
  email   text,
  name    text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
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
