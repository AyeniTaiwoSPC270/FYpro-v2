export interface ExpressRoutingInput {
  /** paid_features from user_entitlements */
  features: string[]
  /** app_config.express_beta_free — GLOBAL pricing state, true for every user at once */
  betaFree: boolean
  hasExpressProject: boolean
  hasStandardProject: boolean
}

// Answers "does this user belong in the Express product?" — NOT "may this user use
// Express for free?". Those are different questions and conflating them is what sent
// every free signup to /express during the beta: betaFree is global, so it can never
// on its own identify a user as an Express user.
export function isExpressOnlyUser({
  features,
  betaFree,
  hasExpressProject,
  hasStandardProject,
}: ExpressRoutingInput): boolean {
  if (features.includes('student_pack') || features.includes('defense_pack')) return false
  if (features.includes('express_defense')) return true

  // Nobody holds the entitlement while Express is free, so the only per-user proof of
  // express intent is an express project — and those are created only by
  // /express-onboarding.
  if (betaFree) return hasExpressProject && !hasStandardProject

  return false
}
