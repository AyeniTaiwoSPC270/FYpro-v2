-- Renumbered 2026-07-31 from 0029_express_defense_tier.sql (prefix collided with 0029_dismissed_banners.sql). Already applied in production.
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
