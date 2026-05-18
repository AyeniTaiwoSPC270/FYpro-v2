-- Migration: fix_certificates_fk_set_null
-- Severity: HIGH (H2)
-- Problem: defense_certificates.defense_session_id FK is ON DELETE CASCADE.
--          The full chain is: delete project → CASCADE defense_sessions
--          → CASCADE defense_certificates.
--          A student who scored 8/10 and earned certificate FYP-2026-000001
--          loses it permanently if they delete their project.
--          Defense Pack customers lose paid-for content.
-- Fix: Change to ON DELETE SET NULL. Certificates become permanent records.
--      defense_session_id becomes NULL if the session is deleted, but
--      the certificate row, its number, score, and recipient_name remain.
--
-- Note: Two possible constraint names exist depending on how the table was
--       created. Both are dropped with IF EXISTS to be safe.

ALTER TABLE public.defense_certificates
  DROP CONSTRAINT IF EXISTS defense_certificates_defense_session_id_fkey;

ALTER TABLE public.defense_certificates
  DROP CONSTRAINT IF EXISTS fk_cert_session;

-- defense_session_id must become nullable to accept SET NULL on cascade
ALTER TABLE public.defense_certificates
  ALTER COLUMN defense_session_id DROP NOT NULL;

ALTER TABLE public.defense_certificates
  ADD CONSTRAINT defense_certificates_defense_session_id_fkey
    FOREIGN KEY (defense_session_id)
    REFERENCES public.defense_sessions(id)
    ON DELETE SET NULL;

-- ── Verification ──────────────────────────────────────────────────────────────
-- After applying, run this to confirm:
--
-- SELECT tc.table_name, kcu.column_name, rc.delete_rule
-- FROM information_schema.table_constraints tc
-- JOIN information_schema.key_column_usage kcu
--   ON tc.constraint_name = kcu.constraint_name
-- JOIN information_schema.referential_constraints rc
--   ON rc.constraint_name = tc.constraint_name
-- WHERE tc.table_name = 'defense_certificates';
--
-- Expected: defense_certificates | defense_session_id | SET NULL
--
-- Also confirm column is now nullable:
-- SELECT column_name, is_nullable
-- FROM information_schema.columns
-- WHERE table_name = 'defense_certificates'
--   AND column_name = 'defense_session_id';
-- Expected: defense_session_id | YES
