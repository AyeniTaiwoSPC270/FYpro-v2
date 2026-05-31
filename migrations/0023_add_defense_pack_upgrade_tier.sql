-- migrations/0023_add_defense_pack_upgrade_tier.sql
-- Adds defense_pack_upgrade to the payments tier constraint.
-- defense_pack_upgrade is charged when a student_pack holder upgrades to defense_pack
-- (they pay only the ₦1,500 difference). The entitlement granted is identical to defense_pack.

ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_tier_check;

ALTER TABLE payments ADD CONSTRAINT payments_tier_check
  CHECK (tier IN ('student_pack', 'defense_pack', 'defense_pack_upgrade', 'project_reset'));
