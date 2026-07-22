-- =============================================================================
-- 80_product_batch_name.sql
-- Optional editable batch name. Default = 'Batch {seq}'. User may rename.
-- =============================================================================

BEGIN;

ALTER TABLE public.product_batches
  ADD COLUMN IF NOT EXISTS name text;

UPDATE public.product_batches
SET name = 'Batch ' || batch_seq::text
WHERE name IS NULL OR trim(name) = '';

COMMENT ON COLUMN public.product_batches.name IS
  'Display name for the batch. Defaults to Batch {seq}; user may rename.';

/* -----------------------------------------------------------------------------
   find_or_create_product_batch — optional p_name
   ----------------------------------------------------------------------------- */
DROP FUNCTION IF EXISTS public.find_or_create_product_batch(uuid, uuid, numeric, numeric, numeric);

CREATE OR REPLACE FUNCTION public.find_or_create_product_batch(
  p_company_id     uuid,
  p_product_id     uuid,
  p_purchase_price numeric,
  p_selling_price  numeric,
  p_mrp            numeric,
  p_name           text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_batch_id  uuid;
  v_batch_seq integer;
  v_purchase  numeric(18, 2);
  v_selling   numeric(18, 2);
  v_mrp       numeric(18, 2);
  v_name      text;
BEGIN
  IF p_company_id IS DISTINCT FROM public.get_my_company_id() THEN
    RAISE EXCEPTION 'company_id mismatch for batch creation';
  END IF;

  v_purchase := round(COALESCE(p_purchase_price, 0)::numeric, 2);
  v_selling  := CASE WHEN p_selling_price IS NULL THEN NULL ELSE round(p_selling_price::numeric, 2) END;
  v_mrp      := CASE WHEN p_mrp IS NULL THEN NULL ELSE round(p_mrp::numeric, 2) END;
  v_name     := NULLIF(trim(COALESCE(p_name, '')), '');

  SELECT pb.id
    INTO v_batch_id
    FROM public.product_batches pb
   WHERE pb.company_id = p_company_id
     AND pb.product_id = p_product_id
     AND pb.purchase_price = v_purchase
     AND pb.selling_price IS NOT DISTINCT FROM v_selling
     AND pb.mrp IS NOT DISTINCT FROM v_mrp
   LIMIT 1;

  IF v_batch_id IS NOT NULL THEN
    IF v_name IS NOT NULL THEN
      UPDATE public.product_batches AS pb
      SET name = v_name
      WHERE pb.id = v_batch_id
        AND pb.name IS DISTINCT FROM v_name;
    END IF;
    RETURN v_batch_id;
  END IF;

  SELECT COALESCE(MAX(pb.batch_seq), 0) + 1
    INTO v_batch_seq
    FROM public.product_batches pb
   WHERE pb.company_id = p_company_id
     AND pb.product_id = p_product_id;

  IF v_name IS NULL THEN
    v_name := 'Batch ' || v_batch_seq::text;
  END IF;

  INSERT INTO public.product_batches AS pb (
    company_id,
    product_id,
    batch_seq,
    name,
    purchase_price,
    selling_price,
    mrp,
    quantity_received,
    quantity_remaining
  )
  VALUES (
    p_company_id,
    p_product_id,
    v_batch_seq,
    v_name,
    v_purchase,
    v_selling,
    v_mrp,
    0,
    0
  )
  RETURNING pb.id INTO v_batch_id;

  RETURN v_batch_id;
END;
$$;

COMMENT ON FUNCTION public.find_or_create_product_batch(uuid, uuid, numeric, numeric, numeric, text) IS
  'Returns existing batch for product+price tuple or creates a new batch. Optional p_name sets/renames display name.';

GRANT EXECUTE ON FUNCTION public.find_or_create_product_batch(uuid, uuid, numeric, numeric, numeric, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.find_or_create_product_batch(uuid, uuid, numeric, numeric, numeric, text) TO service_role;

/* -----------------------------------------------------------------------------
   get_product_batches_with_stock — include name
   ----------------------------------------------------------------------------- */
DROP FUNCTION IF EXISTS public.get_product_batches_with_stock(uuid);

CREATE OR REPLACE FUNCTION public.get_product_batches_with_stock(p_product_id uuid)
RETURNS TABLE (
  id                  uuid,
  batch_seq           integer,
  name                text,
  purchase_price      numeric,
  selling_price       numeric,
  mrp                 numeric,
  quantity_remaining  numeric
)
LANGUAGE sql
STABLE
SECURITY INVOKER
AS $$
  SELECT
    pb.id,
    pb.batch_seq,
    COALESCE(NULLIF(trim(pb.name), ''), 'Batch ' || pb.batch_seq::text) AS name,
    pb.purchase_price,
    COALESCE(pb.selling_price, p.selling_price) AS selling_price,
    COALESCE(pb.mrp, p.mrp) AS mrp,
    pb.quantity_remaining
  FROM public.product_batches pb
  INNER JOIN public.products p ON p.id = pb.product_id
  WHERE pb.product_id = p_product_id
    AND pb.company_id = public.get_my_company_id()
    AND pb.quantity_remaining > 0
  ORDER BY pb.batch_seq ASC;
$$;

COMMENT ON FUNCTION public.get_product_batches_with_stock(uuid) IS
  'Batches with remaining stock for a product. Includes display name; selling/MRP fall back to catalog when NULL.';

GRANT EXECUTE ON FUNCTION public.get_product_batches_with_stock(uuid) TO authenticated;

/* -----------------------------------------------------------------------------
   create_stock_in — accept optional batch_name per line
   ----------------------------------------------------------------------------- */
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
  v_company_id    uuid;
  v_batch_id      uuid;

  v_product_id         uuid;
  v_manufacturing_date date;
  v_quantity           numeric(18,3);
  v_row_total          numeric(18,2);
  v_purchase_price     numeric(18,2);
  v_selling_price      numeric(18,2);
  v_mrp                numeric(18,2);
  v_catalog_selling    numeric(18,2);
  v_catalog_mrp        numeric(18,2);
  v_batch_name         text;

  v_total_items   integer        := 0;
  v_total_amount  numeric(18,2)  := 0;
BEGIN
  v_company_id := public.get_my_company_id();

  IF p_items IS NULL
     OR jsonb_typeof(p_items) <> 'array'
     OR jsonb_array_length(p_items) = 0
  THEN
    RAISE EXCEPTION 'p_items must be a non-empty JSON array of line items';
  END IF;

  v_account_id := COALESCE(
    p_account_id,
    (
      SELECT a.id
      FROM public.accounts a
      WHERE a.name = 'Cash in Hand'
        AND a.is_active = true
        AND a.company_id = v_company_id
      LIMIT 1
    )
  );
  IF v_account_id IS NULL THEN
    RAISE EXCEPTION 'No payment account available for this company.';
  END IF;

  FOR v_item IN
    SELECT value FROM jsonb_array_elements(p_items) AS t(value)
  LOOP
    v_quantity  := COALESCE((v_item->>'quantity')::numeric(18,3), 0);
    v_row_total := COALESCE((v_item->>'row_total')::numeric(18,2), 0);
    v_total_items  := v_total_items + 1;
    v_total_amount := v_total_amount + v_row_total;
  END LOOP;

  INSERT INTO public.stock_in (
    date, supplier_id, invoice_number, notes,
    total_items, total_amount, created_by, account_id, company_id
  )
  VALUES (
    p_date, p_supplier_id, p_invoice_number, p_notes,
    v_total_items, v_total_amount, p_created_by, v_account_id, v_company_id
  )
  RETURNING public.stock_in.id INTO v_stock_in_id;

  PERFORM set_config('app.suppress_stock_adjustment', 'true', true);

  FOR v_item IN
    SELECT value FROM jsonb_array_elements(p_items) AS t(value)
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

    v_batch_name := NULLIF(trim(COALESCE(v_item->>'batch_name', '')), '');

    SELECT p.selling_price, p.mrp
      INTO v_catalog_selling, v_catalog_mrp
      FROM public.products AS p
     WHERE p.id = v_product_id;

    v_selling_price := COALESCE(v_selling_price, v_catalog_selling);
    v_mrp := COALESCE(v_mrp, v_catalog_mrp);

    v_batch_id := public.find_or_create_product_batch(
      v_company_id, v_product_id, v_purchase_price, v_selling_price, v_mrp, v_batch_name
    );

    UPDATE public.product_batches AS pb
    SET quantity_received  = pb.quantity_received + v_quantity,
        quantity_remaining = pb.quantity_remaining + v_quantity
    WHERE pb.id = v_batch_id;

    INSERT INTO public.stock_in_items (
      stock_in_id, product_id, manufacturing_date,
      purchase_price, selling_price, mrp, quantity, row_total, company_id, batch_id
    )
    VALUES (
      v_stock_in_id, v_product_id, v_manufacturing_date,
      v_purchase_price, v_selling_price, v_mrp, v_quantity, v_row_total, v_company_id, v_batch_id
    );

    UPDATE public.products AS p
    SET stock_quantity = COALESCE(p.stock_quantity, 0) + v_quantity,
        purchase_price = v_purchase_price,
        selling_price  = COALESCE(v_selling_price, p.selling_price),
        mrp            = COALESCE(v_mrp, p.mrp)
    WHERE p.id = v_product_id;

    INSERT INTO public.stock_transactions (
      product_id, transaction_type, quantity,
      reference_type, reference_id, notes, company_id, batch_id
    )
    VALUES (
      v_product_id, 'PURCHASE', v_quantity,
      'STOCK_IN', v_stock_in_id, p_invoice_number, v_company_id, v_batch_id
    );
  END LOOP;

  RETURN QUERY SELECT v_stock_in_id;
END;
$$;

COMMENT ON FUNCTION public.create_stock_in(date, jsonb, uuid, text, text, uuid, uuid) IS
  'Creates stock-in with batch merge. Optional batch_name per line sets/renames the batch display name.';

COMMIT;
