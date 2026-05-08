-- get_eligible_nurture_users: returns users due to receive a given email type.
-- Called by the email-nurture Deno Edge Function via service_role RPC.
-- SECURITY DEFINER: runs as the function owner (postgres), allowing access to auth.users.
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
  WHERE au.email_confirmed_at IS NOT NULL
    AND au.email IS NOT NULL
    AND au.email_confirmed_at <= now() - (p_min_days || ' days')::interval
    AND NOT EXISTS (
      SELECT 1 FROM public.email_log el
      WHERE el.user_id   = au.id
        AND el.email_type = p_email_type
    );
$$;
