/* =============================================================================
   Migration: backward-compatible manual bill lines for old Android builds

   Problem: migration 69 allows bill_items.product_id IS NULL. The Play Store
   app deserializes product_id as a required String and fails on null until users
   install an app update.

   Fix: one hidden placeholder product per company (barcode __MANUAL_BILL__).
   Manual bill lines store that product_id; stock triggers skip it. Existing
   NULL rows are backfilled. Old app builds keep working during Play Store rollout.
   ============================================================================= */

BEGIN;

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

COMMENT ON FUNCTION public.is_manual_bill_product(uuid) IS
  'True when product_id is the per-company manual bill placeholder (no stock impact).';

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

COMMENT ON FUNCTION public.ensure_manual_bill_product(uuid) IS
  'Returns the manual bill placeholder product for a company; creates it if missing. SECURITY DEFINER.';

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

COMMENT ON FUNCTION public.get_manual_bill_product_id() IS
  'Callable by authenticated app users: returns manual bill placeholder product id for current company.';

REVOKE ALL ON FUNCTION public.get_manual_bill_product_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_manual_bill_product_id() TO authenticated;

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

COMMIT;
