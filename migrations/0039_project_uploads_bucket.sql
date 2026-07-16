-- Migration 0039: project-uploads bucket for async Project Reviewer PDF uploads.
-- The browser uploads a student's draft PDF here directly (off our 60s-capped
-- serverless functions); the reviewer endpoint downloads it via service role,
-- reviews it, then deletes it. Objects are transient — one per review.
--
-- Path convention: {user_id}/{uuid}.pdf  — RLS keys on the user_id prefix.
-- Mirrors the scoped-ownership pattern from the avatar bucket policy
-- (20260518110004_medium_fix_avatar_bucket_policy.sql). Private bucket: no
-- public read policy — these are unpublished drafts.

INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('project-uploads', 'project-uploads', false, 5242880)
ON CONFLICT (id) DO NOTHING;

-- INSERT: a user may write only into their own {user_id}/... prefix.
CREATE POLICY "Users can upload own reviewer PDFs"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'project-uploads'
    AND (storage.foldername(name))[1] = (auth.uid())::text
  );

-- SELECT: owner only (service role bypasses RLS for the server download).
CREATE POLICY "Users can read own reviewer PDFs"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'project-uploads'
    AND owner_id = (auth.uid())::text
  );

-- DELETE: owner only (server cleanup runs via service role).
CREATE POLICY "Users can delete own reviewer PDFs"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'project-uploads'
    AND owner_id = (auth.uid())::text
  );

-- ── Verification ──────────────────────────────────────────────────────────────
-- SELECT policyname, cmd FROM pg_policies
-- WHERE schemaname='storage' AND tablename='objects'
--   AND policyname LIKE '%reviewer PDFs%';
-- Expected: three rows (INSERT, SELECT, DELETE).
