-- =========================================
-- Migration 33: Add payment_mode to entries
--
-- Purpose:
--   - Track how each accounting entry was paid:
--       * Cash
--       * UPI
--       * Card
--       * Mixed
--   - Keep NULL for historical records where mode is unknown.
--
-- Rules:
--   - Uses ALTER TABLE only (no table recreation).
--   - Column is nullable to avoid breaking existing data.
--   - CHECK constraint allows NULL or one of the allowed values.
--   - Adds an index for reporting/filtering by payment_mode.
--   - Safe for production; no data loss.
-- =========================================

BEGIN;

-- =========================================
-- STEP 1: Add payment_mode column (nullable)
-- =========================================

ALTER TABLE public.entries
  ADD COLUMN IF NOT EXISTS payment_mode TEXT NULL;

COMMENT ON COLUMN public.entries.payment_mode IS
  'How the transaction was paid: Cash, UPI, Card, Mixed. Nullable for legacy entries.';

-- =========================================
-- STEP 2: Add CHECK constraint for allowed values
-- =========================================

ALTER TABLE public.entries
  ADD CONSTRAINT entries_payment_mode_check
  CHECK (
    payment_mode IS NULL
    OR payment_mode IN ('Cash', 'UPI', 'Card', 'Mixed')
  );

-- =========================================
-- STEP 3: Add index for reporting/filtering
-- =========================================

CREATE INDEX IF NOT EXISTS entries_payment_mode_idx
  ON public.entries (payment_mode);

-- =========================================
-- STEP 4: Ensure 'Sales' accounting category exists (income)
-- =========================================

INSERT INTO public.accounting_categories (name, type, description, is_active)
VALUES ('Sales', 'income', 'Sales income from customer bills', true)
ON CONFLICT (name, type) DO NOTHING;

COMMIT;

-- =========================================
-- ROLLBACK (Down Migration Reference)
-- =========================================
-- The following statements can be used in a separate down migration
-- to fully revert this change if ever required.
--
-- DROP INDEX IF EXISTS entries_payment_mode_idx;
--
-- ALTER TABLE public.entries
--   DROP CONSTRAINT IF EXISTS entries_payment_mode_check;
--
-- ALTER TABLE public.entries
--   DROP COLUMN IF EXISTS payment_mode;

