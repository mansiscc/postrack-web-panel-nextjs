/* =============================================================================
   FIX — BILL RETURNS MUST LOG RETURN_IN STOCK TRANSACTION

   Problem:
   - `restore_product_stock()` was redefined later for SECURITY DEFINER, but that
     version only restored `products.stock_quantity` and stopped logging
     `RETURN_IN` rows in `stock_transactions`.

   Fix:
   - Keep SECURITY DEFINER + suppress adjustment trigger.
   - Restore stock on products.
   - Insert one `RETURN_IN` movement in `stock_transactions` per return item.
   ============================================================================= */

CREATE OR REPLACE FUNCTION public.restore_product_stock()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Avoid duplicate ADJUSTMENT_IN from generic product stock adjustment trigger
  PERFORM set_config('app.suppress_stock_adjustment', 'true', true);

  -- 1) Restore product stock
  UPDATE public.products
  SET stock_quantity = stock_quantity + NEW.quantity
  WHERE id = NEW.product_id;

  -- 2) Log stock movement for return history
  INSERT INTO public.stock_transactions (
    product_id,
    transaction_type,
    quantity,
    reference_type,
    reference_id,
    notes
  )
  VALUES (
    NEW.product_id,
    'RETURN_IN',
    NEW.quantity,
    'BILL_RETURN',
    NEW.return_id,
    'Bill return'
  );

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.restore_product_stock() IS
  'After insert on bill_return_items: increases product stock and logs RETURN_IN in stock_transactions. SECURITY DEFINER bypasses products UPDATE RLS for staff.';

