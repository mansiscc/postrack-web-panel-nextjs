/* =============================================================================
   MODULE — PRODUCT OPENING STOCK RPC & ADJUSTMENT TYPES
   Migration: Extend create_product_with_opening_stock for app use; use
   ADJUSTMENT_IN / ADJUSTMENT_OUT in product stock adjustment trigger.

   1) create_product_with_opening_stock:
       - Add p_id uuid DEFAULT NULL (use as product id when provided)
       - Add p_is_active boolean DEFAULT true
       - Insert is_active into products
   2) log_product_stock_adjustment:
       - transaction_type = 'ADJUSTMENT_IN' when difference > 0
       - transaction_type = 'ADJUSTMENT_OUT' when difference < 0
   ============================================================================= */

/* -----------------------------------------------------------------------------
   STEP 1: Extend create_product_with_opening_stock (p_id, p_is_active)
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
  p_opening_stock       numeric DEFAULT 0,
  p_id                  uuid DEFAULT NULL,
  p_is_active           boolean DEFAULT true
)
RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
  v_product_id   uuid;
  v_stock_in_id  uuid;
BEGIN
  /* Step 1 — Resolve product id and insert product */
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

  RETURN v_product_id;
END;
$$;

COMMENT ON FUNCTION public.create_product_with_opening_stock(
  text, text, numeric, numeric, numeric, text, numeric, uuid, numeric, uuid, boolean
) IS
  'Creates a product and, if opening_stock > 0, a stock_in entry (invoice OPENING) with one stock_in_item and an OPENING stock_transaction. Accepts optional p_id (product id) and p_is_active. Returns product id.';

/* -----------------------------------------------------------------------------
   STEP 2: Use ADJUSTMENT_IN / ADJUSTMENT_OUT in log_product_stock_adjustment
   ----------------------------------------------------------------------------- */
CREATE OR REPLACE FUNCTION public.log_product_stock_adjustment()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_old   numeric(18,3);
  v_new   numeric(18,3);
  v_diff  numeric(18,3);
  v_type  text;
BEGIN
  v_old  := COALESCE(OLD.stock_quantity, 0);
  v_new  := COALESCE(NEW.stock_quantity, 0);
  v_diff := v_new - v_old;

  IF v_diff <> 0 THEN
    v_type := CASE WHEN v_diff > 0 THEN 'ADJUSTMENT_IN' ELSE 'ADJUSTMENT_OUT' END;

    INSERT INTO public.stock_transactions (
      product_id,
      transaction_type,
      quantity,
      reference_type,
      reference_id,
      notes
    )
    VALUES (
      NEW.id,
      v_type,
      v_diff,
      'PRODUCT_EDIT',
      NEW.id,
      'Stock adjusted via product edit'
    );
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.log_product_stock_adjustment() IS
  'Logs ADJUSTMENT_IN or ADJUSTMENT_OUT stock_transactions when products.stock_quantity changes on update.';
