-- Add faculty and department to defense_certificates
-- The insert payload in api/certificate.js includes both columns but they were
-- omitted from the original 2026_06_defense_certificates.sql migration.
-- Both are nullable — existing rows have no values and students may not have
-- filled in their profile at the time the certificate was issued.

ALTER TABLE public.defense_certificates
  ADD COLUMN IF NOT EXISTS faculty    text,
  ADD COLUMN IF NOT EXISTS department text;
