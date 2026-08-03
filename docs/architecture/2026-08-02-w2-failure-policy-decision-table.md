# W2 Failure Policy — Decision Table

**Date:** 2026-08-02
**Spec:** docs/specs/2026-07-31-infra-9-plus-program-design.md §8 (W2 — Failure policy)

Every Redis- or Supabase-backed guard in the Claude API proxy, and what happens to a
request when that dependency is unavailable. "Recorded" means: a `system_logs` row
(queryable counter) plus a deduplicated Sentry + Telegram alert — see
`api/_lib/failure-policy.js`. Rate limits, spend caps, and the free-run reservation all
protect the same underlying resource (Anthropic spend) but at different layers; the
policy differs per layer, not per endpoint, so this table is organised by mechanism, not
by the ~12 call sites that use them.

| # | Mechanism | Dependency | Current file | Policy | Recorded on trip? | Rationale |
|---|---|---|---|---|---|---|
| 1 | `rateLimitCheck` (per-IP + per-user daily request count) | Redis (Upstash) | `api/_lib/rate-limit.js` | **Open** | Yes (Task 3) | Availability outweighs abuse risk for a request-count limiter during a brief outage — a legitimate user should not be locked out because Redis hiccuped. Real spend is still bounded by rows 2–3 below, which stay closed. |
| 2 | `checkDailyCap` (global daily spend ceiling) | Supabase (`daily_usage`) | `api/_lib/usage-tracker.js` | **Closed** | Yes (Task 2) | The sharpest edge in the 2026-07-28 audit: a Supabase outage must never let Claude spend run uncapped. Blocking is the safe direction — a false block during a rare outage costs a delayed generation; a false allow could cost the whole daily budget. |
| 3 | `checkUserCap` (per-user daily spend ceiling) | Redis (Upstash) | `api/_lib/usage-tracker.js` | **Closed** | Yes (Task 2) | Same reasoning as row 2, scoped per user — without this, a Redis outage lets one abusive account drain the global cap uncontested even while row 2 holds. |
| 4 | Free-tier run-count reservation (per-step lifetime limit for unpaid users) | Redis (Upstash) | `api/ai.js` `handleGeneral` (inline, lines ~179–198) | **Open** (unchanged) | No — pre-existing, out of scope | A quota layered *on top of* rows 2–3, which now both fail closed. Failing this open during a rare Redis blip lets a free user run one extra generation of a single step; total spend for that user is still bounded by the now-closed per-user cap (row 3). Not touched by this plan — already correct given rows 2–3's fix. |
| 5 | Express lifetime-cap reservation (`reserveRun`) | Redis (Upstash) | `api/_lib/run-reservation.js` | **Open** (unchanged) | No — pre-existing, out of scope | Same reasoning as row 4: a quota on top of the spend caps, which are the real backstop. Already documented in the file's own comment ("Fails OPEN... an infra outage must never block paying users"). |
| 6 | Response cache read/write (`getCached`/`setCached`) | Redis (Upstash) | `api/_lib/cache.js` | **Degrade** (unchanged) | No — not a spend-integrity issue | A cache miss just means the *real* Anthropic call happens (paying its normal cost, still bounded by rows 2–3); a cache-write failure means the next identical request also pays full cost. Neither uncaps spend, so this is a performance degradation, not a policy trip. |
| 7 | `getMaintenanceMode` (admin kill switch) | Redis, then Supabase fallback | `api/_lib/maintenance.js` | **Open** (unchanged) | No — operational switch, not spend | Fail-open here means "the site stays up" during an infra hiccup, which is the desired behaviour — a Redis/Supabase blip must not itself trigger the maintenance page for every visitor. |
| 8 | `supabaseAdmin.auth.getUser(token)` (JWT verification) | Supabase Auth (GoTrue) | `api/ai.js` (all handlers) | **Closed** (already correct) | No — returns 503, doesn't need the shared helper | On throw, every handler already returns `503 Authentication service unavailable` rather than treating the request as authenticated. No unauthenticated request can reach a spend-gated path. Not touched by this plan. |
| 9 | User bans | Supabase Auth (GoTrue `ban_duration`) | Set via `api/admin.js` ban-user action | **Closed** (already correct, delegated) | No — enforced by GoTrue itself | Bans are enforced at the GoTrue level, not app code — a banned user's token simply fails verification (row 8). There is no app-level "check if banned" call that could itself fail open. |
| 10 | Entitlements fetch (`user_entitlements.paid_features`) | Supabase | `api/ai.js` `handleGeneral` (lines ~117–127) | **Degrade** (unchanged, known trade-off) | No — UX cost, not a spend/security risk | On error, `entData` stays `null` → the user is treated as free-tier. This can wrongly deny a *paying* customer their higher limits during an outage — a UX bug — but it never uncaps spend (a free-tier misclassification only makes limits *tighter*, and rows 2–3 still apply). Documented here as a known trade-off; not fixed by this plan (out of scope — see spec §8 criteria, none of which cover this path). |

## Fire-and-forget side effects (spec exit criterion 5)

Separate from the checks above: side effects that fire after a decision is made and
must not be silently lost if they fail. Retried with backoff, then dead-lettered — see
`api/_lib/reliable-async.js` (Task 4).

| # | Side effect | Call site | Was it awaited before? | Treatment |
|---|---|---|---|---|
| 11 | Telegram alerts (all ~40 call sites across `api/`) | via `sendTelegramAlert`/`sendTelegramAlertOnce` in `api/_lib/telegram.js` | Mixed — roughly half already awaited, half intentionally fire-and-forget for latency | `sendTelegramAlert` retries internally with backoff before dead-lettering (Task 4). This is a real reliability improvement for every already-awaited call site. For call sites that remain un-awaited by their caller, retries can still be cut short if Vercel freezes the function after the response is sent — that risk is unchanged for those sites and is an accepted trade-off (documented here, not an accident). |
| 12 | Signup welcome nurture email trigger | `api/auth.js` (~line 216) | No (fire-and-forget, `.catch()` logs only) | Converted to `await reliably(...)` (Task 5) — this is exactly the "same bug class as the unawaited login alert fixed in be60a7b" the spec names. |
| 13 | Login nurture email trigger | `api/notify.js` (~line 1266) | No (explicitly documented as intentional fire-and-forget) | Converted to `await reliably(...)` (Task 5). The prior comment's rationale ("response doesn't depend on the email completing") is a latency preference, not a reliability one — W2 prioritises not silently losing the email over saving the few hundred ms. |
| 14 | Referrer notification insert | `api/referral.js` (~lines 128–144) | No (`.then()` chain, `.catch()` logs only) | Converted to `await reliably(...)` (Task 5). |

## What this plan does *not* change

Rows 4–10 and the "mixed" half of row 11 are deliberate, stated fail-open/degrade
decisions per the table above — not gaps. Extending retry+dead-letter treatment to
every one of the ~40 Telegram call sites in row 11 is out of scope for this plan (see
spec §8: the exit criteria name Telegram alerts, nurture emails, and notification
inserts as the target class, not an exhaustive rewrite of every call site) — the shared
`sendTelegramAlert` fix in Task 4 already lifts every already-awaited call site for
free, and rows 12–14 cover the specific named "same bug class" instances.
