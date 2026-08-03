# W2 Drill Runbook — Live Staging Credential Revocation

**Spec:** docs/specs/2026-07-31-infra-9-plus-program-design.md §8, exit criterion 6.
**Automated coverage:** `api/ai.failure-policy.test.js` proves every gated action in
`api/ai.js` blocks with 503 when `checkDailyCap` fails closed, and proceeds when
`rateLimitCheck` fails open — at the handler layer, against a simulated outage.

**This runbook covers the remaining, live half of the drill: revoking real Upstash
credentials against the staging environment.** Unlike the automated tests above, this
step touches live infrastructure and is *not* safe to run unsupervised — if staging
shares any credentials with production (unconfirmed as of this writing; verify in
Vercel's environment variables for both projects before proceeding), this could cause
a production outage. **A human must run this drill, with the go-ahead confirmed in the
moment — do not automate this step.**

## Steps

1. In the Vercel dashboard, confirm the `fypro-staging` project's
   `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` env vars point at a
   **staging-only** Upstash database, distinct from production's. If they are shared,
   stop — this drill cannot safely proceed against shared credentials; provision a
   separate staging Upstash database first (Upstash's free tier supports multiple
   databases).
2. In the Upstash dashboard, revoke or rotate the staging database's REST token (or
   temporarily delete the staging database, if a rotation isn't available).
3. Against the staging deployment, exercise each of: Topic Validator (general),
   Defense Simulator, Supervisor Prep, Defence Brief, Defence Brief Coach, and a login
   (nurture email trigger) and a referral signup.
4. For each, confirm the observed behaviour matches the decision table
   (`docs/architecture/2026-08-02-w2-failure-policy-decision-table.md`):
   - The Claude-spend paths (rows 2–3) should **block** with a 503/429-style message,
     since `checkUserCap` depends on Redis and now fails closed.
   - Request-count rate limiting (row 1) should **not** block — requests still go
     through.
   - The nurture-email and referral-notification triggers (rows 12, 14) should still
     succeed via retry (Redis is not in their path — they depend on Supabase and the
     `send-nurture-email` endpoint, not Upstash) — this specific drill does not
     exercise rows 12–14's failure path; note that as a known gap if you want full
     coverage, since it would require revoking Supabase credentials instead.
5. Restore the staging Upstash credentials (rotate back / recreate the database).
6. Record the outcome (pass/fail per row, with timestamps) in §8 of
   `docs/specs/2026-07-31-infra-9-plus-program-design.md` under a new "Verified"
   subsection, the same way W1's drill outcome was recorded in §7.
