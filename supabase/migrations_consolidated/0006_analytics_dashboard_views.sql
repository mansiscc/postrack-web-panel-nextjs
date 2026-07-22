-- =============================================================================
-- Consolidated migration (module bundle): 0006_analytics_dashboard_views.sql
-- Sources merged in order (do not reorder):
--   35_admin_dashboard_rpc.sql
--   36_add_accounts_current_balance.sql
--   37_create_sales_history_and_user_permissions_views.sql
--   38_extend_admin_dashboard_totals_inactive_oos_json.sql
-- =============================================================================


-- >>> begin: 35_admin_dashboard_rpc.sql
/* =============================================================================
   MODULE — ADMIN DASHBOARD RPC
   Migration: get_admin_dashboard_totals()

   Returns all KPI totals needed by the admin dashboard in a single DB request:
   - Today: sales, manual income, income
   - Today: purchase, manual expense, expense
   - Today profit = income - expense - return_amount
   - Returns: count + amount
   - Payments: cash/upi/card totals from bills in the given time window
   - Inventory: total products, low stock count, out of stock count
   - Out-of-stock product names (top 10)
   ============================================================================= */

CREATE OR REPLACE FUNCTION public.get_admin_dashboard_totals(
  p_start timestamptz,
  p_end   timestamptz,
  p_today date
)
RETURNS TABLE (
  today_sales numeric,
  today_manual_income numeric,
  today_income numeric,
  today_purchase numeric,
  today_manual_expense numeric,
  today_expense numeric,
  today_profit numeric,
  bill_count integer,
  today_returns_count integer,
  today_return_amount numeric,
  cash_total numeric,
  upi_total numeric,
  card_total numeric,
  total_products integer,
  low_stock_count integer,
  out_of_stock_count integer,
  out_of_stock_product_names text[]
)
LANGUAGE sql
STABLE
AS $$
WITH
  /* ── Bills (sales + payments + bill count) ─────────────────────────────── */
  bills_in_range AS (
    SELECT
      total_payable_amount,
      payment_mode,
      cash_amount,
      online_amount
    FROM public.bills
    WHERE created_at >= p_start
      AND created_at <  p_end
  ),
  bills_totals AS (
    SELECT
      COALESCE(SUM(total_payable_amount), 0)::numeric AS today_sales,
      COUNT(*)::integer AS bill_count,

      /* Payment breakdown */
      COALESCE(SUM(CASE WHEN payment_mode = 'Cash' THEN total_payable_amount ELSE 0 END), 0)::numeric AS cash_total,
      COALESCE(SUM(CASE WHEN payment_mode = 'UPI'  THEN total_payable_amount ELSE 0 END), 0)::numeric AS upi_total,
      COALESCE(SUM(CASE WHEN payment_mode = 'Card' THEN total_payable_amount ELSE 0 END), 0)::numeric AS card_total,
      COALESCE(SUM(CASE WHEN payment_mode = 'Mixed' THEN cash_amount ELSE 0 END), 0)::numeric AS mixed_cash,
      COALESCE(SUM(CASE WHEN payment_mode = 'Mixed' THEN online_amount ELSE 0 END), 0)::numeric AS mixed_online
    FROM bills_in_range
  ),
  payments_totals AS (
    SELECT
      today_sales,
      bill_count,
      (cash_total + mixed_cash)::numeric AS cash_total,
      (upi_total + mixed_online)::numeric AS upi_total,
      card_total::numeric AS card_total
    FROM bills_totals
  ),

  /* ── Returns (count + amount) ─────────────────────────────────────────── */
  returns_totals AS (
    SELECT
      COALESCE(COUNT(*), 0)::integer AS today_returns_count,
      COALESCE(SUM(total_return_amount), 0)::numeric AS today_return_amount
    FROM public.bill_returns
    WHERE created_at >= p_start
      AND created_at <  p_end
  ),

  /* ── Manual income/expense (by entries.entry_type + source_type) ───── */
  manual_income AS (
    SELECT COALESCE(SUM(amount), 0)::numeric AS today_manual_income
    FROM public.entries
    WHERE is_deleted = false
      AND entry_type = 'income'
      AND source_type = 'manual'
      AND entry_date = p_today
  ),
  purchase_expense AS (
    SELECT COALESCE(SUM(amount), 0)::numeric AS today_purchase
    FROM public.entries
    WHERE is_deleted = false
      AND entry_type = 'expense'
      AND source_type = 'purchase'
      AND entry_date = p_today
  ),
  manual_expense AS (
    SELECT COALESCE(SUM(amount), 0)::numeric AS today_manual_expense
    FROM public.entries
    WHERE is_deleted = false
      AND entry_type = 'expense'
      AND source_type = 'manual'
      AND entry_date = p_today
  ),

  computed AS (
    SELECT
      p.today_sales,
      mi.today_manual_income,
      (p.today_sales + mi.today_manual_income)::numeric AS today_income,
      pe.today_purchase,
      me.today_manual_expense,
      (pe.today_purchase + me.today_manual_expense)::numeric AS today_expense
    FROM payments_totals p
    CROSS JOIN manual_income mi
    CROSS JOIN purchase_expense pe
    CROSS JOIN manual_expense me
  )

SELECT
  c.today_sales,
  mi.today_manual_income,
  c.today_income,
  pe.today_purchase,
  me.today_manual_expense,
  c.today_expense,
  (c.today_income - c.today_expense - r.today_return_amount)::numeric AS today_profit,
  p.bill_count,
  r.today_returns_count,
  r.today_return_amount,
  p.cash_total,
  p.upi_total,
  p.card_total,

  /* ── Inventory ───────────────────────────────────────────────────────── */
  (SELECT COUNT(*)::integer FROM public.products WHERE is_active = true) AS total_products,
  (SELECT COUNT(*)::integer
     FROM public.products
     WHERE is_active = true
       AND COALESCE(stock_quantity, 0) > 0
       AND COALESCE(stock_quantity, 0) <= COALESCE(low_stock_alert_qty, 0)
  ) AS low_stock_count,
  (SELECT COUNT(*)::integer
     FROM public.products
     WHERE is_active = true
       AND COALESCE(stock_quantity, 0) <= 0
  ) AS out_of_stock_count,
  (
    SELECT COALESCE(ARRAY_AGG(name), ARRAY[]::text[])
    FROM (
      SELECT name
      FROM public.products
      WHERE is_active = true
        AND COALESCE(stock_quantity, 0) <= 0
        AND name IS NOT NULL
      LIMIT 10
    ) t
  ) AS out_of_stock_product_names
FROM computed c
JOIN payments_totals p ON true
JOIN returns_totals r ON true
JOIN manual_income mi ON true
JOIN purchase_expense pe ON true
JOIN manual_expense me ON true;
$$;


-- <<< end: 35_admin_dashboard_rpc.sql

-- >>> begin: 36_add_accounts_current_balance.sql
-- =========================================
-- Migration 36: Add current_balance to accounts (denormalized)
-- =========================================
-- Adds `accounts.current_balance` and keeps it correct using triggers.
--
-- current_balance = opening_balance + (SUM(income.amount) - SUM(expense.amount))
-- where is_deleted = false.
--
-- This avoids downloading all rows from `entries` on the client.
-- =========================================

BEGIN;

-- 1) Add column
ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS current_balance NUMERIC(18,2) NOT NULL DEFAULT 0;

-- 2) Backfill using existing entries
-- Set current_balance for every account (even if it has zero entries).
UPDATE public.accounts a
SET current_balance = COALESCE(a.opening_balance, 0) + COALESCE(net.net_entries, 0)
FROM (
  SELECT
    a2.id,
    COALESCE(
      SUM(
        CASE
          WHEN e.entry_type = 'income' THEN e.amount
          WHEN e.entry_type = 'expense' THEN -e.amount
          ELSE 0
        END
      ),
      0
    ) AS net_entries
  FROM public.accounts a2
  LEFT JOIN public.entries e
    ON e.account_id = a2.id
   AND e.is_deleted = false
  GROUP BY a2.id
) net
WHERE a.id = net.id;

-- 3) accounts: initialize current_balance on insert
CREATE OR REPLACE FUNCTION public.fn_accounts_set_current_balance_before_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.current_balance := COALESCE(NEW.opening_balance, 0);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_accounts_set_current_balance_before_insert ON public.accounts;
CREATE TRIGGER trg_accounts_set_current_balance_before_insert
BEFORE INSERT ON public.accounts
FOR EACH ROW
EXECUTE FUNCTION public.fn_accounts_set_current_balance_before_insert();

-- 4) accounts: when opening_balance changes, adjust current_balance by delta
CREATE OR REPLACE FUNCTION public.fn_accounts_opening_balance_adjust_current_balance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_delta NUMERIC(18,2);
BEGIN
  v_delta := COALESCE(NEW.opening_balance, 0) - COALESCE(OLD.opening_balance, 0);

  IF v_delta <> 0 THEN
    UPDATE public.accounts
    SET current_balance = COALESCE(current_balance, 0) + v_delta
    WHERE id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_accounts_opening_balance_adjust_current_balance ON public.accounts;
CREATE TRIGGER trg_accounts_opening_balance_adjust_current_balance
AFTER UPDATE OF opening_balance ON public.accounts
FOR EACH ROW
EXECUTE FUNCTION public.fn_accounts_opening_balance_adjust_current_balance();

-- 5) entries: keep accounts.current_balance correct on INSERT/UPDATE/DELETE
CREATE OR REPLACE FUNCTION public.fn_entries_adjust_account_current_balance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old_contrib NUMERIC(18,2) := 0;
  v_new_contrib NUMERIC(18,2) := 0;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.is_deleted = false THEN
      v_new_contrib :=
        CASE
          WHEN NEW.entry_type = 'income' THEN NEW.amount
          WHEN NEW.entry_type = 'expense' THEN -NEW.amount
          ELSE 0
        END;

      UPDATE public.accounts
      SET current_balance = COALESCE(current_balance, 0) + v_new_contrib
      WHERE id = NEW.account_id;
    END IF;

    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Old contribution only counts if it was not deleted.
    IF OLD.is_deleted = false THEN
      v_old_contrib :=
        CASE
          WHEN OLD.entry_type = 'income' THEN OLD.amount
          WHEN OLD.entry_type = 'expense' THEN -OLD.amount
          ELSE 0
        END;
    END IF;

    -- New contribution only counts if it is not deleted.
    IF NEW.is_deleted = false THEN
      v_new_contrib :=
        CASE
          WHEN NEW.entry_type = 'income' THEN NEW.amount
          WHEN NEW.entry_type = 'expense' THEN -NEW.amount
          ELSE 0
        END;
    END IF;

    -- If account_id stays the same: adjust by (new - old)
    IF OLD.account_id = NEW.account_id THEN
      IF (v_new_contrib - v_old_contrib) <> 0 THEN
        UPDATE public.accounts
        SET current_balance = COALESCE(current_balance, 0) + (v_new_contrib - v_old_contrib)
        WHERE id = NEW.account_id;
      END IF;
    ELSE
      -- Remove old contribution from old account
      IF v_old_contrib <> 0 THEN
        UPDATE public.accounts
        SET current_balance = COALESCE(current_balance, 0) - v_old_contrib
        WHERE id = OLD.account_id;
      END IF;

      -- Add new contribution to new account
      IF v_new_contrib <> 0 THEN
        UPDATE public.accounts
        SET current_balance = COALESCE(current_balance, 0) + v_new_contrib
        WHERE id = NEW.account_id;
      END IF;
    END IF;

    RETURN NEW;
  ELSE -- DELETE
    -- Hard deletes are rare (app uses soft delete), but handle it anyway.
    IF OLD.is_deleted = false THEN
      v_old_contrib :=
        CASE
          WHEN OLD.entry_type = 'income' THEN OLD.amount
          WHEN OLD.entry_type = 'expense' THEN -OLD.amount
          ELSE 0
        END;

      UPDATE public.accounts
      SET current_balance = COALESCE(current_balance, 0) - v_old_contrib
      WHERE id = OLD.account_id;
    END IF;

    RETURN OLD;
  END IF;
END;
$$;

DROP TRIGGER IF EXISTS trg_entries_adjust_account_current_balance ON public.entries;
CREATE TRIGGER trg_entries_adjust_account_current_balance
AFTER INSERT OR UPDATE OR DELETE ON public.entries
FOR EACH ROW
EXECUTE FUNCTION public.fn_entries_adjust_account_current_balance();

COMMIT;


-- <<< end: 36_add_accounts_current_balance.sql

-- >>> begin: 37_create_sales_history_and_user_permissions_views.sql
-- =========================================
-- Migration 37: Sales history + user permissions views
-- =========================================
-- Creates a DB view that returns all fields needed for the Sales/Bills history screen
-- in a single query (bills + customers + users).
-- This removes the need for N+1 requests for customer/user names on the client.

BEGIN;

CREATE OR REPLACE VIEW public.bill_history_sales_view
WITH (security_invoker = true) AS
SELECT
  b.id AS id,
  b.bill_number AS bill_number,

  COALESCE(c.name, 'Walk-in') AS customer_name,
  COALESCE(c.phone, '') AS customer_phone,

  COALESCE(u.full_name, '') AS created_by_name,

  b.created_at AS created_at,
  b.total_payable_amount AS total_payable_amount,
  b.payment_mode AS payment_mode,
  b.status AS status
FROM public.bills b
LEFT JOIN public.customers c
  ON c.id = b.customer_id
 AND c.is_active = true
LEFT JOIN public.users u
  ON u.id = b.created_by_user_id;

COMMIT;

-- =========================================
-- View security options
-- =========================================
-- Make sure permissions/RLS are evaluated using the querying user
-- (not the view owner), to avoid "SECURITY DEFINER" style warnings.
-- Note: we set `security_invoker` on CREATE VIEW below so tooling
-- can detect it reliably (and permissions/RLS are checked for the caller).

-- =========================================
-- Migration 37 (continued): Transactions list view
-- =========================================
-- Creates a DB view that returns transaction rows (entries) with
-- account name + accounting category name already joined.
-- This lets the client fetch the transactions list in a single request.

BEGIN;

CREATE OR REPLACE VIEW public.transactions_list_view
WITH (security_invoker = true) AS
SELECT
  e.id AS id,
  e.entry_date::text AS entry_date,
  e.entry_type AS entry_type,
  e.account_id AS account_id,
  COALESCE(a.name, '—') AS account_name,
  COALESCE(c.name, '—') AS category_name,
  e.amount AS amount,
  e.remarks AS remarks,
  e.created_at AS created_at
FROM public.entries e
LEFT JOIN public.accounts a
  ON a.id = e.account_id
  AND a.is_active = true
LEFT JOIN public.accounting_categories c
  ON c.id = e.category_id
WHERE e.is_deleted = false;

COMMIT;

-- =========================================
-- Migration 37 (continued): Stock-in list view
-- =========================================
-- Creates a DB view that returns stock-in history rows (headers)
-- with supplier name and created-by user name already joined.
-- This removes N+1 API calls for supplier/user names on the client.

BEGIN;

CREATE OR REPLACE VIEW public.stock_in_list_view
WITH (security_invoker = true) AS
SELECT
  si.id AS id,
  si.date::text AS date,
  si.invoice_number AS invoice_number,
  si.notes AS notes,
  si.total_items AS total_items,
  si.total_amount AS total_amount,

  CASE
    WHEN si.invoice_number = 'OPENING' THEN 'Opening Stock'
    ELSE COALESCE(s.supplier_name, 'Walk-in Purchase')
  END AS supplier_name,

  u.full_name AS created_by_name,

  si.created_at AS created_at
FROM public.stock_in si
LEFT JOIN public.suppliers s
  ON s.id = si.supplier_id
  AND s.is_deleted = false
LEFT JOIN public.users u
  ON u.id = si.created_by;

COMMIT;

-- =========================================
-- Migration 37 (continued): User list with permissions view
-- =========================================
-- Creates a DB view that returns:
-- - user fields needed by the UserList screen
-- - a pre-aggregated `permissions` JSON array for each user
--
-- This removes the client-side N+1 pattern:
--   getUsers() + getUserPermissions() per Staff user
-- and allows the app to fetch everything in one request.

BEGIN;

CREATE OR REPLACE VIEW public.user_list_with_permissions_view
WITH (security_invoker = true) AS
SELECT
  u.id AS id,
  u.full_name AS full_name,
  u.email AS email,
  u.phone AS phone,
  u.role AS role,
  u.status AS status,
  u.created_at AS created_at,
  u.updated_at AS updated_at,
  u.created_by AS created_by,
  COALESCE(
    jsonb_agg(up.permission::text ORDER BY up.permission),
    '[]'::jsonb
  ) AS permissions
FROM public.users u
LEFT JOIN public.user_permissions up
  ON up.user_id = u.id
 AND up.granted IS TRUE
GROUP BY
  u.id,
  u.full_name,
  u.email,
  u.phone,
  u.role,
  u.status,
  u.created_at,
  u.updated_at,
  u.created_by;

COMMIT;


-- <<< end: 37_create_sales_history_and_user_permissions_views.sql

-- >>> begin: 38_extend_admin_dashboard_totals_inactive_oos_json.sql
/* =============================================================================
   Migration 38 — extends get_admin_dashboard_totals (after 35_admin_dashboard_rpc)
   Single RPC update (no extra API calls):
   - inactive_product_count: products with is_active = false
   - out_of_stock_products: jsonb array [{ "name", "stock_quantity" }, ...] top 10
   Replaces out_of_stock_product_names (text[]) with out_of_stock_products (jsonb).
   Requires DROP + CREATE because RETURN TABLE shape changes.
   ============================================================================= */

DROP FUNCTION IF EXISTS public.get_admin_dashboard_totals(timestamptz, timestamptz, date);

CREATE OR REPLACE FUNCTION public.get_admin_dashboard_totals(
  p_start timestamptz,
  p_end   timestamptz,
  p_today date
)
RETURNS TABLE (
  today_sales numeric,
  today_manual_income numeric,
  today_income numeric,
  today_purchase numeric,
  today_manual_expense numeric,
  today_expense numeric,
  today_profit numeric,
  bill_count integer,
  today_returns_count integer,
  today_return_amount numeric,
  cash_total numeric,
  upi_total numeric,
  card_total numeric,
  total_products integer,
  low_stock_count integer,
  out_of_stock_count integer,
  inactive_product_count integer,
  out_of_stock_products jsonb
)
LANGUAGE sql
STABLE
AS $$
WITH
  bills_in_range AS (
    SELECT
      total_payable_amount,
      payment_mode,
      cash_amount,
      online_amount
    FROM public.bills
    WHERE created_at >= p_start
      AND created_at <  p_end
  ),
  bills_totals AS (
    SELECT
      COALESCE(SUM(total_payable_amount), 0)::numeric AS today_sales,
      COUNT(*)::integer AS bill_count,
      COALESCE(SUM(CASE WHEN payment_mode = 'Cash' THEN total_payable_amount ELSE 0 END), 0)::numeric AS cash_total,
      COALESCE(SUM(CASE WHEN payment_mode = 'UPI'  THEN total_payable_amount ELSE 0 END), 0)::numeric AS upi_total,
      COALESCE(SUM(CASE WHEN payment_mode = 'Card' THEN total_payable_amount ELSE 0 END), 0)::numeric AS card_total,
      COALESCE(SUM(CASE WHEN payment_mode = 'Mixed' THEN cash_amount ELSE 0 END), 0)::numeric AS mixed_cash,
      COALESCE(SUM(CASE WHEN payment_mode = 'Mixed' THEN online_amount ELSE 0 END), 0)::numeric AS mixed_online
    FROM bills_in_range
  ),
  payments_totals AS (
    SELECT
      today_sales,
      bill_count,
      (cash_total + mixed_cash)::numeric AS cash_total,
      (upi_total + mixed_online)::numeric AS upi_total,
      card_total::numeric AS card_total
    FROM bills_totals
  ),
  returns_totals AS (
    SELECT
      COALESCE(COUNT(*), 0)::integer AS today_returns_count,
      COALESCE(SUM(total_return_amount), 0)::numeric AS today_return_amount
    FROM public.bill_returns
    WHERE created_at >= p_start
      AND created_at <  p_end
  ),
  manual_income AS (
    SELECT COALESCE(SUM(amount), 0)::numeric AS today_manual_income
    FROM public.entries
    WHERE is_deleted = false
      AND entry_type = 'income'
      AND source_type = 'manual'
      AND entry_date = p_today
  ),
  purchase_expense AS (
    SELECT COALESCE(SUM(amount), 0)::numeric AS today_purchase
    FROM public.entries
    WHERE is_deleted = false
      AND entry_type = 'expense'
      AND source_type = 'purchase'
      AND entry_date = p_today
  ),
  manual_expense AS (
    SELECT COALESCE(SUM(amount), 0)::numeric AS today_manual_expense
    FROM public.entries
    WHERE is_deleted = false
      AND entry_type = 'expense'
      AND source_type = 'manual'
      AND entry_date = p_today
  ),
  computed AS (
    SELECT
      p.today_sales,
      mi.today_manual_income,
      (p.today_sales + mi.today_manual_income)::numeric AS today_income,
      pe.today_purchase,
      me.today_manual_expense,
      (pe.today_purchase + me.today_manual_expense)::numeric AS today_expense
    FROM payments_totals p
    CROSS JOIN manual_income mi
    CROSS JOIN purchase_expense pe
    CROSS JOIN manual_expense me
  )

SELECT
  c.today_sales,
  mi.today_manual_income,
  c.today_income,
  pe.today_purchase,
  me.today_manual_expense,
  c.today_expense,
  (c.today_income - c.today_expense - r.today_return_amount)::numeric AS today_profit,
  p.bill_count,
  r.today_returns_count,
  r.today_return_amount,
  p.cash_total,
  p.upi_total,
  p.card_total,

  (SELECT COUNT(*)::integer FROM public.products WHERE is_active = true) AS total_products,
  (SELECT COUNT(*)::integer
     FROM public.products
     WHERE is_active = true
       AND COALESCE(stock_quantity, 0) > 0
       AND COALESCE(stock_quantity, 0) <= COALESCE(low_stock_alert_qty, 0)
  ) AS low_stock_count,
  (SELECT COUNT(*)::integer
     FROM public.products
     WHERE is_active = true
       AND COALESCE(stock_quantity, 0) <= 0
  ) AS out_of_stock_count,
  (SELECT COUNT(*)::integer FROM public.products WHERE is_active = false) AS inactive_product_count,
  (
    SELECT COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'name', t.name,
          'stock_quantity', COALESCE(t.stock_quantity, 0)::double precision
        )
        ORDER BY t.name
      ),
      '[]'::jsonb
    )
    FROM (
      SELECT name, stock_quantity
      FROM public.products
      WHERE is_active = true
        AND COALESCE(stock_quantity, 0) <= 0
        AND name IS NOT NULL
      ORDER BY name
      LIMIT 10
    ) t
  ) AS out_of_stock_products
FROM computed c
JOIN payments_totals p ON true
JOIN returns_totals r ON true
JOIN manual_income mi ON true
JOIN purchase_expense pe ON true
JOIN manual_expense me ON true;
$$;

-- <<< end: 38_extend_admin_dashboard_totals_inactive_oos_json.sql
