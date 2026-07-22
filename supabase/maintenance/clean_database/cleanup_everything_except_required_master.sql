-- Cleanup (strong): remove almost all app data, keep only "required masters"
--
-- Keeps:
-- - public.users (app users; hard-delete is blocked by trigger in migration 01)
-- - public.accounts (including default seeded accounts)
-- - public.accounting_categories (keeps required seeded categories; see below)
-- - public.taxes (seeded GST slabs; safe to keep even if not currently referenced)
--
-- Removes:
-- - Transactional tables (bills/returns/stock/entries)
-- - Non-required master data (products, customers, suppliers, product_categories)
-- - user_permissions (optional; if you want to keep staff permissions, comment it out)
--
-- Notes:
-- - Uses DELETE (not TRUNCATE) for tables referenced by other objects with RESTRICT.
-- - Resets products.stock_quantity (but products are deleted anyway).

BEGIN;

-- Transactional (children first)
DO $$
DECLARE
  v_tables text[] := ARRAY[]::text[];
  v_sql    text;
BEGIN
  -- Build ONE truncate statement (required for FK-related tables)
  -- Include both parent+child tables, then TRUNCATE ... CASCADE.
  IF to_regclass('public.bill_return_items') IS NOT NULL THEN
    v_tables := array_append(v_tables, 'public.bill_return_items');
  END IF;
  IF to_regclass('public.bill_returns') IS NOT NULL THEN
    v_tables := array_append(v_tables, 'public.bill_returns');
  END IF;
  IF to_regclass('public.bill_items') IS NOT NULL THEN
    v_tables := array_append(v_tables, 'public.bill_items');
  END IF;
  IF to_regclass('public.bills') IS NOT NULL THEN
    v_tables := array_append(v_tables, 'public.bills');
  END IF;

  IF to_regclass('public.stock_in_items') IS NOT NULL THEN
    v_tables := array_append(v_tables, 'public.stock_in_items');
  END IF;
  IF to_regclass('public.stock_in') IS NOT NULL THEN
    v_tables := array_append(v_tables, 'public.stock_in');
  END IF;
  IF to_regclass('public.stock_transactions') IS NOT NULL THEN
    v_tables := array_append(v_tables, 'public.stock_transactions');
  END IF;

  IF to_regclass('public.entries') IS NOT NULL THEN
    v_tables := array_append(v_tables, 'public.entries');
  END IF;

  IF array_length(v_tables, 1) IS NOT NULL THEN
    v_sql := 'TRUNCATE TABLE ' || array_to_string(v_tables, ', ') || ' CASCADE';
    EXECUTE v_sql;
  END IF;
END $$;

-- Permissions (optional to wipe)
DO $$
BEGIN
  IF to_regclass('public.user_permissions') IS NOT NULL THEN
    EXECUTE 'DELETE FROM public.user_permissions';
  END IF;
END $$;

-- Master data (wipe)
-- products depends on product_categories; wipe products first
DO $$
BEGIN
  IF to_regclass('public.products') IS NOT NULL THEN
    EXECUTE 'DELETE FROM public.products';
  END IF;
  IF to_regclass('public.customers') IS NOT NULL THEN
    EXECUTE 'DELETE FROM public.customers';
  END IF;
  IF to_regclass('public.suppliers') IS NOT NULL THEN
    EXECUTE 'DELETE FROM public.suppliers';
  END IF;
  IF to_regclass('public.product_categories') IS NOT NULL THEN
    EXECUTE 'DELETE FROM public.product_categories';
  END IF;
END $$;

-- Keep required accounting categories:
-- - Purchase (expense)
-- - Sales Return (expense)
-- - Sales (income)
DO $$
BEGIN
  IF to_regclass('public.accounting_categories') IS NOT NULL THEN
    EXECUTE $q$
      DELETE FROM public.accounting_categories
      WHERE (name, type) NOT IN (
        ('Purchase', 'expense'),
        ('Sales Return', 'expense'),
        ('Sales', 'income')
      )
    $q$;
  END IF;
END $$;

-- Keep default accounts seeded in migration 30
DO $$
BEGIN
  IF to_regclass('public.accounts') IS NOT NULL THEN
    EXECUTE $q$
      DELETE FROM public.accounts
      WHERE name NOT IN ('Cash in Hand', 'Bank Account', 'Online Payments')
    $q$;
  END IF;
END $$;

COMMIT;

