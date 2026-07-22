/* =============================================================================
   Migration 23: Fix ambiguous id references in create_stock_in function

   Based on migration 21 (optional params + slim stock_in_items schema)

   - Keep signature:
       create_stock_in(
         p_date date,
         p_items jsonb,
         p_supplier_id uuid DEFAULT NULL,
         p_invoice_number text DEFAULT NULL,
         p_notes text DEFAULT NULL,
         p_created_by uuid DEFAULT NULL
       )
     RETURNS TABLE(id uuid)

   - stock_in_items columns: stock_in_id, product_id, manufacturing_date, quantity, row_total
     (NO purchase_price, selling_price, mrp)

   - Fix ambiguity by:
     * RETURNING public.stock_in.id INTO v_stock_in_id
     * UPDATE public.products AS p ... WHERE p.id = v_product_id
   ============================================================================= */

CREATE OR REPLACE FUNCTION public.create_stock_in(
  p_date           date,
  p_items          jsonb,
  p_supplier_id    uuid DEFAULT NULL,
  p_invoice_number text DEFAULT NULL,
  p_notes          text DEFAULT NULL,
  p_created_by     uuid DEFAULT NULL
)
RETURNS TABLE(id uuid)
LANGUAGE plpgsql
AS $$
DECLARE
  v_stock_in_id   uuid;
  v_item          jsonb;

  v_product_id         uuid;
  v_manufacturing_date date;
  v_quantity           numeric(18,3);
  v_row_total          numeric(18,2);

  v_total_items   integer        := 0;
  v_total_amount  numeric(18,2)  := 0;
BEGIN
  -- Validate items
  IF p_items IS NULL
     OR jsonb_typeof(p_items) <> 'array'
     OR jsonb_array_length(p_items) = 0
  THEN
    RAISE EXCEPTION 'p_items must be a non-empty JSON array of line items';
  END IF;

  /* ------------------------------------------------------------
     STEP 1: Compute totals from items (row_total from JSON)
     ------------------------------------------------------------ */
  FOR v_item IN
    SELECT value
    FROM jsonb_array_elements(p_items) AS t(value)
  LOOP
    v_quantity  := COALESCE((v_item->>'quantity')::numeric(18,3), 0);
    v_row_total := COALESCE((v_item->>'row_total')::numeric(18,2), 0);

    v_total_items  := v_total_items + 1;
    v_total_amount := v_total_amount + v_row_total;
  END LOOP;

  /* ------------------------------------------------------------
     STEP 2: Insert stock_in header
     ------------------------------------------------------------ */
  INSERT INTO public.stock_in (
    date,
    supplier_id,
    invoice_number,
    notes,
    total_items,
    total_amount,
    created_by
  )
  VALUES (
    p_date,
    p_supplier_id,
    p_invoice_number,
    p_notes,
    v_total_items,
    v_total_amount,
    p_created_by
  )
  RETURNING public.stock_in.id INTO v_stock_in_id;

  /* ------------------------------------------------------------
     STEP 3 & 4: stock_in_items (no purchase_price/selling_price/mrp),
     products.stock_quantity, stock_transactions
     ------------------------------------------------------------ */
  FOR v_item IN
    SELECT value
    FROM jsonb_array_elements(p_items) AS t(value)
  LOOP
    v_product_id := (v_item->>'product_id')::uuid;
    v_manufacturing_date := CASE
      WHEN NULLIF(trim(v_item->>'manufacturing_date'), '') IS NOT NULL
      THEN (v_item->>'manufacturing_date')::date
      ELSE NULL
    END;
    v_quantity  := COALESCE((v_item->>'quantity')::numeric(18,3), 0);
    v_row_total := COALESCE((v_item->>'row_total')::numeric(18,2), 0);

    INSERT INTO public.stock_in_items (
      stock_in_id,
      product_id,
      manufacturing_date,
      quantity,
      row_total
    )
    VALUES (
      v_stock_in_id,
      v_product_id,
      v_manufacturing_date,
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
  date, jsonb, uuid, text, text, uuid
) IS
  'Creates a stock_in purchase entry with items (stock_in_items: product_id, quantity, row_total, manufacturing_date only), updates products.stock_quantity, and logs PURCHASE stock_transactions. Returns TABLE(id uuid) for PostgREST compatibility. Supplier, Invoice No, and Notes are optional (default null).';