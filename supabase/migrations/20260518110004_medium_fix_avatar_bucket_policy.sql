-- Migration: medium_fix_avatar_bucket_policy
-- Severity: MEDIUM (M6)
-- Problem: The "Public read access for avatars" policy on storage.objects has
--          qual = (bucket_id = 'avatars') with no name filter. This allows
--          any client (including unauthenticated) to call the Supabase Storage
--          list API and enumerate ALL avatar filenames, which expose user UUIDs.
--          Public bucket CDN URLs (https://...supabase.co/storage/v1/object/public/...)
--          are unaffected by RLS and will continue to work for direct URL access.
-- Fix: Drop the broad public SELECT policy. Add a scoped policy allowing each
--      authenticated user to read only files they own (owner_id = auth.uid()).
--      This closes the enumeration vector while keeping CDN URLs functional.
-- Note: owner_id is automatically set to (auth.uid())::text by Supabase Storage
--       on every upload. Existing uploaded avatars already have owner_id set.

DROP POLICY IF EXISTS "Public read access for avatars" ON storage.objects;

CREATE POLICY "Users can read own avatar"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'avatars'
    AND owner_id = (auth.uid())::text
  );

-- ── Verification ──────────────────────────────────────────────────────────────
-- SELECT policyname, roles, cmd, qual
-- FROM pg_policies
-- WHERE schemaname = 'storage' AND tablename = 'objects'
--   AND cmd = 'SELECT';
-- Expected: only "Users can read own avatar" remains for SELECT.
-- "Public read access for avatars" must NOT appear.
