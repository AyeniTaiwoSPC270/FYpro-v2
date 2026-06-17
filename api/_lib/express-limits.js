// Lifetime (per-purchase) run caps for Express Defence features — single source of truth.
//
// Express Defence is a ONE-TIME ₦2,000 unlock, not a subscription. The daily rate
// limits + per-user spend cap bound cost per day but not total cost, so an express
// purchase could draw many multiples of its price over time. These lifetime caps
// close that margin leak by limiting total uses of the expensive features.
//
// They apply ONLY to express-only users (hold express_defense, NOT defense_pack).
// Defense Pack is the richer purchase and keeps its daily-bounded behavior.
//
// The SERVER enforces these via an atomic Redis reservation (api/_lib/run-reservation.js)
// keyed off user_entitlements.run_counts. The CLIENT mirrors them in
// src/hooks/useRunLimit.js purely to show "X uses left". One shared definition
// removes the drift risk of two copies disagreeing.
//
// Keys are snake_case to match the user_entitlements.run_counts JSON column.
// The Defence Brief Coach is intentionally omitted — it is cheap and conversational,
// bounded by its daily rate limit (60/user/day) only.
//
// This file must stay dependency-free so it is safe to import from both the
// Vercel serverless functions and the Vite client bundle.
export const EXPRESS_TOTAL_LIMITS = {
  express_reviewer:      5,
  express_defence_brief: 5,
  express_simulator:     10,
};
