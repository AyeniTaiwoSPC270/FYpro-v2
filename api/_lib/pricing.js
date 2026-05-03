export const PRICING_KOBO = {
  student_pack:  200000,  // ₦2,000
  defense_pack:  350000,  // ₦3,500
  project_reset: 150000,  // ₦1,500
};

export function expectedAmountKobo(tier) {
  const amount = PRICING_KOBO[tier];
  if (!amount) throw new Error(`Unknown tier: ${tier}`);
  return amount;
}
