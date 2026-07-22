/* =============================================================================
   Migration 76 — Dashboard totals for current Home UI

   Returns only fields shown on admin dashboard:
   - Bills / Bills Total / Purchase / Extra income / Other expense / Today's profit
   - Sales profit (revenue, COGS, profit, margin)
   - Refunds today
   - Payment breakdown (received by Cash / UPI / Card)
   - Inventory counts + out-of-stock product preview (limit 10)
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
  today_purchase numeric,
  today_manual_expense numeric,
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
      received_amount_total,
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
      -- Payment breakdown: money received on today's bills (not unpaid payable)
      COALESCE(SUM(CASE WHEN payment_mode = 'Cash' THEN received_amount_total ELSE 0 END), 0)::numeric AS cash_total,
      COALESCE(SUM(CASE WHEN payment_mode = 'UPI'  THEN received_amount_total ELSE 0 END), 0)::numeric AS upi_total,
      COALESCE(SUM(CASE WHEN payment_mode = 'Card' THEN received_amount_total ELSE 0 END), 0)::numeric AS card_total,
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
      COALESCE(SUM(quantity * purchase_price), 0)::numeric AS gross_cogs
    FROM sold_items
  ),
  -- Bill-level revenue after discount / other items (matches Bills Total)
  billed_revenue AS (
    SELECT COALESCE(SUM(total_payable_amount), 0)::numeric AS gross_billed_revenue
    FROM bills_in_range
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
      (br.gross_billed_revenue - rt.return_revenue)::numeric AS today_sales_revenue,
      (st.gross_cogs - rt.return_cogs)::numeric AS today_cogs,
      (br.gross_billed_revenue - rt.return_revenue - st.gross_cogs + rt.return_cogs)::numeric AS today_sales_profit
    FROM billed_revenue br
    CROSS JOIN sold_totals st
    CROSS JOIN returned_totals rt
  )

SELECT
  p.today_sales,
  mi.today_manual_income,
  pe.today_purchase,
  me.today_manual_expense,
  -- Profit on goods sold + extra income − other expense (returns already netted in sales_profit)
  (sp.today_sales_profit + mi.today_manual_income - me.today_manual_expense)::numeric AS today_profit,
  p.bill_count,
  r.today_returns_count,
  r.today_return_amount,
  p.cash_total,
  p.upi_total,
  p.card_total,

  (SELECT COUNT(*)::integer
     FROM public.products
     WHERE is_active = true AND is_deleted = false
  ) AS total_products,
  (SELECT COUNT(*)::integer
     FROM public.products
     WHERE is_active = true
       AND is_deleted = false
       AND COALESCE(stock_quantity, 0) > 0
       AND COALESCE(stock_quantity, 0) <= COALESCE(low_stock_alert_qty, 0)
  ) AS low_stock_count,
  (SELECT COUNT(*)::integer
     FROM public.products
     WHERE is_active = true
       AND is_deleted = false
       AND COALESCE(stock_quantity, 0) <= 0
  ) AS out_of_stock_count,
  (SELECT COUNT(*)::integer
     FROM public.products
     WHERE is_active = false AND is_deleted = false
  ) AS inactive_product_count,
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
        AND is_deleted = false
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
FROM payments_totals p
JOIN returns_totals r ON true
JOIN manual_income mi ON true
JOIN purchase_expense pe ON true
JOIN manual_expense me ON true
CROSS JOIN sales_profit sp;
$$;

COMMENT ON FUNCTION public.get_admin_dashboard_totals(timestamptz, timestamptz, date) IS
  'Admin home dashboard totals. today_sales = billed payable; payment mode uses received; '
  'today_profit = sales profit + manual income - manual expense; sales profit nets returns.';
