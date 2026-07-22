/* =============================================================================
   MODULE — BILL RETURNS & REFUNDS (PHASE 5)
   Migration: bill_returns, bill_return_items tables with stock restoration,
   return quantity validation, and bill status updates.

   - bill_returns:      return header (bill_id, return_number, amounts, refund method)
   - bill_return_items: line items per return
   - Stock:             on bill_return_items INSERT, restore products.stock_quantity
   - Validation:        prevent returning more than sold per bill_item
   - Bill update:       update bills.status, returned_at, return_note on return
   ============================================================================= */

/* -----------------------------------------------------------------------------
   STEP 1: Add PARTIAL_RETURN to bills.status (existing: PENDING, PARTIALLY_PAID, PAID, RETURNED)
   ----------------------------------------------------------------------------- */
ALTER TABLE public.bills
  DROP CONSTRAINT IF EXISTS bills_status_check;

ALTER TABLE public.bills
  ADD CONSTRAINT bills_status_check CHECK (
    status IN ('PENDING', 'PARTIALLY_PAID', 'PAID', 'RETURNED', 'PARTIAL_RETURN')
  );

COMMENT ON COLUMN public.bills.status IS 'PENDING, PARTIALLY_PAID, PAID, RETURNED, or PARTIAL_RETURN.';

/* -----------------------------------------------------------------------------
   STEP 2: CREATE bill_returns TABLE
   ----------------------------------------------------------------------------- */
CREATE TABLE IF NOT EXISTS public.bill_returns (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_id              uuid NOT NULL REFERENCES public.bills(id) ON DELETE CASCADE,
  return_number        varchar(50) UNIQUE NOT NULL,
  return_note          text,
  total_return_amount  numeric(18, 2) NOT NULL CHECK (total_return_amount >= 0),
  refund_method        text NOT NULL DEFAULT 'Cash'
    CHECK (refund_method IN ('Cash', 'UPI', 'Card', 'Mixed')),
  refund_status        varchar(20) NOT NULL DEFAULT 'pending'
    CHECK (refund_status IN ('pending', 'refunded')),
  created_by           uuid NOT NULL REFERENCES public.users(id),
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.bill_returns IS 'Return/refund records for bills.';
COMMENT ON COLUMN public.bill_returns.return_number IS 'Human-readable return number; format R-YYYYMMDD-XXX.';
COMMENT ON COLUMN public.bill_returns.total_return_amount IS 'Sum of returned line items.';
COMMENT ON COLUMN public.bill_returns.refund_method IS 'Cash, UPI, Card, or Mixed.';
COMMENT ON COLUMN public.bill_returns.refund_status IS 'pending or refunded.';

CREATE INDEX IF NOT EXISTS idx_bill_returns_bill_id ON public.bill_returns(bill_id);
CREATE INDEX IF NOT EXISTS idx_bill_returns_created_at ON public.bill_returns(created_at);
CREATE INDEX IF NOT EXISTS idx_bill_returns_return_number ON public.bill_returns(return_number);

DROP TRIGGER IF EXISTS trigger_update_bill_returns_updated_at ON public.bill_returns;
CREATE TRIGGER trigger_update_bill_returns_updated_at
  BEFORE UPDATE ON public.bill_returns
  FOR EACH ROW
  EXECUTE PROCEDURE update_updated_at_column();

/* -----------------------------------------------------------------------------
   STEP 3: Return number generation — R-YYYYMMDD-XXX (similar to bill_number)
   ----------------------------------------------------------------------------- */
CREATE OR REPLACE FUNCTION public.generate_return_number()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_today     date := CURRENT_DATE;
  v_lock_key  bigint := 9000000000 + (to_char(v_today, 'YYYYMMDD')::bigint);
  v_count     integer;
  v_seq       integer;
BEGIN
  IF NEW.return_number IS NOT NULL AND trim(NEW.return_number) <> '' THEN
    RETURN NEW;
  END IF;

  PERFORM pg_advisory_xact_lock(v_lock_key);

  SELECT COUNT(*)::integer
    INTO v_count
    FROM public.bill_returns
   WHERE created_at::date = v_today;

  v_seq := v_count + 1;
  NEW.return_number := 'R-' || to_char(v_today, 'YYYYMMDD') || '-' || lpad(v_seq::text, 3, '0');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_bill_returns_generate_return_number ON public.bill_returns;
CREATE TRIGGER trigger_bill_returns_generate_return_number
  BEFORE INSERT ON public.bill_returns
  FOR EACH ROW
  WHEN (NEW.return_number IS NULL OR NEW.return_number = '')
  EXECUTE PROCEDURE public.generate_return_number();

/* -----------------------------------------------------------------------------
   STEP 4: CREATE bill_return_items TABLE
   ----------------------------------------------------------------------------- */
CREATE TABLE IF NOT EXISTS public.bill_return_items (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  return_id     uuid NOT NULL REFERENCES public.bill_returns(id) ON DELETE CASCADE,
  bill_item_id  uuid NOT NULL REFERENCES public.bill_items(id),
  product_id    uuid NOT NULL REFERENCES public.products(id),
  product_name  text NOT NULL,
  quantity      integer NOT NULL CHECK (quantity > 0),
  unit_price    numeric(18, 2) NOT NULL CHECK (unit_price >= 0),
  line_total    numeric(18, 2) NOT NULL CHECK (line_total >= 0),
  created_at    timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.bill_return_items IS 'Line items per bill return; stock is restored on insert.';

CREATE INDEX IF NOT EXISTS idx_bill_return_items_return_id ON public.bill_return_items(return_id);
CREATE INDEX IF NOT EXISTS idx_bill_return_items_bill_item_id ON public.bill_return_items(bill_item_id);
CREATE INDEX IF NOT EXISTS idx_bill_return_items_product_id ON public.bill_return_items(product_id);

/* -----------------------------------------------------------------------------
   STEP 5: Stock restoration trigger — increase stock when return items inserted
   ----------------------------------------------------------------------------- */
CREATE OR REPLACE FUNCTION public.restore_product_stock()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE public.products
  SET stock_quantity = stock_quantity + NEW.quantity
  WHERE id = NEW.product_id;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.restore_product_stock() IS 'After insert on bill_return_items: increases product stock.';

DROP TRIGGER IF EXISTS trg_restore_stock_after_return ON public.bill_return_items;
CREATE TRIGGER trg_restore_stock_after_return
  AFTER INSERT ON public.bill_return_items
  FOR EACH ROW
  EXECUTE PROCEDURE public.restore_product_stock();

/* -----------------------------------------------------------------------------
   STEP 6: Prevent over-return — validate quantity <= (sold - already returned)
   ----------------------------------------------------------------------------- */
CREATE OR REPLACE FUNCTION public.validate_return_quantity()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  sold_qty     numeric;
  returned_qty integer;
BEGIN
  SELECT quantity INTO sold_qty
  FROM public.bill_items
  WHERE id = NEW.bill_item_id;

  IF sold_qty IS NULL THEN
    RAISE EXCEPTION 'Bill item not found';
  END IF;

  SELECT COALESCE(SUM(quantity), 0)::integer
  INTO returned_qty
  FROM public.bill_return_items
  WHERE bill_item_id = NEW.bill_item_id;

  IF returned_qty + NEW.quantity > sold_qty::integer THEN
    RAISE EXCEPTION 'Return quantity exceeds sold quantity for this item';
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.validate_return_quantity() IS 'Before insert on bill_return_items: ensures return qty <= sold qty - already returned.';

DROP TRIGGER IF EXISTS trg_validate_return_qty ON public.bill_return_items;
CREATE TRIGGER trg_validate_return_qty
  BEFORE INSERT ON public.bill_return_items
  FOR EACH ROW
  EXECUTE PROCEDURE public.validate_return_quantity();

/* -----------------------------------------------------------------------------
   STEP 7: Row Level Security for bill_returns and bill_return_items
   ----------------------------------------------------------------------------- */
ALTER TABLE public.bill_returns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bill_return_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read bill_returns" ON public.bill_returns;
CREATE POLICY "Authenticated users can read bill_returns"
  ON public.bill_returns FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can insert bill_returns" ON public.bill_returns;
CREATE POLICY "Authenticated users can insert bill_returns"
  ON public.bill_returns FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can update bill_returns" ON public.bill_returns;
CREATE POLICY "Authenticated users can update bill_returns"
  ON public.bill_returns FOR UPDATE USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can read bill_return_items" ON public.bill_return_items;
CREATE POLICY "Authenticated users can read bill_return_items"
  ON public.bill_return_items FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can insert bill_return_items" ON public.bill_return_items;
CREATE POLICY "Authenticated users can insert bill_return_items"
  ON public.bill_return_items FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
