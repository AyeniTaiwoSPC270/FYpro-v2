// Canonical free-tier per-step run limits — single source of truth.
//
// The SERVER enforces these in api/ai.js (the authoritative gate). The CLIENT
// mirrors them in src/hooks/useRunLimit.js purely to show the "X runs left" UI.
// Keeping them in one place removes the drift risk of the two copies disagreeing.
//
// Keys are snake_case to match the user_entitlements.run_counts JSON column and
// the client step keys. The /api/ai request contract uses kebab-case step ids
// (topic-validator), which the server normalises to snake_case before lookup.
//
// This file must stay dependency-free so it is safe to import from both the
// Vercel serverless function and the Vite client bundle.
export const FREE_STEP_LIMITS = {
  topic_validator:     3,
  chapter_architect:   3,
  methodology_advisor: 3,
};
