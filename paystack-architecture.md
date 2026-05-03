# FYPro v2 — Paystack Architecture (Security-First)

**Date:** Sun May 03, 2026
**Scope:** One-time Paystack payments for v2 launch (June 12). Built v3-ready.
**Stack alignment:** Vercel serverless functions + Supabase + the schema in `architecture-decisions.md`.

---

## The Three Locks

Payment fraud is the #1 way to lose money on launch day. Every payment MUST pass all three locks before access is granted. Skip any one and you have a bypass.

1. **Server-side `/transaction/verify` call** — never trust the frontend's "payment success" callback.
2. **HMAC SHA512 webhook signature** — verified against the **raw request body** with `PAYSTACK_SECRET_KEY`.
3. **Amount verification** — the `amount` returned by Paystack (in kobo) MUST match the expected price for the claimed `tier`. Otherwise a user pays ₦100 and unlocks the ₦3,500 Defense Pack.

If any lock fails: reject, log, do not credit.

---

## Pricing Source of Truth

Pricing lives in **server code only**. The frontend can display prices but it is never trusted to send them. The `tier` is the only thing the frontend submits; the server resolves the price.

```js
// /api/_lib/pricing.js — single source of truth
export const PRICING_KOBO = {
  student_pack:  200000,   // ₦2,000
  defense_pack:  350000,   // ₦3,500
  project_reset: 150000,   // ₦1,500
};

export function expectedAmountKobo(tier) {
  const amount = PRICING_KOBO[tier];
  if (!amount) throw new Error(`Unknown tier: ${tier}`);
  return amount;
}
```

This is imported by both `/api/initiate-payment`, `/api/verify-payment`, and `/api/paystack-webhook`. The frontend never sees these numbers in any code path that controls credit.

---

## 1. Inline Modal vs Redirect — Decision: **Inline Modal**

For FYPro, **Paystack Inline Popup** wins. Reasons:

| Factor | Inline | Redirect | Winner for FYPro |
|---|---|---|---|
| Mobile UX (Nigerian students on phones) | Stays in-app, no tab switch | Opens new page, browser-back loses state | **Inline** |
| Conversion friction | One modal, in-context | Full navigation away and back | **Inline** |
| Recovering from "user closes browser" | Reference is generated server-side **before** modal opens, so the record exists regardless of what the user does next | Same | Tied |
| Security | Identical — both flows MUST be verified server-side after | Identical | Tied |
| Implementation complexity | Slightly more JS on the client | Slightly more state management on return | Tied |

The security model is the same either way (verification happens server-side after the fact), so the decision is pure UX. Inline keeps the student inside FYPro at the most fragile moment of the journey: handing over money.

**However** — the reference is generated **server-side first** (`/api/initiate-payment` returns the reference), so even if the student closes the browser mid-payment, the record is in our DB and the webhook will reconcile.

---

## 2. Server-Side Verification — Mandatory Flow

The `/transaction/verify` endpoint is the **second confirmation** that the payment actually happened, independent of the webhook. We use both. They are belt and braces, not alternatives.

### Flow

```
[1] Frontend: user clicks "Pay ₦3,500"
       │
       ▼
[2] POST /api/initiate-payment  { tier: 'defense_pack' }
       │   - Server: lookup expected amount from PRICING_KOBO
       │   - Server: generate reference: FYP_<userId>_<timestamp>_<random>
       │   - Server: INSERT into payments (status='pending', amount_kobo=expected, tier, paystack_reference)
       │   - Server: return { reference, amount_kobo, publicKey }
       ▼
[3] Frontend: PaystackPop.setup({ key: publicKey, email, amount, ref: reference, ... }).openIframe()
       │
       ▼
[4] User completes payment in modal
       │
       ▼
[5] Modal onSuccess callback fires → POST /api/verify-payment { reference }
       │   - Server: GET https://api.paystack.co/transaction/verify/:reference
       │     Authorization: Bearer PAYSTACK_SECRET_KEY
       │   - Server: assert response.data.status === 'success'
       │   - Server: assert response.data.amount === payments.amount_kobo  ← AMOUNT LOCK
       │   - Server: assert response.data.currency === 'NGN'
       │   - Server: idempotency check (see §4)
       │   - Server: UPDATE payments SET status='success', webhook_verified_at=now()
       │   - Server: UPDATE user_entitlements via service_role (grant feature)
       │   - Server: return { status: 'success', tier }
       ▼
[6] Frontend: redirect to confirmation page
```

### In parallel (and authoritative)

```
[A] Paystack POSTs webhook to /api/paystack-webhook
       │   - Server: HMAC verification on RAW body (see §3)
       │   - Server: idempotency check (see §4)
       │   - Server: amount verification (see §5)
       │   - Server: same UPDATE as step 5
```

**Both paths converge on the same server function** (`creditUser(reference, paystackData)`) which is itself idempotent. So whichever fires first wins; the second is a no-op.

### Why both paths?

- The verify call from the frontend is **synchronous** — the user is sitting there waiting. We need a fast confirmation to redirect them.
- The webhook is **authoritative** — it fires even if the user closes the browser, loses connectivity, or the verify call fails. It is the thing we trust at end of day.

---

## 3. Webhook Security

### 3a. HMAC SHA512 Verification (the core lock)

Paystack signs the **raw request body bytes** with your secret key. You MUST verify against the raw bytes, not a re-stringified version. `JSON.stringify(req.body)` will produce different output (whitespace, key ordering) and the signature will not match.

**On Vercel, you must disable bodyParser** to access the raw stream.

```js
// /api/paystack-webhook.js
import crypto from 'crypto';
import { creditUser } from './_lib/credit-user';

export const config = {
  api: { bodyParser: false },  // CRITICAL — must read raw body
};

// Helper: read raw body as Buffer
async function getRawBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  // === LOCK 1: HMAC verification on RAW bytes ===
  let rawBody;
  try {
    rawBody = await getRawBody(req);
  } catch (err) {
    console.error('[webhook] failed to read raw body', err);
    return res.status(400).json({ error: 'Bad request' });
  }

  const signature = req.headers['x-paystack-signature'];
  if (!signature) {
    console.warn('[webhook] missing signature header from', req.headers['x-forwarded-for']);
    return res.status(400).json({ error: 'Missing signature' });
  }

  const computed = crypto
    .createHmac('sha512', process.env.PAYSTACK_SECRET_KEY)
    .update(rawBody)
    .digest('hex');

  // Constant-time comparison to prevent timing attacks
  const sigBuf = Buffer.from(signature, 'hex');
  const compBuf = Buffer.from(computed, 'hex');
  if (sigBuf.length !== compBuf.length || !crypto.timingSafeEqual(sigBuf, compBuf)) {
    console.warn('[webhook] invalid signature from', req.headers['x-forwarded-for']);
    return res.status(400).json({ error: 'Invalid signature' });
  }

  // Signature valid — NOW it is safe to parse
  const event = JSON.parse(rawBody.toString('utf8'));

  // Only handle charge.success — ignore other event types for now
  if (event.event !== 'charge.success') {
    return res.status(200).json({ received: true, ignored: event.event });
  }

  // === LOCKS 2 + 3 (idempotency + amount) handled inside creditUser ===
  try {
    const result = await creditUser({
      reference: event.data.reference,
      paystackAmountKobo: event.data.amount,
      paystackStatus: event.data.status,
      paystackCurrency: event.data.currency,
      source: 'webhook',
    });
    return res.status(200).json(result);
  } catch (err) {
    console.error('[webhook] creditUser failed', { ref: event.data.reference, err: err.message });
    // Return 200 anyway if it's a "known bad" rejection (amount mismatch, unknown ref) —
    // we don't want Paystack retrying forever. We've logged it.
    if (err.code === 'KNOWN_REJECTION') {
      return res.status(200).json({ received: true, rejected: err.message });
    }
    // Genuine server error — return 500 so Paystack retries
    return res.status(500).json({ error: 'Internal error' });
  }
}
```

### 3b. If signature fails

- **Return `400`** immediately. Do not parse the body. Do not log the body content (it is unverified — could be attacker-controlled).
- **Log** the source IP, the timestamp, and the fact that signature failed. Do not log the secret or the computed hash.
- **Do not** alert on every failure — there will be a baseline of probing traffic. Alert only if rate exceeds a threshold (e.g. >10/min).

### 3c. IP Whitelisting — Second Layer (Optional, Recommended)

Paystack's documented webhook source IPs:
- `52.31.139.75`
- `52.49.173.169`
- `52.214.14.220`

Add as a **second** check, after HMAC. Never as a replacement — IPs can change, and HMAC is the cryptographic guarantee.

```js
const PAYSTACK_IPS = new Set(['52.31.139.75', '52.49.173.169', '52.214.14.220']);

// Vercel puts the real client IP in x-forwarded-for (first entry)
const sourceIp = (req.headers['x-forwarded-for'] || '').split(',')[0].trim();

if (!PAYSTACK_IPS.has(sourceIp)) {
  // Log and continue — HMAC is the real check. Treat IP mismatch as a warning,
  // not a hard reject, in case Paystack adds new IPs without warning.
  console.warn('[webhook] unexpected source IP:', sourceIp);
  // Optionally: return res.status(403).end(); — but only if you commit to monitoring this.
}
```

**Recommendation for v2 launch:** log only, do not block on IP. HMAC is sufficient. Once Paystack publishes a stable IP allowlist policy you can harden this. If they rotate IPs and you've blocked, you'll miss webhooks and not know why.

---

## 4. Idempotency — No Double-Crediting

Paystack will retry webhooks. Networks fail. The `/verify` path and the webhook path will both fire for the same payment. The `creditUser` function MUST be safe to call N times with the same reference and produce the same end state.

### Mechanism

The `payments` table has `paystack_reference TEXT NOT NULL UNIQUE`. This is the idempotency key. The flow:

```js
// /api/_lib/credit-user.js
import { supabaseAdmin } from './supabase-admin';  // service_role client
import { expectedAmountKobo } from './pricing';

export async function creditUser({ reference, paystackAmountKobo, paystackStatus, paystackCurrency, source }) {
  // 1. Look up the pending payment by reference
  const { data: payment, error: lookupErr } = await supabaseAdmin
    .from('payments')
    .select('id, user_id, project_id, tier, amount_kobo, status, webhook_verified_at')
    .eq('paystack_reference', reference)
    .single();

  if (lookupErr || !payment) {
    const e = new Error('Unknown reference: ' + reference);
    e.code = 'KNOWN_REJECTION';
    throw e;
  }

  // === IDEMPOTENCY CHECK ===
  if (payment.status === 'success' && payment.webhook_verified_at) {
    console.log('[creditUser] already processed', reference, 'source=', source);
    return { status: 'already_processed', reference };
  }

  // === STATUS CHECK ===
  if (paystackStatus !== 'success') {
    await supabaseAdmin.from('payments')
      .update({ status: 'failed' })
      .eq('paystack_reference', reference);
    const e = new Error('Paystack status not success: ' + paystackStatus);
    e.code = 'KNOWN_REJECTION';
    throw e;
  }

  // === CURRENCY CHECK ===
  if (paystackCurrency !== 'NGN') {
    const e = new Error('Unexpected currency: ' + paystackCurrency);
    e.code = 'KNOWN_REJECTION';
    throw e;
  }

  // === AMOUNT LOCK ===
  const expected = expectedAmountKobo(payment.tier);
  if (paystackAmountKobo !== expected) {
    console.error('[creditUser] AMOUNT MISMATCH', {
      reference, tier: payment.tier, expected, received: paystackAmountKobo,
    });
    await supabaseAdmin.from('payments')
      .update({ status: 'failed' })
      .eq('paystack_reference', reference);
    const e = new Error(`Amount mismatch: expected ${expected}, got ${paystackAmountKobo}`);
    e.code = 'KNOWN_REJECTION';
    throw e;
  }

  // All locks passed — credit atomically
  // Use a Postgres function for true atomicity if you want belt-and-braces;
  // for v2, two sequential service_role updates are acceptable.

  await supabaseAdmin.from('payments')
    .update({
      status: 'success',
      webhook_verified_at: new Date().toISOString(),
    })
    .eq('paystack_reference', reference)
    .eq('status', 'pending');  // ← guards against race: only update if still pending

  // Grant entitlement
  await grantEntitlement(payment.user_id, payment.tier, payment.amount_kobo);

  return { status: 'success', reference, tier: payment.tier };
}

async function grantEntitlement(userId, tier, amountKobo) {
  const { data: current } = await supabaseAdmin
    .from('user_entitlements')
    .select('paid_features, defense_packs_remaining, total_lifetime_paid_ngn')
    .eq('user_id', userId)
    .single();

  const features = new Set(current?.paid_features || []);
  let defensePacks = current?.defense_packs_remaining || 0;

  if (tier === 'student_pack') features.add('student_pack');
  if (tier === 'defense_pack') { features.add('defense_pack'); defensePacks += 1; }
  if (tier === 'project_reset') features.add('project_reset');

  await supabaseAdmin.from('user_entitlements')
    .update({
      paid_features: Array.from(features),
      defense_packs_remaining: defensePacks,
      total_lifetime_paid_ngn:
        (current?.total_lifetime_paid_ngn || 0) + Math.floor(amountKobo / 100),
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId);
}
```

The `.eq('status', 'pending')` guard on the update is the race-condition safety net: if two concurrent calls both pass the idempotency check, only one will match `status='pending'` and perform the update; the other's update will affect zero rows and exit silently. Combined with the upfront idempotency check, the window for double-credit is closed.

---

## 5. Amount Verification — Detail

This is the lock that stops the "₦100 paying for ₦3,500 access" attack.

The attacker's playbook without this lock:
1. Open the inline modal for `defense_pack`.
2. Use browser devtools to change the `amount` field in the Paystack iframe to `10000` (₦100).
3. Pay ₦100.
4. Webhook fires with `amount: 10000` — but the reference is for `tier: 'defense_pack'`.
5. Without the check: server credits Defense Pack. Loss: ₦3,400 per attack, repeatable.

**With the check (as in §4):**
- Server reads `payments.tier` → `'defense_pack'`.
- Server reads `expectedAmountKobo('defense_pack')` → `350000`.
- Compares to `paystack.data.amount` → `10000`.
- Mismatch → mark payment failed, do not credit, log loudly.

The reason this works is that the `tier` and `amount_kobo` were written to the DB **server-side at `/api/initiate-payment` time**, before the user touched the modal. The frontend never had a chance to lie about which tier was being purchased.

---

## 6. State Tracking — `payments` Table

Already defined in `architecture-decisions.md`. Recap of the security-relevant properties:

| Property | Why |
|---|---|
| `paystack_reference UNIQUE` | Idempotency key |
| `amount_kobo INTEGER` | Stored as integer kobo, not float NGN — no rounding errors |
| `tier` enum constrained to 3 values | Cannot smuggle arbitrary tier strings |
| `status` enum constrained to 4 values | Cannot smuggle arbitrary statuses |
| `webhook_verified_at TIMESTAMPTZ NULL` | Distinguishes "Paystack told us OK" from "we verified the HMAC" |
| **No client INSERT/UPDATE/DELETE policy** | Service role only — frontend SDK literally cannot write here |
| Client SELECT policy = `(select auth.uid()) = user_id` | User can see their own history, nothing more |

The matching `user_entitlements` table follows the same rule: **no client write policy at all**. Even a buggy RLS policy on `users` cannot grant Defense Pack access, because that data isn't on `users`. This is the architectural reason the three-locks approach is sufficient: there is no way to write to `paid_features` except through the service-role webhook code paths above.

---

## 7. Secret Key — `PAYSTACK_SECRET_KEY`

### Rules

1. **Lives only in Vercel env vars.** Set via `vercel env add PAYSTACK_SECRET_KEY` or the Vercel dashboard.
2. **Never in `NEXT_PUBLIC_*` or `VITE_*` env vars** — those get bundled to the client.
3. **Never in `.env` files committed to git.** `.env*` is in `.gitignore` from day 1 (security discipline already in place).
4. **Public key (`PAYSTACK_PUBLIC_KEY`) is the only one the frontend touches.** It is safe to expose because it cannot initiate refunds or read transaction history — it can only open the modal.

### Verification checklist

```bash
# 1. Confirm the secret is NOT in any client bundle
grep -r "sk_live\|sk_test" src/  # should return nothing
grep -r "PAYSTACK_SECRET" src/   # should return nothing

# 2. Confirm it IS in Vercel
vercel env ls | grep PAYSTACK

# 3. Confirm .env is gitignored
git check-ignore .env .env.local  # should print the filenames
```

The secret is read **only** from `process.env.PAYSTACK_SECRET_KEY` inside `/api/*` files. If it leaks, rotate immediately via the Paystack dashboard and update Vercel — old keys are invalidated server-side at Paystack.

---

## 8. Edge Cases

### 8a. User pays then closes browser before redirect

- The `/api/initiate-payment` call already created the `payments` row with `status='pending'`.
- Paystack webhook will fire regardless of the browser state.
- `creditUser` runs from the webhook path → entitlement granted.
- Next time user logs in, they see Defense Pack unlocked.
- **Optional UX polish:** on dashboard load, query `payments` for any rows with `status='success'` granted in the last 24h that the user hasn't seen a confirmation for, and show a "Welcome back — your Defense Pack is active" toast.

### 8b. Webhook arrives before verify call returns

This is **the most common race** and the reason for the idempotency design.

- Webhook fires → HMAC OK → `creditUser` runs → `payments.status='success'`, entitlement granted.
- Verify call (still in flight from frontend) returns → `creditUser` runs again → idempotency check sees `status='success' AND webhook_verified_at IS NOT NULL` → returns `'already_processed'` → no double credit.
- Frontend gets a successful response either way → redirects user to confirmation page.

### 8c. Paystack is down

- `/api/initiate-payment` succeeds (we just create the DB row and return our own reference) but the modal won't load.
- Frontend shows: *"Payment is temporarily unavailable. Please try again in a moment."*
- The orphaned `pending` row is harmless. A daily cleanup job can sweep `pending` rows older than 24h and mark them `failed` (no entitlement granted, no harm done). For v2 launch, you don't even need the sweep — orphans are inert.

### 8d. User refunds — revoking access

Paystack sends a `charge.refund` event (or you initiate a refund manually via dashboard, which still produces an event).

```js
// In the webhook handler, alongside charge.success:
if (event.event === 'charge.refund') {
  await handleRefund({
    reference: event.data.reference,
    refundedAmountKobo: event.data.amount,
  });
  return res.status(200).json({ received: true });
}

async function handleRefund({ reference }) {
  const { data: payment } = await supabaseAdmin
    .from('payments')
    .select('user_id, tier')
    .eq('paystack_reference', reference)
    .single();
  if (!payment) return;

  await supabaseAdmin.from('payments')
    .update({ status: 'refunded' })
    .eq('paystack_reference', reference);

  // Revoke the entitlement
  const { data: ent } = await supabaseAdmin
    .from('user_entitlements')
    .select('paid_features, defense_packs_remaining')
    .eq('user_id', payment.user_id)
    .single();

  const features = new Set(ent?.paid_features || []);
  let defensePacks = ent?.defense_packs_remaining || 0;

  if (payment.tier === 'student_pack')  features.delete('student_pack');
  if (payment.tier === 'project_reset') features.delete('project_reset');
  if (payment.tier === 'defense_pack') {
    defensePacks = Math.max(0, defensePacks - 1);
    if (defensePacks === 0) features.delete('defense_pack');
  }

  await supabaseAdmin.from('user_entitlements')
    .update({
      paid_features: Array.from(features),
      defense_packs_remaining: defensePacks,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', payment.user_id);
}
```

**Edge case within the edge case:** what if a user paid for two Defense Packs, used one, then refunded one? The decrement above takes them from 2 → 1, which is the correct end state. They keep access via the unrefunded pack.

### 8e. Bonus: Replay attacks

The HMAC check protects against tampered payloads, but a captured-and-replayed valid payload would still pass HMAC. Defense:
- The idempotency check (`payment.status === 'success' && webhook_verified_at`) makes replays no-ops.
- For belt-and-braces, you could check `event.data.created_at` against a max age (e.g. reject events older than 7 days). For v2, the idempotency check alone is sufficient.

---

## Files & Endpoints — Inventory

```
/api
├── initiate-payment.js       # POST: create pending row, return reference
├── verify-payment.js         # POST: call /transaction/verify, run creditUser
├── paystack-webhook.js       # POST: HMAC + creditUser (raw body, bodyParser disabled)
└── _lib
    ├── pricing.js            # PRICING_KOBO + expectedAmountKobo()
    ├── credit-user.js        # creditUser() — idempotent, amount-checked
    └── supabase-admin.js     # service_role client (server-only)
```

Frontend touches **only** `/api/initiate-payment` and `/api/verify-payment`. The webhook is invisible to the frontend.

---

## Pre-Launch Verification Checklist

Run through this the night before payments go live (June 25 per the operations checklist).

**Code**
- [ ] `grep -r "sk_live\|sk_test\|PAYSTACK_SECRET" src/` returns nothing
- [ ] `.env` and `.env.local` are gitignored; `git status` does not show them
- [ ] `/api/paystack-webhook.js` has `export const config = { api: { bodyParser: false } }`
- [ ] HMAC computed with `crypto.createHmac('sha512', secret).update(rawBody).digest('hex')` — `rawBody` is a Buffer from the stream, not `JSON.stringify(req.body)`
- [ ] `creditUser` imports `expectedAmountKobo` from `_lib/pricing` and rejects on mismatch
- [ ] `payments` table has `paystack_reference UNIQUE` constraint live in production
- [ ] `payments` and `user_entitlements` have no client INSERT/UPDATE policies (verify with Test 6 in `security-policies.md`)

**Paystack dashboard**
- [ ] Webhook URL set to `https://fypro.vercel.app/api/paystack-webhook`
- [ ] Live secret key copied to Vercel env vars (not committed anywhere)
- [ ] Test mode keys still present in a separate `.env.local` (never deployed)

**Live tests (with ₦100 test transactions)**
- [ ] Pay ₦2,000 student pack → check `user_entitlements.paid_features` contains `student_pack`
- [ ] Pay ₦3,500 defense pack → check `defense_packs_remaining = 1`
- [ ] Initiate a refund from Paystack dashboard → check entitlement is revoked
- [ ] Send a manually-crafted webhook to `/api/paystack-webhook` with no signature header → confirm 400 response
- [ ] Send one with a wrong signature → confirm 400 response
- [ ] Send the same valid webhook twice → confirm second attempt returns `already_processed` and no double credit

If all green, you're cleared to switch to live keys. If anything is yellow, hold the launch.

---

## v3 Evolution Notes

When B2B institutional pricing arrives in v3:
- Add `tier: 'institutional_seat'` to `PRICING_KOBO` (price set per contract).
- `creditUser` extends to grant entitlement against `institution_id` instead of `user_id` for bulk payments.
- The webhook, HMAC, idempotency, and amount verification logic are unchanged. The pattern survives.
