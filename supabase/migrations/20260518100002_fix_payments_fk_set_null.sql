-- Migration: fix_payments_fk_set_null
-- Severity: HIGH (H1)
-- Problem: payments.user_id FK is ON DELETE CASCADE.
--          Deleting a user account wipes all their payment records.
--          This breaks payment audit trails, refund eligibility, and
--          Paystack reconciliation. CLAUDE.md explicitly states:
--          "Payment records should never cascade delete."
-- Fix: Change to ON DELETE SET NULL. Payment rows survive with user_id = NULL,
--      preserving the financial audit trail. The paystack_reference unique
--      constraint and amount_kobo remain intact for reconciliation.

ALTER TABLE public.payments
  DROP CONSTRAINT payments_user_id_fkey;

ALTER TABLE public.payments
  ADD CONSTRAINT payments_user_id_fkey
    FOREIGN KEY (user_id)
    REFERENCES public.users(id)
    ON DELETE SET NULL;

-- ── Verification ──────────────────────────────────────────────────────────────
-- After applying, run this to confirm the rule changed:
--
-- SELECT tc.table_name, kcu.column_name, rc.delete_rule
-- FROM information_schema.table_constraints tc
-- JOIN information_schema.key_column_usage kcu
--   ON tc.constraint_name = kcu.constraint_name
-- JOIN information_schema.referential_constraints rc
--   ON rc.constraint_name = tc.constraint_name
-- WHERE tc.table_name = 'payments'
--   AND kcu.column_name = 'user_id';
--
-- Expected: payments | user_id | SET NULL
