# API/Backend: Zod Validation + Request Tracing — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Zod input validation to auth/payments/ai endpoints and attach a per-request trace ID to all backend logs and responses so frontend Sentry errors can be correlated with Vercel log lines.

**Architecture:** Two new shared utilities (`api/_lib/validate.js`, `api/_lib/trace.js`) consumed by three handler files. Frontend reads the `X-Trace-Id` response header and stamps the current Sentry scope so every captured error carries the ID.

**Tech Stack:** Zod (already in node_modules as transitive dep — adding as direct dep), Node.js `crypto.randomBytes`, `@sentry/react`

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `api/_lib/validate.js` | **Create** | Zod schemas + `validate()` helper |
| `api/_lib/trace.js` | **Create** | `generateTraceId()` + `traceLog()` |
| `api/auth.js` | **Modify** | Add validation + trace to 3 handlers |
| `api/payments.js` | **Modify** | Add validation + trace to `handleInitiate` and `handleVerify` |
| `api/ai.js` | **Modify** | Add messages validation + trace to `handleGeneral` and `handleDefense` |
| `src/lib/sentry.ts` | **Modify** | Export `setTraceId()` |
| `src/services/api.js` | **Modify** | Read `X-Trace-Id` from responses, call `setTraceId()` |

---

## Task 1: Install Zod as a direct dependency

**Files:**
- Modify: `package.json` (via npm)

- [ ] **Step 1: Install**

```bash
npm install zod
```

- [ ] **Step 2: Verify**

```bash
node -e "const { z } = require('zod'); console.log(z.string().parse('ok'))"
```
Expected output: `ok`

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "deps: add zod as direct dependency"
```

---

## Task 2: Create `api/_lib/validate.js`

**Files:**
- Create: `api/_lib/validate.js`

- [ ] **Step 1: Create the file**

```js
// api/_lib/validate.js
import { z } from 'zod';

export const AuthLoginSchema = z.object({
  email:    z.string().email('Invalid email address.'),
  password: z.string().min(1, 'Password is required.'),
});

export const AuthSignupSchema = z.object({
  email:      z.string().email('Invalid email address.'),
  password:   z.string().min(8, 'Password must be at least 8 characters.'),
  full_name:  z.string().max(100).optional(),
  university: z.string().optional(),
});

export const AuthForgotSchema = z.object({
  email: z.string().email('Invalid email address.'),
});

export const PaymentInitiateSchema = z.object({
  tier: z.enum(['student_pack', 'defense_pack', 'project_reset']),
});

export const AiMessagesSchema = z.object({
  messages: z
    .array(
      z.object({
        role:    z.enum(['user', 'assistant']),
        content: z.string(),
      })
    )
    .min(1, 'At least one message is required.'),
});

/**
 * Returns { ok: true } or { ok: false, error: '<first Zod issue message>' }.
 * @param {import('zod').ZodTypeAny} schema
 * @param {unknown} data
 */
export function validate(schema, data) {
  const result = schema.safeParse(data);
  if (result.success) return { ok: true };
  return {
    ok:    false,
    error: result.error.issues[0]?.message ?? 'Invalid request.',
  };
}
```

- [ ] **Step 2: Smoke-test the schemas**

```bash
node -e "
import { validate, AuthLoginSchema, PaymentInitiateSchema } from './api/_lib/validate.js';
console.log(validate(AuthLoginSchema, { email: 'bad', password: 'x' }));
console.log(validate(AuthLoginSchema, { email: 'a@b.com', password: 'secret' }));
console.log(validate(PaymentInitiateSchema, { tier: 'unknown_tier' }));
console.log(validate(PaymentInitiateSchema, { tier: 'student_pack' }));
" --input-type=module
```

Expected:
```
{ ok: false, error: 'Invalid email address.' }
{ ok: true }
{ ok: false, error: 'Invalid enum value' }
{ ok: true }
```

- [ ] **Step 3: Commit**

```bash
git add api/_lib/validate.js
git commit -m "feat(api): add shared Zod validation schemas"
```

---

## Task 3: Create `api/_lib/trace.js`

**Files:**
- Create: `api/_lib/trace.js`

- [ ] **Step 1: Create the file**

```js
// api/_lib/trace.js
import { randomBytes } from 'crypto';

/**
 * Returns a short request-scoped ID like "fyp-3a8f2c1b".
 * Paste it into Vercel log search to find every log line from one request.
 */
export function generateTraceId() {
  return 'fyp-' + randomBytes(4).toString('hex');
}

/**
 * Wraps console.error / console.warn with the trace ID prefix.
 * @param {string} traceId
 * @param {'error'|'warn'} level
 * @param {...unknown} args
 */
export function traceLog(traceId, level, ...args) {
  const fn = level === 'warn' ? console.warn : console.error;
  fn(`[${traceId}]`, ...args);
}
```

- [ ] **Step 2: Smoke-test**

```bash
node -e "
import { generateTraceId, traceLog } from './api/_lib/trace.js';
const id = generateTraceId();
console.assert(id.startsWith('fyp-'), 'prefix missing');
console.assert(id.length === 12, 'wrong length: ' + id.length);
traceLog(id, 'error', 'test error');
traceLog(id, 'warn',  'test warn');
" --input-type=module
```

Expected: two lines starting with `[fyp-xxxxxxxx] test error` and `[fyp-xxxxxxxx] test warn`, no assertion errors.

- [ ] **Step 3: Commit**

```bash
git add api/_lib/trace.js
git commit -m "feat(api): add request trace ID generator and prefixed logger"
```

---

## Task 4: Update `api/auth.js`

**Files:**
- Modify: `api/auth.js`

The pattern for every handler:
1. `const traceId = generateTraceId(); res.setHeader('X-Trace-Id', traceId);` — first two lines of each handler
2. `validate(Schema, req.body || {})` — before the existing field checks (and replaces them)
3. `traceLog(traceId, 'error', ...)` — replaces all `console.error` in that handler

- [ ] **Step 1: Add imports at the top of `api/auth.js`**

After the existing imports add:
```js
import { generateTraceId, traceLog } from './_lib/trace.js';
import { validate, AuthLoginSchema, AuthSignupSchema, AuthForgotSchema } from './_lib/validate.js';
```

- [ ] **Step 2: Replace `handleLogin`**

Replace the entire `handleLogin` function (lines 51–100) with:

```js
async function handleLogin(req, res) {
  const traceId = generateTraceId();
  res.setHeader('X-Trace-Id', traceId);

  const v = validate(AuthLoginSchema, req.body || {});
  if (!v.ok) return res.status(400).json({ error: v.error });

  const ip = getIp(req);
  let rl;
  try {
    rl = await makeIpLimiter(10, '15 m', 'login').limit(ip);
  } catch (rlErr) {
    traceLog(traceId, 'error', '[auth/login] rate limiter threw (failing open):', rlErr.message);
    rl = { success: true };
  }
  if (!rl.success) {
    const today = new Date().toISOString().slice(0, 10);
    sendTelegramAlertOnce(`⚠️ Brute-force detected: 10+ login attempts from IP ${ip}`, `tg:auth:bruteforce:${ip}:${today}`).catch(() => null);
    return res.status(429).json({
      error: 'Too many login attempts from your location. Please wait 15 minutes and try again.',
    });
  }

  const { email, password } = req.body;

  let response, data;
  try {
    response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON },
      body:    JSON.stringify({ email, password }),
    });
    data = await response.json();
  } catch (fetchErr) {
    traceLog(traceId, 'error', '[auth/login] GoTrue fetch failed:', fetchErr.message);
    return res.status(503).json({ error: 'Authentication service unavailable. Please try again.' });
  }
  const success = response.ok && !!data.access_token;

  logAttempt(email, ip, 'login', success);

  if (!success) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  return res.status(200).json({
    access_token:  data.access_token,
    refresh_token: data.refresh_token,
    expires_in:    data.expires_in,
    token_type:    data.token_type,
  });
}
```

- [ ] **Step 3: Replace `handleSignup`**

Replace the entire `handleSignup` function (lines 104–190) with:

```js
async function handleSignup(req, res) {
  const traceId = generateTraceId();
  res.setHeader('X-Trace-Id', traceId);

  const v = validate(AuthSignupSchema, req.body || {});
  if (!v.ok) return res.status(400).json({ error: v.error });

  const ip = getIp(req);
  let rl;
  try {
    rl = await makeIpLimiter(5, '1 h', 'signup').limit(ip);
  } catch (rlErr) {
    traceLog(traceId, 'error', '[auth/signup] rate limiter threw (failing open):', rlErr.message);
    rl = { success: true };
  }
  if (!rl.success) {
    return res.status(429).json({
      error: 'Too many signup attempts from your location. Please try again later.',
    });
  }

  const { email, password, full_name, university } = req.body;

  const { data, error } = await supabaseAnon.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${APP_URL}/auth/confirm`,
      data: { full_name, university },
    },
  });

  const userId  = data?.user?.id;
  const success = !error && !!userId;

  logAttempt(email, ip, 'signup', success);

  if (success) {
    await Promise.all([
      sendTelegramAlert(`👤 New signup: ${email} (free)`),
      (async () => {
        try {
          const { count } = await supabaseAdmin
            .from('notifications')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', userId)
            .eq('type', 'welcome');
          if (count === 0) {
            await supabaseAdmin.from('notifications').insert({
              user_id: userId,
              type:    'welcome',
              title:   'Welcome to FYPro',
              message: "Your research journey starts here. Let's go.",
            });
          }
        } catch (e) {
          traceLog(traceId, 'error', '[auth/signup] welcome notification failed:', e.message);
        }
      })(),
    ]);
    if (process.env.CRON_SECRET) {
      fetch(`${APP_URL}/api/send-nurture-email`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.CRON_SECRET}` },
        body:    JSON.stringify({ userId, emailType: 'welcome', email, name: full_name || '' }),
      }).catch(e => traceLog(traceId, 'error', '[auth/signup] welcome email failed:', e.message));
    }
  }

  if (error) {
    const msg = error.message || 'Sign up failed. Please try again.';
    return res.status(400).json({ error: msg });
  }

  if (userId && full_name) {
    supabaseAdmin
      .from('users')
      .update({ full_name, university_name: university })
      .eq('id', userId)
      .then(({ error }) => { if (error) traceLog(traceId, 'error', '[auth/signup] users update:', error.message) })
      .catch(e => traceLog(traceId, 'error', '[auth/signup] users update:', e.message));
  }

  return res.status(200).json({ ok: true });
}
```

- [ ] **Step 4: Replace `handleForgotPassword`**

Replace the entire `handleForgotPassword` function (lines 194–223) with:

```js
async function handleForgotPassword(req, res) {
  const traceId = generateTraceId();
  res.setHeader('X-Trace-Id', traceId);

  const v = validate(AuthForgotSchema, req.body || {});
  if (!v.ok) return res.status(400).json({ error: v.error });

  const ip = getIp(req);
  let rl;
  try {
    rl = await makeIpLimiter(5, '1 h', 'forgot').limit(ip);
  } catch (rlErr) {
    traceLog(traceId, 'error', '[auth/forgot] rate limiter threw (failing open):', rlErr.message);
    rl = { success: true };
  }
  if (!rl.success) {
    return res.status(429).json({
      error: 'Too many requests. Please try again later.',
    });
  }

  const { email } = req.body;

  fetch(`${SUPABASE_URL}/auth/v1/recover`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON },
    body:    JSON.stringify({ email }),
  }).catch(e => traceLog(traceId, 'error', '[auth/forgot] recover error:', e.message));

  logAttempt(email, ip, 'forgot_password', true);

  return res.status(200).json({ ok: true });
}
```

- [ ] **Step 5: Run tests**

```bash
npm test
```

Expected: 85 passed.

- [ ] **Step 6: Commit**

```bash
git add api/auth.js
git commit -m "feat(auth): add Zod validation and request trace ID"
```

---

## Task 5: Update `api/payments.js`

**Files:**
- Modify: `api/payments.js`

Only `handleInitiate` and `handleVerify` receive user-controlled JSON bodies. The webhook handler reads a Paystack-signed body — leave it untouched.

- [ ] **Step 1: Add imports at the top of `api/payments.js`**

After the existing imports add:
```js
import { generateTraceId, traceLog } from './_lib/trace.js';
import { validate, PaymentInitiateSchema } from './_lib/validate.js';
```

- [ ] **Step 2: Replace `handleInitiate`**

Replace the entire `handleInitiate` function (lines 172–242) with:

```js
async function handleInitiate(req, res) {
  const traceId = generateTraceId();
  res.setHeader('X-Trace-Id', traceId);

  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    const v = validate(PaymentInitiateSchema, req.body || {});
    if (!v.ok) return res.status(400).json({ error: v.error });

    let authResult, rl;
    try {
      [authResult, rl] = await Promise.all([
        supabaseAdmin.auth.getUser(token),
        rateLimitCheck(req, { userDay: 10, ipDay: 30, prefix: 'pay_initiate' }).catch(() => ({ allowed: true, reason: '' })),
      ]);
    } catch {
      return res.status(503).json({ error: 'Service unavailable. Please try again.' });
    }
    const { data: { user } = {}, error: authError } = authResult;
    if (authError || !user) return res.status(401).json({ error: 'Unauthorized' });
    if (!rl.allowed) return res.status(429).json({ error: rl.reason });

    const { tier } = req.body;

    // Detect upgrade: Student Plan holders buying Defense Pack pay ₦1,500 (the difference)
    let effectiveTier = tier;
    if (tier === 'defense_pack') {
      const { data: entitlements } = await supabaseAdmin
        .from('user_entitlements')
        .select('paid_features')
        .eq('user_id', user.id)
        .maybeSingle();
      const features = Array.isArray(entitlements?.paid_features) ? entitlements.paid_features : [];
      if (features.includes('student_pack') && !features.includes('defense_pack')) {
        effectiveTier = 'defense_pack_upgrade';
      }
    }

    let amountKobo;
    try {
      amountKobo = expectedAmountKobo(effectiveTier);
    } catch {
      traceLog(traceId, 'error', '[payments/initiate] unknown tier:', effectiveTier);
      return res.status(400).json({ error: 'Invalid payment tier.' });
    }

    const reference = generateReference(user.id);

    const { error: insertError } = await supabaseAdmin
      .from('payments')
      .insert({
        user_id:            user.id,
        tier:               effectiveTier,
        amount_kobo:        amountKobo,
        paystack_reference: reference,
        status:             'pending',
      });

    if (insertError) {
      traceLog(traceId, 'error', '[payments/initiate] insert failed', insertError.message);
      return res.status(500).json({ error: 'Failed to create payment record' });
    }

    return res.status(200).json({
      reference,
      amount_kobo: amountKobo,
      email:       user.email,
      publicKey:   process.env.PAYSTACK_PUBLIC_KEY,
    });
  } catch (err) {
    traceLog(traceId, 'error', '[payments/initiate] error:', err);
    return res.status(500).json({ error: 'An unexpected error occurred. Please try again.' });
  }
}
```

- [ ] **Step 3: Add trace ID to `handleVerify`**

At the very start of `handleVerify` (line 244), insert these two lines before `const token = ...`:

```js
  const traceId = generateTraceId();
  res.setHeader('X-Trace-Id', traceId);
```

Then replace every `console.warn` and `console.error` in `handleVerify` with `traceLog`:

| Original | Replace with |
|----------|-------------|
| `console.warn('[payments/verify] Paystack verify failed', ...)` | `traceLog(traceId, 'warn', '[payments/verify] Paystack verify failed', ...)` |
| `console.error('[payments/verify] fetch error', ...)` | `traceLog(traceId, 'error', '[payments/verify] fetch error', ...)` |
| `console.error('[payments/verify] receipt email failed', ...)` | `traceLog(traceId, 'error', '[payments/verify] receipt email failed', ...)` |
| `console.warn('[payments/verify] known rejection', ...)` | `traceLog(traceId, 'warn', '[payments/verify] known rejection', ...)` |
| `console.error('[payments/verify] unexpected error', ...)` | `traceLog(traceId, 'error', '[payments/verify] unexpected error', ...)` |

- [ ] **Step 4: Run tests**

```bash
npm test
```

Expected: 85 passed.

- [ ] **Step 5: Commit**

```bash
git add api/payments.js
git commit -m "feat(payments): add Zod tier validation and request trace ID"
```

---

## Task 6: Update `api/ai.js`

**Files:**
- Modify: `api/ai.js`

Add messages validation and trace to `handleGeneral` and `handleDefense`. Leave `handleSupervisorPrep` and `handleCheckAchievements` unchanged — they already have adequate validation.

- [ ] **Step 1: Add imports at the top of `api/ai.js`**

After the existing imports add:
```js
import { generateTraceId, traceLog } from './_lib/trace.js';
import { validate, AiMessagesSchema } from './_lib/validate.js';
```

- [ ] **Step 2: Add trace ID + messages validation to `handleGeneral`**

At the very start of `handleGeneral` (line 44), insert after the function signature opening:

```js
  const traceId = generateTraceId();
  res.setHeader('X-Trace-Id', traceId);
```

Then add messages validation right after the `req.body` destructuring (after line 55, before the `isAllowedGeneralStep` check):

```js
  const v = validate(AiMessagesSchema, req.body || {});
  if (!v.ok) return res.status(400).json({ error: v.error });
```

Then replace every `console.error` in `handleGeneral` with `traceLog`:

| Original | Replace with |
|----------|-------------|
| `console.error('[ai/general] auth.getUser threw:', authErr.message)` | `traceLog(traceId, 'error', '[ai/general] auth.getUser threw:', authErr.message)` |
| `console.error('[ai/general] rateLimitCheck threw (failing open):', rlErr.message)` | `traceLog(traceId, 'error', '[ai/general] rateLimitCheck threw (failing open):', rlErr.message)` |
| `console.error('[ai/general] entitlements fetch error:', e.message)` | `traceLog(traceId, 'error', '[ai/general] entitlements fetch error:', e.message)` |
| `console.error('[ai/general] Anthropic request timed out after 50s')` | `traceLog(traceId, 'error', '[ai/general] Anthropic request timed out after 50s')` |
| `console.error('[ai/general] error:', err.message)` | `traceLog(traceId, 'error', '[ai/general] error:', err.message)` |
| `console.error('[ai/general] ANTHROPIC_API_KEY is not set')` | `traceLog(traceId, 'error', '[ai/general] ANTHROPIC_API_KEY is not set')` |
| `console.error('[ai/general] run count increment failed:', ...)` | `traceLog(traceId, 'error', '[ai/general] run count increment failed:', ...)` |

- [ ] **Step 3: Add trace ID + messages validation to `handleDefense`**

At the very start of `handleDefense` (line 202), insert after the function signature opening:

```js
  const traceId = generateTraceId();
  res.setHeader('X-Trace-Id', traceId);
```

Add messages validation right after the `req.body` destructuring (after line 264, before the `answerWordCount` check):

```js
  const mv = validate(AiMessagesSchema, req.body || {});
  if (!mv.ok) return res.status(400).json({ error: mv.error });
```

Then replace every `console.error` in `handleDefense` with `traceLog`:

| Original | Replace with |
|----------|-------------|
| `console.error('[ai/defense] auth.getUser threw:', authErr.message)` | `traceLog(traceId, 'error', '[ai/defense] auth.getUser threw:', authErr.message)` |
| `console.error('[ai/defense] rateLimitCheck threw (failing open):', rlErr.message)` | `traceLog(traceId, 'error', '[ai/defense] rateLimitCheck threw (failing open):', rlErr.message)` |
| `console.error('[ai/defense] entitlements fetch error:', entError.message)` | `traceLog(traceId, 'error', '[ai/defense] entitlements fetch error:', entError.message)` |
| `console.error('[ai/defense] error:', err.message)` | `traceLog(traceId, 'error', '[ai/defense] error:', err.message)` |

- [ ] **Step 4: Run tests**

```bash
npm test
```

Expected: 85 passed.

- [ ] **Step 5: Commit**

```bash
git add api/ai.js
git commit -m "feat(ai): add messages Zod validation and request trace ID"
```

---

## Task 7: Wire trace ID to Sentry on the frontend

**Files:**
- Modify: `src/lib/sentry.ts`
- Modify: `src/services/api.js`

- [ ] **Step 1: Add `setTraceId` export to `src/lib/sentry.ts`**

Replace the entire file with:

```ts
import * as Sentry from "@sentry/react";

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  environment: import.meta.env.MODE,
  enabled: import.meta.env.PROD,
  tracesSampleRate: 0.2,
  beforeSend(event) {
    if (event.user) {
      delete event.user.ip_address;
      delete event.user.email;
      delete event.user.username;
    }
    return event;
  },
});

/** Stamps the current Sentry scope with the backend trace ID so any error
 *  captured after this call will link to the backend log for that request. */
export function setTraceId(id: string): void {
  Sentry.setTag('trace_id', id);
}

export default Sentry;
```

- [ ] **Step 2: Import `setTraceId` in `src/services/api.js`**

Add this import near the top of the file, after the existing imports:

```js
import { setTraceId } from '../lib/sentry';
```

- [ ] **Step 3: Read `X-Trace-Id` in `callClaude`**

In `callClaude()`, immediately after `const res = await fetch(ENDPOINT, { ... });` (line ~41), insert:

```js
  const traceId = res.headers.get('X-Trace-Id');
  if (traceId) setTraceId(traceId);
```

The result looks like:

```js
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  const traceId = res.headers.get('X-Trace-Id');
  if (traceId) setTraceId(traceId);

  if (res.status === 429) {
```

- [ ] **Step 4: Run tests**

```bash
npm test
```

Expected: 85 passed.

- [ ] **Step 5: Commit**

```bash
git add src/lib/sentry.ts src/services/api.js
git commit -m "feat(frontend): wire X-Trace-Id response header to Sentry scope"
```

---

## Task 8: Final verification

- [ ] **Step 1: Run full test suite one last time**

```bash
npm test
```

Expected: 85 passed, 0 failed.

- [ ] **Step 2: Run npm audit**

```bash
npm audit --audit-level=moderate
```

Expected: `found 0 vulnerabilities`

- [ ] **Step 3: Build check**

```bash
npm run build
```

Expected: build completes with no errors.

- [ ] **Step 4: Push**

```bash
git push
```
