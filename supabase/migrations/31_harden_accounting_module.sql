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

