/* =============================================================================
   MODULE — STOCK-IN WORKFLOW FUNCTION
   Migration: create_stock_in function to save purchase (stock-in) entries
   in a single transactional operation.

   Responsibilities:
   - Insert stock_in header (purchase metadata)
   - Insert stock_in_items rows (per-product purchase lines)
   - Update products.stock_quantity (increase by purchased quantity)
   - Insert stock_transactions rows for each item:
       - transaction_type = 'PURCHASE'
       - quantity         = +quantity
       - reference_type   = 'STOCK_IN'
       - reference_id     = stock_in.id

   This function is intended to be called via Supabase RPC from the app.
   All steps run inside a single transaction (function execution is atomic).
   ============================================================================= */

CREATE OR REPLACE FUNCTION public.create_stock_in(
  p_date           date,
  p_supplier_id    uuid,
  p_invoice_number text,
  p_notes          text,
  p_created_by     uuid,
  p_items          jsonb          -- JSON array of line items
)
RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
  v_stock_in_id   uuid;
  v_item          jsonb;

  v_product_id         uuid;
  v_purchase_price     numeric(18,2);
  v_selling_price      numeric(18,2);
  v_mrp                numeric(18,2);
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
     STEP 1: Compute totals from items
     ------------------------------------------------------------ */
  FOR v_item IN
    SELECT value
    FROM jsonb_array_elements(p_items) AS t(value)
  LOOP
    v_quantity       := COALESCE((v_item->>'quantity')::numeric(18,3), 0);
    v_purchase_price := COALESCE((v_item->>'purchase_price')::numeric(18,2), 0);

    -- Allow caller to pass row_total; otherwise compute it
    v_row_total := COALESCE(
      (v_item->>'row_total')::numeric(18,2),
      v_purchase_price * v_quantity
    );

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
  RETURNING id INTO v_stock_in_id;

  /* ------------------------------------------------------------
     STEP 3 & 4:
       - Insert stock_in_items
       - Update products.stock_quantity
       - Insert stock_transactions (PURCHASE / STOCK_IN)
     ------------------------------------------------------------ */
  FOR v_item IN
    SELECT value
    FROM jsonb_array_elements(p_items) AS t(value)
  LOOP
    v_product_id         := (v_item->>'product_id')::uuid;
    v_purchase_price     := COALESCE((v_item->>'purchase_price')::numeric(18,2), NULL);
    v_selling_price      := COALESCE((v_item->>'selling_price')::numeric(18,2), NULL);
    v_mrp                := COALESCE((v_item->>'mrp')::numeric(18,2), NULL);
    v_manufacturing_date := (v_item->>'manufacturing_date')::date;
    v_quantity           := COALESCE((v_item->>'quantity')::numeric(18,3), 0);

    v_row_total := COALESCE(
      (v_item->>'row_total')::numeric(18,2),
      v_purchase_price * v_quantity
    );

    -- 3.1 Insert line item
    INSERT INTO public.stock_in_items (
      stock_in_id,
      product_id,
      purchase_price,
      selling_price,
      mrp,
      manufacturing_date,
      quantity,
      row_total
    )
    VALUES (
      v_stock_in_id,
      v_product_id,
      v_purchase_price,
      v_selling_price,
      v_mrp,
      v_manufacturing_date,
      v_quantity,
      v_row_total
    );

    -- 3.2 Update product stock
    UPDATE public.products
    SET stock_quantity = COALESCE(stock_quantity, 0) + v_quantity
    WHERE id = v_product_id;

    -- 3.3 Insert stock transaction
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
      v_quantity,           -- positive = stock in
      'STOCK_IN',
      v_stock_in_id,        -- header id as reference
      p_invoice_number
    );
  END LOOP;

  RETURN v_stock_in_id;
END;
$$;

COMMENT ON FUNCTION public.create_stock_in(
  date, uuid, text, text, uuid, jsonb
) IS
  'Creates a stock_in purchase entry with items, updates products.stock_quantity, and logs PURCHASE stock_transactions in a single transaction.';

