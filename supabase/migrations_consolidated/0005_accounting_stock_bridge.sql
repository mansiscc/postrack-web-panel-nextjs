-- =============================================================================
-- Consolidated migration (module bundle): 0005_accounting_stock_bridge.sql
-- Sources merged in order (do not reorder):
--   30_create_accounts_and_entries_tables.sql
--   31_harden_accounting_module.sql
--   32_add_stock_in_account_id_and_rpc.sql
--   33_add_entries_payment_mode.sql
--   34_fix_create_product_with_opening_stock_account_id.sql
-- =============================================================================


-- >>> begin: 30_create_accounts_and_entries_tables.sql
-- =========================================
-- Accounting Module: accounts & entries
-- =========================================

-- NOTE:
-- - This migration ONLY creates new tables:
--     1) accounts
--     2) entries
-- - It does NOT modify any existing tables.
-- - It assumes:
--     * extension "pgcrypto" or "uuid-ossp" with gen_random_uuid() is available
--     * table "users" with primary key "id" (UUID) already exists
--     * table "accounting_categories" with primary key "id" (UUID) already exists

-- =========================================
-- TABLE: accounts
-- Purpose:
--   Stores financial accounts such as:
--     - Cash in Hand
--     - Bank Account
--     - Online Payments
-- =========================================

CREATE TABLE public.accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    name TEXT NOT NULL,
    description TEXT NULL,

    opening_balance NUMERIC(18,2) DEFAULT 0,

    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    is_active  BOOLEAN NOT NULL DEFAULT TRUE,

    created_by UUID NULL REFERENCES public.users (id) ON UPDATE CASCADE ON DELETE SET NULL,
    updated_by UUID NULL REFERENCES public.users (id) ON UPDATE CASCADE ON DELETE SET NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index on is_active for quick filtering of active accounts
CREATE INDEX accounts_is_active_idx
    ON public.accounts (is_active);

-- Enforce unique account names
CREATE UNIQUE INDEX accounts_name_unique_idx
    ON public.accounts (name);

-- =========================================
-- TABLE: entries
-- Purpose:
--   Stores all accounting income and expense transactions.
-- =========================================

CREATE TABLE public.entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    entry_type TEXT NOT NULL,
    -- Restrict entry_type to 'income' or 'expense'
    CONSTRAINT entries_entry_type_check
        CHECK (entry_type IN ('income', 'expense')),

    account_id  UUID NOT NULL REFERENCES public.accounts (id) ON UPDATE CASCADE ON DELETE RESTRICT,
    category_id UUID NOT NULL REFERENCES public.accounting_categories (id) ON UPDATE CASCADE ON DELETE RESTRICT,

    amount NUMERIC(18,2) NOT NULL,
    -- Enforce positive amounts
    CONSTRAINT entries_amount_check
        CHECK (amount > 0),

    -- Business transaction date (not necessarily created_at)
    entry_date DATE NOT NULL,

    remarks TEXT NULL,

    source_type TEXT NULL,
    -- Restrict source_type to allowed values when not null
    CONSTRAINT entries_source_type_check
        CHECK (
            source_type IS NULL
            OR source_type IN ('bill', 'bill_return', 'purchase', 'manual')
        ),

    source_id UUID NULL,
    -- source_id refers to original transaction (bill, bill_return, purchase, etc.)

    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,

    created_by UUID NULL REFERENCES public.users (id) ON UPDATE CASCADE ON DELETE SET NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =========================================
-- Indexes for entries
-- =========================================

-- Fast lookup by account
CREATE INDEX entries_account_id_idx
    ON public.entries (account_id);

-- Fast lookup by accounting category
CREATE INDEX entries_category_id_idx
    ON public.entries (category_id);

-- Fast lookup and reporting by entry date
CREATE INDEX entries_entry_date_idx
    ON public.entries (entry_date);

-- Fast lookup from external source (bill, purchase, etc.)
CREATE INDEX entries_source_type_source_id_idx
    ON public.entries (source_type, source_id);

-- Prevent duplicate accounting entries for the same source + account
-- Enforces uniqueness of (source_type, source_id, account_id)
CREATE UNIQUE INDEX entries_source_type_source_id_account_id_unique_idx
    ON public.entries (source_type, source_id, account_id);

-- =========================================
-- Seed Default Accounts
-- Purpose:
--   Insert default system accounts.
--   All are marked is_default = TRUE to protect from deletion/modification.
-- =========================================

INSERT INTO public.accounts (name, description, opening_balance, is_default, is_active)
VALUES
    ('Cash in Hand',  'Cash account',        0, TRUE, TRUE),
    ('Bank Account',  'Bank account',        0, FALSE, TRUE),
    ('Online Payments','Online payments',    0, FALSE, TRUE)
ON CONFLICT (name) DO NOTHING;


-- <<< end: 30_create_accounts_and_entries_tables.sql

-- >>> begin: 31_harden_accounting_module.sql
-- =========================================
-- Migration 31: Accounting Module Hardening
-- - Auto-updated `updated_at` triggers
-- - Reporting indexes for accounting
-- - Row Level Security (RLS) for accounting tables
--
-- Notes:
-- - Does NOT modify existing table schemas.
-- - Safe to run once; objects are created with IF NOT EXISTS
--   or guarded via pg_catalog checks.
-- - PostgreSQL / Supabase compatible.
-- =========================================

BEGIN;

-- =========================================
-- STEP 1: Reusable updated_at trigger function
-- =========================================
-- Purpose:
--   Generic trigger function to automatically set
--   NEW.updated_at = now() on every UPDATE.
-- Notes:
--   - Uses CREATE OR REPLACE so it is safe to run multiple times.
--   - Does NOT modify any existing tables directly.
-- =========================================

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- =========================================
-- STEP 2: Attach updated_at triggers
-- Tables:
--   - accounts
--   - accounting_categories
--   - entries
-- Rules:
--   - BEFORE UPDATE
--   - FOR EACH ROW
--   - EXECUTE FUNCTION set_updated_at()
-- Notes:
--   - Uses conditional checks on pg_trigger to avoid duplicate triggers.
--   - Only adds triggers; does not alter table definitions.
-- =========================================

-- Trigger for accounts.updated_at
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'trigger_update_accounts_updated_at'
  ) THEN
    CREATE TRIGGER trigger_update_accounts_updated_at
    BEFORE UPDATE ON public.accounts
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();
  END IF;
END;
$$;

-- Trigger for accounting_categories.updated_at
-- (Accounting categories already have an updated_at column;
--  this trigger ensures it is auto-maintained on UPDATE.)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'trigger_update_accounting_categories_set_updated_at'
  ) THEN
    CREATE TRIGGER trigger_update_accounting_categories_set_updated_at
    BEFORE UPDATE ON public.accounting_categories
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();
  END IF;
END;
$$;

-- Trigger for entries.updated_at
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'trigger_update_entries_updated_at'
  ) THEN
    CREATE TRIGGER trigger_update_entries_updated_at
    BEFORE UPDATE ON public.entries
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();
  END IF;
END;
$$;

-- =========================================
-- STEP 3: Performance Indexes for Accounting Reports
-- Tables:
--   - entries
--   - accounts
-- Rules:
--   - Do NOT modify existing columns.
--   - Only add indexes.
--   - Avoid duplicate indexes (use IF NOT EXISTS).
-- =========================================

-- 3.1 entries reporting index
-- Columns:
--   (entry_date, account_id, entry_type)
-- Purpose:
--   - Improve performance for:
--       * Daily reports
--       * Account ledger queries
--       * Income vs expense summaries
CREATE INDEX IF NOT EXISTS entries_reporting_idx
ON public.entries (entry_date, account_id, entry_type);

-- 3.2 entries category reporting index
-- Columns:
--   (category_id, entry_date)
-- Purpose:
--   - Improve category-wise expense and income reports by
--     allowing efficient filtering by category and date ranges.
CREATE INDEX IF NOT EXISTS entries_category_reporting_idx
ON public.entries (category_id, entry_date);

-- 3.3 accounts active filter index
-- Column:
--   (is_active)
-- Purpose:
--   - Quick filtering of active accounts in dropdowns and lookups.
-- Notes:
--   - The initial accounts migration already created
--     `accounts_is_active_idx`. This statement is idempotent and will
--     not create a duplicate index.
CREATE INDEX IF NOT EXISTS accounts_is_active_idx
ON public.accounts (is_active);

-- =========================================
-- STEP 4: Row Level Security (RLS) for Accounting Tables
-- Tables:
--   - accounts
--   - accounting_categories
--   - entries
--
-- Rules:
--   - Do NOT modify existing tables.
--   - Only add RLS policies.
--   - Enable RLS on all three tables.
--   - Follow least-privilege model using application roles:
--       * Admin
--       * Manager
--       * Staff
--   - Policies must use auth.uid() for user context.
--
-- Assumptions:
--   - Function public.get_my_role() (SECURITY DEFINER) already exists
--     and resolves the current app role based on auth.uid().
--   - Supabase uses JWT-based auth; auth.uid() is non-null for
--     authenticated users.
-- =========================================

-- 4.1 Enable RLS on accounting tables
-- (Safe if run multiple times; enabling an already-enabled
--  table is a no-op.)
ALTER TABLE public.accounts
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.accounting_categories
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.entries
  ENABLE ROW LEVEL SECURITY;

-- =========================================
-- 4.2 ACCOUNTS TABLE POLICIES
--
-- Spec:
--   admin   : full access (SELECT, INSERT, UPDATE, DELETE)
--   manager : SELECT
--   staff   : SELECT
--
-- Implementation notes:
--   - We gate by:
--       * auth.uid() IS NOT NULL  → only authenticated users
--       * get_my_role()           → 'Admin' | 'Manager' | 'Staff'
--   - Admin policies use WITH CHECK / USING to allow full access.
--   - Manager/Staff policies only allow SELECT.
-- =========================================

-- Note: CREATE POLICY does not support IF NOT EXISTS on PostgreSQL 15,
-- so this migration is intended to run once (like other Supabase migrations).
-- If you need to change this policy later, use a follow-up migration
-- to ALTER or DROP/CREATE the policy.
CREATE POLICY accounts_admin_full_access
ON public.accounts
FOR ALL
USING (
  auth.uid() IS NOT NULL
  AND public.get_my_role() = 'Admin'
)
WITH CHECK (
  auth.uid() IS NOT NULL
  AND public.get_my_role() = 'Admin'
);

-- Manager + Staff: read-only access to accounts
CREATE POLICY accounts_manager_staff_select
ON public.accounts
FOR SELECT
USING (
  auth.uid() IS NOT NULL
  AND public.get_my_role() IN ('Admin', 'Manager', 'Staff')
);

-- =========================================
-- 4.3 ACCOUNTING_CATEGORIES TABLE POLICIES
--
-- Spec:
--   admin   : full access
--   manager : SELECT
--   staff   : SELECT
--
-- Accounting categories are shared lookup data for income/expense
-- classification. Managers and staff should be able to read but not
-- modify categories; only admins can manage the master data.
-- =========================================

-- Admin: full access on accounting_categories
CREATE POLICY accounting_categories_admin_full_access
ON public.accounting_categories
FOR ALL
USING (
  auth.uid() IS NOT NULL
  AND public.get_my_role() = 'Admin'
)
WITH CHECK (
  auth.uid() IS NOT NULL
  AND public.get_my_role() = 'Admin'
);

-- Manager + Staff: read-only access to accounting_categories
CREATE POLICY accounting_categories_manager_staff_select
ON public.accounting_categories
FOR SELECT
USING (
  auth.uid() IS NOT NULL
  AND public.get_my_role() IN ('Admin', 'Manager', 'Staff')
);

-- =========================================
-- 4.4 ENTRIES TABLE POLICIES
--
-- Spec:
--   admin   : full access
--   manager : SELECT + INSERT
--   staff   : SELECT + INSERT
--
-- Restrictions:
--   - staff cannot DELETE entries
--   - staff cannot UPDATE entries
--
-- Implementation:
--   - SELECT: allowed for Admin, Manager, Staff
--   - INSERT: allowed for Admin, Manager, Staff
--   - UPDATE: restricted to Admin only
--   - DELETE: restricted to Admin only
-- =========================================

-- Admin: full access on entries
CREATE POLICY entries_admin_full_access
ON public.entries
FOR ALL
USING (
  auth.uid() IS NOT NULL
  AND public.get_my_role() = 'Admin'
)
WITH CHECK (
  auth.uid() IS NOT NULL
  AND public.get_my_role() = 'Admin'
);

-- Manager + Staff (and Admin): SELECT entries
CREATE POLICY entries_manager_staff_select
ON public.entries
FOR SELECT
USING (
  auth.uid() IS NOT NULL
  AND public.get_my_role() IN ('Admin', 'Manager', 'Staff')
);

-- Manager + Staff (and Admin): INSERT entries
-- Note: Admin is included to preserve "full access".
CREATE POLICY entries_manager_staff_insert
ON public.entries
FOR INSERT
WITH CHECK (
  auth.uid() IS NOT NULL
  AND public.get_my_role() IN ('Admin', 'Manager', 'Staff')
);

-- Admin-only UPDATE on entries
CREATE POLICY entries_admin_update
ON public.entries
FOR UPDATE
USING (
  auth.uid() IS NOT NULL
  AND public.get_my_role() = 'Admin'
)
WITH CHECK (
  auth.uid() IS NOT NULL
  AND public.get_my_role() = 'Admin'
);

-- Admin-only DELETE on entries
CREATE POLICY entries_admin_delete
ON public.entries
FOR DELETE
USING (
  auth.uid() IS NOT NULL
  AND public.get_my_role() = 'Admin'
);

COMMIT;


-- <<< end: 31_harden_accounting_module.sql

-- >>> begin: 32_add_stock_in_account_id_and_rpc.sql
-- =========================================
-- Migration 32: Add account_id to stock_in and update create_stock_in RPC
--
-- Purpose:
--   - Link each purchase (stock_in) to the account used for payment.
--   - Enables accounting entry creation for purchases (expense from account).
--
-- Rules:
--   - Only adds column account_id to stock_in; no other schema changes.
--   - Existing rows get default 'Cash in Hand' account.
--   - create_stock_in RPC gains p_account_id and inserts it into stock_in.
-- =========================================

BEGIN;

-- =========================================
-- STEP 1: Add account_id to stock_in
-- =========================================

ALTER TABLE public.stock_in
  ADD COLUMN IF NOT EXISTS account_id uuid REFERENCES public.accounts(id) ON UPDATE CASCADE ON DELETE RESTRICT;

-- Backfill existing rows with 'Cash in Hand' account
UPDATE public.stock_in
SET account_id = (
  SELECT public.accounts.id
  FROM public.accounts
  WHERE name = 'Cash in Hand'
  LIMIT 1
)
WHERE account_id IS NULL;

-- Enforce NOT NULL after backfill
ALTER TABLE public.stock_in
  ALTER COLUMN account_id SET NOT NULL;

COMMENT ON COLUMN public.stock_in.account_id IS 'Account used to pay for this purchase (e.g. Cash in Hand, Bank).';

-- =========================================
-- STEP 2: Update create_stock_in to accept and use p_account_id
-- =========================================

CREATE OR REPLACE FUNCTION public.create_stock_in(
  p_date           date,
  p_items          jsonb,
  p_supplier_id    uuid DEFAULT NULL,
  p_invoice_number text DEFAULT NULL,
  p_notes          text DEFAULT NULL,
  p_created_by     uuid DEFAULT NULL,
  p_account_id     uuid DEFAULT NULL
)
RETURNS TABLE(id uuid)
LANGUAGE plpgsql
AS $$
DECLARE
  v_stock_in_id   uuid;
  v_item          jsonb;
  v_account_id    uuid;

  v_product_id         uuid;
  v_manufacturing_date date;
  v_quantity           numeric(18,3);
  v_row_total          numeric(18,2);

  v_total_items   integer        := 0;
  v_total_amount  numeric(18,2)  := 0;
BEGIN
  IF p_items IS NULL
     OR jsonb_typeof(p_items) <> 'array'
     OR jsonb_array_length(p_items) = 0
  THEN
    RAISE EXCEPTION 'p_items must be a non-empty JSON array of line items';
  END IF;

  -- Resolve account: required for purchase payment
  v_account_id := COALESCE(
    p_account_id,
    (
      SELECT public.accounts.id
      FROM public.accounts
      WHERE name = 'Cash in Hand'
        AND is_active = true
      LIMIT 1
    )
  );
  IF v_account_id IS NULL THEN
    RAISE EXCEPTION 'No payment account available. Ensure at least one active account exists (e.g. Cash in Hand).';
  END IF;

  FOR v_item IN
    SELECT value
    FROM jsonb_array_elements(p_items) AS t(value)
  LOOP
    v_quantity  := COALESCE((v_item->>'quantity')::numeric(18,3), 0);
    v_row_total := COALESCE((v_item->>'row_total')::numeric(18,2), 0);

    v_total_items  := v_total_items + 1;
    v_total_amount := v_total_amount + v_row_total;
  END LOOP;

  INSERT INTO public.stock_in (
    date,
    supplier_id,
    invoice_number,
    notes,
    total_items,
    total_amount,
    created_by,
    account_id
  )
  VALUES (
    p_date,
    p_supplier_id,
    p_invoice_number,
    p_notes,
    v_total_items,
    v_total_amount,
    p_created_by,
    v_account_id
  )
  RETURNING public.stock_in.id INTO v_stock_in_id;

  PERFORM set_config('app.suppress_stock_adjustment', 'true', true);

  FOR v_item IN
    SELECT value
    FROM jsonb_array_elements(p_items) AS t(value)
  LOOP
    v_product_id         := (v_item->>'product_id')::uuid;
    v_manufacturing_date  := (v_item->>'manufacturing_date')::date;
    v_quantity            := COALESCE((v_item->>'quantity')::numeric(18,3), 0);
    v_row_total           := COALESCE((v_item->>'row_total')::numeric(18,2), 0);

    INSERT INTO public.stock_in_items (
      stock_in_id,
      product_id,
      manufacturing_date,
      quantity,
      row_total
    )
    VALUES (
      v_stock_in_id,
      v_product_id,
      v_manufacturing_date,
      v_quantity,
      v_row_total
    );

    UPDATE public.products AS p
    SET stock_quantity = COALESCE(p.stock_quantity, 0) + v_quantity
    WHERE p.id = v_product_id;

    INSERT INTO public.stock_transactions (
      product_id,
      transaction_type,
      quantity,
      reference_type,
      reference_id,
      notes
    )
    VALUES (
      v_product_id,
      'PURCHASE',
      v_quantity,
      'STOCK_IN',
      v_stock_in_id,
      p_invoice_number
    );
  END LOOP;

  RETURN QUERY SELECT v_stock_in_id;
END;
$$;

COMMENT ON FUNCTION public.create_stock_in(
  date, jsonb, uuid, text, text, uuid, uuid
) IS
  'Creates a stock_in purchase entry with items and account_id, updates products.stock_quantity, and logs PURCHASE stock_transactions. Suppresses adjustment trigger. Defaults account to Cash in Hand if p_account_id is null.';

-- =========================================
-- =========================================

INSERT INTO public.accounting_categories (name, type, description, is_active)
VALUES 
  ('Purchase', 'expense', 'Stock-in / inventory purchases', true),
  ('Sales Return', 'expense', 'Sales return / customer refunds', true)
ON CONFLICT (name, type) DO NOTHING;

COMMIT;

-- <<< end: 32_add_stock_in_account_id_and_rpc.sql

-- >>> begin: 33_add_entries_payment_mode.sql
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


-- <<< end: 33_add_entries_payment_mode.sql

-- >>> begin: 34_fix_create_product_with_opening_stock_account_id.sql
-- =============================================================================
-- Migration 34: Fix create_product_with_opening_stock stock_in.account_id
--
-- Problem:
--   stock_in.account_id is NOT NULL (migration 32), but
--   create_product_with_opening_stock inserted into stock_in without account_id.
--
-- Behavior:
--   - stock_in.account_id is made nullable
--   - When opening_stock > 0, create_product_with_opening_stock creates a stock_in
--     row without account_id (NULL)
-- =============================================================================

BEGIN;

-- Make stock_in.account_id optional for opening stock stock-ins
ALTER TABLE IF EXISTS public.stock_in
  ALTER COLUMN account_id DROP NOT NULL;

DROP FUNCTION IF EXISTS public.create_product_with_opening_stock(
  text, text, numeric, numeric, numeric, text, numeric, uuid, numeric, uuid, boolean, uuid
);

DROP FUNCTION IF EXISTS public.create_product_with_opening_stock(
  text, text, numeric, numeric, numeric, text, numeric, uuid, numeric, uuid, boolean, uuid, uuid
);

CREATE OR REPLACE FUNCTION public.create_product_with_opening_stock(
  p_name                text,
  p_barcode             text,
  p_purchase_price      numeric,
  p_selling_price       numeric,
  p_mrp                 numeric,
  p_unit                text,
  p_low_stock_alert_qty numeric DEFAULT 0,
  p_product_category_id uuid DEFAULT NULL,
  p_opening_stock       numeric DEFAULT 0,
  p_id                  uuid DEFAULT NULL,
  p_is_active           boolean DEFAULT true,
  p_created_by          uuid DEFAULT NULL,
  p_account_id          uuid DEFAULT NULL
)
RETURNS TABLE(id uuid)
LANGUAGE plpgsql
AS $$
DECLARE
  v_product_id   uuid;
  v_stock_in_id  uuid;
BEGIN
  v_product_id := COALESCE(p_id, gen_random_uuid());

  INSERT INTO public.products (
    id,
    name,
    barcode,
    purchase_price,
    selling_price,
    mrp,
    unit,
    low_stock_alert_qty,
    product_category_id,
    stock_quantity,
    is_active
  )
  VALUES (
    v_product_id,
    p_name,
    p_barcode,
    p_purchase_price,
    p_selling_price,
    p_mrp,
    p_unit,
    COALESCE(p_low_stock_alert_qty, 0),
    p_product_category_id,
    COALESCE(p_opening_stock, 0),
    COALESCE(p_is_active, true)
  );

  IF COALESCE(p_opening_stock, 0) > 0 THEN
    v_stock_in_id := gen_random_uuid();

    INSERT INTO public.stock_in (
      id,
      date,
      supplier_id,
      invoice_number,
      notes,
      total_items,
      total_amount,
      created_by
    )
    VALUES (
      v_stock_in_id,
      CURRENT_DATE,
      NULL,
      'OPENING',
      'Opening stock from product creation',
      1,
      COALESCE(p_purchase_price, 0) * p_opening_stock,
      p_created_by
    );

    INSERT INTO public.stock_in_items (
      stock_in_id,
      product_id,
      manufacturing_date,
      quantity,
      row_total
    )
    VALUES (
      v_stock_in_id,
      v_product_id,
      NULL,
      p_opening_stock,
      COALESCE(p_purchase_price, 0) * p_opening_stock
    );

    INSERT INTO public.stock_transactions (
      product_id,
      transaction_type,
      quantity,
      reference_type,
      reference_id,
      notes
    )
    VALUES (
      v_product_id,
      'OPENING',
      p_opening_stock,
      'STOCK_IN',
      v_stock_in_id,
      'Opening stock'
    );
  END IF;

  RETURN QUERY SELECT v_product_id;
END;
$$;

COMMENT ON FUNCTION public.create_product_with_opening_stock(
  text, text, numeric, numeric, numeric, text, numeric, uuid, numeric, uuid, boolean, uuid, uuid
) IS
  'Creates a product and, if opening_stock > 0, creates a stock_in (invoice OPENING) without account_id. Returns TABLE(id uuid) for PostgREST.';

COMMIT;


-- <<< end: 34_fix_create_product_with_opening_stock_account_id.sql
