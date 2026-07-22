-- =============================================================================
-- Consolidated migration (module bundle): 0017_product_soft_delete_batches_users_analytics.sql
-- Sources merged in order (do not reorder):
--   75_products_soft_delete.sql          (schema only; dashboard superseded by 76)
--   76_dashboard_cash_dues_clarity.sql
--   77_product_image_url.sql             (column only; RPC superseded by 79)
--   78_sales_analytics_summary_rpc.sql   (superseded by 79 section 12)
--   79_product_batches.sql               (merged with 80 for batch name + final RPCs)
--   80_product_batch_name.sql
--   81_get_product_details_rpc.sql
--   82_users_soft_delete.sql
-- =============================================================================


-- >>> begin: 75_products_soft_delete.sql — schema
BEGIN;

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS is_deleted boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.products.is_deleted IS
  'Soft delete flag. When true, product is hidden from default lists and billing search.';

CREATE INDEX IF NOT EXISTS idx_products_is_deleted
  ON public.products(is_deleted);

-- Barcode uniqueness stays on all non-null barcodes (as in migration 51), so
-- soft-deleted products keep their barcode reserved and it cannot be reused
-- until the product is restored or its barcode is changed. Recreated here
-- (idempotent) to guarantee the correct definition.
DROP INDEX IF EXISTS public.uq_products_company_barcode;
CREATE UNIQUE INDEX uq_products_company_barcode
  ON public.products(company_id, barcode)
  WHERE barcode IS NOT NULL;

COMMIT;

-- <<< end: 75 schema


-- >>> begin: 76_dashboard_cash_dues_clarity.sql
DROP FUNCTION IF EXISTS public.get_admin_dashboard_totals(timestamptz, timestamptz, date);

CREATE OR REPLACE FUNCTION public.get_admin_dashboard_totals(
  p_start timestamptz,
  p_end   timestamptz,
  p_today date
)
RETURNS TABLE (
  today_sales numeric,
  today_manual_income numeric,
  today_purchase numeric,
  today_manual_expense numeric,
  today_profit numeric,
  bill_count integer,
  today_returns_count integer,
  today_return_amount numeric,
  cash_total numeric,
  upi_total numeric,
  card_total numeric,
  total_products integer,
  low_stock_count integer,
  out_of_stock_count integer,
  inactive_product_count integer,
  out_of_stock_products jsonb,
  today_sales_revenue numeric,
  today_cogs numeric,
  today_sales_profit numeric,
  today_sales_profit_margin numeric
)
LANGUAGE sql
STABLE
AS $$
WITH
  bills_in_range AS (
    SELECT
      total_payable_amount,
      received_amount_total,
      payment_mode,
      cash_amount,
      online_amount
    FROM public.bills
    WHERE created_at >= p_start
      AND created_at <  p_end
  ),
  bills_totals AS (
    SELECT
      COALESCE(SUM(total_payable_amount), 0)::numeric AS today_sales,
      COUNT(*)::integer AS bill_count,
      -- Payment breakdown: money received on today's bills (not unpaid payable)
      COALESCE(SUM(CASE WHEN payment_mode = 'Cash' THEN received_amount_total ELSE 0 END), 0)::numeric AS cash_total,
      COALESCE(SUM(CASE WHEN payment_mode = 'UPI'  THEN received_amount_total ELSE 0 END), 0)::numeric AS upi_total,
      COALESCE(SUM(CASE WHEN payment_mode = 'Card' THEN received_amount_total ELSE 0 END), 0)::numeric AS card_total,
      COALESCE(SUM(CASE WHEN payment_mode = 'Mixed' THEN cash_amount ELSE 0 END), 0)::numeric AS mixed_cash,
      COALESCE(SUM(CASE WHEN payment_mode = 'Mixed' THEN online_amount ELSE 0 END), 0)::numeric AS mixed_online
    FROM bills_in_range
  ),
  payments_totals AS (
    SELECT
      today_sales,
      bill_count,
      (cash_total + mixed_cash)::numeric AS cash_total,
      (upi_total + mixed_online)::numeric AS upi_total,
      card_total::numeric AS card_total
    FROM bills_totals
  ),
  returns_totals AS (
    SELECT
      COALESCE(COUNT(*), 0)::integer AS today_returns_count,
      COALESCE(SUM(total_return_amount), 0)::numeric AS today_return_amount
    FROM public.bill_returns
    WHERE created_at >= p_start
      AND created_at <  p_end
  ),
  manual_income AS (
    SELECT COALESCE(SUM(amount), 0)::numeric AS today_manual_income
    FROM public.entries
    WHERE is_deleted = false
      AND entry_type = 'income'
      AND source_type = 'manual'
      AND entry_date = p_today
  ),
  purchase_expense AS (
    SELECT COALESCE(SUM(amount), 0)::numeric AS today_purchase
    FROM public.entries
    WHERE is_deleted = false
      AND entry_type = 'expense'
      AND source_type = 'purchase'
      AND entry_date = p_today
  ),
  manual_expense AS (
    SELECT COALESCE(SUM(amount), 0)::numeric AS today_manual_expense
    FROM public.entries
    WHERE is_deleted = false
      AND entry_type = 'expense'
      AND source_type = 'manual'
      AND entry_date = p_today
  ),
  sold_items AS (
    SELECT
      bi.quantity,
      COALESCE(p.purchase_price, 0)::numeric AS purchase_price
    FROM public.bill_items bi
    INNER JOIN public.bills b ON b.id = bi.bill_id
    LEFT JOIN public.products p ON p.id = bi.product_id
    WHERE b.created_at >= p_start
      AND b.created_at <  p_end
  ),
  sold_totals AS (
    SELECT
      COALESCE(SUM(quantity * purchase_price), 0)::numeric AS gross_cogs
    FROM sold_items
  ),
  -- Bill-level revenue after discount / other items (matches Bills Total)
  billed_revenue AS (
    SELECT COALESCE(SUM(total_payable_amount), 0)::numeric AS gross_billed_revenue
    FROM bills_in_range
  ),
  returned_items AS (
    SELECT
      bri.line_total,
      bri.quantity,
      COALESCE(p.purchase_price, 0)::numeric AS purchase_price
    FROM public.bill_return_items bri
    INNER JOIN public.bill_returns br ON br.id = bri.return_id
    LEFT JOIN public.products p ON p.id = bri.product_id
    WHERE br.created_at >= p_start
      AND br.created_at <  p_end
  ),
  returned_totals AS (
    SELECT
      COALESCE(SUM(line_total), 0)::numeric AS return_revenue,
      COALESCE(SUM(quantity * purchase_price), 0)::numeric AS return_cogs
    FROM returned_items
  ),
  sales_profit AS (
    SELECT
      (br.gross_billed_revenue - rt.return_revenue)::numeric AS today_sales_revenue,
      (st.gross_cogs - rt.return_cogs)::numeric AS today_cogs,
      (br.gross_billed_revenue - rt.return_revenue - st.gross_cogs + rt.return_cogs)::numeric AS today_sales_profit
    FROM billed_revenue br
    CROSS JOIN sold_totals st
    CROSS JOIN returned_totals rt
  )

SELECT
  p.today_sales,
  mi.today_manual_income,
  pe.today_purchase,
  me.today_manual_expense,
  -- Profit on goods sold + extra income − other expense (returns already netted in sales_profit)
  (sp.today_sales_profit + mi.today_manual_income - me.today_manual_expense)::numeric AS today_profit,
  p.bill_count,
  r.today_returns_count,
  r.today_return_amount,
  p.cash_total,
  p.upi_total,
  p.card_total,

  (SELECT COUNT(*)::integer
     FROM public.products
     WHERE is_active = true AND is_deleted = false
  ) AS total_products,
  (SELECT COUNT(*)::integer
     FROM public.products
     WHERE is_active = true
       AND is_deleted = false
       AND COALESCE(stock_quantity, 0) > 0
       AND COALESCE(stock_quantity, 0) <= COALESCE(low_stock_alert_qty, 0)
  ) AS low_stock_count,
  (SELECT COUNT(*)::integer
     FROM public.products
     WHERE is_active = true
       AND is_deleted = false
       AND COALESCE(stock_quantity, 0) <= 0
  ) AS out_of_stock_count,
  (SELECT COUNT(*)::integer
     FROM public.products
     WHERE is_active = false AND is_deleted = false
  ) AS inactive_product_count,
  (
    SELECT COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'name', t.name,
          'stock_quantity', COALESCE(t.stock_quantity, 0)::double precision
        )
        ORDER BY t.name
      ),
      '[]'::jsonb
    )
    FROM (
      SELECT name, stock_quantity
      FROM public.products
      WHERE is_active = true
        AND is_deleted = false
        AND COALESCE(stock_quantity, 0) <= 0
        AND name IS NOT NULL
      ORDER BY name
      LIMIT 10
    ) t
  ) AS out_of_stock_products,

  sp.today_sales_revenue,
  sp.today_cogs,
  sp.today_sales_profit,
  CASE
    WHEN sp.today_sales_revenue > 0
    THEN round((sp.today_sales_profit / sp.today_sales_revenue) * 100.0, 1)
    ELSE 0::numeric
  END AS today_sales_profit_margin
FROM payments_totals p
JOIN returns_totals r ON true
JOIN manual_income mi ON true
JOIN purchase_expense pe ON true
JOIN manual_expense me ON true
CROSS JOIN sales_profit sp;
$$;

COMMENT ON FUNCTION public.get_admin_dashboard_totals(timestamptz, timestamptz, date) IS
  'Admin home dashboard totals. today_sales = billed payable; payment mode uses received; '
  'today_profit = sales profit + manual income - manual expense; sales profit nets returns.';

-- <<< end: 76


-- >>> begin: 77_product_image_url.sql — column

BEGIN;

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS image_url text;

COMMENT ON COLUMN public.products.image_url IS
  'Public URL of the single product image (Cloudinary secure_url). Null when no image.';

COMMIT;

-- <<< end: 77


-- >>> begin: 79_product_batches.sql + 80_product_batch_name.sql

BEGIN;

/* -----------------------------------------------------------------------------
   1) product_batches table
   ----------------------------------------------------------------------------- */
CREATE TABLE IF NOT EXISTS public.product_batches (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id          uuid NOT NULL REFERENCES public.companies(id),
  product_id          uuid NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  batch_seq           integer NOT NULL,
  name                text,
  purchase_price      numeric(18, 2) NOT NULL,
  selling_price       numeric(18, 2),
  mrp                 numeric(18, 2),
  quantity_received   numeric(18, 3) NOT NULL DEFAULT 0,
  quantity_remaining  numeric(18, 3) NOT NULL DEFAULT 0,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_product_batches_qty_received CHECK (quantity_received >= 0),
  CONSTRAINT chk_product_batches_qty_remaining CHECK (quantity_remaining >= 0),
  CONSTRAINT chk_product_batches_qty_remaining_lte_received
    CHECK (quantity_remaining <= quantity_received)
);

COMMENT ON COLUMN public.product_batches.name IS
  'Display name for the batch. Defaults to Batch {seq}; user may rename.';

COMMENT ON TABLE public.product_batches IS
  'Price-based inventory batches. Same product + same purchase/selling/MRP shares one batch; any price change creates a new batch.';

CREATE UNIQUE INDEX IF NOT EXISTS uq_product_batches_price_key
  ON public.product_batches (
    company_id,
    product_id,
    purchase_price,
    COALESCE(selling_price, -1::numeric),
    COALESCE(mrp, -1::numeric)
  );

CREATE UNIQUE INDEX IF NOT EXISTS uq_product_batches_product_seq
  ON public.product_batches (company_id, product_id, batch_seq);

CREATE INDEX IF NOT EXISTS idx_product_batches_product_id
  ON public.product_batches (product_id);

CREATE INDEX IF NOT EXISTS idx_product_batches_company_product_remaining
  ON public.product_batches (company_id, product_id)
  WHERE quantity_remaining > 0;

DROP TRIGGER IF EXISTS trigger_update_product_batches_updated_at ON public.product_batches;
CREATE TRIGGER trigger_update_product_batches_updated_at
  BEFORE UPDATE ON public.product_batches
  FOR EACH ROW
  EXECUTE PROCEDURE public.update_updated_at_column();

/* -----------------------------------------------------------------------------
   2) Link batches to stock_in_items, bill_items, stock_transactions
   ----------------------------------------------------------------------------- */
ALTER TABLE public.stock_in_items
  ADD COLUMN IF NOT EXISTS batch_id uuid REFERENCES public.product_batches(id) ON DELETE RESTRICT;

ALTER TABLE public.bill_items
  ADD COLUMN IF NOT EXISTS batch_id uuid REFERENCES public.product_batches(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS unit_cost numeric(18, 2);

COMMENT ON COLUMN public.bill_items.batch_id IS
  'Inventory batch sold from; required for catalog lines with batch tracking.';
COMMENT ON COLUMN public.bill_items.unit_cost IS
  'Unit purchase/cost at sale time (from batch purchase_price). Used for accurate COGS.';

ALTER TABLE public.stock_transactions
  ADD COLUMN IF NOT EXISTS batch_id uuid REFERENCES public.product_batches(id) ON DELETE SET NULL;

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
   5) reduce_product_stock — deduct from batch + product
   ----------------------------------------------------------------------------- */
CREATE OR REPLACE FUNCTION public.reduce_product_stock(
  p_product_id   uuid,
  p_quantity     numeric,
  p_bill_id      uuid,
  p_batch_id     uuid DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_updated       integer;
  v_batch_updated integer;
  v_company_id    uuid;
BEGIN
  PERFORM set_config('app.suppress_stock_adjustment', 'true', true);

  IF p_batch_id IS NOT NULL THEN
    UPDATE public.product_batches
    SET quantity_remaining = quantity_remaining - p_quantity
    WHERE id = p_batch_id
      AND product_id = p_product_id
      AND quantity_remaining >= p_quantity;

    GET DIAGNOSTICS v_batch_updated = ROW_COUNT;

    IF v_batch_updated = 0 THEN
      RAISE EXCEPTION 'Insufficient batch stock for batch % product %', p_batch_id, p_product_id;
    END IF;
  END IF;

  UPDATE public.products
  SET stock_quantity = stock_quantity - p_quantity
  WHERE id = p_product_id
    AND stock_quantity >= p_quantity;

  GET DIAGNOSTICS v_updated = ROW_COUNT;

  IF v_updated = 0 THEN
    RAISE EXCEPTION 'Insufficient stock for product %', p_product_id;
  END IF;

  SELECT p.company_id INTO v_company_id FROM public.products p WHERE p.id = p_product_id;

  INSERT INTO public.stock_transactions (
    product_id,
    transaction_type,
    quantity,
    reference_type,
    reference_id,
    notes,
    company_id,
    batch_id
  )
  VALUES (
    p_product_id,
    'SALE',
    -p_quantity,
    'BILL',
    p_bill_id,
    'POS sale',
    v_company_id,
    p_batch_id
  );

  RETURN true;
END;
$fn$;

COMMENT ON FUNCTION public.reduce_product_stock(uuid, numeric, uuid, uuid) IS
  'Decreases batch (if batch_id) and product stock; logs SALE. SECURITY DEFINER.';

REVOKE ALL ON FUNCTION public.reduce_product_stock(uuid, numeric, uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reduce_product_stock(uuid, numeric, uuid, uuid) FROM anon;
REVOKE ALL ON FUNCTION public.reduce_product_stock(uuid, numeric, uuid, uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.reduce_product_stock(uuid, numeric, uuid, uuid) TO service_role;

-- Drop old 3-arg overload if present
DROP FUNCTION IF EXISTS public.reduce_product_stock(uuid, numeric, uuid);

/* -----------------------------------------------------------------------------
   6) bill_items triggers — set unit_cost, deduct batch stock
   ----------------------------------------------------------------------------- */
CREATE OR REPLACE FUNCTION public.trigger_bill_items_set_unit_cost()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.batch_id IS NOT NULL AND NEW.unit_cost IS NULL THEN
    SELECT pb.purchase_price
      INTO NEW.unit_cost
      FROM public.product_batches pb
     WHERE pb.id = NEW.batch_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bill_items_set_unit_cost ON public.bill_items;
CREATE TRIGGER trg_bill_items_set_unit_cost
  BEFORE INSERT ON public.bill_items
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_bill_items_set_unit_cost();

CREATE OR REPLACE FUNCTION public.trigger_bill_items_deduct_stock()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.product_id IS NULL OR public.is_manual_bill_product(NEW.product_id) THEN
    RETURN NEW;
  END IF;

  PERFORM public.reduce_product_stock(
    NEW.product_id,
    NEW.quantity,
    NEW.bill_id,
    NEW.batch_id
  );
  RETURN NEW;
END;
$$;

/* -----------------------------------------------------------------------------
   7) restore_product_stock — restore batch on return
   ----------------------------------------------------------------------------- */
CREATE OR REPLACE FUNCTION public.restore_product_stock()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company   uuid;
  v_batch_id  uuid;
BEGIN
  IF NEW.product_id IS NULL OR public.is_manual_bill_product(NEW.product_id) THEN
    RETURN NEW;
  END IF;

  PERFORM set_config('app.suppress_stock_adjustment', 'true', true);

  SELECT bi.batch_id
    INTO v_batch_id
    FROM public.bill_items bi
   WHERE bi.id = NEW.bill_item_id;

  IF v_batch_id IS NOT NULL THEN
    UPDATE public.product_batches
    SET quantity_remaining = quantity_remaining + NEW.quantity
    WHERE id = v_batch_id
      AND product_id = NEW.product_id;
  END IF;

  SELECT br.company_id
    INTO v_company
    FROM public.bill_returns br
   WHERE br.id = NEW.return_id;

  UPDATE public.products
  SET stock_quantity = stock_quantity + NEW.quantity
  WHERE id = NEW.product_id;

  INSERT INTO public.stock_transactions (
    product_id,
    transaction_type,
    quantity,
    reference_type,
    reference_id,
    notes,
    company_id,
    batch_id
  )
  VALUES (
    NEW.product_id,
    'RETURN_IN',
    NEW.quantity,
    'BILL_RETURN',
    NEW.return_id,
    'Bill return',
    v_company,
    v_batch_id
  );

  RETURN NEW;
END;
$$;

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

DROP FUNCTION IF EXISTS public.create_product_with_opening_stock(
  text, text, numeric, numeric, numeric, text, numeric, uuid, numeric, uuid, boolean, uuid, uuid
);

DROP FUNCTION IF EXISTS public.create_product_with_opening_stock(
  text, text, numeric, numeric, numeric, text, numeric, uuid, numeric, uuid, boolean, uuid, uuid, text
);

/* -----------------------------------------------------------------------------
   9) create_product_with_opening_stock — create opening batch
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
  v_batch_id     uuid;
  v_purchase     numeric(18, 2);
BEGIN
  v_company_id := public.get_my_company_id();
  v_product_id := COALESCE(p_id, gen_random_uuid());
  v_purchase := round(COALESCE(p_purchase_price, 0)::numeric, 2);

  INSERT INTO public.products (
    id, name, barcode, purchase_price, selling_price, mrp, unit,
    low_stock_alert_qty, product_category_id, stock_quantity, is_active,
    image_url, company_id
  )
  VALUES (
    v_product_id, p_name, p_barcode, p_purchase_price, p_selling_price, p_mrp, p_unit,
    COALESCE(p_low_stock_alert_qty, 0), p_product_category_id, COALESCE(p_opening_stock, 0),
    COALESCE(p_is_active, true), NULLIF(trim(p_image_url), ''), v_company_id
  );

  IF COALESCE(p_opening_stock, 0) > 0 THEN
    v_batch_id := public.find_or_create_product_batch(
      v_company_id, v_product_id, p_purchase_price, p_selling_price, p_mrp
    );

    UPDATE public.product_batches AS pb
    SET quantity_received  = pb.quantity_received + p_opening_stock,
        quantity_remaining = pb.quantity_remaining + p_opening_stock
    WHERE pb.id = v_batch_id;

    v_stock_in_id := gen_random_uuid();

    INSERT INTO public.stock_in (
      id, date, supplier_id, invoice_number, notes,
      total_items, total_amount, created_by, account_id, company_id
    )
    VALUES (
      v_stock_in_id, CURRENT_DATE, NULL, 'OPENING', 'Opening stock from product creation',
      1, v_purchase * p_opening_stock, p_created_by,
      COALESCE(
        p_account_id,
        (SELECT a.id FROM public.accounts a
         WHERE a.name = 'Cash in Hand' AND a.is_active = true AND a.company_id = v_company_id LIMIT 1)
      ),
      v_company_id
    );

    INSERT INTO public.stock_in_items (
      stock_in_id, product_id, manufacturing_date,
      purchase_price, selling_price, mrp, quantity, row_total, company_id, batch_id
    )
    VALUES (
      v_stock_in_id, v_product_id, NULL,
      v_purchase, p_selling_price, p_mrp, p_opening_stock,
      v_purchase * p_opening_stock, v_company_id, v_batch_id
    );

    INSERT INTO public.stock_transactions (
      product_id, transaction_type, quantity,
      reference_type, reference_id, notes, company_id, batch_id
    )
    VALUES (
      v_product_id, 'OPENING', p_opening_stock,
      'STOCK_IN', v_stock_in_id, 'Opening stock', v_company_id, v_batch_id
    );
  END IF;

  RETURN QUERY SELECT v_product_id;
END;
$$;

-- Legacy opening-stock lines often stored purchase price only. Copy catalog sell/MRP first.
UPDATE public.stock_in_items AS si
SET
  selling_price = COALESCE(si.selling_price, p.selling_price),
  mrp = COALESCE(si.mrp, p.mrp)
FROM public.products AS p
WHERE p.id = si.product_id
  AND (si.selling_price IS NULL OR si.mrp IS NULL);

-- Merge batches that share the same effective price key (e.g. one row had NULL sell/MRP,
-- another already had catalog prices). Prevents uq_product_batches_price_key violations.
DO $$
DECLARE
  grp record;
  v_keep_id   uuid;
  v_dup_id    uuid;
  v_dup_idx   integer;
BEGIN
  FOR grp IN
    SELECT
      pb.company_id,
      pb.product_id,
      round(pb.purchase_price, 2) AS purchase_price,
      round(COALESCE(pb.selling_price, p.selling_price), 2) AS eff_selling,
      round(COALESCE(pb.mrp, p.mrp), 2) AS eff_mrp,
      array_agg(
        pb.id
        ORDER BY
          CASE
            WHEN pb.selling_price IS NOT NULL AND pb.mrp IS NOT NULL THEN 0
            WHEN pb.selling_price IS NOT NULL OR pb.mrp IS NOT NULL THEN 1
            ELSE 2
          END,
          pb.batch_seq ASC,
          pb.created_at ASC
      ) AS batch_ids
    FROM public.product_batches pb
    INNER JOIN public.products p ON p.id = pb.product_id
    GROUP BY
      pb.company_id,
      pb.product_id,
      round(pb.purchase_price, 2),
      round(COALESCE(pb.selling_price, p.selling_price), 2),
      round(COALESCE(pb.mrp, p.mrp), 2)
    HAVING count(*) > 1
  LOOP
    -- Prefer the batch that already has stored prices (avoids unique-index clash on UPDATE).
    v_keep_id := grp.batch_ids[1];

    FOR v_dup_idx IN 2..array_length(grp.batch_ids, 1) LOOP
      v_dup_id := grp.batch_ids[v_dup_idx];

      UPDATE public.product_batches AS keeper
      SET
        quantity_received  = keeper.quantity_received
          + COALESCE((SELECT dup.quantity_received FROM public.product_batches dup WHERE dup.id = v_dup_id), 0),
        quantity_remaining = keeper.quantity_remaining
          + COALESCE((SELECT dup.quantity_remaining FROM public.product_batches dup WHERE dup.id = v_dup_id), 0)
      WHERE keeper.id = v_keep_id;

      UPDATE public.stock_in_items SET batch_id = v_keep_id WHERE batch_id = v_dup_id;
      UPDATE public.bill_items SET batch_id = v_keep_id WHERE batch_id = v_dup_id;
      UPDATE public.stock_transactions SET batch_id = v_keep_id WHERE batch_id = v_dup_id;

      DELETE FROM public.product_batches WHERE id = v_dup_id;
    END LOOP;

    -- Safe after duplicates removed: fill NULL prices on the surviving batch only.
    UPDATE public.product_batches AS keeper
    SET
      selling_price = COALESCE(keeper.selling_price, grp.eff_selling),
      mrp = COALESCE(keeper.mrp, grp.eff_mrp)
    WHERE keeper.id = v_keep_id
      AND (keeper.selling_price IS NULL OR keeper.mrp IS NULL);
  END LOOP;
END;
$$;

-- Fill remaining NULL sell/MRP on batches that had no duplicates to merge.
UPDATE public.product_batches AS pb
SET
  selling_price = COALESCE(pb.selling_price, p.selling_price),
  mrp = COALESCE(pb.mrp, p.mrp)
FROM public.products AS p
WHERE p.id = pb.product_id
  AND (pb.selling_price IS NULL OR pb.mrp IS NULL)
  AND NOT EXISTS (
    SELECT 1
    FROM public.product_batches AS other
    INNER JOIN public.products AS p2 ON p2.id = other.product_id
    WHERE other.id <> pb.id
      AND other.company_id = pb.company_id
      AND other.product_id = pb.product_id
      AND round(other.purchase_price, 2) = round(pb.purchase_price, 2)
      AND round(COALESCE(other.selling_price, p2.selling_price), 2)
        IS NOT DISTINCT FROM round(COALESCE(pb.selling_price, p.selling_price), 2)
      AND round(COALESCE(other.mrp, p2.mrp), 2)
        IS NOT DISTINCT FROM round(COALESCE(pb.mrp, p.mrp), 2)
  );

DO $$
DECLARE
  r record;
  v_batch_id uuid;
  v_batch_seq integer;
  v_sold numeric(18,3);
  v_alloc numeric(18,3);
  v_remaining numeric(18,3);
  b record;
BEGIN
  FOR r IN
    SELECT DISTINCT
      si.company_id,
      si.product_id,
      round(si.purchase_price, 2) AS purchase_price,
      round(COALESCE(si.selling_price, p.selling_price), 2) AS selling_price,
      round(COALESCE(si.mrp, p.mrp), 2) AS mrp
    FROM public.stock_in_items si
    INNER JOIN public.products p ON p.id = si.product_id
    WHERE p.barcode IS DISTINCT FROM '__MANUAL_BILL__'
  LOOP
    SELECT pb.id
      INTO v_batch_id
      FROM public.product_batches pb
     WHERE pb.company_id = r.company_id
       AND pb.product_id = r.product_id
       AND round(pb.purchase_price, 2) = r.purchase_price
       AND round(pb.selling_price, 2) IS NOT DISTINCT FROM r.selling_price
       AND round(pb.mrp, 2) IS NOT DISTINCT FROM r.mrp
     ORDER BY pb.batch_seq ASC
     LIMIT 1;

    IF v_batch_id IS NULL THEN
      BEGIN
        SELECT COALESCE(MAX(pb.batch_seq), 0) + 1
          INTO v_batch_seq
          FROM public.product_batches pb
         WHERE pb.company_id = r.company_id
           AND pb.product_id = r.product_id;

        INSERT INTO public.product_batches AS pb (
          company_id, product_id, batch_seq,
          purchase_price, selling_price, mrp,
          quantity_received, quantity_remaining
        )
        VALUES (
          r.company_id, r.product_id, v_batch_seq,
          r.purchase_price, r.selling_price, r.mrp,
          0, 0
        )
        RETURNING pb.id INTO v_batch_id;
      EXCEPTION
        WHEN unique_violation THEN
          SELECT pb.id
            INTO v_batch_id
            FROM public.product_batches pb
           WHERE pb.company_id = r.company_id
             AND pb.product_id = r.product_id
             AND round(pb.purchase_price, 2) = r.purchase_price
             AND round(pb.selling_price, 2) IS NOT DISTINCT FROM r.selling_price
             AND round(pb.mrp, 2) IS NOT DISTINCT FROM r.mrp
           ORDER BY pb.batch_seq ASC
           LIMIT 1;
      END;
    END IF;

    UPDATE public.product_batches pb
    SET quantity_received = sub.total_qty,
        quantity_remaining = sub.total_qty
    FROM (
      SELECT COALESCE(SUM(si.quantity), 0) AS total_qty
      FROM public.stock_in_items si
      INNER JOIN public.products p ON p.id = si.product_id
      WHERE si.company_id = r.company_id
        AND si.product_id = r.product_id
        AND round(si.purchase_price, 2) = r.purchase_price
        AND round(COALESCE(si.selling_price, p.selling_price), 2) IS NOT DISTINCT FROM r.selling_price
        AND round(COALESCE(si.mrp, p.mrp), 2) IS NOT DISTINCT FROM r.mrp
    ) sub
    WHERE pb.id = v_batch_id;

    UPDATE public.stock_in_items si
    SET batch_id = v_batch_id
    FROM public.products p
    WHERE si.company_id = r.company_id
      AND si.product_id = r.product_id
      AND p.id = si.product_id
      AND round(si.purchase_price, 2) = r.purchase_price
      AND round(COALESCE(si.selling_price, p.selling_price), 2) IS NOT DISTINCT FROM r.selling_price
      AND round(COALESCE(si.mrp, p.mrp), 2) IS NOT DISTINCT FROM r.mrp
      AND si.batch_id IS DISTINCT FROM v_batch_id;
  END LOOP;

  -- Allocate sold qty across batches (oldest first) so remaining matches products.stock_quantity
  FOR r IN
    SELECT p.id AS product_id, COALESCE(p.stock_quantity, 0) AS current_stock
    FROM public.products p
    WHERE p.barcode IS DISTINCT FROM '__MANUAL_BILL__'
      AND EXISTS (SELECT 1 FROM public.product_batches pb WHERE pb.product_id = p.id)
  LOOP
    SELECT COALESCE(SUM(pb.quantity_received), 0) - r.current_stock
      INTO v_sold
      FROM public.product_batches pb
     WHERE pb.product_id = r.product_id;

    IF v_sold < 0 THEN
      v_sold := 0;
    END IF;

    v_alloc := v_sold;

    FOR b IN
      SELECT pb.id, pb.quantity_received
      FROM public.product_batches pb
      WHERE pb.product_id = r.product_id
      ORDER BY pb.created_at ASC, pb.batch_seq ASC
    LOOP
      IF v_alloc <= 0 THEN
        UPDATE public.product_batches SET quantity_remaining = b.quantity_received WHERE id = b.id;
      ELSE
        v_remaining := GREATEST(b.quantity_received - LEAST(v_alloc, b.quantity_received), 0);
        UPDATE public.product_batches SET quantity_remaining = v_remaining WHERE id = b.id;
        v_alloc := v_alloc - (b.quantity_received - v_remaining);
      END IF;
    END LOOP;
  END LOOP;
END;
$$;

/* -----------------------------------------------------------------------------
   11) RLS for product_batches
   ----------------------------------------------------------------------------- */
ALTER TABLE public.product_batches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS product_batches_select_tenant ON public.product_batches;
CREATE POLICY product_batches_select_tenant ON public.product_batches
  FOR SELECT TO authenticated
  USING (company_id = public.get_my_company_id());

DROP POLICY IF EXISTS product_batches_insert_tenant ON public.product_batches;
CREATE POLICY product_batches_insert_tenant ON public.product_batches
  FOR INSERT TO authenticated
  WITH CHECK (company_id = public.get_my_company_id());

DROP POLICY IF EXISTS product_batches_update_tenant ON public.product_batches;
CREATE POLICY product_batches_update_tenant ON public.product_batches
  FOR UPDATE TO authenticated
  USING (company_id = public.get_my_company_id())
  WITH CHECK (company_id = public.get_my_company_id());


UPDATE public.product_batches
SET name = 'Batch ' || batch_seq::text
WHERE name IS NULL OR trim(name) = '';

COMMIT;

-- <<< end: 79+80


-- >>> begin: 78+79 get_sales_analytics_summary (final)

CREATE OR REPLACE FUNCTION public.get_sales_analytics_summary(
  p_start timestamptz,
  p_end   timestamptz,
  p_bucket text DEFAULT 'day'
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
AS $$
WITH bills_in_range AS (
  SELECT id, total_payable_amount, received_amount_total, payment_mode,
         cash_amount, online_amount, created_at
  FROM public.bills
  WHERE created_at >= p_start AND created_at < p_end
),
bill_totals AS (
  SELECT
    COALESCE(COUNT(*), 0)::integer AS bill_count,
    COALESCE(SUM(total_payable_amount), 0)::numeric AS total_sales,
    COALESCE(SUM(received_amount_total), 0)::numeric AS total_received,
    COALESCE(SUM(CASE WHEN payment_mode = 'Cash' THEN received_amount_total ELSE 0 END), 0)::numeric
      + COALESCE(SUM(CASE WHEN payment_mode = 'Mixed' THEN cash_amount ELSE 0 END), 0)::numeric AS cash_total,
    COALESCE(SUM(CASE WHEN payment_mode = 'UPI' THEN received_amount_total ELSE 0 END), 0)::numeric
      + COALESCE(SUM(CASE WHEN payment_mode = 'Mixed' THEN online_amount ELSE 0 END), 0)::numeric AS upi_total,
    COALESCE(SUM(CASE WHEN payment_mode = 'Card' THEN received_amount_total ELSE 0 END), 0)::numeric AS card_total
  FROM bills_in_range
),
returns_in_range AS (
  SELECT
    COALESCE(COUNT(*), 0)::integer AS return_count,
    COALESCE(SUM(total_return_amount), 0)::numeric AS return_amount
  FROM public.bill_returns
  WHERE created_at >= p_start AND created_at < p_end
),
sold_items AS (
  SELECT
    bi.product_id,
    COALESCE(bi.product_name, 'Unknown') AS product_name,
    COALESCE(SUM(bi.quantity), 0)::numeric AS qty_sold,
    COALESCE(SUM(bi.row_total), 0)::numeric AS revenue,
    COALESCE(SUM(bi.quantity * COALESCE(bi.unit_cost, 0)), 0)::numeric AS cogs_sold
  FROM public.bill_items bi
  INNER JOIN bills_in_range b ON b.id = bi.bill_id
  WHERE bi.product_id IS NOT NULL
    AND NOT public.is_manual_bill_product(bi.product_id)
  GROUP BY bi.product_id, COALESCE(bi.product_name, 'Unknown')
),
returned_items AS (
  SELECT
    bri.product_id,
    COALESCE(SUM(bri.quantity), 0)::numeric AS qty_returned,
    COALESCE(SUM(bri.line_total), 0)::numeric AS return_revenue,
    COALESCE(SUM(
      bri.quantity * COALESCE(bi.unit_cost, COALESCE(p.purchase_price, 0))
    ), 0)::numeric AS cogs_returned
  FROM public.bill_return_items bri
  INNER JOIN public.bill_returns br ON br.id = bri.return_id
  LEFT JOIN public.bill_items bi ON bi.id = bri.bill_item_id
  LEFT JOIN public.products p ON p.id = bri.product_id
  WHERE br.created_at >= p_start AND br.created_at < p_end
    AND bri.product_id IS NOT NULL
    AND NOT public.is_manual_bill_product(bri.product_id)
  GROUP BY bri.product_id
),
product_net AS (
  SELECT
    s.product_id,
    s.product_name,
    GREATEST(s.qty_sold - COALESCE(r.qty_returned, 0), 0)::numeric AS net_qty,
    GREATEST(s.revenue - COALESCE(r.return_revenue, 0), 0)::numeric AS net_revenue,
    GREATEST(s.cogs_sold - COALESCE(r.cogs_returned, 0), 0)::numeric AS cogs
  FROM sold_items s
  LEFT JOIN returned_items r ON r.product_id = s.product_id
),
top_products AS (
  SELECT * FROM product_net ORDER BY net_revenue DESC LIMIT 10
),
trend AS (
  SELECT
    CASE
      WHEN lower(p_bucket) = 'week' THEN to_char(date_trunc('week', created_at), 'IYYY-"W"IW')
      WHEN lower(p_bucket) = 'month' THEN to_char(date_trunc('month', created_at), 'YYYY-MM')
      ELSE to_char(date_trunc('day', created_at), 'YYYY-MM-DD')
    END AS label,
    COALESCE(SUM(total_payable_amount), 0)::numeric AS sales
  FROM bills_in_range
  GROUP BY 1
  ORDER BY 1
)
SELECT jsonb_build_object(
  'bill_count', (SELECT bill_count FROM bill_totals),
  'total_sales', (SELECT total_sales FROM bill_totals),
  'total_received', (SELECT total_received FROM bill_totals),
  'cash_total', (SELECT cash_total FROM bill_totals),
  'upi_total', (SELECT upi_total FROM bill_totals),
  'card_total', (SELECT card_total FROM bill_totals),
  'return_count', (SELECT return_count FROM returns_in_range),
  'return_amount', (SELECT return_amount FROM returns_in_range),
  'net_sales', GREATEST(
    (SELECT total_sales FROM bill_totals) - (SELECT return_amount FROM returns_in_range), 0
  ),
  'cogs', COALESCE((SELECT SUM(cogs) FROM product_net), 0),
  'sales_profit', GREATEST(
    COALESCE((SELECT SUM(net_revenue) FROM product_net), 0)
    - COALESCE((SELECT SUM(cogs) FROM product_net), 0),
    0
  ),
  'top_products', COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'product_id', tp.product_id,
      'product_name', tp.product_name,
      'net_qty', tp.net_qty,
      'net_revenue', tp.net_revenue,
      'cogs', tp.cogs,
      'profit', GREATEST(tp.net_revenue - tp.cogs, 0)
    )) FROM top_products tp
  ), '[]'::jsonb),
  'trend', COALESCE((SELECT jsonb_agg(jsonb_build_object('label', t.label, 'sales', t.sales)) FROM trend t), '[]'::jsonb)
);
$$;

GRANT EXECUTE ON FUNCTION public.get_sales_analytics_summary(timestamptz, timestamptz, text)
  TO authenticated, service_role;

-- <<< end: analytics


-- >>> begin: 81_get_product_details_rpc.sql
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


-- <<< end: 81


-- >>> begin: 82_users_soft_delete.sql
/* =============================================================================
   Migration 82 — User soft delete + conditional hard delete

   - Adds users.is_deleted (default false)
   - Soft delete when user has business references; hard delete otherwise
   - Updates user list view; relaxes prevent_user_delete for controlled hard delete
   ============================================================================= */

BEGIN;

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS is_deleted boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.users.is_deleted IS
  'Soft delete flag. When true, user is hidden from default lists and cannot sign in.';

CREATE INDEX IF NOT EXISTS idx_users_is_deleted
  ON public.users(is_deleted);

CREATE INDEX IF NOT EXISTS idx_users_company_not_deleted
  ON public.users(company_id)
  WHERE is_deleted = false;

/* Allow hard delete only when explicitly enabled (maintenance / delete-user flow). */
CREATE OR REPLACE FUNCTION public.prevent_user_delete()
RETURNS TRIGGER AS $$
BEGIN
  IF current_setting('app.allow_user_hard_delete', true) = 'on' THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'Hard delete not allowed. Use delete_user or set status to Inactive.';
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.user_has_business_references(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.activity_log al WHERE al.user_id = p_user_id
    UNION ALL
    SELECT 1 FROM public.bill_returns br WHERE br.created_by = p_user_id
    UNION ALL
    SELECT 1 FROM public.bills b WHERE b.created_by_user_id = p_user_id
    UNION ALL
    SELECT 1 FROM public.entries e WHERE e.created_by = p_user_id
    UNION ALL
    SELECT 1 FROM public.stock_in si WHERE si.created_by = p_user_id
    UNION ALL
    SELECT 1 FROM public.product_categories pc
      WHERE pc.created_by = p_user_id OR pc.updated_by = p_user_id
    UNION ALL
    SELECT 1 FROM public.accounting_categories ac
      WHERE ac.created_by = p_user_id OR ac.updated_by = p_user_id
    UNION ALL
    SELECT 1 FROM public.accounts a
      WHERE a.created_by = p_user_id OR a.updated_by = p_user_id
    UNION ALL
    SELECT 1 FROM public.users u
      WHERE u.created_by = p_user_id AND u.id <> p_user_id
  );
$$;

COMMENT ON FUNCTION public.user_has_business_references(uuid) IS
  'True when the user is linked to audit/billing/stock/master-data rows; hard delete must not run.';

CREATE OR REPLACE FUNCTION public.hard_delete_user_row(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.user_permissions WHERE user_id = p_user_id;
  PERFORM set_config('app.allow_user_hard_delete', 'on', true);
  DELETE FROM public.users WHERE id = p_user_id;
END;
$$;

COMMENT ON FUNCTION public.hard_delete_user_row(uuid) IS
  'Removes public.users row (and permissions). Caller must delete auth.users separately.';

CREATE OR REPLACE FUNCTION public.restore_user(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id uuid := auth.uid();
  v_caller_company uuid;
  v_target public.users%ROWTYPE;
BEGIN
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT u.company_id INTO v_caller_company
  FROM public.users u
  WHERE u.id = v_caller_id
    AND u.role = 'Admin'
    AND u.status = 'Active'
    AND NOT u.is_deleted;

  IF v_caller_company IS NULL THEN
    RAISE EXCEPTION 'Forbidden – admin only';
  END IF;

  SELECT * INTO v_target FROM public.users WHERE id = p_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  IF v_target.company_id IS DISTINCT FROM v_caller_company THEN
    RAISE EXCEPTION 'Forbidden – different company';
  END IF;

  IF NOT v_target.is_deleted THEN
    RAISE EXCEPTION 'User is not deleted';
  END IF;

  UPDATE public.users
  SET is_deleted = false,
      status = 'Active',
      updated_at = now()
  WHERE id = p_user_id;

  RETURN jsonb_build_object('user_id', p_user_id, 'action', 'restored');
END;
$$;

/* Recreate view: CREATE OR REPLACE cannot insert columns mid-definition (53 → 82). */
DROP VIEW IF EXISTS public.user_list_with_permissions_view;

CREATE VIEW public.user_list_with_permissions_view
WITH (security_invoker = true) AS
SELECT
  u.id AS id,
  u.full_name AS full_name,
  u.email AS email,
  u.phone AS phone,
  u.role AS role,
  u.status AS status,
  u.created_at AS created_at,
  u.updated_at AS updated_at,
  u.created_by AS created_by,
  COALESCE(
    jsonb_agg(up.permission::text ORDER BY up.permission),
    '[]'::jsonb
  ) AS permissions,
  u.company_id AS company_id,
  u.is_deleted AS is_deleted
FROM public.users u
LEFT JOIN public.user_permissions up
  ON up.user_id = u.id
 AND up.granted IS TRUE
GROUP BY
  u.id,
  u.full_name,
  u.email,
  u.phone,
  u.role,
  u.status,
  u.created_at,
  u.updated_at,
  u.created_by,
  u.company_id,
  u.is_deleted;

REVOKE ALL ON FUNCTION public.user_has_business_references(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.user_has_business_references(uuid) TO service_role;

REVOKE ALL ON FUNCTION public.hard_delete_user_row(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.hard_delete_user_row(uuid) TO service_role;

REVOKE ALL ON FUNCTION public.restore_user(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.restore_user(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.restore_user(uuid) TO service_role;

COMMIT;


-- <<< end: 82
