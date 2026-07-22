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

