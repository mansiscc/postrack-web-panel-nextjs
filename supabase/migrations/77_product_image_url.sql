/* =============================================================================
   Migration 77 — Product image_url + tenant-aware create_product_with_opening_stock

   - Adds products.image_url for a single product image URL
   - Extends create_product_with_opening_stock with optional p_image_url
   - Keeps multi-tenant company_id + Cash-in-Hand account fallback (migration 51)
   ============================================================================= */

BEGIN;

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS image_url text;

COMMENT ON COLUMN public.products.image_url IS
  'Public URL of the single product image (Cloudinary secure_url). Null when no image.';

-- Drop prior signatures so PostgREST binds the new optional p_image_url param.
DROP FUNCTION IF EXISTS public.create_product_with_opening_stock(
  text, text, numeric, numeric, numeric, text, numeric, uuid, numeric, uuid, boolean, uuid, uuid
);

DROP FUNCTION IF EXISTS public.create_product_with_opening_stock(
  text, text, numeric, numeric, numeric, text, numeric, uuid, numeric, uuid, boolean, uuid, uuid, text
);

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
  p_account_id          uuid DEFAULT NULL,
  p_image_url           text DEFAULT NULL
)
RETURNS TABLE(id uuid)
LANGUAGE plpgsql
AS $$
DECLARE
  v_product_id   uuid;
  v_stock_in_id  uuid;
  v_company_id   uuid;
BEGIN
  v_company_id := public.get_my_company_id();
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
    is_active,
    image_url,
    company_id
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
    COALESCE(p_is_active, true),
    NULLIF(trim(p_image_url), ''),
    v_company_id
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
      created_by,
      account_id,
      company_id
    )
    VALUES (
      v_stock_in_id,
      CURRENT_DATE,
      NULL,
      'OPENING',
      'Opening stock from product creation',
      1,
      COALESCE(p_purchase_price, 0) * p_opening_stock,
      p_created_by,
      COALESCE(
        p_account_id,
        (
          SELECT a.id
          FROM public.accounts a
          WHERE a.name = 'Cash in Hand'
            AND a.is_active = true
            AND a.company_id = v_company_id
          LIMIT 1
        )
      ),
      v_company_id
    );

    INSERT INTO public.stock_in_items (
      stock_in_id,
      product_id,
      manufacturing_date,
      purchase_price,
      selling_price,
      mrp,
      quantity,
      row_total,
      company_id
    )
    VALUES (
      v_stock_in_id,
      v_product_id,
      NULL,
      COALESCE(p_purchase_price, 0),
      p_selling_price,
      p_mrp,
      p_opening_stock,
      COALESCE(p_purchase_price, 0) * p_opening_stock,
      v_company_id
    );

    INSERT INTO public.stock_transactions (
      product_id,
      transaction_type,
      quantity,
      reference_type,
      reference_id,
      notes,
      company_id
    )
    VALUES (
      v_product_id,
      'OPENING',
      p_opening_stock,
      'STOCK_IN',
      v_stock_in_id,
      'Opening stock',
      v_company_id
    );
  END IF;

  RETURN QUERY SELECT v_product_id;
END;
$$;

COMMENT ON FUNCTION public.create_product_with_opening_stock(
  text, text, numeric, numeric, numeric, text, numeric, uuid, numeric, uuid, boolean, uuid, uuid, text
) IS
  'Creates a tenant-scoped product (optional image_url) and, if opening_stock > 0, stock_in with price snapshots. Returns TABLE(id uuid).';

COMMIT;
