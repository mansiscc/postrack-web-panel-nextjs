-- =============================================================================
-- Consolidated migration (module bundle): 0003_inventory_stock.sql
-- Sources merged in order (do not reorder):
--   11_create_stock_in_and_transactions.sql
--   12_add_product_stock_triggers.sql
--   13_add_stock_transactions_policies.sql
--   14_create_stock_in_function.sql
--   15_refactor_opening_stock_to_stock_in.sql
--   16_create_reduce_product_stock_function.sql
--   17_product_opening_stock_rpc_and_adjustment_types.sql
--   18_stock_in_rls_policies.sql
--   19_create_product_with_opening_stock_returns_table.sql
--   20_product_updated_at_and_stock_in_created_by.sql
--   21_create_stock_in_optional_notes.sql
--   22_create_product_with_opening_stock_stock_in_items_columns.sql
--   23_fix_create_stock_in_function_id_ambiguity.sql
--   24_add_unique_constraint_on_products_barcode.sql
-- =============================================================================


-- >>> begin: 11_create_stock_in_and_transactions.sql
/* =============================================================================
   MODULE — STOCK-IN & STOCK MANAGEMENT
   Migration: stock_in, stock_in_items, stock_transactions tables

   - stock_in:        purchase header (date, supplier, invoice, totals)
   - stock_in_items:  line items for each purchase, referencing products
   - stock_transactions: unified stock movement history (PURCHASE, SALE, etc.)

   NOTES:
   - This migration DOES NOT modify the existing products table.
   - Application logic will:
       - Increase products.stock_quantity on stock-in
       - Insert stock_transactions rows for each movement
   ============================================================================= */

/* STEP 1: CREATE stock_in TABLE (purchase headers) */

CREATE TABLE public.stock_in (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date           date NOT NULL,                          -- date of purchase
  supplier_id    uuid,                                   -- optional; may reference a suppliers table in future
  invoice_number text,                                   -- optional
  notes          text,                                   -- optional
  total_items    integer NOT NULL DEFAULT 0,             -- number of distinct line items
  total_amount   numeric(18, 2) NOT NULL DEFAULT 0,      -- sum of row_total across items

  created_by     uuid,                                   -- optional; user who created this entry
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.stock_in IS 'Stock-in (purchase) headers: one row per purchase entry.';
COMMENT ON COLUMN public.stock_in.date IS 'Date of purchase entry (invoice/bill date).';
COMMENT ON COLUMN public.stock_in.total_items IS 'Number of line items in this stock_in.';
COMMENT ON COLUMN public.stock_in.total_amount IS 'Total purchase amount (sum of row_total).';

/* Index: frequently filtered by date for reports */
CREATE INDEX idx_stock_in_date
ON public.stock_in(date);

/* Auto-update updated_at on changes (reuses existing update_updated_at_column()) */
CREATE TRIGGER trigger_update_stock_in_updated_at
BEFORE UPDATE ON public.stock_in
FOR EACH ROW
EXECUTE PROCEDURE update_updated_at_column();


/* =============================================================================
   STEP 2: CREATE stock_in_items TABLE (purchase line items)
   - One row per product in a stock_in (purchase)
   - References stock_in and products
   ============================================================================= */

CREATE TABLE public.stock_in_items (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stock_in_id        uuid NOT NULL,
  product_id         uuid NOT NULL,

  purchase_price     numeric(18, 2) NOT NULL,
  selling_price      numeric(18, 2),        -- snapshot at purchase time; optional
  mrp                numeric(18, 2),        -- snapshot at purchase time; optional
  manufacturing_date date,                  -- optional
  quantity           numeric(18, 3) NOT NULL,
  row_total          numeric(18, 2) NOT NULL,

  created_at         timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.stock_in_items IS 'Stock-in line items: per-product purchase quantities and prices.';
COMMENT ON COLUMN public.stock_in_items.row_total IS 'purchase_price * quantity at time of stock-in.';

/* Foreign keys */
ALTER TABLE public.stock_in_items
  ADD CONSTRAINT fk_stock_in_items_stock_in
  FOREIGN KEY (stock_in_id) REFERENCES public.stock_in(id) ON DELETE CASCADE;

ALTER TABLE public.stock_in_items
  ADD CONSTRAINT fk_stock_in_items_product
  FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE RESTRICT;

/* Indexes:
   - product_id: needed for product-wise stock and purchase history
   - stock_in_id: quick lookup of all items for a header
*/
CREATE INDEX idx_stock_in_items_product_id
ON public.stock_in_items(product_id);

CREATE INDEX idx_stock_in_items_stock_in_id
ON public.stock_in_items(stock_in_id);


/* =============================================================================
   STEP 3: CREATE stock_transactions TABLE (stock movement history)
   - Append-only log of stock movement
   - Application writes rows such as:
       - transaction_type = 'PURCHASE'
       - quantity         = +quantity
       - reference_type   = 'STOCK_IN'
       - reference_id     = stock_in.id
   ============================================================================= */

CREATE TABLE public.stock_transactions (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id       uuid NOT NULL,

  transaction_type text NOT NULL,   -- e.g. OPENING, PURCHASE, SALE, RETURN_IN, RETURN_OUT, ADJUSTMENT
  quantity         numeric(18, 3) NOT NULL,  -- positive = stock in, negative = stock out

  reference_type   text NOT NULL,   -- e.g. 'STOCK_IN', 'BILL', 'ADJUSTMENT'
  reference_id     uuid NOT NULL,   -- points to the source record (e.g. stock_in.id)
  notes            text,

  created_at       timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.stock_transactions IS 'Unified stock movement history (opening, purchase, sale, returns, adjustments).';
COMMENT ON COLUMN public.stock_transactions.transaction_type IS 'OPENING, PURCHASE, SALE, RETURN_IN, RETURN_OUT, ADJUSTMENT, etc.';
COMMENT ON COLUMN public.stock_transactions.quantity IS 'Positive for stock in, negative for stock out.';

/* Foreign key to products (does NOT modify products table) */
ALTER TABLE public.stock_transactions
  ADD CONSTRAINT fk_stock_transactions_product
  FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE RESTRICT;

/* Indexes:
   - product_id: for product-wise movement history and stock reports
   - reference_id: for looking up all movements for a given source record (e.g. one stock_in)
*/
CREATE INDEX idx_stock_transactions_product_id
ON public.stock_transactions(product_id);

CREATE INDEX idx_stock_transactions_reference_id
ON public.stock_transactions(reference_id);


-- <<< end: 11_create_stock_in_and_transactions.sql

-- >>> begin: 12_add_product_stock_triggers.sql
/* =============================================================================
   MODULE — PRODUCT STOCK TRIGGERS
   Migration: triggers to log opening stock and stock adjustments
   into public.stock_transactions when products are created or edited.

   Requirements:
   - On product create with opening stock:
       - Save opening stock into products.stock_quantity (handled by app)
       - Insert stock_transactions row:
           transaction_type = 'OPENING'
           quantity         = opening stock
           reference_type   = 'PRODUCT_CREATE'
           reference_id     = product_id
   - On product edit when stock changes:
       - difference = new_stock - old_stock
       - Update products.stock_quantity (handled by app)
       - Insert stock_transactions row:
           transaction_type = 'ADJUSTMENT'
           quantity         = difference (positive=increase, negative=decrease)
           reference_type   = 'PRODUCT_EDIT'
           reference_id     = product_id
   - If stock does not change, no transaction is created.
   ============================================================================= */

/* -----------------------------------------------------------------------------
   STEP 1: FUNCTION — log_product_opening_stock
   Logs an OPENING transaction when a product is created with non-zero stock_quantity.
   ----------------------------------------------------------------------------- */
CREATE OR REPLACE FUNCTION public.log_product_opening_stock()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_qty numeric(18,3);
BEGIN
  v_qty := COALESCE(NEW.stock_quantity, 0);

  -- Only log when there is a non-zero opening stock
  IF v_qty <> 0 THEN
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
      'OPENING',
      v_qty,
      'PRODUCT_CREATE',
      NEW.id,
      'Opening stock at product creation'
    );
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.log_product_opening_stock() IS
  'Logs an OPENING stock_transactions row when a product is created with non-zero stock_quantity.';

/* Trigger: after insert on products, log opening stock */
CREATE TRIGGER trg_products_opening_stock
AFTER INSERT ON public.products
FOR EACH ROW
EXECUTE FUNCTION public.log_product_opening_stock();


/* -----------------------------------------------------------------------------
   STEP 2: FUNCTION — log_product_stock_adjustment
   Logs an ADJUSTMENT transaction when products.stock_quantity changes on update.
   ----------------------------------------------------------------------------- */
CREATE OR REPLACE FUNCTION public.log_product_stock_adjustment()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_old  numeric(18,3);
  v_new  numeric(18,3);
  v_diff numeric(18,3);
BEGIN
  v_old  := COALESCE(OLD.stock_quantity, 0);
  v_new  := COALESCE(NEW.stock_quantity, 0);
  v_diff := v_new - v_old;

  -- Only log when there is an actual change in stock
  IF v_diff <> 0 THEN
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
      'ADJUSTMENT',
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
  'Logs an ADJUSTMENT stock_transactions row when products.stock_quantity changes on update.';

/* Trigger: after update of stock_quantity on products, log adjustment */
CREATE TRIGGER trg_products_stock_adjustment
AFTER UPDATE OF stock_quantity ON public.products
FOR EACH ROW
EXECUTE FUNCTION public.log_product_stock_adjustment();


-- <<< end: 12_add_product_stock_triggers.sql

-- >>> begin: 13_add_stock_transactions_policies.sql
/* =============================================================================
   MODULE — STOCK TRANSACTIONS RLS
   Migration: Enable row-level security and add policies
   so application code and triggers can insert and read rows
   in public.stock_transactions without RLS violations.

   Fixes error:
   "new row violates row-level security policy for table \"stock_transactions\""
   when inserting products that cause stock_transactions trigger inserts.
   ============================================================================= */

/* STEP 1: ENABLE ROW LEVEL SECURITY (idempotent) */
ALTER TABLE public.stock_transactions ENABLE ROW LEVEL SECURITY;

/* STEP 2: POLICIES */

-- Authenticated users can read stock_transactions
CREATE POLICY "Authenticated users can read stock_transactions"
ON public.stock_transactions
FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Authenticated users can insert stock_transactions
-- (includes inserts performed via triggers on products / stock_in_items)
CREATE POLICY "Authenticated users can insert stock_transactions"
ON public.stock_transactions
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);


-- <<< end: 13_add_stock_transactions_policies.sql

-- >>> begin: 14_create_stock_in_function.sql
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


-- <<< end: 14_create_stock_in_function.sql

-- >>> begin: 15_refactor_opening_stock_to_stock_in.sql
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

-- <<< end: 15_refactor_opening_stock_to_stock_in.sql

-- >>> begin: 16_create_reduce_product_stock_function.sql
/* =============================================================================
   MODULE — REDUCE PRODUCT STOCK (BILLING)
   Migration: create reduce_product_stock function to safely decrease product
   stock during billing and log a SALE stock_transaction.

   - Decreases products.stock_quantity only when sufficient stock exists.
   - Inserts stock_transactions (SALE / BILL) on success.
   - Raises on insufficient stock.
   Does NOT modify existing table structures.
   ============================================================================= */

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
  /* Decrease stock only if enough exists (prevents negative stock) */
  UPDATE public.products
  SET stock_quantity = stock_quantity - p_quantity
  WHERE id = p_product_id
    AND stock_quantity >= p_quantity;

  GET DIAGNOSTICS v_updated = ROW_COUNT;

  IF v_updated = 0 THEN
    RAISE EXCEPTION 'Insufficient stock for product %', p_product_id;
  END IF;

  /* Log SALE transaction linked to the bill */
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
  'Safely decreases product stock by p_quantity for billing; logs SALE stock_transaction. Raises if insufficient stock.';

-- <<< end: 16_create_reduce_product_stock_function.sql

-- >>> begin: 17_product_opening_stock_rpc_and_adjustment_types.sql
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

-- <<< end: 17_product_opening_stock_rpc_and_adjustment_types.sql

-- >>> begin: 18_stock_in_rls_policies.sql
/* =============================================================================
   MODULE — STOCK_IN & STOCK_IN_ITEMS RLS
   Migration: Enable RLS (if not already) and add policies so that
   create_product_with_opening_stock and create_stock_in RPCs can insert
   into stock_in and stock_in_items when called by an authenticated user.

   Fixes error:
   "new row violates row-level security policy for table \"stock_in\""
   ============================================================================= */

/* -----------------------------------------------------------------------------
   STEP 1: Ensure RLS is enabled on stock_in and stock_in_items
   ----------------------------------------------------------------------------- */
ALTER TABLE public.stock_in ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_in_items ENABLE ROW LEVEL SECURITY;

/* -----------------------------------------------------------------------------
   STEP 2: Policies for stock_in — authenticated users can read and insert
   ----------------------------------------------------------------------------- */
DROP POLICY IF EXISTS "Authenticated users can read stock_in" ON public.stock_in;
CREATE POLICY "Authenticated users can read stock_in"
ON public.stock_in
FOR SELECT
USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can insert stock_in" ON public.stock_in;
CREATE POLICY "Authenticated users can insert stock_in"
ON public.stock_in
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

/* -----------------------------------------------------------------------------
   STEP 3: Policies for stock_in_items — authenticated users can read and insert
   ----------------------------------------------------------------------------- */
DROP POLICY IF EXISTS "Authenticated users can read stock_in_items" ON public.stock_in_items;
CREATE POLICY "Authenticated users can read stock_in_items"
ON public.stock_in_items
FOR SELECT
USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can insert stock_in_items" ON public.stock_in_items;
CREATE POLICY "Authenticated users can insert stock_in_items"
ON public.stock_in_items
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

-- <<< end: 18_stock_in_rls_policies.sql

-- >>> begin: 19_create_product_with_opening_stock_returns_table.sql
/* =============================================================================
   MODULE — RPC RETURN AS TABLE FOR POSTGREST
   PostgREST returns scalar RPC results as a raw JSON value (e.g. "uuid-string"),
   which supabase-kt decodeSingle<String>() cannot parse (it expects an array).
   Change create_product_with_opening_stock to RETURNS TABLE(id uuid) so the
   response is [{"id": "uuid"}], which the client can decode.
   Must DROP first because return type cannot be changed with CREATE OR REPLACE.
   ============================================================================= */

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
  p_is_active           boolean DEFAULT true
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

  RETURN QUERY SELECT v_product_id;
END;
$$;

COMMENT ON FUNCTION public.create_product_with_opening_stock(
  text, text, numeric, numeric, numeric, text, numeric, uuid, numeric, uuid, boolean
) IS
  'Creates a product and, if opening_stock > 0, a stock_in entry. Returns TABLE(id uuid) for PostgREST compatibility.';

-- <<< end: 19_create_product_with_opening_stock_returns_table.sql

-- >>> begin: 20_product_updated_at_and_stock_in_created_by.sql
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

-- <<< end: 20_product_updated_at_and_stock_in_created_by.sql

-- >>> begin: 21_create_stock_in_optional_notes.sql
/* =============================================================================
   create_stock_in: optional parameters for RPC compatibility.
   stock_in_items: remove purchase_price, selling_price, mrp (keep quantity, row_total).

   Optional (DEFAULT NULL): Supplier (p_supplier_id), Invoice No (p_invoice_number),
   Notes (p_notes), Created By (p_created_by). Required: Date (p_date), Items (p_items).
   In PostgreSQL, all parameters after the first one with DEFAULT must have DEFAULT;
   therefore required params (p_date, p_items) come first, then optional params.
   ============================================================================= */

/* -----------------------------------------------------------------------------
   STEP 1: Drop purchase_price, selling_price, mrp from stock_in_items
   ----------------------------------------------------------------------------- */
ALTER TABLE public.stock_in_items
  DROP COLUMN IF EXISTS purchase_price,
  DROP COLUMN IF EXISTS selling_price,
  DROP COLUMN IF EXISTS mrp;

/* -----------------------------------------------------------------------------
   STEP 2: create_stock_in — drop existing (to allow changing return type), then create
   ----------------------------------------------------------------------------- */
-- Original from migration 14: (date, uuid, text, text, uuid, jsonb) RETURNS uuid
DROP FUNCTION IF EXISTS public.create_stock_in(date, uuid, text, text, uuid, jsonb);
-- Current from this migration: (date, jsonb, uuid, text, text, uuid)
DROP FUNCTION IF EXISTS public.create_stock_in(date, jsonb, uuid, text, text, uuid);

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
  RETURNING id INTO v_stock_in_id;

  /* ------------------------------------------------------------
     STEP 3 & 4: stock_in_items (no purchase_price/selling_price/mrp),
     products.stock_quantity, stock_transactions
     ------------------------------------------------------------ */
  FOR v_item IN
    SELECT value
    FROM jsonb_array_elements(p_items) AS t(value)
  LOOP
    v_product_id         := (v_item->>'product_id')::uuid;
    v_manufacturing_date  := CASE WHEN NULLIF(trim(v_item->>'manufacturing_date'), '') IS NOT NULL
                                  THEN (v_item->>'manufacturing_date')::date ELSE NULL END;
    v_quantity           := COALESCE((v_item->>'quantity')::numeric(18,3), 0);
    v_row_total          := COALESCE((v_item->>'row_total')::numeric(18,2), 0);

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

    UPDATE public.products
    SET stock_quantity = COALESCE(stock_quantity, 0) + v_quantity
    WHERE id = v_product_id;

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

-- <<< end: 21_create_stock_in_optional_notes.sql

-- >>> begin: 22_create_product_with_opening_stock_stock_in_items_columns.sql
/* =============================================================================
   Fix create_product_with_opening_stock: stock_in_items no longer has
   purchase_price, selling_price, mrp (dropped in migration 21).
   Insert only: stock_in_id, product_id, manufacturing_date, quantity, row_total.
   ============================================================================= */

DROP FUNCTION IF EXISTS public.create_product_with_opening_stock(text, text, numeric, numeric, numeric, text, numeric, uuid, numeric, uuid, boolean, uuid);

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
      manufacturing_date,
      quantity,
      row_total
    )
    VALUES (
      v_stock_in_id,
      v_product_id,
      NULL,
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
  'Creates a product and, if opening_stock > 0, a stock_in entry (stock_in_items: product_id, quantity, row_total only) with created_by set to the user who added the product. Returns TABLE(id uuid) for PostgREST.';

-- <<< end: 22_create_product_with_opening_stock_stock_in_items_columns.sql

-- >>> begin: 23_fix_create_stock_in_function_id_ambiguity.sql
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
-- <<< end: 23_fix_create_stock_in_function_id_ambiguity.sql

-- >>> begin: 24_add_unique_constraint_on_products_barcode.sql
/* =============================================================================
   Migration 24: Ensure unique product barcodes

   - Adds a UNIQUE constraint on products.barcode so that
     no two products can share the same non-null barcode.

   NOTE:
   - Column remains nullable; PostgreSQL allows multiple NULL values.
   - If this migration fails because of existing duplicates, clean up
     duplicated barcodes first, then re-run the migration.
   ============================================================================= */

ALTER TABLE public.products
ADD CONSTRAINT uq_products_barcode UNIQUE (barcode);


-- <<< end: 24_add_unique_constraint_on_products_barcode.sql
