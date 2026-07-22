-- Cleanup (safe): remove ONLY transactional data
-- - Keeps: users, permissions, products, customers, suppliers, accounts, categories
-- - Removes: bills/returns, stock-in/history, accounting entries
-- - Resets: products.stock_quantity to 0 to avoid inconsistent inventory

BEGIN;

-- Billing returns (children first)
DO $$
BEGIN
  IF to_regclass('public.bill_return_items') IS NOT NULL THEN
    EXECUTE 'TRUNCATE TABLE public.bill_return_items';
  END IF;
  IF to_regclass('public.bill_returns') IS NOT NULL THEN
    EXECUTE 'TRUNCATE TABLE public.bill_returns';
  END IF;
END $$;

-- Billing
DO $$
BEGIN
  IF to_regclass('public.bill_items') IS NOT NULL THEN
    EXECUTE 'TRUNCATE TABLE public.bill_items';
  END IF;
  IF to_regclass('public.bills') IS NOT NULL THEN
    EXECUTE 'TRUNCATE TABLE public.bills';
  END IF;
END $$;

-- Stock / purchases
DO $$
BEGIN
  IF to_regclass('public.stock_in_items') IS NOT NULL THEN
    EXECUTE 'TRUNCATE TABLE public.stock_in_items';
  END IF;
  IF to_regclass('public.stock_in') IS NOT NULL THEN
    EXECUTE 'TRUNCATE TABLE public.stock_in';
  END IF;
  IF to_regclass('public.stock_transactions') IS NOT NULL THEN
    EXECUTE 'TRUNCATE TABLE public.stock_transactions';
  END IF;
END $$;

-- Accounting
DO $$
BEGIN
  IF to_regclass('public.entries') IS NOT NULL THEN
    EXECUTE 'TRUNCATE TABLE public.entries';
  END IF;
END $$;

-- Reset inventory quantity (since we wiped all stock movements and sales)
DO $$
BEGIN
  IF to_regclass('public.products') IS NOT NULL THEN
    EXECUTE 'UPDATE public.products SET stock_quantity = 0';
  END IF;
END $$;

COMMIT;

