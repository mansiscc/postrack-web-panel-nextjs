/* =============================================================================
   MODULE — REFACTOR OPENING STOCK TO STOCK-IN
   Migration: Remove opening-stock trigger; add create_product_with_opening_stock RPC
   so opening stock appears in the Stock-In screen (stock_in / stock_in_items).

   - Drop trigger trg_products_opening_stock and function log_product_opening_stock()
   - Create create_product_with_opening_stock(...) that:
       - Inserts product with stock_quantity = opening_stock
       - If opening_stock > 0: creates stock_in, stock_in_items, stock_transactions
       - Returns created product id
   Does NOT modify table structures of stock_in, stock_in_items, stock_transactions.
   ============================================================================= */

/* -----------------------------------------------------------------------------
   STEP 1: Remove existing opening stock trigger and function
   ----------------------------------------------------------------------------- */
DROP TRIGGER IF EXISTS trg_products_opening_stock ON public.products;
DROP FUNCTION IF EXISTS public.log_product_opening_stock();

/* -----------------------------------------------------------------------------
   STEP 2: Create create_product_with_opening_stock RPC
   ----------------------------------------------------------------------------- */
CREATE OR REPLACE FUNCTION public.create_product_with_opening_stock(
  p_name                text,
  p_barcode             text,
  p_purchase_price      numeric,
  p_selling_price       numeric,
  p_mrp                 numeric,
  p_unit                text,
  p_low_stock_alert_qty numeric DEFAULT 0,
  p_product_category_id uuid DEFAULT NULL,
  p_opening_stock       numeric DEFAULT 0
)
RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
  v_product_id   uuid;
  v_stock_in_id  uuid;
BEGIN
  /* Step 1 — Insert product */
  v_product_id := gen_random_uuid();

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
    stock_quantity
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
    COALESCE(p_opening_stock, 0)
  );

  /* Step 2 & 3 & 4 — If opening_stock > 0: stock_in, stock_in_items, stock_transactions */
  IF COALESCE(p_opening_stock, 0) > 0 THEN
    v_stock_in_id := gen_random_uuid();

    INSERT INTO public.stock_in (
      id,
      date,
      supplier_id,
      invoice_number,
      notes,
      total_items,
      total_amount
    )
    VALUES (
      v_stock_in_id,
      CURRENT_DATE,
      NULL,
      'OPENING',
      'Opening stock from product creation',
      1,
      COALESCE(p_purchase_price, 0) * p_opening_stock
    );

    INSERT INTO public.stock_in_items (
      stock_in_id,
      product_id,
      purchase_price,
      selling_price,
      mrp,
      quantity,
      row_total
    )
    VALUES (
      v_stock_in_id,
      v_product_id,
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

  /* Step 5 — Return created product id */
  RETURN v_product_id;
END;
$$;

COMMENT ON FUNCTION public.create_product_with_opening_stock(
  text, text, numeric, numeric, numeric, text, numeric, uuid, numeric
) IS
  'Creates a product and, if opening_stock > 0, a stock_in entry (invoice OPENING) with one stock_in_item and an OPENING stock_transaction, so opening stock appears in Stock-In screen. Returns product id.';
