-- =============================================================================
-- Migration 42: Restore purchase_price, selling_price, mrp on stock_in_items
--
-- Rationale: Snapshot unit cost and list prices at stock-in time; row_total
-- remains the line amount (e.g. purchase_price * quantity).
-- =============================================================================

BEGIN;

ALTER TABLE public.stock_in_items
  ADD COLUMN IF NOT EXISTS purchase_price numeric(18, 2),
  ADD COLUMN IF NOT EXISTS selling_price numeric(18, 2),
  ADD COLUMN IF NOT EXISTS mrp numeric(18, 2);

UPDATE public.stock_in_items
SET purchase_price = CASE
  WHEN COALESCE(quantity, 0) <> 0 THEN round(row_total / quantity, 2)
  ELSE 0::numeric(18, 2)
END
WHERE purchase_price IS NULL;

ALTER TABLE public.stock_in_items
  ALTER COLUMN purchase_price SET NOT NULL;

COMMENT ON COLUMN public.stock_in_items.purchase_price IS 'Unit purchase price at time of stock-in.';
COMMENT ON COLUMN public.stock_in_items.selling_price IS 'Selling price snapshot at stock-in (optional).';
COMMENT ON COLUMN public.stock_in_items.mrp IS 'MRP snapshot at stock-in (optional).';
COMMENT ON COLUMN public.stock_in_items.row_total IS 'Line total (typically purchase_price × quantity at stock-in).';

-- -----------------------------------------------------------------------------
-- create_stock_in: persist price columns from JSON (fallback for purchase_price)
-- -----------------------------------------------------------------------------
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
  v_purchase_price     numeric(18,2);
  v_selling_price      numeric(18,2);
  v_mrp                numeric(18,2);

  v_total_items   integer        := 0;
  v_total_amount  numeric(18,2)  := 0;
BEGIN
  IF p_items IS NULL
     OR jsonb_typeof(p_items) <> 'array'
     OR jsonb_array_length(p_items) = 0
  THEN
    RAISE EXCEPTION 'p_items must be a non-empty JSON array of line items';
  END IF;

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
    v_product_id := (v_item->>'product_id')::uuid;
    v_manufacturing_date := CASE
      WHEN NULLIF(trim(COALESCE(v_item->>'manufacturing_date', '')), '') IS NOT NULL
      THEN (NULLIF(trim(COALESCE(v_item->>'manufacturing_date', '')), ''))::date
      ELSE NULL
    END;
    v_quantity  := COALESCE((v_item->>'quantity')::numeric(18,3), 0);
    v_row_total := COALESCE((v_item->>'row_total')::numeric(18,2), 0);

    v_purchase_price := CASE
      WHEN NULLIF(trim(COALESCE(v_item->>'purchase_price', '')), '') IS NOT NULL
      THEN (NULLIF(trim(COALESCE(v_item->>'purchase_price', '')), ''))::numeric(18,2)
      ELSE CASE
        WHEN COALESCE(v_quantity, 0) <> 0 THEN round(v_row_total / v_quantity, 2)
        ELSE 0::numeric(18,2)
      END
    END;

    v_selling_price := CASE
      WHEN NULLIF(trim(COALESCE(v_item->>'selling_price', '')), '') IS NOT NULL
      THEN (NULLIF(trim(COALESCE(v_item->>'selling_price', '')), ''))::numeric(18,2)
      ELSE NULL
    END;

    v_mrp := CASE
      WHEN NULLIF(trim(COALESCE(v_item->>'mrp', '')), '') IS NOT NULL
      THEN (NULLIF(trim(COALESCE(v_item->>'mrp', '')), ''))::numeric(18,2)
      ELSE NULL
    END;

    INSERT INTO public.stock_in_items (
      stock_in_id,
      product_id,
      manufacturing_date,
      purchase_price,
      selling_price,
      mrp,
      quantity,
      row_total
    )
    VALUES (
      v_stock_in_id,
      v_product_id,
      v_manufacturing_date,
      v_purchase_price,
      v_selling_price,
      v_mrp,
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
  'Creates stock_in with line items (purchase_price, selling_price, mrp snapshots + quantity, row_total), updates products.stock_quantity, logs PURCHASE stock_transactions. purchase_price defaults from row_total/quantity if omitted in JSON.';

-- -----------------------------------------------------------------------------
-- create_product_with_opening_stock: line items include price snapshots
-- -----------------------------------------------------------------------------
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
      purchase_price,
      selling_price,
      mrp,
      quantity,
      row_total
    )
    VALUES (
      v_stock_in_id,
      v_product_id,
      NULL,
      COALESCE(p_purchase_price, 0),
      p_selling_price,
      p_mrp,
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
  'Creates a product and, if opening_stock > 0, stock_in (invoice OPENING) with stock_in_items price snapshots. Returns TABLE(id uuid).';

COMMIT;
