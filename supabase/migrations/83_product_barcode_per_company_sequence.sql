/* =============================================================================
   Migration 83 — Product barcodes start at 0001 per company

   Rule (simple):
   - First auto barcode for a company = 0001
   - Then 0002, 0003, … then 10000 when needed
   - Each new company starts again at 0001
   - If user types/scans a barcode, keep it (do not auto-assign)

   Implementation:
   - companies.product_barcode_seq counter (0 → next is 0001)
   - SECURITY DEFINER so Manager/Staff can allocate (companies UPDATE is Admin-only under RLS)
   - Skips numbers already used as product barcodes
   ============================================================================= */

BEGIN;

ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS product_barcode_seq bigint NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.companies.product_barcode_seq IS
  'Auto barcode counter. 0 means next code is 0001.';

/* Always restart counters at 0 so the next free code begins from 0001, 0002, … */
UPDATE public.companies
SET product_barcode_seq = 0;

CREATE OR REPLACE FUNCTION public.allocate_next_product_barcode(
  p_company_id uuid DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company uuid;
  v_seq     bigint;
  v_barcode text;
  v_tries   integer := 0;
BEGIN
  v_company := COALESCE(p_company_id, public.get_my_company_id());
  IF v_company IS NULL THEN
    RAISE EXCEPTION 'allocate_next_product_barcode: company_id is required';
  END IF;

  LOOP
    v_tries := v_tries + 1;
    IF v_tries > 10000 THEN
      RAISE EXCEPTION 'allocate_next_product_barcode: no free barcode for company %', v_company;
    END IF;

    UPDATE public.companies AS c
       SET product_barcode_seq = c.product_barcode_seq + 1
     WHERE c.id = v_company
     RETURNING c.product_barcode_seq INTO v_seq;

    IF v_seq IS NULL THEN
      RAISE EXCEPTION 'allocate_next_product_barcode: company % not found', v_company;
    END IF;

    /* 1 → 0001, 12 → 0012, 10000 → 10000 */
    v_barcode := lpad(v_seq::text, GREATEST(4, length(v_seq::text)), '0');

    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM public.products AS p
       WHERE p.company_id = v_company
         AND p.barcode = v_barcode
    );
  END LOOP;

  RETURN v_barcode;
END;
$$;

COMMENT ON FUNCTION public.allocate_next_product_barcode(uuid) IS
  'Next product barcode for company: 0001, 0002, … SECURITY DEFINER.';

REVOKE ALL ON FUNCTION public.allocate_next_product_barcode(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.allocate_next_product_barcode(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.allocate_next_product_barcode(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.generate_product_barcode()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.company_id IS NULL THEN
    NEW.company_id := public.get_my_company_id();
  END IF;

  IF NEW.barcode IS NOT NULL AND btrim(NEW.barcode) <> '' THEN
    NEW.barcode := btrim(NEW.barcode);
    RETURN NEW;
  END IF;

  NEW.barcode := public.allocate_next_product_barcode(NEW.company_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_products_generate_barcode ON public.products;
CREATE TRIGGER trg_products_generate_barcode
  BEFORE INSERT ON public.products
  FOR EACH ROW
  EXECUTE PROCEDURE public.generate_product_barcode();

/* Opening-stock create: assign 0001… when p_barcode is blank (before insert). */
CREATE OR REPLACE FUNCTION public.create_product_with_opening_stock(
  p_name                text,
  p_barcode             text,
  p_purchase_price      numeric,
  p_selling_price       numeric,
  p_mrp                 numeric,
  p_unit                text,
  p_low_stock_alert_qty numeric DEFAULT 0,
  p_product_category_id uuid DEFAULT NULL,
  p_opening_stock       numeric DEFAULT 0,
  p_id                  uuid DEFAULT NULL,
  p_is_active           boolean DEFAULT true,
  p_created_by          uuid DEFAULT NULL,
  p_account_id          uuid DEFAULT NULL,
  p_image_url           text DEFAULT NULL
)
RETURNS TABLE(id uuid)
LANGUAGE plpgsql
AS $$
DECLARE
  v_product_id   uuid;
  v_stock_in_id  uuid;
  v_company_id   uuid;
  v_batch_id     uuid;
  v_purchase     numeric(18, 2);
  v_barcode      text;
BEGIN
  v_company_id := public.get_my_company_id();
  v_product_id := COALESCE(p_id, gen_random_uuid());
  v_purchase := round(COALESCE(p_purchase_price, 0)::numeric, 2);

  v_barcode := NULLIF(btrim(COALESCE(p_barcode, '')), '');
  IF v_barcode IS NULL THEN
    v_barcode := public.allocate_next_product_barcode(v_company_id);
  END IF;

  INSERT INTO public.products (
    id, name, barcode, purchase_price, selling_price, mrp, unit,
    low_stock_alert_qty, product_category_id, stock_quantity, is_active,
    image_url, company_id
  )
  VALUES (
    v_product_id, p_name, v_barcode, p_purchase_price, p_selling_price, p_mrp, p_unit,
    COALESCE(p_low_stock_alert_qty, 0), p_product_category_id, COALESCE(p_opening_stock, 0),
    COALESCE(p_is_active, true), NULLIF(trim(p_image_url), ''), v_company_id
  );

  IF COALESCE(p_opening_stock, 0) > 0 THEN
    v_batch_id := public.find_or_create_product_batch(
      v_company_id, v_product_id, p_purchase_price, p_selling_price, p_mrp
    );

    UPDATE public.product_batches AS pb
    SET quantity_received  = pb.quantity_received + p_opening_stock,
        quantity_remaining = pb.quantity_remaining + p_opening_stock
    WHERE pb.id = v_batch_id;

    v_stock_in_id := gen_random_uuid();

    INSERT INTO public.stock_in (
      id, date, supplier_id, invoice_number, notes,
      total_items, total_amount, created_by, account_id, company_id
    )
    VALUES (
      v_stock_in_id, CURRENT_DATE, NULL, 'OPENING', 'Opening stock from product creation',
      1, v_purchase * p_opening_stock, p_created_by,
      COALESCE(
        p_account_id,
        (SELECT a.id FROM public.accounts a
         WHERE a.name = 'Cash in Hand' AND a.is_active = true AND a.company_id = v_company_id LIMIT 1)
      ),
      v_company_id
    );

    INSERT INTO public.stock_in_items (
      stock_in_id, product_id, manufacturing_date,
      purchase_price, selling_price, mrp, quantity, row_total, company_id, batch_id
    )
    VALUES (
      v_stock_in_id, v_product_id, NULL,
      v_purchase, p_selling_price, p_mrp, p_opening_stock,
      v_purchase * p_opening_stock, v_company_id, v_batch_id
    );

    INSERT INTO public.stock_transactions (
      product_id, transaction_type, quantity,
      reference_type, reference_id, notes, company_id, batch_id
    )
    VALUES (
      v_product_id, 'OPENING', p_opening_stock,
      'STOCK_IN', v_stock_in_id, 'Opening stock', v_company_id, v_batch_id
    );
  END IF;

  RETURN QUERY SELECT v_product_id;
END;
$$;

COMMIT;
