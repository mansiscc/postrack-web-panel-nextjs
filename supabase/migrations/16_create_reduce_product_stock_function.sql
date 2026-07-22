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
