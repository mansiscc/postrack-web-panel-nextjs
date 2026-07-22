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

