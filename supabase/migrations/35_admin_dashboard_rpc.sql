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

