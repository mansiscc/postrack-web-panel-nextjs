/* =============================================================================
   MODULE — BILL RETURNS: LOG INTO stock_transactions

   Extends restore_product_stock() so that each return item also writes a
   RETURN_IN row into stock_transactions for a complete stock history.

   Tables involved:
   - bill_return_items: line items per bill return (NEW.return_id, NEW.product_id, NEW.quantity)
   - stock_transactions: unified stock movement history

   This migration is safe to run after:
   - 11_create_stock_in_and_transactions.sql   (creates stock_transactions)
   - 26_create_bill_returns_and_triggers.sql   (creates bill_return_items + initial restore_product_stock)
   - 28_suppress_stock_adjustment_trigger_for_billing_and_others.sql
     (redefines restore_product_stock to set suppress flag)
   ============================================================================= */

CREATE OR REPLACE FUNCTION public.restore_product_stock()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Ensure generic adjustment trigger does not double-log ADJUSTMENT_IN
  PERFORM set_config('app.suppress_stock_adjustment', 'true', true);

  -- 1) Restore stock to products
  UPDATE public.products
  SET stock_quantity = stock_quantity + NEW.quantity
  WHERE id = NEW.product_id;

  -- 2) Log stock movement as RETURN_IN tied to this bill return
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
    NEW.quantity,       -- positive: stock coming back to inventory
    'BILL_RETURN',
    NEW.return_id,      -- references bill_returns.id
    'Bill return'
  );

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.restore_product_stock() IS
  'After insert on bill_return_items: increases product stock and logs RETURN_IN in stock_transactions. Suppresses adjustment trigger.';

