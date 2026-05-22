# Admin Dashboard Security Hardening Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all 2 critical, 6 high, and 5 medium security issues found in the admin dashboard audit.

**Architecture:** All fixes are surgical edits to existing functions — no new files, no new dependencies, no schema changes. The three main concerns are: (1) timing-safe secret comparisons in `api/admin.js`, (2) error message sanitization across all catch blocks, (3) UI state management in `Health.jsx`.

**Tech Stack:** Node.js ES modules (api/admin.js), React (Health.jsx), crypto (built-in Node)

---

## Files to modify

- `api/admin.js` — Tasks 1–6 (all backend fixes)
- `src/pages/admin/Health.jsx` — Task 7 (UI optimistic state)
- `.env.example` — Task 8 (remove VITE_ADMIN_EMAIL)

---

## Task 1: C-1 + C-2 + M-4 — Timing-safe secret comparisons

**Files:** Modify `api/admin.js`

These are the two CRITICAL issues. Replace `===` string comparisons for HMAC signatures and cron secrets with `crypto.timingSafeEqual`. Also fix admin email comparison (M-4). Extract a shared `verifyCronSecret()` helper to eliminate duplication.

- [ ] **Step 1: Replace `getAdminRedis` to cache the instance (M-6 fix bundled here)**

Find this block at lines 12–17:
```js
function getAdminRedis() {
  return new Redis({
    url:   process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  });
}
```

Replace with:
```js
let _adminRedis = null;
function getAdminRedis() {
  if (!_adminRedis) {
    _adminRedis = new Redis({
      url:   process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
  }
  return _adminRedis;
}
```

- [ ] **Step 2: Add `verifyCronSecret` helper immediately after `readRawBody` (around line 31)**

Insert this new function after the `readRawBody` function block:
```js
// Timing-safe cron secret verification.
// Accepts x-cron-secret header OR Authorization: Bearer <secret>.
// Returns true if authorized, false (and sends 401) if not.
function verifyCronSecret(req, res) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) { res.status(401).json({ error: 'Unauthorized' }); return false; }
  const xSecret    = req.headers['x-cron-secret']   || '';
  const authHeader = req.headers['authorization']    || '';
  const expected   = Buffer.from(cronSecret);
  const bearer     = `Bearer ${cronSecret}`;

  const xMatch = xSecret.length === cronSecret.length &&
    crypto.timingSafeEqual(Buffer.from(xSecret), expected);
  const bearerMatch = authHeader.length === bearer.length &&
    crypto.timingSafeEqual(Buffer.from(authHeader), Buffer.from(bearer));

  if (!xMatch && !bearerMatch) {
    res.status(401).json({ error: 'Unauthorized' });
    return false;
  }
  return true;
}
```

- [ ] **Step 3: Replace cron secret block in `handleAlertCheck` (lines 129–136)**

Find:
```js
  const cronSecret = process.env.CRON_SECRET;
  // Fail closed: if CRON_SECRET is not configured, reject all requests.
  if (!cronSecret) return res.status(401).json({ error: 'Unauthorized' });
  const xSecret    = req.headers['x-cron-secret'];
  const authHeader = req.headers['authorization'];
  const authorized = (xSecret && xSecret === cronSecret) ||
                     (authHeader && authHeader === `Bearer ${cronSecret}`);
  if (!authorized) return res.status(401).json({ error: 'Unauthorized' });
```

Replace with:
```js
  if (!verifyCronSecret(req, res)) return;
```

- [ ] **Step 4: Replace cron secret block in `handleDispatchNurtureEmails` (lines 1322–1328)**

Find:
```js
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return res.status(401).json({ error: 'Unauthorized' });
  const xSecret    = req.headers['x-cron-secret'];
  const authHeader = req.headers['authorization'];
  const authorized = (xSecret && xSecret === cronSecret) ||
                     (authHeader && authHeader === `Bearer ${cronSecret}`);
  if (!authorized) return res.status(401).json({ error: 'Unauthorized' });
```

Replace with:
```js
  if (!verifyCronSecret(req, res)) return;
```

- [ ] **Step 5: Replace cron secret block in `handleDailyReport` (lines 1411–1417)**

Find:
```js
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return res.status(401).json({ error: 'Unauthorized' });
  const xSecret    = req.headers['x-cron-secret'];
  const authHeader = req.headers['authorization'];
  const authorized = (xSecret && xSecret === cronSecret) ||
                     (authHeader && authHeader === `Bearer ${cronSecret}`);
  if (!authorized) return res.status(401).json({ error: 'Unauthorized' });
```

Replace with:
```js
  if (!verifyCronSecret(req, res)) return;
```

- [ ] **Step 6: Fix HMAC timing-unsafe comparison in Sentry webhook (line 1080)**

Find:
```js
  const sig      = req.headers['sentry-hook-signature'] || '';
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  if (sig !== expected) {
    console.error('[sentry-webhook] invalid signature');
    return res.status(400).json({ error: 'Invalid signature' });
  }
```

Replace with:
```js
  const sig      = req.headers['sentry-hook-signature'] || '';
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  const sigBuf   = Buffer.from(sig);
  const expBuf   = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    console.error('[sentry-webhook] invalid signature');
    return res.status(401).json({ error: 'Unauthorized' });
  }
```

- [ ] **Step 7: Fix Sentry webhook 500→401 on missing secret (H-6, lines 1072–1075)**

Find:
```js
  const secret = process.env.SENTRY_WEBHOOK_SECRET;
  if (!secret) {
    console.error('[sentry-webhook] SENTRY_WEBHOOK_SECRET is not set — rejecting request');
    return res.status(500).json({ error: 'Webhook secret not configured on server.' });
  }
```

Replace with:
```js
  const secret = process.env.SENTRY_WEBHOOK_SECRET;
  if (!secret) {
    console.error('[sentry-webhook] SENTRY_WEBHOOK_SECRET is not set — rejecting request');
    return res.status(401).json({ error: 'Unauthorized' });
  }
```

- [ ] **Step 8: Fix admin email timing-safe comparison in `verifyAdmin` (M-4, line 479)**

Find:
```js
    if (!process.env.ADMIN_EMAIL || caller.email !== process.env.ADMIN_EMAIL) {
      res.status(403).json({ error: 'Forbidden' }); return null;
    }
```

Replace with:
```js
    const adminEmail = process.env.ADMIN_EMAIL;
    const callerBuf  = Buffer.from(caller.email  || '');
    const adminBuf   = Buffer.from(adminEmail     || '');
    if (!adminEmail || callerBuf.length !== adminBuf.length ||
        !crypto.timingSafeEqual(callerBuf, adminBuf)) {
      res.status(403).json({ error: 'Forbidden' }); return null;
    }
```

- [ ] **Step 9: Fix log prefix typo (L-2, line ~1553)**

Find:
```js
    console.error('[admin\resolve-sentry-issues] error:', msg);
```

Replace with:
```js
    console.error('[admin/resolve-sentry-issues] error:', msg);
```

---

## Task 2: H-1 — Sanitize error responses in all catch blocks

**Files:** Modify `api/admin.js`

Every `catch` block that returns `err.message` to the client must be changed to return `'Internal server error'`. The `console.error` lines stay — they go to server logs, not to the user.

The pattern to replace is exactly:
```js
return res.status(500).json({ error: err.message });
```

This appears at lines: 120, 181, 467, 607, 624, 672, 734, 803, 830, 854, 1183, 1266, 1402, 1507, 1554, 1582, 1614.

- [ ] **Step 1: Do a global replacement of the error pattern**

Use replace_all to change every instance of:
```js
return res.status(500).json({ error: err.message });
```
to:
```js
return res.status(500).json({ error: 'Internal server error' });
```

- [ ] **Step 2: Fix the `handleDebugRedisKeys` catch which lacks a console.error (line ~756)**

Find:
```js
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

// action: "grant-entitlement"
```

Replace with:
```js
  } catch (err) {
    console.error('[admin/debug-redis-keys]', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// action: "grant-entitlement"
```

- [ ] **Step 3: Fix the resolve-sentry-issues catch (line ~1554) which also returns `msg` not `err.message`**

After Task 1 Step 9 fixes the typo, this line returns `msg` (which could be the raw error). Change it:

Find:
```js
    console.error('[admin/resolve-sentry-issues] error:', msg);
    return res.status(500).json({ error: msg });
```

Replace with:
```js
    console.error('[admin/resolve-sentry-issues] error:', msg);
    return res.status(500).json({ error: 'Internal server error' });
```

---

## Task 3: H-2 — Rate limit destructive admin actions

**Files:** Modify `api/admin.js`

Add `rateLimitCheck` (already imported at line 6) to the seven destructive handlers. Limits: 20 actions per admin per day, 30 per IP per hour. These are per-action prefixes so limits don't bleed across different operations.

- [ ] **Step 1: Add rate limit to `handleResetRunCounts` after the `verifyAdmin` call**

Find:
```js
async function handleResetRunCounts(req, res) {
  const caller = await verifyAdmin(req, res);
  if (!caller) return;

  const { userId } = req.body || {};
  if (!userId) return res.status(400).json({ error: 'userId required' });
```

Replace with:
```js
async function handleResetRunCounts(req, res) {
  const caller = await verifyAdmin(req, res);
  if (!caller) return;
  const rl = await rateLimitCheck(req, { userDay: 50, ipHour: 60, prefix: 'admin:reset-run-counts' });
  if (!rl.allowed) return res.status(429).json({ error: 'Rate limited' });

  const { userId } = req.body || {};
  if (!userId) return res.status(400).json({ error: 'userId required' });
```

- [ ] **Step 2: Add rate limit to `handleDeleteUser`**

Find:
```js
async function handleDeleteUser(req, res) {
  const caller = await verifyAdmin(req, res);
  if (!caller) return;

  const { userId } = req.body || {};
  if (!userId) return res.status(400).json({ error: 'userId required' });
```

Replace with:
```js
async function handleDeleteUser(req, res) {
  const caller = await verifyAdmin(req, res);
  if (!caller) return;
  const rl = await rateLimitCheck(req, { userDay: 20, ipHour: 30, prefix: 'admin:delete-user' });
  if (!rl.allowed) return res.status(429).json({ error: 'Rate limited' });

  const { userId } = req.body || {};
  if (!userId) return res.status(400).json({ error: 'userId required' });
```

- [ ] **Step 3: Add rate limit to `handleResetUsage`**

Find:
```js
async function handleResetUsage(req, res) {
  const caller = await verifyAdmin(req, res);
  if (!caller) return;

  const { userId } = req.body || {};
  if (!userId) return res.status(400).json({ error: 'userId required' });

  if (!process.env.UPSTASH_REDIS_REST_URL
```

Replace with:
```js
async function handleResetUsage(req, res) {
  const caller = await verifyAdmin(req, res);
  if (!caller) return;
  const rl = await rateLimitCheck(req, { userDay: 50, ipHour: 60, prefix: 'admin:reset-usage' });
  if (!rl.allowed) return res.status(429).json({ error: 'Rate limited' });

  const { userId } = req.body || {};
  if (!userId) return res.status(400).json({ error: 'userId required' });

  if (!process.env.UPSTASH_REDIS_REST_URL
```

- [ ] **Step 4: Add rate limit to `handleGrantEntitlement`**

Find:
```js
async function handleGrantEntitlement(req, res) {
  const caller = await verifyAdmin(req, res);
  if (!caller) return;

  const { userId, plan } = req.body || {};
```

Replace with:
```js
async function handleGrantEntitlement(req, res) {
  const caller = await verifyAdmin(req, res);
  if (!caller) return;
  const rl = await rateLimitCheck(req, { userDay: 20, ipHour: 30, prefix: 'admin:grant-entitlement' });
  if (!rl.allowed) return res.status(429).json({ error: 'Rate limited' });

  const { userId, plan } = req.body || {};
```

- [ ] **Step 5: Add rate limit to `handleBanUser`**

Find:
```js
async function handleBanUser(req, res) {
  const caller = await verifyAdmin(req, res);
  if (!caller) return;

  const { userId } = req.body || {};
  if (!userId) return res.status(400).json({ error: 'userId required' });

  try {
    const { error } = await supabaseAdmin
      .from('user_entitlements')
      .upsert({
        user_id: userId,
        banned_until: '2099-01-01T00:00:00.000Z',
```

Replace with:
```js
async function handleBanUser(req, res) {
  const caller = await verifyAdmin(req, res);
  if (!caller) return;
  const rl = await rateLimitCheck(req, { userDay: 20, ipHour: 30, prefix: 'admin:ban-user' });
  if (!rl.allowed) return res.status(429).json({ error: 'Rate limited' });

  const { userId } = req.body || {};
  if (!userId) return res.status(400).json({ error: 'userId required' });

  try {
    const { error } = await supabaseAdmin
      .from('user_entitlements')
      .upsert({
        user_id: userId,
        banned_until: '2099-01-01T00:00:00.000Z',
```

- [ ] **Step 6: Add rate limit to `handleUnbanUser`**

Find:
```js
async function handleUnbanUser(req, res) {
  const caller = await verifyAdmin(req, res);
  if (!caller) return;

  const { userId } = req.body || {};
  if (!userId) return res.status(400).json({ error: 'userId required' });

  try {
    const { error } = await supabaseAdmin
      .from('user_entitlements')
      .upsert({
        user_id:      userId,
        banned_until: null,
```

Replace with:
```js
async function handleUnbanUser(req, res) {
  const caller = await verifyAdmin(req, res);
  if (!caller) return;
  const rl = await rateLimitCheck(req, { userDay: 20, ipHour: 30, prefix: 'admin:unban-user' });
  if (!rl.allowed) return res.status(429).json({ error: 'Rate limited' });

  const { userId } = req.body || {};
  if (!userId) return res.status(400).json({ error: 'userId required' });

  try {
    const { error } = await supabaseAdmin
      .from('user_entitlements')
      .upsert({
        user_id:      userId,
        banned_until: null,
```

---

## Task 4: H-3 — Audit logging for destructive admin actions

**Files:** Modify `api/admin.js`

Add a `console.log` audit line at the START of each destructive action (before the DB call), recording admin email, action, target, and timestamp. This creates a server-log trail.

- [ ] **Step 1: Add audit log to `handleDeleteUser` (inside try, before the deleteUser call)**

Find:
```js
  try {
    const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
```

Replace with:
```js
  try {
    console.log(`[audit] action=delete-user admin=${caller.email} target=${userId} at=${new Date().toISOString()}`);
    const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
```

- [ ] **Step 2: Add audit log to `handleBanUser` (inside try, before the upsert)**

Find:
```js
  try {
    const { error } = await supabaseAdmin
      .from('user_entitlements')
      .upsert({
        user_id: userId,
        banned_until: '2099-01-01T00:00:00.000Z',
```

Replace with:
```js
  try {
    console.log(`[audit] action=ban-user admin=${caller.email} target=${userId} at=${new Date().toISOString()}`);
    const { error } = await supabaseAdmin
      .from('user_entitlements')
      .upsert({
        user_id: userId,
        banned_until: '2099-01-01T00:00:00.000Z',
```

- [ ] **Step 3: Add audit log to `handleUnbanUser` (inside try, before the upsert)**

Find:
```js
  try {
    const { error } = await supabaseAdmin
      .from('user_entitlements')
      .upsert({
        user_id:      userId,
        banned_until: null,
```

Replace with:
```js
  try {
    console.log(`[audit] action=unban-user admin=${caller.email} target=${userId} at=${new Date().toISOString()}`);
    const { error } = await supabaseAdmin
      .from('user_entitlements')
      .upsert({
        user_id:      userId,
        banned_until: null,
```

- [ ] **Step 4: Add audit log to `handleResetRunCounts` (inside try, before the upsert)**

Find:
```js
  try {
    const { error } = await supabaseAdmin
      .from('user_entitlements')
      .upsert({
        user_id:    userId,
        run_counts: { _reset_at: new Date().toISOString() },
```

Replace with:
```js
  try {
    console.log(`[audit] action=reset-run-counts admin=${caller.email} target=${userId} at=${new Date().toISOString()}`);
    const { error } = await supabaseAdmin
      .from('user_entitlements')
      .upsert({
        user_id:    userId,
        run_counts: { _reset_at: new Date().toISOString() },
```

- [ ] **Step 5: Add audit log to `handleGrantEntitlement` (inside try, before DB read)**

Find:
```js
  try {
    const { data: current } = await supabaseAdmin
      .from('user_entitlements')
      .select('paid_features, defense_packs_remaining, total_lifetime_paid_ngn')
```

Replace with:
```js
  try {
    console.log(`[audit] action=grant-entitlement admin=${caller.email} target=${userId} plan=${plan} at=${new Date().toISOString()}`);
    const { data: current } = await supabaseAdmin
      .from('user_entitlements')
      .select('paid_features, defense_packs_remaining, total_lifetime_paid_ngn')
```

---

## Task 5: H-4 — Fix Redis key pattern scope in debug/reset handlers

**Files:** Modify `api/admin.js`

The `*${userId}*` wildcard is too broad and can match cache or config keys. The `handleResetUsage` function already filters with `.filter(k => k.startsWith('rl:'))` which is safe, but the initial fetch in `handleDebugRedisKeys` is unscoped and returns all matching keys (including non-rl keys) in the response.

- [ ] **Step 1: Fix `handleDebugRedisKeys` to scope both queries to `rl:` prefix**

Find:
```js
  try {
    const redis  = getAdminRedis();
    const found  = await redis.keys(`*${userId}*`);
    const allRl  = await redis.keys('rl:*');
    return res.status(200).json({ keys_for_user: found || [], all_rl_keys_sample: (allRl || []).slice(0, 20) });
  } catch (err) {
    console.error('[admin/debug-redis-keys]', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
```

Replace with:
```js
  try {
    const redis       = getAdminRedis();
    const userRlKeys  = await redis.keys(`rl:*${userId}*`);
    const allRlSample = await redis.keys('rl:*');
    return res.status(200).json({
      keys_for_user:       userRlKeys   || [],
      all_rl_keys_sample:  (allRlSample || []).slice(0, 20),
    });
  } catch (err) {
    console.error('[admin/debug-redis-keys]', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
```

---

## Task 6: M-1 — Fix optimistic `isAdmin = true` flash in Health.jsx

**Files:** Modify `src/pages/admin/Health.jsx`

Change the initial state from `true` (optimistic) to `null` (undetermined). Add a null guard so the admin UI doesn't render at all until the server confirms access.

- [ ] **Step 1: Change `useState(true)` to `useState(null)` for isAdmin**

Find:
```js
  const [isAdmin, setIsAdmin] = useState(true) // optimistic; server corrects to false on 403
```

Replace with:
```js
  const [isAdmin, setIsAdmin] = useState(null) // null = loading; server response sets true/false
```

- [ ] **Step 2: Update `loadData` to set isAdmin true on success**

Find:
```js
      .then(r => {
        if (r.status === 403) { setIsAdmin(false); throw new Error('Forbidden') }
        return r.json()
      })
      .then(d => { if (d.error) throw new Error(d.error); setData(d); setLastUpdated(new Date()) })
```

Replace with:
```js
      .then(r => {
        if (r.status === 403) { setIsAdmin(false); throw new Error('Forbidden') }
        setIsAdmin(true)
        return r.json()
      })
      .then(d => { if (d.error) throw new Error(d.error); setData(d); setLastUpdated(new Date()) })
```

- [ ] **Step 3: Find the render guard that checks `isAdmin === false` and add a null check above it**

Search for the block that renders when `isAdmin === false` (the "Access Denied" screen). It will look like:
```js
  if (isAdmin === false) return (
```
or similar. Directly above that block, insert:
```js
  if (isAdmin === null) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#060E18' }}>
      <div style={{ color: '#fff', fontFamily: 'Poppins, sans-serif', fontSize: '1rem', opacity: 0.6 }}>
        Verifying access…
      </div>
    </div>
  )
```

---

## Task 7: M-5 — Remove `VITE_ADMIN_EMAIL` from `.env.example`

**Files:** Modify `.env.example`

`VITE_ADMIN_EMAIL` bakes the admin email address into the frontend JS bundle. The admin email check is server-only (`ADMIN_EMAIL` env var). Remove the VITE_ variant entirely.

- [ ] **Step 1: Remove `VITE_ADMIN_EMAIL=` line from `.env.example`**

Find:
```
# Admin
ADMIN_EMAIL=
VITE_ADMIN_EMAIL=
```

Replace with:
```
# Admin — server-side only, never use VITE_ADMIN_EMAIL (would expose admin email in JS bundle)
ADMIN_EMAIL=
```

---

## Self-Review Checklist

**Spec coverage:**
- [x] C-1 HMAC timing — Task 1 Step 6
- [x] C-2 cron timing — Task 1 Steps 3–5 + verifyCronSecret helper
- [x] H-1 err.message — Task 2 Steps 1–3 (replace_all + targeted)
- [x] H-2 rate limits — Task 3 Steps 1–6
- [x] H-3 audit log — Task 4 Steps 1–5
- [x] H-4 Redis patterns — Task 5 Step 1
- [x] H-6 Sentry 500→401 — Task 1 Step 7
- [x] M-1 optimistic isAdmin — Task 6 Steps 1–3
- [x] M-4 email timing — Task 1 Step 8
- [x] M-5 VITE_ADMIN_EMAIL — Task 7 Step 1
- [x] M-6 Redis client cache — Task 1 Step 1
- [x] L-2 log typo — Task 1 Step 9

**Not in scope (deferred):**
- H-5 CSP unsafe-inline: requires moving all inline `style={{ }}` props out of Health.jsx to CSS classes. Significant refactor; tracked separately.
- M-2/M-3 Diagnose modal / system log raw_detail: backend sanitization requires reviewing what diagnose-user returns; deferred to a follow-up PR.
- L-3/L-4: cosmetic, low risk, deferred.
