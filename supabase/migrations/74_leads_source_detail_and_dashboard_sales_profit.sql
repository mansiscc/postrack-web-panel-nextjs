/* =============================================================================
   Migration 74 — Leads source_detail, app_updates cleanup, dashboard sales profit

   Part A — Leads & app updates (migration 74):
   - source_detail: referrer / other source text on leads.
   - is_blocked removed: app updates use Play Store; min/force version rules remain.

   Part B — Admin dashboard sales profit (migration 75):
   Adds COGS-based sales profit to get_admin_dashboard_totals():
   - today_sales_revenue: net item revenue (sold − returned) for the time window
   - today_cogs: cost of goods sold (purchase price × qty, net of returns)
   - today_sales_profit: today_sales_revenue − today_cogs
   - today_sales_profit_margin: profit as % of sales revenue
   ============================================================================= */

BEGIN;

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS source_detail text;

COMMENT ON COLUMN public.leads.source_detail IS
  'Referrer name or other source description when source is referral-customer, referral-partner, or other.';

ALTER TABLE public.app_updates
  DROP COLUMN IF EXISTS is_blocked;

COMMENT ON TABLE public.app_updates IS
  'App version control records (latest/min/force) per platform for Play Store update dialogs.';

COMMIT;

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
  out_of_stock_products jsonb,
  today_sales_revenue numeric,
  today_cogs numeric,
  today_sales_profit numeric,
  today_sales_profit_margin numeric
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
  sold_items AS (
    SELECT
      bi.row_total,
      bi.quantity,
      COALESCE(p.purchase_price, 0)::numeric AS purchase_price
    FROM public.bill_items bi
    INNER JOIN public.bills b ON b.id = bi.bill_id
    LEFT JOIN public.products p ON p.id = bi.product_id
    WHERE b.created_at >= p_start
      AND b.created_at <  p_end
  ),
  sold_totals AS (
    SELECT
      COALESCE(SUM(row_total), 0)::numeric AS gross_sales_revenue,
      COALESCE(SUM(quantity * purchase_price), 0)::numeric AS gross_cogs
    FROM sold_items
  ),
  returned_items AS (
    SELECT
      bri.line_total,
      bri.quantity,
      COALESCE(p.purchase_price, 0)::numeric AS purchase_price
    FROM public.bill_return_items bri
    INNER JOIN public.bill_returns br ON br.id = bri.return_id
    LEFT JOIN public.products p ON p.id = bri.product_id
    WHERE br.created_at >= p_start
      AND br.created_at <  p_end
  ),
  returned_totals AS (
    SELECT
      COALESCE(SUM(line_total), 0)::numeric AS return_revenue,
      COALESCE(SUM(quantity * purchase_price), 0)::numeric AS return_cogs
    FROM returned_items
  ),
  sales_profit AS (
    SELECT
      (st.gross_sales_revenue - rt.return_revenue)::numeric AS today_sales_revenue,
      (st.gross_cogs - rt.return_cogs)::numeric AS today_cogs,
      (st.gross_sales_revenue - rt.return_revenue - st.gross_cogs + rt.return_cogs)::numeric AS today_sales_profit
    FROM sold_totals st
    CROSS JOIN returned_totals rt
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
  ) AS out_of_stock_products,

  sp.today_sales_revenue,
  sp.today_cogs,
  sp.today_sales_profit,
  CASE
    WHEN sp.today_sales_revenue > 0
    THEN round((sp.today_sales_profit / sp.today_sales_revenue) * 100.0, 1)
    ELSE 0::numeric
  END AS today_sales_profit_margin
FROM computed c
JOIN payments_totals p ON true
JOIN returns_totals r ON true
JOIN manual_income mi ON true
JOIN purchase_expense pe ON true
JOIN manual_expense me ON true
CROSS JOIN sales_profit sp;
$$;
