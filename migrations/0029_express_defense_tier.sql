-- Migration: 0029_express_defense_tier
-- Adds 'express_defense' as a valid tier in the payments table.
-- Run in Supabase SQL Editor.

ALTER TABLE payments
DROP CONSTRAINT IF EXISTS payments_tier_check;

ALTER TABLE payments
ADD CONSTRAINT payments_tier_check
CHECK (tier IN (
  'student_pack',
  'defense_pack',
  'defense_pack_upgrade',
  'project_reset',
  'express_defense'
));
