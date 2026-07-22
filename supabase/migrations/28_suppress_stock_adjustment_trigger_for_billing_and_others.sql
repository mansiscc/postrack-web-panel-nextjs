/* =============================================================================
   MODULE — SUPPRESS STOCK ADJUSTMENT TRIGGER FOR BILLING / RETURNS / STOCK-IN

   When a bill is generated, reduce_product_stock() updates products.stock_quantity
   and then inserts a SALE row into stock_transactions. The trigger
   trg_products_stock_adjustment also fires on that UPDATE and inserts an
   ADJUSTMENT_OUT row, so we get two entries (SALE + ADJUSTMENT_OUT) per line.

   Same double-logging can occur for:
   - Stock-in (PURCHASE + ADJUSTMENT_IN)
   - Bill returns (restore_product_stock UPDATE → ADJUSTMENT_IN only, wrong ref)

   Fix: Use a transaction-local GUC so the adjustment trigger skips when the
   update is from reduce_product_stock, restore_product_stock, or create_stock_in.
   ============================================================================= */

/* -----------------------------------------------------------------------------
   STEP 1: log_product_stock_adjustment — skip when suppress flag is set
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
  -- Skip when stock change is from billing, returns, or stock-in (they log their own transaction type)
  IF current_setting('app.suppress_stock_adjustment', true) = 'true' THEN
    RETURN NEW;
  END IF;

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
  'Logs ADJUSTMENT_IN or ADJUSTMENT_OUT when products.stock_quantity changes on update. Skips when app.suppress_stock_adjustment is set (billing, returns, stock-in).';

/* -----------------------------------------------------------------------------
   STEP 2: reduce_product_stock — set flag before UPDATE so only SALE is logged
   ----------------------------------------------------------------------------- */
CREATE OR REPLACE FUNCTION public.reduce_product_stock(
  p_product_id   uuid,
  p_quantity    numeric,
  p_bill_id     uuid
)
RETURNS boolean
LANGUAGE plpgsql
AS $fn$
DECLARE
  v_updated integer;
BEGIN
  PERFORM set_config('app.suppress_stock_adjustment', 'true', true);

  UPDATE public.products
  SET stock_quantity = stock_quantity - p_quantity
  WHERE id = p_product_id
    AND stock_quantity >= p_quantity;

  GET DIAGNOSTICS v_updated = ROW_COUNT;

  IF v_updated = 0 THEN
    RAISE EXCEPTION 'Insufficient stock for product %', p_product_id;
  END IF;

  INSERT INTO public.stock_transactions (
    product_id,
    transaction_type,
    "quantity",
    reference_type,
    reference_id,
    notes
  )
  VALUES (
    p_product_id,
    'SALE',
    -p_quantity,
    'BILL',
    p_bill_id,
    'POS sale'
  );

  RETURN true;
END;
$fn$;

COMMENT ON FUNCTION public.reduce_product_stock(uuid, numeric, uuid) IS
  'Safely decreases product stock by p_quantity for billing; logs SALE stock_transaction. Raises if insufficient stock. Suppresses product adjustment trigger to avoid duplicate ADJUSTMENT_OUT.';

/* -----------------------------------------------------------------------------
   STEP 3: restore_product_stock — set flag before UPDATE (avoids wrong ADJUSTMENT_IN)
   ----------------------------------------------------------------------------- */
CREATE OR REPLACE FUNCTION public.restore_product_stock()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM set_config('app.suppress_stock_adjustment', 'true', true);

  UPDATE public.products
  SET stock_quantity = stock_quantity + NEW.quantity
  WHERE id = NEW.product_id;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.restore_product_stock() IS
  'After insert on bill_return_items: increases product stock. Suppresses adjustment trigger.';

/* -----------------------------------------------------------------------------
   STEP 4: create_stock_in — set flag before UPDATE so only PURCHASE is logged
   ----------------------------------------------------------------------------- */
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
  IF p_items IS NULL
     OR jsonb_typeof(p_items) <> 'array'
     OR jsonb_array_length(p_items) = 0
  THEN
    RAISE EXCEPTION 'p_items must be a non-empty JSON array of line items';
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

  PERFORM set_config('app.suppress_stock_adjustment', 'true', true);

  FOR v_item IN
    SELECT value
    FROM jsonb_array_elements(p_items) AS t(value)
  LOOP
    v_product_id         := (v_item->>'product_id')::uuid;
    v_manufacturing_date  := (v_item->>'manufacturing_date')::date;
    v_quantity            := COALESCE((v_item->>'quantity')::numeric(18,3), 0);
    v_row_total           := COALESCE((v_item->>'row_total')::numeric(18,2), 0);

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
  'Creates a stock_in purchase entry with items, updates products.stock_quantity, and logs PURCHASE stock_transactions. Suppresses adjustment trigger to avoid duplicate ADJUSTMENT_IN.';
