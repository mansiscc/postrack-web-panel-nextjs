/* =============================================================================
   MODULE — PRODUCT updated_at + STOCK_IN created_by
   1) When product is added, set updated_at same as created_at (default now()).
   2) When product with opening_stock creates a stock_in row, set created_by to
      the current login user who added the product (passed from app).
   ============================================================================= */

/* -----------------------------------------------------------------------------
   STEP 1: products.updated_at — default to now() so new rows get same as created_at
   ----------------------------------------------------------------------------- */
ALTER TABLE public.products
  ALTER COLUMN updated_at SET DEFAULT now();

-- Backfill existing rows where updated_at is null
UPDATE public.products
SET updated_at = created_at
WHERE updated_at IS NULL;

/* -----------------------------------------------------------------------------
   STEP 2: create_product_with_opening_stock — add p_created_by, set stock_in.created_by
   ----------------------------------------------------------------------------- */
DROP FUNCTION IF EXISTS public.create_product_with_opening_stock(text, text, numeric, numeric, numeric, text, numeric, uuid, numeric, uuid, boolean);

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
  p_created_by          uuid DEFAULT NULL
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

  RETURN QUERY SELECT v_product_id;
END;
$$;

COMMENT ON FUNCTION public.create_product_with_opening_stock(
  text, text, numeric, numeric, numeric, text, numeric, uuid, numeric, uuid, boolean, uuid
) IS
  'Creates a product and, if opening_stock > 0, a stock_in entry with created_by set to the user who added the product. Returns TABLE(id uuid) for PostgREST.';
