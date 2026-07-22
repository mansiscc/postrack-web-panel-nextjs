/* =============================================================================
   Migration: manual bill line items (no linked product)

   Allows POS users to add one-off items directly on a bill without creating a
   product master record. Manual lines store product_name / unit_price on
   bill_items only; product_id is NULL and stock is not deducted or restored.

   Also updates stock triggers:
   - trigger_bill_items_deduct_stock: skip when product_id IS NULL
   - restore_product_stock: skip when product_id IS NULL; for catalog returns
     keep stock restore + RETURN_IN log with company_id (migrations 48 + 51)

   Safe to re-run on live if an earlier draft of this migration was applied
   without the full restore_product_stock() body — CREATE OR REPLACE replaces
   the function in place.
   ============================================================================= */

BEGIN;

ALTER TABLE public.bill_items
  ALTER COLUMN product_id DROP NOT NULL;

ALTER TABLE public.bill_items
  DROP CONSTRAINT IF EXISTS fk_bill_items_product;

ALTER TABLE public.bill_items
  ADD CONSTRAINT fk_bill_items_product
    FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE RESTRICT;

COMMENT ON COLUMN public.bill_items.product_id IS
  'Linked catalog product when sold from inventory; NULL for manual one-off bill lines (no stock impact).';

CREATE OR REPLACE FUNCTION public.trigger_bill_items_deduct_stock()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.product_id IS NULL THEN
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
  'After insert on bill_items: reduces stock via reduce_product_stock when product_id is set. Skips manual lines (product_id IS NULL). SECURITY DEFINER so staff can complete billing under products UPDATE RLS.';

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
  IF NEW.product_id IS NULL THEN
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
  'After insert on bill_return_items: restores product stock and logs RETURN_IN with company_id when product_id is set. Skips manual bill lines (product_id IS NULL). SECURITY DEFINER bypasses products UPDATE RLS for staff.';

COMMIT;
