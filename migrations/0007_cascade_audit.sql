-- Migration 0007: cascade audit
-- Run this SELECT in the Supabase SQL Editor to verify the full cascade chain
-- is in place before deploying the simplified deletion handlers.
--
-- Expected result: every row should show delete_rule = 'CASCADE' (except
-- generation_failures and payment_issues which must show 'SET NULL').
--
-- If any row shows 'NO ACTION' or 'RESTRICT', add the missing CASCADE before
-- deploying the api/admin.js changes from this commit.

SELECT
  tc.table_name,
  kcu.column_name,
  ccu.table_name  AS references_table,
  rc.delete_rule
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema  = kcu.table_schema
JOIN information_schema.referential_constraints rc
  ON tc.constraint_name = rc.constraint_name
JOIN information_schema.constraint_column_usage ccu
  ON rc.unique_constraint_name = ccu.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema    = 'public'
  AND kcu.column_name    = 'user_id'
ORDER BY tc.table_name;

-- Expected output:
-- defense_sessions   | user_id | users             | CASCADE
-- defense_turns      | user_id | users             | CASCADE
-- generation_failures| user_id | users (auth)      | SET NULL
-- payment_issues     | user_id | users (auth)      | SET NULL
-- payments           | user_id | users             | CASCADE
-- project_steps      | user_id | users             | CASCADE
-- user_entitlements  | user_id | users             | CASCADE
--
-- Note: public.users.id → auth.users(id) ON DELETE CASCADE is verified separately:
SELECT
  tc.table_name,
  kcu.column_name,
  rc.delete_rule
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema  = kcu.table_schema
JOIN information_schema.referential_constraints rc
  ON tc.constraint_name = rc.constraint_name
JOIN information_schema.constraint_column_usage ccu
  ON rc.unique_constraint_name = ccu.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema  = 'public'
  AND tc.table_name    = 'users'
  AND kcu.column_name  = 'id';
-- Expected: users | id | CASCADE
