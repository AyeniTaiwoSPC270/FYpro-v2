# FYPro Error Reference

Complete catalogue of every error state in FYPro v2 — what it means, what causes it, and how to fix it.  
Organised by severity. Entries marked **[UI]** show a message to the user; **[Console]** are silent log-only errors.

---

## Legend

| Severity | Meaning |
|----------|---------|
| **CRITICAL** | Blocks the user entirely or causes data loss |
| **MEDIUM** | Degrades a feature but the rest of the app still works |
| **LOW** | Non-fatal, logged only, or recovers automatically |

---

## CRITICAL Errors

### C-01 — `load_timeout` on startup **[Console + UI]**
**Console:** `[useProjectState] load error: Error: load_timeout`  
**UI effect:** Amber offline banner appears ("Showing cached data from your last session"). If no snapshot exists at all, the user sees a blank dashboard.  
**Cause:** `loadUserState()` in `useProjectState.ts` calls Supabase to fetch the user's profile, project, and step data. It is wrapped in a 5-second `withTimeout()`. If Supabase does not respond within 5 s, the promise rejects with `load_timeout`.  
**Root causes of the slowness:**
- Poor mobile data connection (extremely common in Nigeria)
- Supabase cold-start latency on the Postgres connection
- Supabase being temporarily slow or down
- Network congestion between Vercel's region and Supabase's region  

**Fix for users:** Reload the page on a better connection. The amber banner auto-clears when Supabase becomes reachable again.  
**Fix for developer:** No code change needed — the 5 s timeout and snapshot fallback is intentional. If this becomes frequent, investigate whether the `loadUserState` query can be made lighter (fewer joins).

---

### C-02 — Banned account **[UI — delayed, not immediate]**
**UI effect:** "Account Suspended" full-screen message (rendered by `ProtectedRoute.jsx`) — BUT only after the user refreshes or opens a new tab, AND only if the `sessionStorage` ban cache has expired.  
**What actually happens when you ban someone who is already logged in:**
- The ban check (`user_entitlements.banned_until`) only runs when `ProtectedRoute` **mounts** — it does not re-run on route navigation within the same session.
- The result is cached in `sessionStorage` with a **30-minute TTL** (`BAN_CACHE_TTL`).
- So a logged-in user can continue using the app uninterrupted until they either refresh the page (or open a new tab) AND the 30-minute cache has expired.
- In practice: a banned user who is actively using the app can keep using it for up to 30 minutes after a ban is applied.

**Cause of the ban:** Admin sets `banned_until` to a future timestamp (e.g. `'2099-01-01'`) via Mission Control → Ban User. This also calls `supabase.auth.admin.signOut(userId)` server-side to invalidate the session immediately — but only prevents *new* logins, not the existing in-memory session.  
**Fix for users:** Contact support at hello@fypro.com.ng.  
**Fix for developer:** Use Mission Control → Unban User to clear `banned_until`. To force an immediate ban (no 30-minute grace), you would need to either shorten `BAN_CACHE_TTL` or add a realtime Supabase subscription in `ProtectedRoute` that listens for changes to the `user_entitlements` row.

---

### C-03 — Maintenance mode **[UI]**
**UI effect:** Every API call returns 503 with "FYPro is temporarily unavailable." The maintenance kill switch in admin also redirects the whole app to `/maintenance`.  
**Cause:** Admin toggled maintenance mode ON via the Mission Control dashboard. The state is stored in `app_config` (key: `maintenance_mode`) and cached in Redis for fast lookups.  
**Fix for developer:** Toggle maintenance mode OFF in Mission Control or via the Telegram `/maintenance off` command.

---

### C-04 — Session expired / UNAUTHORIZED **[Console + UI]**
**Console:** none (error is caught at `callClaude` level)  
**UI effect (in step):** `"Your session has expired. Please sign in again."` shown in `ApiErrorBox`.  
**UI effect (on page load):** `AuthContext` detects a 401 on token refresh and calls `window.location.replace('/login?session_expired=1')`, forcing a full redirect to login.  
**Cause:** The Supabase JWT is expired (tokens live ~1 hour) and the silent refresh failed. Causes:
- User left a tab open overnight with no activity
- Browser blocked third-party cookies, preventing background token refresh
- `supabase.auth.autoRefreshToken` was accidentally disabled (it was re-enabled as a bug fix in June 2026)  

**Fix for users:** Sign in again. Progress is saved in Supabase and will reload.  
**Fix for developer:** `supabase.ts` has `autoRefreshToken: true` — never disable it.

---

### C-05 — Paystack webhook HMAC failure **[Console, server-side only]**
**Console:** `[webhook] missing signature header` or `[webhook] invalid signature`  
**UI effect:** Payment goes through on Paystack but the user's entitlement is never credited. User thinks they paid but gets no access.  
**Cause:**
- `x-paystack-signature` header is missing (request not from Paystack)
- `bodyParser` is accidentally re-enabled in `payments.js` (body must be raw for HMAC)
- `PAYSTACK_SECRET_KEY` env var is wrong or missing  

**Fix for developer:** `payments.js` must have `bodyParser: false` in its Vercel config. Verify `PAYSTACK_SECRET_KEY` in Vercel env vars. Check Telegram alerts for `❌ Payment failed` notifications.

---

### C-06 — Express Defence project not found on load **[Console]**
**Console:** `[db] getExpressProject: <supabase error>`  
**UI effect:** Express shell loads but has no project context — sidebar shows empty student info, steps may not load.  
**Cause:** The express project row doesn't exist in `projects` (mode='express') for this user, and `createExpressProject` also fails (e.g. because Supabase is unreachable or RLS rejects the insert).  
**Fix for developer:** Ensure the user has the `express_defense` entitlement. Check Supabase RLS on the `projects` table allows INSERT for authenticated users.

---

## MEDIUM Errors

### M-01 — Rate limited (IP or user daily limit) **[UI]**
**UI effect:** `ApiErrorBox` shows a live countdown: `"FYPro is in high demand right now. Your progress is saved — please try again in 47 seconds."` Counter ticks down every second; box auto-clears at 0.  
**Cause:** One of the Upstash Redis fixed-window counters was exceeded:
- General IP: 30 requests / hour
- General per-user: 30 requests / day
- Defense: 5 sessions / user / day
- Supervisor Prep: 5 requests / user / day  

**Fix for users:** Wait for the countdown and try again.  
**Fix for developer:** Admin can use Mission Control → Reset Usage to clear the Redis keys for a specific user.

---

### M-02 — Free tier step run limit reached **[UI]**
**UI effect:** `ApiErrorBox` shows `"Free tier limit reached for this feature. Upgrade to the Student Pack to continue."` A `PaidFeatureGate` also renders the Paystack popup.  
**Cause:** Free users get 3 runs on Chapter Architect and Methodology Advisor. The server-side Redis reservation checks the `run_counts` column in `user_entitlements` and rejects the request with HTTP 429 when the limit is hit.  
**Fix for users:** Purchase the Student Pack (₦2,000).  
**Fix for developer:** Admin can use Mission Control → Reset Run Counts to clear a user's Redis keys and `run_counts` column for testing.

---

### M-03 — Global daily spend cap hit **[Console + UI]**
**Console:** `[ai] Daily Claude spend cap reached — blocking request`  
**UI effect:** All AI generation returns "FYPro is temporarily unavailable" (503) for ALL users.  
**Cause:** Total Claude spend for the UTC day exceeded `DAILY_CAP_USD` ($10 default). The cap is checked in `usage-tracker.js` before every Anthropic call.  
**Telegram alert fires at 80% and at 100%.**  

**Fix for developer:** Check Telegram for the spend cap alert. The cap resets at midnight UTC. To extend, update `DAILY_CAP_USD` in Vercel env vars. Do NOT disable the cap — it exists to prevent runaway costs.

---

### M-04 — Per-user daily spend cap hit **[UI]**
**UI effect:** `ApiErrorBox` shows `"You've reached today's usage limit. It resets at midnight UTC."` (exact wording depends on whether the user is paid or free).  
**Cause:** An individual user's Claude spend for the UTC day exceeded their cap:
- Free users: $0.75 / day
- Paid users: $4.00 / day  
These are enforced in `usage-tracker.js` after the global cap check.  

**Fix for users:** Wait until midnight UTC (1 AM WAT).  
**Fix for developer:** Admin can reset per-user usage from Mission Control.

---

### M-05 — Gateway timeout (504) **[Console + UI]**
**Console:** `[callClaude] Response truncated` or `[research/validate] Anthropic request timed out after 50s`  
**UI effect:** `ApiErrorBox` shows `"This is taking longer than expected. Your progress is saved. Please click Try Again."`  
**Cause:**
- Claude API is slow to respond (Anthropic infrastructure under load)
- The prompt is very large (Chapter Architect with long topic context gets 3000 tokens output)
- Vercel function timeout hit (default 300 s on Hobby, but internal Anthropic call has a 50 s abort)  

**Fix for users:** Click Try Again. The request usually succeeds on retry.  
**Fix for developer:** The `AbortSignal.timeout(50000)` in `anthropic-proxy.js` is intentional — prevents hanging functions from eating into the daily spend cap.

---

### M-06 — JSON parse failure **[Console + UI]**
**Console:** `[callClaude] JSON parse failed. Raw response: <first 1000 chars of text>`  
**UI effect:** `ApiErrorBox` shows `"Received an unexpected response. Your progress is saved. Please try again."`  
**Cause (two separate triggers):**
1. `stop_reason === 'max_tokens'` — Claude ran out of output space mid-JSON; the response is truncated and unparseable
2. Claude returned freeform text instead of the requested JSON (prompt compliance failure, rare)  

**Fix for users:** Try Again. If persistent, shorten the research topic or inputs.  
**Fix for developer:** If this recurs for a specific step, increase `max_tokens` for that step or tighten the prompt's JSON instruction.

---

### M-07 — Input too long (TOKEN_LIMIT / 400) **[UI]**
**UI effect:** `ApiErrorBox` shows `"Your input is too long. Please shorten it and try again."` or `"Input too long. Please shorten your text to continue."`  
**Cause:** The assembled prompt (system + user messages) exceeds Claude's context window. Triggered server-side by `research.js` and `ai.js` checking message length before calling Anthropic, or client-side when `max_tokens` is hit.  
**Fix for users:** Shorten the research topic, chapter titles, or methodology description before retrying.

---

### M-08 — Defense Simulator free trial exhausted **[UI]**
**UI effect:** The simulation stops after 3 questions. A paywall card appears showing the student's trial score and identified gaps. The "Start New Session" button is hidden; only the Defense Pack purchase CTA is shown.  
**Cause:** The server returns `{ error: 'FREE_TRIAL_USED' }` (HTTP 403) when a non-Defense-Pack user has already completed 1 full free session. The client sets `err.code = 'FREE_TRIAL_USED'` and renders the paywall.  
**Fix for users:** Purchase the Defense Pack (₦3,500) or the Defense Pack Upgrade (₦1,500 if they have Student Pack).

---

### M-09 — Feature not unlocked (FORBIDDEN / 403) **[UI]**
**UI effect:** `ApiErrorBox` shows `"This feature requires a paid upgrade. Please visit the Pricing page to unlock it."` A `PaidFeatureGate` wraps gated UI sections.  
**Cause:** The user tried to use a server-enforced paid feature without the required entitlement:
- Defense Simulator → requires `defense_pack` or `express_defense`
- Project Reviewer → requires `defense_pack`
- ElevenLabs voices → requires `defense_pack`
- Defence Brief → requires `express_defense` or `defense_pack`  

**Fix for users:** Purchase the appropriate plan.

---

### M-10 — Project Reviewer: file too large **[UI]**
**UI effect:** Inline error below the upload dropzone: `"File is too large (X.X MB). Please upload a file under 4 MB, or paste your content as a .txt file."`  
**Cause:** `file.size > 4 * 1024 * 1024` (4 MB). The check runs client-side in `ProjectReviewer.jsx` before any upload occurs. A second 4 MB cap also exists server-side in `project-reviewer.js`.  
**Fix for users:** Compress the PDF, remove images, or copy-paste the text into a `.txt` file.

---

### M-11 — Project Reviewer: unsupported file type **[UI]**
**UI effect:** Inline error: `"Unsupported file type. Please upload a PDF, Word (.docx), or plain text (.txt) file."`  
**Cause:** File extension is not one of `pdf`, `docx`, `txt`.  
**Fix for users:** Convert the file to PDF or copy content into a `.txt` file.

---

### M-12 — Project Reviewer: document not relevant **[UI]**
**UI effect:** Inline error: `"<AI reason>. Please upload the correct file."`  
**Cause:** A pre-review relevance check sends the document content to Claude. If Claude returns `{ relevant: false, reason: "..." }`, the full review is aborted and the user sees the reason. Common triggers: uploading a CV, a lecture slide deck, or a different course's report.  
**Fix for users:** Upload the correct final year project document.

---

### M-13 — Project Reviewer: DOCX parse / ZIP error **[Console]**
**Console:** `[FYPro] DEFLATE decompress error: <message>` or `[FYPro] ZIP parse error: <message>` or `[FYPro] Unsupported ZIP compression method: <number>`  
**UI effect:** The extracted text is empty or the review proceeds with no content. Claude may return a low-quality review.  
**Cause:** The DOCX file uses password protection, a non-standard ZIP compression method, or is corrupt.  
**Fix for users:** Open the DOCX, File → Save As PDF, and upload the PDF instead.

---

### M-14 — ElevenLabs TTS failure (voice fallback) **[Console]**
**Console:** `[speak] Voice unavailable, using text fallback`  
**UI effect:** A "Voice paused" chip appears on the examiner bubble with a retry button. The examiner message is still shown as text — the session continues normally.  
**Cause:**
- `EL_API_KEY` env var not set in Vercel
- ElevenLabs API returned 401 (invalid/expired key), 429 (quota exceeded), or 500
- Network error reaching `api.elevenlabs.io`
- User does not have the `defense_pack` entitlement (server returns 403 and speak falls through)  

**Fix for developer:** Check `EL_API_KEY` in Vercel env vars. Check ElevenLabs usage dashboard.

---

### M-15 — Writing Planner: deadline in the past **[UI]**
**UI effect:** Inline error: `"Please select a future date — the deadline must be after today."` or `"Please select a future date before generating a plan."`  
**Cause:** User selected a defense/submission date that is today or earlier.  
**Fix for users:** Pick a future date.

---

### M-16 — Supervisor Prep: no stage selected **[UI]**
**UI effect:** Inline error: `"Please select where you are in your project."`  
**Cause:** User clicked "Generate Questions" without selecting their current project stage from the dropdown.  
**Fix for users:** Select a stage and try again.

---

### M-17 — Chapter Architect: word count too low **[UI]**
**UI effect:** Inline error: `"Please enter a word count of at least 5,000 before generating."`  
**Cause:** User entered a target word count below 5,000 words.  
**Fix for users:** Enter a realistic thesis length (minimum 5,000 words).

---

### M-18 — selectProject: not found or ownership mismatch **[Console]**
**Console:** `[useProjectState] selectProject: project not found or unauthorized <pid>` or `[useProjectState] selectProject: ownership mismatch <pid>`  
**UI effect:** Dashboard silently fails to load the selected project. The project grid stays visible.  
**Cause:** The project ID from the URL doesn't exist in Supabase for this user, or the `user_id` on the project row doesn't match the authenticated user. Can happen if a stale URL is shared or after a project is deleted.  
**Fix for users:** Return to the project grid and select a current project.

---

### M-19 — Defense session row not created at start **[Console]**
**Console:** `[defense] session row not created at start — fallback runs at session end`  
**UI effect:** None visible. The session continues. A fallback creates the `defense_sessions` row when the session ends.  
**Cause:** The initial `supabase.from('defense_sessions').insert()` at session start failed (network blip, Supabase transient error). The code catches this and continues without blocking the user.  
**Fix:** Resolved automatically — the fallback insert at session end covers it. If the fallback also fails (`[defense] fallback session insert failed`), the session score is not persisted and no certificate can be issued.

---

### M-20 — Anonymous session migration failed **[UI]**
**UI effect:** Toast: `"Migration failed — please try again."`  
**Cause:** `AnonymousMigrationModal` tried to move a `localStorage`-based session (from before the user signed up) into Supabase, but `createProject()` returned null. This happens when:
- Supabase is unreachable
- The user's RLS policies prevented the insert  

**Fix for users:** Their localStorage data is still intact — they can try again after reconnecting.

---

### M-21 — Defense Brief: unexpected format **[UI]**
**UI effect:** Inline error: `"The brief returned an unexpected format. Please try again."`  
**Cause:** Claude returned valid JSON but without the expected keys (`opening_statement`, `model_answers`, `examiner_qa`). Likely a prompt compliance issue on a slow/overloaded Anthropic response.  
**Fix for users:** Try Again.

---

### M-22 — Defence Brief PDF download failed **[UI]**
**UI effect:** Toast: `"PDF download failed — copying brief to clipboard"`. The brief text is copied to clipboard instead.  
**Cause:** `jsPDF` threw during PDF generation. Common causes: browser memory pressure, special Unicode characters in the brief content that `safeText()` didn't catch.  
**Fix for users:** Paste from clipboard into a Word doc and save as PDF.

---

### M-23 — Past Sessions: failed to load **[UI]**
**UI effect:** `"Failed to load session history."` shown inside the Past Sessions tab.  
**Cause:** Supabase query on `defense_sessions` failed (network error, RLS issue, or Supabase returning an error on the join with `defense_certificates`).  
**Fix for users:** Switch tabs and switch back to retry the load.

---

### M-24 — You're offline (generation blocked) **[UI]**
**UI effect:** `ApiErrorBox` shows `"You're offline. Connect to generate new content."` in any step component.  
**Cause:** `navigator.onLine === false` at the moment a generation call was attempted. The app detects this before making any network call.  
**Fix for users:** Reconnect to the internet. Previously generated results are still visible from the offline snapshot.

---

### M-25 — Upstash Redis unavailable (failing open) **[Console]**
**Console:** `[run-reservation] reserve failed (failing open): <error>` or `[usage-tracker] checkDailyCap failed (failing open): <error>`  
**UI effect:** None — the system fails open (allows the request through).  
**Cause:** Upstash Redis is unreachable (bad `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`, or Upstash service outage).  
**Fix for developer:** Verify Upstash env vars in Vercel. Check Upstash status page. Note: failing open means rate limiting is not enforced while Redis is down — this is intentional to avoid blocking legitimate users, but exposes the system to cost overrun.

---

## LOW Errors

### L-01 — PWA Service Worker registration failed **[Console]**
**Console:** `SW registration error: <error>`  
**UI effect:** None. The app works normally; it just isn't installable as a PWA until the next successful registration.  
**Cause:** Browser blocks SW registration on HTTP (local dev), or the SW file threw during install. Rare in production.  
**Fix:** Non-actionable for users. For developer: check `vite.config.js` PWA plugin config.

---

### L-02 — Sync queue drain failed (offline save) **[Console + UI toast]**
**Console:** none (drain errors are swallowed)  
**UI effect:** Toast: `"Saved locally — will sync when reconnected"` when `saveStep()` is called offline.  
**Cause:** User completed a step while offline. The result is queued in `fypro_sync_queue` localStorage. The drain runs when the browser comes back online. If the drain also fails (Supabase unreachable), the item stays queued.  
**Fix:** Automatically retries on next `online` event. Data is not lost unless the user clears localStorage.

---

### L-03 — Push notification subscribe failed **[Console]**
**Console:** `[push] subscribe failed: <error>` or `[push] VITE_VAPID_PUBLIC_KEY not configured`  
**UI effect:** None for the user. Settings toggle silently fails. The user won't receive push nudges.  
**Cause:**
- `VITE_VAPID_PUBLIC_KEY` env var is not set
- User denied notification permission
- Browser (older Safari, Firefox in private mode) doesn't support Push API  

**Fix for developer:** Verify `VITE_VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY` are set in Vercel. VAPID keys must be generated as a pair.

---

### L-04 — Push nudge delivery failed for a subscriber **[Console, server-side]**
**Console:** `[nudges] error for <user_id>: <error>`  
**UI effect:** None. The nudge cron continues to the next subscriber.  
**Cause:** The subscriber's push endpoint expired (user uninstalled the PWA, switched browsers, or revoked permission). The `web-push` library throws when it can't deliver.  
**Fix for developer:** These are expected over time as push subscriptions expire. `last_nudged_at` is only updated on success, so expired entries will keep being tried until manually pruned.

---

### L-05 — Supabase `saveStep` failed **[Console]**
**Console:** `[supabase-client] saveStep: <error message>`  
**UI effect:** The step result is saved to the offline snapshot and the sync queue. Toast: `"Saved locally — will sync when reconnected"`.  
**Cause:** Network error or Supabase transient failure at the moment of a step save.  
**Fix:** Retried automatically via `withRetry()` (delays: 1 s, 3 s). If all retries fail, the item enters the sync queue.

---

### L-06 — Supabase `createProject` failed **[Console]**
**Console:** `[supabase-client] createProject: <error message>`  
**UI effect:** `ensureProject()` returns null. Any subsequent `saveStep()` call queues locally without a project ID.  
**Cause:** Network error or RLS rejection on the `projects` INSERT.  
**Fix:** Non-fatal — steps are saved locally. The project is created on the next successful `ensureProject()` call.

---

### L-07 — `updateProject` / `updateUserProfile` failed **[Console]**
**Console:** `[supabase-client] updateProject: <error>` or `[supabase-client] updateUserProfile: <error>`  
**UI effect:** None. The project title or profile change doesn't persist to Supabase but the UI reflects it via React state.  
**Cause:** Network blip or RLS policy block on the UPDATE.

---

### L-08 — Notification insert failed **[Console]**
**Console:** `[notify] project_created failed: <error>` or `[certificate] notification insert failed: <error>`  
**UI effect:** None. The in-app notification bell won't show the expected notification, but the underlying action (project created, certificate issued) completed successfully.  
**Cause:** Supabase transient error on the `notifications` table INSERT.

---

### L-09 — Onboarding save failed **[Console]**
**Console:** `[onboarding] insert failed: <error>` or `[onboarding] saveOnboardingAnswers failed: <error>`  
**UI effect:** None. The onboarding completes and the user proceeds, but their answers (referral source, defence date band, primary goal) are not saved to `user_onboarding`.  
**Cause:** Supabase error or network issue during the INSERT/UPSERT on `user_onboarding`.  
**Fix for developer:** These rows are non-critical but missing them affects analytics segmentation.

---

### L-10 — Semantic Scholar rate-limited (papers search) **[Console]**
**Console:** `[papers] Semantic Scholar 429 (x2) — falling through`  
**UI effect:** None visible. The system falls through to OpenAlex as a secondary source. The Topic Validator or Literature Map still runs.  
**Cause:** Semantic Scholar's public API rate limit hit (no API key in use). The system waits 1 s and retries once before falling through.  
**Fix for developer:** Register for a Semantic Scholar API key and add it as an env var for higher limits.

---

### L-11 — Referral conversion retries exhausted **[Console]**
**Console:** `[referral] all retries exhausted — referral conversion dropped for <email>`  
**UI effect:** None. The referral is silently dropped.  
**Cause:** The `referral.js` endpoint failed to insert the referral conversion record after multiple retries (unique constraint violation on a duplicate, or Supabase unavailable).  
**Fix for developer:** This is logged for manual reconciliation. Check `referrals` table in Supabase for partial records.

---

### L-12 — Usage tracker RPC failed, fallback to direct write **[Console]**
**Console:** `[usage-tracker] RPC increment_daily_usage failed — falling back to direct write. Error: <error>`  
**UI effect:** None. Daily usage tracking still completes via the fallback.  
**Cause:** The `increment_daily_usage` Postgres RPC either doesn't exist or returned an error. This is non-blocking — daily cost tracking continues with a direct INSERT/UPDATE.

---

### L-13 — Telegram alert failed **[Console, server-side]**
**Console:** `[telegram] alert failed: <error>` or `[telegram] dedupe alert failed: <error>`  
**UI effect:** None. The underlying operation (payment processed, signup, etc.) completed successfully.  
**Cause:**
- `TELEGRAM_BOT_TOKEN` or `TELEGRAM_CHAT_ID` not set
- Telegram API unreachable
- Bot was blocked  

**Fix for developer:** Check bot token in Vercel env vars. Test with `/api/admin?action=test-all-alerts`.

---

### L-14 — SupervisorEmail saveStep failed **[Console]**
**Console:** `[SupervisorEmail] saveStep failed: <error>`  
**UI effect:** None. The generated email is displayed to the user; it just isn't persisted to Supabase.  
**Cause:** Supabase error when saving the supervisor email generation result.

---

### L-15 — Share card generation failed **[Console, server-side]**
**Console:** `[share-card] render failed: <error>`  
**UI effect:** The share card image fails to generate. The share card UI shows a broken image or the download button does nothing.  
**Cause:** `satori` threw during SVG rendering — usually a font loading issue or a special character in the topic/student name.  
**Fix for developer:** Check that font files are accessible at the path expected by `share-card.js`.

---

### L-16 — Certificate PDF generation failed **[Console, server-side]**
**Console:** `[certificate] PDF generation failed: <error>` or `[certificate] insert failed: <error>`  
**UI effect:** The certificate download fails silently or the `CertificateUnlock` component shows "Session ID unavailable — please try again."  
**Cause:** jsPDF threw during PDF assembly (usually a font or image loading issue on the server), or the Supabase INSERT on `defense_certificates` failed.  
**Fix for users:** Try downloading again. The certificate endpoint is idempotent — it checks for an existing certificate before creating a new one.

---

### L-17 — Profile save failed **[Console + UI toast]**
**Console:** `[Profile] handleSaveChanges failed: <error>`  
**UI effect:** Toast: error message or "Something went wrong."  
**Cause:** `updateUserProfile()` in `db.ts` failed — usually a network blip or a constraint violation (e.g. invalid university value).

---

### L-18 — Admin dashboard load errors **[Console]**
**Console:** `[Health/loadReports]: <error>`, `[Health/loadRatings]: <error>`, `[admin/health] error: <error>`, etc.  
**UI effect:** Specific admin widgets show empty state or an error message. Other tabs in Mission Control are unaffected.  
**Cause:** Admin-only Supabase queries fail — usually because the admin's session expired or a specific action's service-role query hit an error.

---

### L-19 — Defense turn insert failed **[Console]**
**Console:** `[defense_turns] insert failed: <error message>`  
**UI effect:** None visible during the session. The turn's question and answer are not saved to `defense_turns`, which means the transcript in Past Sessions will be incomplete for that turn.  
**Cause:** Supabase transient error during the turn INSERT.

---

### L-20 — Supabase `getAllUserProjects` failed **[Console]**
**Console:** `[supabase-client] getAllUserProjects: <error>`  
**UI effect:** Project grid shows empty state instead of the user's projects.  
**Cause:** Network error or RLS issue on the `projects` SELECT in `Dashboard.jsx`.  
**Fix for users:** Reload the page.

---

## Error Code Quick Reference

| Code | HTTP Status | UI Message | Handled By |
|------|-------------|------------|------------|
| `OFFLINE` | — | "You're offline. Connect to generate new content." | `handleApiError` |
| `UNAUTHORIZED` | 401 | "Your session has expired. Please sign in again." | `handleApiError` |
| `RATE_LIMIT` | 429 | Countdown: "FYPro is in high demand…" | `handleApiError` |
| `FORBIDDEN` | 403 | "This feature requires a paid upgrade…" | `handleApiError` |
| `FREE_TRIAL_USED` | 403 | Paywall card with trial score | `DefensePrep.jsx` |
| `GATEWAY_TIMEOUT` | 504 | "This is taking longer than expected…" | `handleApiError` |
| `SERVICE_UNAVAILABLE` | 503 | "FYPro is temporarily unavailable…" | `handleApiError` |
| `JSON_PARSE` | — | "Received an unexpected response…" | `handleApiError` |
| `TOKEN_LIMIT` | 400 | "Your input is too long…" | `handleApiError` |
| `NO_PAPERS` | — | Custom message from server | `handleApiError` |
| `load_timeout` | — | Amber offline banner | `useProjectState.ts` |

---

## Where Errors Surface

| Location | Mechanism |
|----------|-----------|
| Step components (TV, CA, MA, WP, DP, PR, SP, LM) | `ApiErrorBox` with optional retry button + `ReportButton` |
| App shell on load | `OfflineBanner` (amber = cached data, red = offline) |
| Save operations | Toast notification ("Saved locally — will sync…") |
| Auth routes | Full-page redirect to `/login?session_expired=1` |
| Protected routes | Ban screen rendered instead of content |
| Defense Simulator | Paywall card (free trial) or inline examiner bubble "Voice paused" chip |
| Project Reviewer | Inline error below the upload dropzone |
| Defence Brief | Inline error + toast for PDF failure |
| Past Sessions | In-tab error message |
| Admin dashboard | Per-widget empty state / error text |

---

*Last updated: 2026-06-23. Re-check after any change to `useProjectState.ts`, `api.js` (services), `ai.js`, `payments.js`, or `research.js`.*
