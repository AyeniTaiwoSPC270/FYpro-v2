CREATE TABLE public.payment_issues (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  user_email      text NOT NULL,
  transaction_ref text NOT NULL,
  description     text,
  created_at      timestamptz DEFAULT now(),
  resolved        boolean DEFAULT false
);

ALTER TABLE public.payment_issues ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users insert own payment issues"
  ON public.payment_issues FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id OR user_id IS NULL);
