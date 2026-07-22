-- =============================================================================
-- 78_sales_analytics_summary_rpc.sql
-- Server-side sales analytics aggregation to replace client 10k-row pulls.
-- Returns a single JSON object with totals, payment breakdown, top products,
-- and trend buckets for the requested [p_start, p_end) window.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_sales_analytics_summary(
  p_start timestamptz,
  p_end   timestamptz,
  p_bucket text DEFAULT 'day'
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
AS $$
WITH bills_in_range AS (
  SELECT
    id,
    total_payable_amount,
    received_amount_total,
    payment_mode,
    cash_amount,
    online_amount,
    created_at
  FROM public.bills
  WHERE created_at >= p_start
    AND created_at < p_end
),
bill_totals AS (
  SELECT
    COALESCE(COUNT(*), 0)::integer AS bill_count,
    COALESCE(SUM(total_payable_amount), 0)::numeric AS total_sales,
    COALESCE(SUM(received_amount_total), 0)::numeric AS total_received,
    COALESCE(SUM(CASE WHEN payment_mode = 'Cash' THEN received_amount_total ELSE 0 END), 0)::numeric
      + COALESCE(SUM(CASE WHEN payment_mode = 'Mixed' THEN cash_amount ELSE 0 END), 0)::numeric AS cash_total,
    COALESCE(SUM(CASE WHEN payment_mode = 'UPI' THEN received_amount_total ELSE 0 END), 0)::numeric
      + COALESCE(SUM(CASE WHEN payment_mode = 'Mixed' THEN online_amount ELSE 0 END), 0)::numeric AS upi_total,
    COALESCE(SUM(CASE WHEN payment_mode = 'Card' THEN received_amount_total ELSE 0 END), 0)::numeric AS card_total
  FROM bills_in_range
),
returns_in_range AS (
  SELECT
    COALESCE(COUNT(*), 0)::integer AS return_count,
    COALESCE(SUM(total_return_amount), 0)::numeric AS return_amount
  FROM public.bill_returns
  WHERE created_at >= p_start
    AND created_at < p_end
),
sold_items AS (
  SELECT
    bi.product_id,
    COALESCE(bi.product_name, 'Unknown') AS product_name,
    COALESCE(SUM(bi.quantity), 0)::numeric AS qty_sold,
    COALESCE(SUM(bi.row_total), 0)::numeric AS revenue
  FROM public.bill_items bi
  INNER JOIN bills_in_range b ON b.id = bi.bill_id
  WHERE bi.product_id IS NOT NULL
  GROUP BY bi.product_id, COALESCE(bi.product_name, 'Unknown')
),
returned_items AS (
  SELECT
    bri.product_id,
    COALESCE(SUM(bri.quantity), 0)::numeric AS qty_returned,
    COALESCE(SUM(bri.line_total), 0)::numeric AS return_revenue
  FROM public.bill_return_items bri
  INNER JOIN public.bill_returns br ON br.id = bri.return_id
  WHERE br.created_at >= p_start
    AND br.created_at < p_end
    AND bri.product_id IS NOT NULL
  GROUP BY bri.product_id
),
product_net AS (
  SELECT
    s.product_id,
    s.product_name,
    GREATEST(s.qty_sold - COALESCE(r.qty_returned, 0), 0)::numeric AS net_qty,
    GREATEST(s.revenue - COALESCE(r.return_revenue, 0), 0)::numeric AS net_revenue,
    GREATEST(
      (s.qty_sold - COALESCE(r.qty_returned, 0)) * COALESCE(p.purchase_price, 0),
      0
    )::numeric AS cogs
  FROM sold_items s
  LEFT JOIN returned_items r ON r.product_id = s.product_id
  LEFT JOIN public.products p ON p.id = s.product_id
),
top_products AS (
  SELECT *
  FROM product_net
  ORDER BY net_revenue DESC
  LIMIT 10
),
trend AS (
  SELECT
    CASE
      WHEN lower(p_bucket) = 'week' THEN to_char(date_trunc('week', created_at), 'IYYY-"W"IW')
      WHEN lower(p_bucket) = 'month' THEN to_char(date_trunc('month', created_at), 'YYYY-MM')
      ELSE to_char(date_trunc('day', created_at), 'YYYY-MM-DD')
    END AS label,
    COALESCE(SUM(total_payable_amount), 0)::numeric AS sales
  FROM bills_in_range
  GROUP BY 1
  ORDER BY 1
),
cogs_totals AS (
  SELECT
    COALESCE(SUM(net_revenue), 0)::numeric AS item_revenue,
    COALESCE(SUM(cogs), 0)::numeric AS cogs,
    COALESCE(SUM(net_qty), 0)::numeric AS items_sold
  FROM product_net
)
SELECT jsonb_build_object(
  'bill_count', (SELECT bill_count FROM bill_totals),
  'total_sales', (SELECT total_sales FROM bill_totals),
  'total_received', (SELECT total_received FROM bill_totals),
  'cash_total', (SELECT cash_total FROM bill_totals),
  'upi_total', (SELECT upi_total FROM bill_totals),
  'card_total', (SELECT card_total FROM bill_totals),
  'return_count', (SELECT return_count FROM returns_in_range),
  'return_amount', (SELECT return_amount FROM returns_in_range),
  'item_revenue', (SELECT item_revenue FROM cogs_totals),
  'cogs', (SELECT cogs FROM cogs_totals),
  'items_sold', (SELECT items_sold FROM cogs_totals),
  'gross_profit', (SELECT item_revenue - cogs FROM cogs_totals),
  'top_products', COALESCE((
    SELECT jsonb_agg(
      jsonb_build_object(
        'product_id', product_id,
        'product_name', product_name,
        'quantity', net_qty,
        'revenue', net_revenue
      )
    )
    FROM top_products
  ), '[]'::jsonb),
  'trend', COALESCE((
    SELECT jsonb_agg(
      jsonb_build_object(
        'label', label,
        'sales', sales
      )
    )
    FROM trend
  ), '[]'::jsonb)
);
$$;

GRANT EXECUTE ON FUNCTION public.get_sales_analytics_summary(timestamptz, timestamptz, text)
  TO authenticated, service_role;
