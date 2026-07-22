-- =============================================================================
-- 81_get_product_details_rpc.sql
-- Single RPC for Product Details screen: product, category, stock summary,
-- financial summary, and enriched stock movements (purchases / sales / returns).
-- Replaces multiple client round-trips with one jsonb payload.
-- =============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.get_product_details(p_product_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_company_id uuid := public.get_my_company_id();
  v_product public.products%ROWTYPE;
  v_category_name text;
  v_fallback_cost numeric;
  v_units_sold numeric;
  v_sales_revenue numeric;
  v_sales_cogs numeric;
  v_units_returned numeric;
  v_return_amount numeric;
  v_return_cogs numeric;
  v_net_revenue numeric;
  v_net_cogs numeric;
  v_gross_profit numeric;
  v_margin numeric;
  v_net_units numeric;
  v_opening numeric;
  v_received numeric;
  v_sold numeric;
  v_returned numeric;
  v_movements jsonb;
BEGIN
  IF p_product_id IS NULL OR v_company_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT *
  INTO v_product
  FROM public.products p
  WHERE p.id = p_product_id
    AND p.company_id = v_company_id;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  SELECT pc.name
  INTO v_category_name
  FROM public.product_categories pc
  WHERE pc.id = v_product.product_category_id
    AND pc.company_id = v_company_id;

  v_fallback_cost := COALESCE(v_product.purchase_price, 0);

  -- Financial summary (matches Android ProductRepositoryImpl logic)
  SELECT
    COALESCE(SUM(bi.quantity), 0),
    COALESCE(SUM(bi.row_total), 0),
    COALESCE(SUM(bi.quantity * COALESCE(bi.unit_cost, v_fallback_cost)), 0)
  INTO v_units_sold, v_sales_revenue, v_sales_cogs
  FROM public.bill_items bi
  WHERE bi.product_id = p_product_id
    AND bi.company_id = v_company_id;

  SELECT
    COALESCE(SUM(bri.quantity::numeric), 0),
    COALESCE(SUM(bri.line_total), 0),
    COALESCE(
      SUM(
        bri.quantity::numeric * COALESCE(
          (
            SELECT bi.unit_cost
            FROM public.bill_items bi
            WHERE bi.id = bri.bill_item_id
          ),
          v_fallback_cost
        )
      ),
      0
    )
  INTO v_units_returned, v_return_amount, v_return_cogs
  FROM public.bill_return_items bri
  WHERE bri.product_id = p_product_id
    AND bri.company_id = v_company_id;

  v_net_revenue := v_sales_revenue - v_return_amount;
  v_net_cogs := GREATEST(v_sales_cogs - v_return_cogs, 0);
  v_gross_profit := v_net_revenue - v_net_cogs;
  v_margin := CASE
    WHEN v_net_revenue > 0 THEN (v_gross_profit / v_net_revenue) * 100
    ELSE NULL
  END;
  v_net_units := GREATEST(v_units_sold - v_units_returned, 0);

  -- Stock summary from stock_transactions
  SELECT
    COALESCE(SUM(CASE WHEN st.transaction_type = 'OPENING' THEN st.quantity ELSE 0 END), 0),
    COALESCE(
      SUM(
        CASE
          WHEN st.transaction_type IN ('OPENING', 'PURCHASE', 'ADJUSTMENT_IN') THEN st.quantity
          ELSE 0
        END
      ),
      0
    ),
    COALESCE(
      SUM(
        CASE
          WHEN st.transaction_type = 'SALE' THEN ABS(st.quantity)
          ELSE 0
        END
      ),
      0
    ),
    COALESCE(
      SUM(
        CASE
          WHEN st.transaction_type = 'RETURN_IN' THEN st.quantity
          ELSE 0
        END
      ),
      0
    )
  INTO v_opening, v_received, v_sold, v_returned
  FROM public.stock_transactions st
  WHERE st.product_id = p_product_id
    AND st.company_id = v_company_id;

  -- Enriched movements (newest first)
  SELECT COALESCE(
    jsonb_agg(row_to_json(m)::jsonb ORDER BY m.created_at DESC NULLS LAST),
    '[]'::jsonb
  )
  INTO v_movements
  FROM (
    SELECT
      st.id::text AS id,
      st.transaction_type,
      st.quantity,
      st.reference_type,
      st.reference_id::text AS reference_id,
      CASE
        WHEN st.notes IS NULL THEN NULL
        WHEN lower(trim(st.notes)) IN ('pos sale', 'bill return', 'opening stock') THEN
          CASE
            WHEN upper(st.reference_type) = 'STOCK_IN'
              AND si.notes IS NOT NULL
              AND si.notes !~* 'opening stock'
            THEN si.notes
            WHEN upper(st.reference_type) = 'BILL_RETURN'
              AND NULLIF(trim(br.return_note), '') IS NOT NULL
            THEN br.return_note
            ELSE NULL
          END
        ELSE st.notes
      END AS notes,
      st.created_at,
      st.batch_id::text AS batch_id,
      pb.batch_seq,
      COALESCE(
        NULLIF(trim(pb.name), ''),
        CASE WHEN pb.batch_seq IS NOT NULL THEN 'Batch ' || pb.batch_seq::text ELSE NULL END
      ) AS batch_name,
      CASE upper(COALESCE(st.reference_type, ''))
        WHEN 'STOCK_IN' THEN
          CASE
            WHEN upper(COALESCE(si.invoice_number, '')) = 'OPENING' THEN 'Opening Stock'
            WHEN NULLIF(trim(sup.supplier_name), '') IS NOT NULL THEN trim(sup.supplier_name)
            ELSE 'Walk-in Purchase'
          END
        WHEN 'BILL' THEN
          COALESCE(NULLIF(trim(cust.name), ''), 'Walk-in Customer')
        WHEN 'BILL_RETURN' THEN
          COALESCE(NULLIF(trim(ret_cust.name), ''), 'Walk-in Customer')
        ELSE NULL
      END AS party_name,
      CASE upper(COALESCE(st.reference_type, ''))
        WHEN 'STOCK_IN' THEN
          CASE
            WHEN upper(COALESCE(si.invoice_number, '')) = 'OPENING' THEN 'Opening'
            ELSE NULLIF(trim(si.invoice_number), '')
          END
        WHEN 'BILL' THEN NULLIF(trim(bill.bill_number), '')
        WHEN 'BILL_RETURN' THEN NULLIF(trim(br.return_number), '')
        ELSE NULL
      END AS document_label,
      CASE
        WHEN upper(COALESCE(st.reference_type, '')) = 'BILL_RETURN'
          THEN NULLIF(trim(orig_bill.bill_number), '')
        ELSE NULL
      END AS related_document_label,
      CASE upper(COALESCE(st.reference_type, ''))
        WHEN 'STOCK_IN' THEN COALESCE(sii.purchase_price, pb.purchase_price)
        WHEN 'BILL' THEN bi.unit_price
        WHEN 'BILL_RETURN' THEN bri.unit_price
        ELSE COALESCE(pb.purchase_price, v_product.purchase_price)
      END AS unit_price,
      CASE upper(COALESCE(st.reference_type, ''))
        WHEN 'STOCK_IN' THEN
          COALESCE(sii.selling_price, pb.selling_price, v_product.selling_price)
        WHEN 'BILL' THEN COALESCE(pb.selling_price, v_product.selling_price)
        ELSE COALESCE(pb.selling_price, v_product.selling_price)
      END AS selling_price,
      CASE upper(COALESCE(st.reference_type, ''))
        WHEN 'STOCK_IN' THEN COALESCE(sii.mrp, pb.mrp, v_product.mrp)
        WHEN 'BILL' THEN COALESCE(bi.mrp, pb.mrp, v_product.mrp)
        ELSE COALESCE(pb.mrp, v_product.mrp)
      END AS mrp,
      CASE upper(COALESCE(st.reference_type, ''))
        WHEN 'STOCK_IN' THEN sii.row_total
        WHEN 'BILL' THEN bi.row_total
        WHEN 'BILL_RETURN' THEN bri.line_total
        ELSE NULL
      END AS line_total,
      CASE
        WHEN upper(COALESCE(st.reference_type, '')) = 'BILL_RETURN'
          THEN NULLIF(trim(br.refund_method), '')
        ELSE NULL
      END AS refund_method
    FROM public.stock_transactions st
    LEFT JOIN public.product_batches pb
      ON pb.id = st.batch_id
     AND pb.company_id = v_company_id
    LEFT JOIN public.stock_in si
      ON upper(COALESCE(st.reference_type, '')) = 'STOCK_IN'
     AND si.id = st.reference_id
     AND si.company_id = v_company_id
    LEFT JOIN public.suppliers sup
      ON sup.id = si.supplier_id
    LEFT JOIN LATERAL (
      SELECT sii.*
      FROM public.stock_in_items sii
      WHERE upper(COALESCE(st.reference_type, '')) = 'STOCK_IN'
        AND sii.stock_in_id = st.reference_id
        AND sii.product_id = p_product_id
      ORDER BY
        CASE
          WHEN st.batch_id IS NOT NULL
            AND sii.batch_id = st.batch_id
            AND abs(sii.quantity - abs(st.quantity)) < 0.0001 THEN 0
          WHEN abs(sii.quantity - abs(st.quantity)) < 0.0001 THEN 1
          ELSE 2
        END,
        sii.created_at
      LIMIT 1
    ) sii ON true
    LEFT JOIN public.bills bill
      ON upper(COALESCE(st.reference_type, '')) = 'BILL'
     AND bill.id = st.reference_id
     AND bill.company_id = v_company_id
    LEFT JOIN public.customers cust
      ON cust.id = bill.customer_id
    LEFT JOIN LATERAL (
      SELECT bi.*
      FROM public.bill_items bi
      WHERE upper(COALESCE(st.reference_type, '')) = 'BILL'
        AND bi.bill_id = st.reference_id
        AND bi.product_id = p_product_id
      ORDER BY
        CASE
          WHEN st.batch_id IS NOT NULL
            AND bi.batch_id = st.batch_id
            AND abs(bi.quantity - abs(st.quantity)) < 0.0001 THEN 0
          WHEN abs(bi.quantity - abs(st.quantity)) < 0.0001 THEN 1
          ELSE 2
        END,
        bi.id
      LIMIT 1
    ) bi ON true
    LEFT JOIN public.bill_returns br
      ON upper(COALESCE(st.reference_type, '')) = 'BILL_RETURN'
     AND br.id = st.reference_id
    LEFT JOIN public.bills orig_bill
      ON orig_bill.id = br.bill_id
     AND orig_bill.company_id = v_company_id
    LEFT JOIN public.customers ret_cust
      ON ret_cust.id = orig_bill.customer_id
    LEFT JOIN LATERAL (
      SELECT bri.*
      FROM public.bill_return_items bri
      WHERE upper(COALESCE(st.reference_type, '')) = 'BILL_RETURN'
        AND bri.return_id = st.reference_id
        AND bri.product_id = p_product_id
      ORDER BY
        CASE
          WHEN abs(bri.quantity::numeric - abs(st.quantity)) < 0.0001 THEN 0
          ELSE 1
        END,
        bri.id
      LIMIT 1
    ) bri ON true
    WHERE st.product_id = p_product_id
      AND st.company_id = v_company_id
  ) m;

  RETURN jsonb_build_object(
    'product', jsonb_build_object(
      'id', v_product.id,
      'name', v_product.name,
      'product_category_id', v_product.product_category_id,
      'barcode', v_product.barcode,
      'purchase_price', v_product.purchase_price,
      'selling_price', v_product.selling_price,
      'mrp', v_product.mrp,
      'unit', v_product.unit,
      'stock_quantity', COALESCE(v_product.stock_quantity, 0),
      'low_stock_alert_qty', COALESCE(v_product.low_stock_alert_qty, 0),
      'is_active', COALESCE(v_product.is_active, true),
      'is_deleted', COALESCE(v_product.is_deleted, false),
      'image_url', v_product.image_url,
      'created_at', v_product.created_at,
      'updated_at', v_product.updated_at
    ),
    'category_name', v_category_name,
    'stock_summary', jsonb_build_object(
      'opening_stock', v_opening,
      'total_received', v_received,
      'total_sold', v_sold,
      'total_returned', v_returned
    ),
    'financial_summary', jsonb_build_object(
      'units_sold', v_units_sold,
      'units_returned', v_units_returned,
      'net_units_sold', v_net_units,
      'sales_revenue', v_sales_revenue,
      'return_amount', v_return_amount,
      'net_revenue', v_net_revenue,
      'cost_of_goods_sold', v_net_cogs,
      'gross_profit', v_gross_profit,
      'profit_margin_percent', v_margin,
      'inventory_value_at_cost', COALESCE(v_product.stock_quantity, 0) * v_fallback_cost,
      'inventory_value_at_sell', CASE
        WHEN v_product.selling_price IS NULL THEN NULL
        ELSE COALESCE(v_product.stock_quantity, 0) * v_product.selling_price
      END
    ),
    'movements', v_movements
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_product_details(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_product_details(uuid) TO service_role;

COMMIT;
