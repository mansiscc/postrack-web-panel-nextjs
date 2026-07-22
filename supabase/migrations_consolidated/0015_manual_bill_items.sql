/* =============================================================================
   Consolidated: manual bill line items, MRP snapshot, bill number format,
   app updates super-admin RLS
   (same as migrations/69 + migrations/70 + migrations/71 + migrations/72 + migrations/73)
   - Manual lines: placeholder product per company (barcode __MANUAL_BILL__); old app safe
   - MRP snapshot: receipt "** Saved Rs. X/- on MRP **" when MRP > unit_price
   - Bill number: <prefix>YYMM-<n> (e.g. B2606-1), per company per month
   - App updates: super_admin manage + activity log (admin panel module)
   ============================================================================= */

BEGIN;

-- >>> begin: 73_manual_bill_placeholder_product.sql (functions first — used by stock triggers)
CREATE OR REPLACE FUNCTION public.is_manual_bill_product(p_product_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.products p
     WHERE p.id = p_product_id
       AND p.barcode = '__MANUAL_BILL__'
  );
$$;

CREATE OR REPLACE FUNCTION public.ensure_manual_bill_product(p_company_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF p_company_id IS NULL THEN
    RAISE EXCEPTION 'company_id is required for manual bill placeholder product';
  END IF;

  SELECT p.id
    INTO v_id
    FROM public.products p
   WHERE p.company_id = p_company_id
     AND p.barcode = '__MANUAL_BILL__'
   LIMIT 1;

  IF v_id IS NOT NULL THEN
    RETURN v_id;
  END IF;

  INSERT INTO public.products (
    company_id,
    name,
    barcode,
    selling_price,
    stock_quantity,
    low_stock_alert_qty,
    is_active
  )
  VALUES (
    p_company_id,
    'Manual Bill Item',
    '__MANUAL_BILL__',
    0,
    0,
    0,
    false
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_manual_bill_product_id()
RETURNS TABLE(id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company uuid := public.get_my_company_id();
BEGIN
  RETURN QUERY SELECT public.ensure_manual_bill_product(v_company);
END;
$$;

REVOKE ALL ON FUNCTION public.get_manual_bill_product_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_manual_bill_product_id() TO authenticated;
-- <<< end: 73_manual_bill_placeholder_product.sql (functions)

-- Manual bill line items (bill_items + bill_return_items)
ALTER TABLE public.bill_items
  ALTER COLUMN product_id DROP NOT NULL;

ALTER TABLE public.bill_items
  DROP CONSTRAINT IF EXISTS fk_bill_items_product;

ALTER TABLE public.bill_items
  ADD CONSTRAINT fk_bill_items_product
    FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE RESTRICT;

COMMENT ON COLUMN public.bill_items.product_id IS
  'Linked catalog product when sold from inventory; __MANUAL_BILL__ placeholder for manual one-off lines (no stock impact).';

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
    NEW.bill_id
  );
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.trigger_bill_items_deduct_stock() IS
  'After insert on bill_items: reduces stock via reduce_product_stock when product_id is set. Skips manual lines (NULL or __MANUAL_BILL__ placeholder). SECURITY DEFINER so staff can complete billing under products UPDATE RLS.';

ALTER TABLE public.bill_return_items
  ALTER COLUMN product_id DROP NOT NULL;

ALTER TABLE public.bill_return_items
  DROP CONSTRAINT IF EXISTS bill_return_items_product_id_fkey;

ALTER TABLE public.bill_return_items
  ADD CONSTRAINT bill_return_items_product_id_fkey
    FOREIGN KEY (product_id) REFERENCES public.products(id);

COMMENT ON COLUMN public.bill_return_items.product_id IS
  'Catalog product restored on return; NULL when the original bill line was manual (no stock impact).';

CREATE OR REPLACE FUNCTION public.restore_product_stock()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company uuid;
BEGIN
  IF NEW.product_id IS NULL OR public.is_manual_bill_product(NEW.product_id) THEN
    RETURN NEW;
  END IF;

  PERFORM set_config('app.suppress_stock_adjustment', 'true', true);

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
    company_id
  )
  VALUES (
    NEW.product_id,
    'RETURN_IN',
    NEW.quantity,
    'BILL_RETURN',
    NEW.return_id,
    'Bill return',
    v_company
  );

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.restore_product_stock() IS
  'After insert on bill_return_items: restores product stock and logs RETURN_IN with company_id when product_id is set. Skips manual lines (NULL or __MANUAL_BILL__ placeholder). SECURITY DEFINER bypasses products UPDATE RLS for staff.';

-- Seed placeholder products + backfill any legacy NULL product_id rows
INSERT INTO public.products (
  company_id,
  name,
  barcode,
  selling_price,
  stock_quantity,
  low_stock_alert_qty,
  is_active
)
SELECT
  c.id,
  'Manual Bill Item',
  '__MANUAL_BILL__',
  0,
  0,
  0,
  false
FROM public.companies c
WHERE NOT EXISTS (
  SELECT 1
    FROM public.products p
   WHERE p.company_id = c.id
     AND p.barcode = '__MANUAL_BILL__'
);

UPDATE public.bill_items bi
SET product_id = public.ensure_manual_bill_product(bi.company_id)
WHERE bi.product_id IS NULL;

UPDATE public.bill_return_items bri
SET product_id = public.ensure_manual_bill_product(bri.company_id)
WHERE bri.product_id IS NULL;

-- MRP snapshot on bill_items
ALTER TABLE public.bill_items
  ADD COLUMN IF NOT EXISTS mrp numeric(18, 2);

COMMENT ON COLUMN public.bill_items.mrp IS
  'Product MRP at time of billing; used to show customer savings on receipt when MRP > unit_price.';

-- Bill number format: <prefix>YYMM-<n>
CREATE OR REPLACE FUNCTION public.generate_bill_number()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_today       date := CURRENT_DATE;
  v_period_text text := to_char(v_today, 'YYMM');
  v_prefix      text;
  v_max_seq     integer;
  v_seq         integer;
  v_lock_key    bigint;
  v_company     uuid;
  v_number_base text;
BEGIN
  IF NEW.company_id IS NULL THEN
    NEW.company_id := public.get_my_company_id();
  END IF;
  v_company := NEW.company_id;

  IF NEW.bill_number IS NOT NULL AND trim(NEW.bill_number) <> '' THEN
    RETURN NEW;
  END IF;

  SELECT bp.invoice_prefix
    INTO v_prefix
    FROM public.companies bp
   WHERE bp.id = v_company
   LIMIT 1;

  v_prefix := upper(trim(coalesce(v_prefix, '')));
  IF v_prefix = '' THEN
    v_prefix := 'B';
  END IF;

  v_prefix := regexp_replace(v_prefix, '[^A-Z0-9]', '', 'g');
  IF v_prefix = '' THEN
    v_prefix := 'B';
  END IF;

  v_number_base := v_prefix || v_period_text;

  v_lock_key := (
    (to_char(v_today, 'YYMM')::bigint) * 100000
    + (abs(hashtext(v_company::text)) % 10000) * 10
    + (abs(hashtext(v_prefix)) % 10)
  );
  PERFORM pg_advisory_xact_lock(v_lock_key);

  SELECT COALESCE(MAX(
    CASE
      WHEN split_part(b.bill_number, '-', 2) ~ '^[0-9]+$'
      THEN split_part(b.bill_number, '-', 2)::integer
      ELSE NULL
    END
  ), 0)
    INTO v_max_seq
    FROM public.bills b
   WHERE b.company_id = v_company
     AND to_char(b.created_at, 'YYMM') = v_period_text
     AND b.bill_number LIKE (v_number_base || '-%');

  v_seq := v_max_seq + 1;
  NEW.bill_number := v_number_base || '-' || v_seq::text;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.generate_bill_number() IS
  'Trigger: sets bill_number to <prefix>YYMM-<n> using companies.invoice_prefix; sequence per company per month (n starts at 1).';

-- >>> begin: 72_app_updates_super_admin_rls.sql
-- POS Track admin panel: super_admins manage app_updates + activity logging
DROP POLICY IF EXISTS app_updates_super_admin_all ON public.app_updates;
CREATE POLICY app_updates_super_admin_all
  ON public.app_updates
  FOR ALL
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

DROP TRIGGER IF EXISTS trg_sa_log_app_updates ON public.app_updates;
CREATE TRIGGER trg_sa_log_app_updates
  AFTER INSERT OR UPDATE OR DELETE ON public.app_updates
  FOR EACH ROW
  EXECUTE PROCEDURE public.trg_log_super_admin_activity('App Updates');
-- <<< end: 72_app_updates_super_admin_rls.sql

COMMIT;
