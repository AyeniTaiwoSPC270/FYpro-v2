export const PRICING_KOBO = {
  student_pack:          200000,  // ₦2,000
  defense_pack:          350000,  // ₦3,500
  defense_pack_upgrade:  150000,  // ₦1,500 — upgrade from Student Pack
  express_defense:       200000,  // ₦2,000 — defense-only for already-done students
  project_reset:         150000,  // ₦1,500
};

export function expectedAmountKobo(tier) {
  const amount = PRICING_KOBO[tier];
  if (!amount) throw new Error(`Unknown tier: ${tier}`);
  return amount;
}
