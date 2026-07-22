/* =============================================================================
   Fix staff billing "Insufficient stock" when stock is actually available

   Cause: products RLS only allows Admin/Manager to UPDATE products. The
   bill_items trigger calls reduce_product_stock(), which UPDATEs products as
   the inserting user (staff). RLS blocks the row → 0 rows updated → same
   error as real insufficient stock.

   Fix: Run stock deduction (and bill-items trigger wrapper) as SECURITY DEFINER
   with search_path pinned. Revoke EXECUTE on reduce_product_stock from anon/
   authenticated so it cannot be called directly via PostgREST (only triggers
   and service_role).

   Also: restore_product_stock (returns) had the same RLS issue for staff.
   ============================================================================= */

/* -----------------------------------------------------------------------------
   reduce_product_stock
   ----------------------------------------------------------------------------- */
CREATE OR REPLACE FUNCTION public.reduce_product_stock(
  p_product_id   uuid,
  p_quantity    numeric,
  p_bill_id     uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
  'Safely decreases product stock for billing; logs SALE. SECURITY DEFINER bypasses products UPDATE RLS for staff. Not callable by anon/authenticated (use bill_items insert).';

REVOKE ALL ON FUNCTION public.reduce_product_stock(uuid, numeric, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reduce_product_stock(uuid, numeric, uuid) FROM anon;
REVOKE ALL ON FUNCTION public.reduce_product_stock(uuid, numeric, uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.reduce_product_stock(uuid, numeric, uuid) TO service_role;

/* -----------------------------------------------------------------------------
   trigger_bill_items_deduct_stock — definer so staff insert does not need EXECUTE
   on reduce_product_stock after REVOKE.
   ----------------------------------------------------------------------------- */
CREATE OR REPLACE FUNCTION public.trigger_bill_items_deduct_stock()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.reduce_product_stock(
    NEW.product_id,
    NEW.quantity,
    NEW.bill_id
  );
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.trigger_bill_items_deduct_stock() IS
  'After insert on bill_items: reduces stock via reduce_product_stock. SECURITY DEFINER so staff can complete billing under products UPDATE RLS.';

/* -----------------------------------------------------------------------------
   restore_product_stock (bill returns) — same RLS gap for staff
   ----------------------------------------------------------------------------- */
CREATE OR REPLACE FUNCTION public.restore_product_stock()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
  'After insert on bill_return_items: increases product stock. SECURITY DEFINER bypasses products UPDATE RLS for staff.';
