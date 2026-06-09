-- Migration 0028: Fall back to Google OAuth metadata for name in nurture emails.
-- public.users.full_name is null for Google OAuth users whose profile trigger
-- didn't populate the column. The actual name lives in auth.users.raw_user_meta_data.
-- COALESCE order: users table → Google 'full_name' key → Google 'name' key → null.

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
    au.id AS user_id,
    au.email AS email,
    COALESCE(
      pu.full_name,
      au.raw_user_meta_data->>'full_name',
      au.raw_user_meta_data->>'name'
    ) AS name
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
