# Payment Issue Report — Design Spec
Date: 2026-05-07

## Problem

When a Paystack webhook drops, the student is charged but their plan is not unlocked. There is currently no way for them to report this without hunting for an email address. This builds a visible, low-friction escape hatch directly into the dashboard.

---

## Architecture

Six files touched:

| File | Change |
|------|--------|
| `src/pages/Dashboard.jsx` | Add payment issue link + modal state |
| `src/components/PaymentIssueModal.jsx` | New — modal with form + success state |
| `api/report-payment-issue.js` | New — authenticated POST, inserts to DB, sends email |
| `migrations/0006_payment_issues.sql` | New — `payment_issues` table + RLS |
| `api/admin.js` | Add `payment-issues` and `resolve-payment-issue` actions |
| `src/pages/admin/Health.jsx` | Add Payment Issues widget section |

**Data flow:**
1. User clicks link in dashboard → `PaymentIssueModal` opens
2. User submits form → POST `/api/report-payment-issue` with `{ transactionRef, description }`
3. API verifies JWT → inserts `payment_issues` row → sends Resend email → returns `{ ok: true }`
4. Modal shows success message
5. Admin loads Health → calls `GET /api/admin?action=payment-issues` → sees unresolved rows
6. Admin clicks "Mark Resolved" → `POST /api/admin?action=resolve-payment-issue` with `{ id }` → row updated, removed from admin UI optimistically

---

## Section 1: Dashboard Link

Location: below the plan/upgrade nudge in `PlanCard`, visible to all users regardless of plan.

```jsx
<button
  onClick={() => setShowPaymentIssueModal(true)}
  style={{
    background: 'none', border: 'none', cursor: 'pointer',
    color: 'rgba(255,255,255,0.4)', fontSize: '0.72rem',
    fontFamily: "'Poppins', sans-serif", marginTop: 12,
    padding: 0, textDecoration: 'underline',
  }}
>
  Paid but access not unlocked? Click here
</button>
```

`setShowPaymentIssueModal` state lives in the `Dashboard` component and is passed as a prop to `PlanCard`.

---

## Section 2: PaymentIssueModal Component

**File:** `src/components/PaymentIssueModal.jsx`

Two internal states: `'form'` and `'success'`.

**Form state:**
- Title: "Payment Issue"
- Body: "If you completed a payment but your plan wasn't unlocked, we'll fix this within 2 hours."
- Field 1: Transaction Reference — text input, required, placeholder `e.g. T680234567890`
- Field 2: Brief description — textarea, optional, maxLength 200
- Submit: "Send Report" — disabled while submitting
- Close button top-right (X)
- Error display: `<ApiErrorBox>` above submit button (reuses existing component)

**Success state:**
- Message: "Report sent. We'll manually verify and unlock your access within 2 hours. Check your email for confirmation."
- "Close" button

**Dismissal rules:**
- Clicking backdrop or X closes modal
- Not dismissible while submitting (`isSubmitting === true`)
- On close, reset form state back to `'form'` and clear fields

**Props:** `{ isOpen, onClose, userEmail, userId }`

---

## Section 3: `api/report-payment-issue.js`

**Method:** POST only. Returns 405 for non-POST.

**Auth:** Extracts Bearer token from `Authorization` header. Calls `supabase.auth.getUser(token)`. Returns 401 if missing or invalid.

**Validation:** `transactionRef` must be non-empty string. Returns 400 if missing.

**Rate limit:** 3 requests per `user_id` per 24 hours via Upstash. Returns 429 with message if exceeded.

**Steps:**
1. Verify JWT → get `userId`, `userEmail`
2. Rate limit check
3. Validate `transactionRef`
4. Insert into `payment_issues` via `supabaseAdmin`
5. Send email via `new Resend(process.env.RESEND_API_KEY)`
   - `from`: `FYPro <hello@fypro.com.ng>`
   - `to`: `hello@fypro.com.ng`
   - `subject`: `URGENT: Payment issue — ${userEmail}`
   - Body: user email, user ID, transaction ref, description, timestamp (ISO)
6. Return `{ ok: true }`

**Error handling:** Catches Resend errors silently — DB insert already succeeded, so return 200 regardless. Log Resend error to console only.

---

## Section 4: Database — `migrations/0006_payment_issues.sql`

```sql
CREATE TABLE public.payment_issues (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  user_email      text NOT NULL,
  transaction_ref text NOT NULL,
  description     text,
  created_at      timestamptz DEFAULT now(),
  resolved        boolean DEFAULT false
);

ALTER TABLE public.payment_issues ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users insert own payment issues"
  ON public.payment_issues FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id OR user_id IS NULL);
```

`ON DELETE SET NULL` (not CASCADE) — preserves the report even if user deletes account, so admin can still resolve.

No client SELECT/UPDATE/DELETE policies — admin reads and writes via `supabaseAdmin` (service role).

---

## Section 5: Admin — `api/admin.js` additions

**`payment-issues` action:**
```js
supabaseAdmin.from('payment_issues')
  .select('*')
  .eq('resolved', false)
  .order('created_at', { ascending: false })
  .limit(50)
```

**`resolve-payment-issue` action:**
```js
supabaseAdmin.from('payment_issues')
  .update({ resolved: true })
  .eq('id', body.id)
```

Both require `verifyAdmin`.

---

## Section 6: Admin UI — `Health.jsx` addition

Widget placed after existing widgets. Loads its own data on mount (isolated from main `loadData`).

- Heading: "Payment Issues" with unresolved count badge (amber)
- Table: user email | transaction ref | description (truncated 80 chars) | timestamp | "Mark Resolved" button
- Zero state: "No unresolved payment issues" in muted text
- "Mark Resolved": calls `resolve-payment-issue`, removes row from local state immediately (optimistic update)

---

## Files Modified Summary

1. `migrations/0006_payment_issues.sql` — run in Supabase SQL Editor before deploying
2. `api/report-payment-issue.js` — new Vercel function
3. `api/admin.js` — two new action handlers + router entries
4. `src/components/PaymentIssueModal.jsx` — new component
5. `src/pages/Dashboard.jsx` — link + modal state + modal render
6. `src/pages/admin/Health.jsx` — new Payment Issues widget
