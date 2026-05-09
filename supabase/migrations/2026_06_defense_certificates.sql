-- ── Defense Certificates ──────────────────────────────────────────────────────
-- Minted server-side only after verifying defense_sessions.total_score >= 7.
-- Clients can SELECT their own rows (read-only).
-- Only service_role can INSERT — score check happens in /api/certificate before insert.
-- No UPDATE or DELETE policies exist for any role.

-- ── Sequence for certificate numbers ─────────────────────────────────────────

CREATE SEQUENCE IF NOT EXISTS public.defense_certificates_seq START 1;

-- ── Table ─────────────────────────────────────────────────────────────────────

CREATE TABLE public.defense_certificates (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- References defense_sessions(id). FK wired below once the sessions table is
  -- confirmed present (it is — see architecture-decisions.md §defense_sessions).
  defense_session_id  uuid        NOT NULL,
  score               numeric(3,1) NOT NULL CHECK (score >= 0 AND score <= 10),
  topic_title         text        NOT NULL,
  recipient_name      text        NOT NULL,
  issued_at           timestamptz NOT NULL DEFAULT now(),
  -- Auto-populated by trg_cert_number trigger below.
  certificate_number  text        NOT NULL UNIQUE
);

-- FK to defense_sessions — ensures the certificate always references a real session
ALTER TABLE public.defense_certificates
  ADD CONSTRAINT fk_cert_session
  FOREIGN KEY (defense_session_id)
  REFERENCES public.defense_sessions(id)
  ON DELETE CASCADE;

-- ── Indexes ───────────────────────────────────────────────────────────────────

CREATE INDEX defense_certificates_user_idx    ON public.defense_certificates(user_id);
CREATE INDEX defense_certificates_session_idx ON public.defense_certificates(defense_session_id);

-- ── Certificate number trigger ────────────────────────────────────────────────
-- Format: FYP-YYYY-NNNNNN (year of issuance, global sequence padded to 6 digits)
-- e.g. FYP-2026-000001

CREATE OR REPLACE FUNCTION public.generate_cert_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

CREATE TRIGGER trg_cert_number
  BEFORE INSERT ON public.defense_certificates
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_cert_number();

-- ── RLS ───────────────────────────────────────────────────────────────────────

ALTER TABLE public.defense_certificates ENABLE ROW LEVEL SECURITY;

-- Users can read their own certificates
CREATE POLICY "user reads own certs"
  ON public.defense_certificates
  FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);

-- Only service_role can INSERT (score verified in /api/certificate before this runs)
CREATE POLICY "service role inserts"
  ON public.defense_certificates
  FOR INSERT TO service_role
  WITH CHECK (true);

-- No UPDATE or DELETE policies for any role.
-- Certificates are immutable once issued.

-- ── Verification ──────────────────────────────────────────────────────────────
-- After running this migration, confirm:
--   SELECT tablename FROM pg_tables
--   WHERE schemaname='public' AND rowsecurity = false;
-- Must return zero rows.
