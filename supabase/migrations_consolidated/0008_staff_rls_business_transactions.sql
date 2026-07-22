-- =============================================================================
-- Consolidated migration (module bundle): 0008_staff_rls_business_transactions.sql
-- Sources merged in order (do not reorder):
--   40_fix_staff_billing_stock_rls_security_definer.sql
--   41_staff_stock_in_products_suppliers_rls.sql
--   42_stock_in_items_purchase_selling_mrp.sql
--   43_business_profile_and_bill_number_prefix_4digit.sql
--   44_business_logo_storage_bucket.sql
--   45_add_show_logo_on_bill_to_business_profile.sql
--   46_add_upi_qr_to_business_profile.sql
--   47_remove_upi_qr_from_business_profile.sql
--   48_fix_restore_product_stock_log_return_in.sql
--   49_add_bill_payment_source_type_to_entries.sql
--   50_transactions_totals_rpc.sql
-- =============================================================================


-- >>> begin: 40_fix_staff_billing_stock_rls_security_definer.sql
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

-- <<< end: 40_fix_staff_billing_stock_rls_security_definer.sql

-- >>> begin: 41_staff_stock_in_products_suppliers_rls.sql
/* =============================================================================
   Staff with user_permissions.stock_in can insert/update products and suppliers

   Cause: RLS only allowed Admin/Manager. Storekeeper (Staff + stock_in) POSTs
   to products/suppliers failed with "violates row-level security policy".

   Fix: has_granted_permission(permission_type) — Admin/Manager always allowed;
   Staff allowed when a matching user_permissions row exists with granted=true.

   Also: create_stock_in() UPDATEs products as the caller; Staff stock_in needs
   products UPDATE RLS, not only INSERT.
   ============================================================================= */

CREATE OR REPLACE FUNCTION public.has_granted_permission(p_perm permission_type)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    (SELECT u.role FROM public.users u WHERE u.id = auth.uid() LIMIT 1) IN ('Admin', 'Manager')
    OR EXISTS (
      SELECT 1
      FROM public.user_permissions up
      WHERE up.user_id = auth.uid()
        AND up.permission = p_perm
        AND up.granted = true
    );
$$;

COMMENT ON FUNCTION public.has_granted_permission(permission_type) IS
  'RLS helper: true for Admin/Manager, or Staff with the given permission in user_permissions.';

REVOKE ALL ON FUNCTION public.has_granted_permission(permission_type) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_granted_permission(permission_type) TO authenticated;

/* products */
DROP POLICY IF EXISTS "Admin and Manager can insert products" ON public.products;
CREATE POLICY "Admin and Manager can insert products"
ON public.products
FOR INSERT
WITH CHECK (public.has_granted_permission('stock_in'::permission_type));

DROP POLICY IF EXISTS "Admin and Manager can update products" ON public.products;
CREATE POLICY "Admin and Manager can update products"
ON public.products
FOR UPDATE
USING (public.has_granted_permission('stock_in'::permission_type))
WITH CHECK (public.has_granted_permission('stock_in'::permission_type));

/* suppliers */
DROP POLICY IF EXISTS "Admin and Manager can insert suppliers" ON public.suppliers;
CREATE POLICY "Admin and Manager can insert suppliers"
ON public.suppliers
FOR INSERT
WITH CHECK (public.has_granted_permission('stock_in'::permission_type));

DROP POLICY IF EXISTS "Admin and Manager can update suppliers" ON public.suppliers;
CREATE POLICY "Admin and Manager can update suppliers"
ON public.suppliers
FOR UPDATE
USING (public.has_granted_permission('stock_in'::permission_type))
WITH CHECK (public.has_granted_permission('stock_in'::permission_type));

-- <<< end: 41_staff_stock_in_products_suppliers_rls.sql

-- >>> begin: 42_stock_in_items_purchase_selling_mrp.sql
-- =============================================================================
-- Migration 42: Restore purchase_price, selling_price, mrp on stock_in_items
--
-- Rationale: Snapshot unit cost and list prices at stock-in time; row_total
-- remains the line amount (e.g. purchase_price * quantity).
-- =============================================================================

BEGIN;

ALTER TABLE public.stock_in_items
  ADD COLUMN IF NOT EXISTS purchase_price numeric(18, 2),
  ADD COLUMN IF NOT EXISTS selling_price numeric(18, 2),
  ADD COLUMN IF NOT EXISTS mrp numeric(18, 2);

UPDATE public.stock_in_items
SET purchase_price = CASE
  WHEN COALESCE(quantity, 0) <> 0 THEN round(row_total / quantity, 2)
  ELSE 0::numeric(18, 2)
END
WHERE purchase_price IS NULL;

ALTER TABLE public.stock_in_items
  ALTER COLUMN purchase_price SET NOT NULL;

COMMENT ON COLUMN public.stock_in_items.purchase_price IS 'Unit purchase price at time of stock-in.';
COMMENT ON COLUMN public.stock_in_items.selling_price IS 'Selling price snapshot at stock-in (optional).';
COMMENT ON COLUMN public.stock_in_items.mrp IS 'MRP snapshot at stock-in (optional).';
COMMENT ON COLUMN public.stock_in_items.row_total IS 'Line total (typically purchase_price × quantity at stock-in).';

-- -----------------------------------------------------------------------------
-- create_stock_in: persist price columns from JSON (fallback for purchase_price)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_stock_in(
  p_date           date,
  p_items          jsonb,
  p_supplier_id    uuid DEFAULT NULL,
  p_invoice_number text DEFAULT NULL,
  p_notes          text DEFAULT NULL,
  p_created_by     uuid DEFAULT NULL,
  p_account_id     uuid DEFAULT NULL
)
RETURNS TABLE(id uuid)
LANGUAGE plpgsql
AS $$
DECLARE
  v_stock_in_id   uuid;
  v_item          jsonb;
  v_account_id    uuid;

  v_product_id         uuid;
  v_manufacturing_date date;
  v_quantity           numeric(18,3);
  v_row_total          numeric(18,2);
  v_purchase_price     numeric(18,2);
  v_selling_price      numeric(18,2);
  v_mrp                numeric(18,2);

  v_total_items   integer        := 0;
  v_total_amount  numeric(18,2)  := 0;
BEGIN
  IF p_items IS NULL
     OR jsonb_typeof(p_items) <> 'array'
     OR jsonb_array_length(p_items) = 0
  THEN
    RAISE EXCEPTION 'p_items must be a non-empty JSON array of line items';
  END IF;

  v_account_id := COALESCE(
    p_account_id,
    (
      SELECT public.accounts.id
      FROM public.accounts
      WHERE name = 'Cash in Hand'
        AND is_active = true
      LIMIT 1
    )
  );
  IF v_account_id IS NULL THEN
    RAISE EXCEPTION 'No payment account available. Ensure at least one active account exists (e.g. Cash in Hand).';
  END IF;

  FOR v_item IN
    SELECT value
    FROM jsonb_array_elements(p_items) AS t(value)
  LOOP
    v_quantity  := COALESCE((v_item->>'quantity')::numeric(18,3), 0);
    v_row_total := COALESCE((v_item->>'row_total')::numeric(18,2), 0);

    v_total_items  := v_total_items + 1;
    v_total_amount := v_total_amount + v_row_total;
  END LOOP;

  INSERT INTO public.stock_in (
    date,
    supplier_id,
    invoice_number,
    notes,
    total_items,
    total_amount,
    created_by,
    account_id
  )
  VALUES (
    p_date,
    p_supplier_id,
    p_invoice_number,
    p_notes,
    v_total_items,
    v_total_amount,
    p_created_by,
    v_account_id
  )
  RETURNING public.stock_in.id INTO v_stock_in_id;

  PERFORM set_config('app.suppress_stock_adjustment', 'true', true);

  FOR v_item IN
    SELECT value
    FROM jsonb_array_elements(p_items) AS t(value)
  LOOP
    v_product_id := (v_item->>'product_id')::uuid;
    v_manufacturing_date := CASE
      WHEN NULLIF(trim(COALESCE(v_item->>'manufacturing_date', '')), '') IS NOT NULL
      THEN (NULLIF(trim(COALESCE(v_item->>'manufacturing_date', '')), ''))::date
      ELSE NULL
    END;
    v_quantity  := COALESCE((v_item->>'quantity')::numeric(18,3), 0);
    v_row_total := COALESCE((v_item->>'row_total')::numeric(18,2), 0);

    v_purchase_price := CASE
      WHEN NULLIF(trim(COALESCE(v_item->>'purchase_price', '')), '') IS NOT NULL
      THEN (NULLIF(trim(COALESCE(v_item->>'purchase_price', '')), ''))::numeric(18,2)
      ELSE CASE
        WHEN COALESCE(v_quantity, 0) <> 0 THEN round(v_row_total / v_quantity, 2)
        ELSE 0::numeric(18,2)
      END
    END;

    v_selling_price := CASE
      WHEN NULLIF(trim(COALESCE(v_item->>'selling_price', '')), '') IS NOT NULL
      THEN (NULLIF(trim(COALESCE(v_item->>'selling_price', '')), ''))::numeric(18,2)
      ELSE NULL
    END;

    v_mrp := CASE
      WHEN NULLIF(trim(COALESCE(v_item->>'mrp', '')), '') IS NOT NULL
      THEN (NULLIF(trim(COALESCE(v_item->>'mrp', '')), ''))::numeric(18,2)
      ELSE NULL
    END;

    INSERT INTO public.stock_in_items (
      stock_in_id,
      product_id,
      manufacturing_date,
      purchase_price,
      selling_price,
      mrp,
      quantity,
      row_total
    )
    VALUES (
      v_stock_in_id,
      v_product_id,
      v_manufacturing_date,
      v_purchase_price,
      v_selling_price,
      v_mrp,
      v_quantity,
      v_row_total
    );

    UPDATE public.products AS p
    SET stock_quantity = COALESCE(p.stock_quantity, 0) + v_quantity
    WHERE p.id = v_product_id;

    INSERT INTO public.stock_transactions (
      product_id,
      transaction_type,
      quantity,
      reference_type,
      reference_id,
      notes
    )
    VALUES (
      v_product_id,
      'PURCHASE',
      v_quantity,
      'STOCK_IN',
      v_stock_in_id,
      p_invoice_number
    );
  END LOOP;

  RETURN QUERY SELECT v_stock_in_id;
END;
$$;

COMMENT ON FUNCTION public.create_stock_in(
  date, jsonb, uuid, text, text, uuid, uuid
) IS
  'Creates stock_in with line items (purchase_price, selling_price, mrp snapshots + quantity, row_total), updates products.stock_quantity, logs PURCHASE stock_transactions. purchase_price defaults from row_total/quantity if omitted in JSON.';

-- -----------------------------------------------------------------------------
-- create_product_with_opening_stock: line items include price snapshots
-- -----------------------------------------------------------------------------
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
  p_account_id          uuid DEFAULT NULL
)
RETURNS TABLE(id uuid)
LANGUAGE plpgsql
AS $$
DECLARE
  v_product_id   uuid;
  v_stock_in_id  uuid;
BEGIN
  v_product_id := COALESCE(p_id, gen_random_uuid());

  INSERT INTO public.products (
    id,
    name,
    barcode,
    purchase_price,
    selling_price,
    mrp,
    unit,
    low_stock_alert_qty,
    product_category_id,
    stock_quantity,
    is_active
  )
  VALUES (
    v_product_id,
    p_name,
    p_barcode,
    p_purchase_price,
    p_selling_price,
    p_mrp,
    p_unit,
    COALESCE(p_low_stock_alert_qty, 0),
    p_product_category_id,
    COALESCE(p_opening_stock, 0),
    COALESCE(p_is_active, true)
  );

  IF COALESCE(p_opening_stock, 0) > 0 THEN
    v_stock_in_id := gen_random_uuid();

    INSERT INTO public.stock_in (
      id,
      date,
      supplier_id,
      invoice_number,
      notes,
      total_items,
      total_amount,
      created_by
    )
    VALUES (
      v_stock_in_id,
      CURRENT_DATE,
      NULL,
      'OPENING',
      'Opening stock from product creation',
      1,
      COALESCE(p_purchase_price, 0) * p_opening_stock,
      p_created_by
    );

    INSERT INTO public.stock_in_items (
      stock_in_id,
      product_id,
      manufacturing_date,
      purchase_price,
      selling_price,
      mrp,
      quantity,
      row_total
    )
    VALUES (
      v_stock_in_id,
      v_product_id,
      NULL,
      COALESCE(p_purchase_price, 0),
      p_selling_price,
      p_mrp,
      p_opening_stock,
      COALESCE(p_purchase_price, 0) * p_opening_stock
    );

    INSERT INTO public.stock_transactions (
      product_id,
      transaction_type,
      quantity,
      reference_type,
      reference_id,
      notes
    )
    VALUES (
      v_product_id,
      'OPENING',
      p_opening_stock,
      'STOCK_IN',
      v_stock_in_id,
      'Opening stock'
    );
  END IF;

  RETURN QUERY SELECT v_product_id;
END;
$$;

COMMENT ON FUNCTION public.create_product_with_opening_stock(
  text, text, numeric, numeric, numeric, text, numeric, uuid, numeric, uuid, boolean, uuid, uuid
) IS
  'Creates a product and, if opening_stock > 0, stock_in (invoice OPENING) with stock_in_items price snapshots. Returns TABLE(id uuid).';

COMMIT;

-- <<< end: 42_stock_in_items_purchase_selling_mrp.sql

-- >>> begin: 43_business_profile_and_bill_number_prefix_4digit.sql
/* =============================================================================
   Migration 43 — Business profile + bill number prefix (4-digit sequence)

   Goals:
   - Create public.business_profile (singleton row design).
   - Use business_profile.invoice_prefix for bill number generation.
   - Change bill number format to <prefix>-YYYYMMDD-XXXX.
   - Default/fallback prefix is 'B'.
   ============================================================================= */

BEGIN;

/* -----------------------------------------------------------------------------
   STEP 1: business_profile table
   ----------------------------------------------------------------------------- */
CREATE TABLE IF NOT EXISTS public.business_profile (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_name   text NOT NULL,
  logo_url        text,
  phone           text,
  email           text,
  address         text,
  gstin           text,
  invoice_prefix  text NOT NULL DEFAULT 'B',
  receipt_footer  text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.business_profile IS
  'Singleton business profile used for receipt header/footer and invoice prefix.';
COMMENT ON COLUMN public.business_profile.invoice_prefix IS
  'Bill prefix (e.g. B, POS). Used in bill_number format <prefix>-YYYYMMDD-XXXX.';

/* Singleton guard: keep exactly one logical row for this app setup. */
CREATE UNIQUE INDEX IF NOT EXISTS uq_business_profile_singleton
  ON public.business_profile ((true));

/* Reuse helper from migration 01 */
DROP TRIGGER IF EXISTS trigger_update_business_profile_updated_at ON public.business_profile;
CREATE TRIGGER trigger_update_business_profile_updated_at
BEFORE UPDATE ON public.business_profile
FOR EACH ROW
EXECUTE PROCEDURE public.update_updated_at_column();

/* -----------------------------------------------------------------------------
   STEP 2: RLS policies (read by authenticated; write by Admin)
   ----------------------------------------------------------------------------- */
ALTER TABLE public.business_profile ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read business_profile" ON public.business_profile;
CREATE POLICY "Authenticated users can read business_profile"
ON public.business_profile
FOR SELECT
USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Admin can insert business_profile" ON public.business_profile;
CREATE POLICY "Admin can insert business_profile"
ON public.business_profile
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.users u
    WHERE u.id = auth.uid()
      AND u.role = 'Admin'
  )
);

DROP POLICY IF EXISTS "Admin can update business_profile" ON public.business_profile;
CREATE POLICY "Admin can update business_profile"
ON public.business_profile
FOR UPDATE
USING (
  EXISTS (
    SELECT 1
    FROM public.users u
    WHERE u.id = auth.uid()
      AND u.role = 'Admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.users u
    WHERE u.id = auth.uid()
      AND u.role = 'Admin'
  )
);

/* -----------------------------------------------------------------------------
   STEP 3: Bill number trigger function
   New format: <prefix>-YYYYMMDD-XXXX
   - prefix from business_profile.invoice_prefix
   - fallback/default prefix: B
   - keeps advisory lock and UNIQUE(bill_number) safety
   ----------------------------------------------------------------------------- */
CREATE OR REPLACE FUNCTION public.generate_bill_number()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_today      date := CURRENT_DATE;
  v_date_text  text := to_char(v_today, 'YYYYMMDD');
  v_prefix     text;
  v_count      integer;
  v_seq        integer;
  v_lock_key   bigint;
BEGIN
  /* Do not overwrite if bill_number was explicitly provided */
  IF NEW.bill_number IS NOT NULL AND trim(NEW.bill_number) <> '' THEN
    RETURN NEW;
  END IF;

  /* Latest profile row (singleton by index; ORDER BY for extra safety) */
  SELECT bp.invoice_prefix
    INTO v_prefix
    FROM public.business_profile bp
   ORDER BY bp.created_at DESC
   LIMIT 1;

  v_prefix := upper(trim(coalesce(v_prefix, '')));
  IF v_prefix = '' THEN
    v_prefix := 'B';
  END IF;

  /* Keep only A-Z / 0-9 to avoid invalid bill token characters */
  v_prefix := regexp_replace(v_prefix, '[^A-Z0-9]', '', 'g');
  IF v_prefix = '' THEN
    v_prefix := 'B';
  END IF;

  /* Serialize sequence generation per day+prefix */
  v_lock_key := (to_char(v_today, 'YYYYMMDD')::bigint * 100000) + (abs(hashtext(v_prefix)) % 100000);
  PERFORM pg_advisory_xact_lock(v_lock_key);

  /* Count existing bills for this day and prefix */
  SELECT COUNT(*)::integer
    INTO v_count
    FROM public.bills b
   WHERE b.created_at::date = v_today
     AND b.bill_number LIKE (v_prefix || '-' || v_date_text || '-%');

  v_seq := v_count + 1;
  NEW.bill_number := v_prefix || '-' || v_date_text || '-' || lpad(v_seq::text, 4, '0');

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.generate_bill_number() IS
  'Trigger: sets bill_number to <prefix>-YYYYMMDD-XXXX using business_profile.invoice_prefix; fallback prefix B.';

COMMIT;

-- <<< end: 43_business_profile_and_bill_number_prefix_4digit.sql

-- >>> begin: 44_business_logo_storage_bucket.sql
BEGIN;

INSERT INTO storage.buckets (id, name, public)
VALUES ('business-logos', 'business-logos', true)
ON CONFLICT (id) DO UPDATE
SET public = EXCLUDED.public;

DROP POLICY IF EXISTS "Public can read business logos" ON storage.objects;
CREATE POLICY "Public can read business logos"
ON storage.objects
FOR SELECT
USING (bucket_id = 'business-logos');

DROP POLICY IF EXISTS "Admin can upload business logos" ON storage.objects;
CREATE POLICY "Admin can upload business logos"
ON storage.objects
FOR INSERT
WITH CHECK (
    bucket_id = 'business-logos'
    AND EXISTS (
        SELECT 1
        FROM public.users u
        WHERE u.id = auth.uid()
          AND u.role = 'Admin'
    )
);

DROP POLICY IF EXISTS "Admin can update business logos" ON storage.objects;
CREATE POLICY "Admin can update business logos"
ON storage.objects
FOR UPDATE
USING (
    bucket_id = 'business-logos'
    AND EXISTS (
        SELECT 1
        FROM public.users u
        WHERE u.id = auth.uid()
          AND u.role = 'Admin'
    )
)
WITH CHECK (
    bucket_id = 'business-logos'
    AND EXISTS (
        SELECT 1
        FROM public.users u
        WHERE u.id = auth.uid()
          AND u.role = 'Admin'
    )
);

DROP POLICY IF EXISTS "Admin can delete business logos" ON storage.objects;
CREATE POLICY "Admin can delete business logos"
ON storage.objects
FOR DELETE
USING (
    bucket_id = 'business-logos'
    AND EXISTS (
        SELECT 1
        FROM public.users u
        WHERE u.id = auth.uid()
          AND u.role = 'Admin'
    )
);

COMMIT;

-- <<< end: 44_business_logo_storage_bucket.sql

-- >>> begin: 45_add_show_logo_on_bill_to_business_profile.sql
BEGIN;

ALTER TABLE public.business_profile
ADD COLUMN IF NOT EXISTS show_logo_on_bill boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.business_profile.show_logo_on_bill IS
  'Controls whether the business logo should be printed on receipts when a logo is available.';

COMMIT;

-- <<< end: 45_add_show_logo_on_bill_to_business_profile.sql

-- >>> begin: 46_add_upi_qr_to_business_profile.sql
BEGIN;

ALTER TABLE public.business_profile
ADD COLUMN IF NOT EXISTS upi_id text,
ADD COLUMN IF NOT EXISTS upi_name text,
ADD COLUMN IF NOT EXISTS upi_qr_enabled boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.business_profile.upi_id IS
  'Merchant UPI VPA used to generate fixed-amount bill payment QR codes.';

COMMENT ON COLUMN public.business_profile.upi_name IS
  'Payee name used in UPI payment QR payloads.';

COMMENT ON COLUMN public.business_profile.upi_qr_enabled IS
  'Controls whether bill payment QR should be generated from the business profile.';

COMMIT;

-- <<< end: 46_add_upi_qr_to_business_profile.sql

-- >>> begin: 47_remove_upi_qr_from_business_profile.sql
BEGIN;

ALTER TABLE public.business_profile
DROP COLUMN IF EXISTS upi_id,
DROP COLUMN IF EXISTS upi_name,
DROP COLUMN IF EXISTS upi_qr_enabled;

COMMIT;

-- <<< end: 47_remove_upi_qr_from_business_profile.sql

-- >>> begin: 48_fix_restore_product_stock_log_return_in.sql
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


-- <<< end: 48_fix_restore_product_stock_log_return_in.sql

-- >>> begin: 49_add_bill_payment_source_type_to_entries.sql
/* =============================================================================
   MIGRATION — Add 'bill_payment' to entries source_type allowed values

   Problem:
   - entries_source_type_check only allows: bill, bill_return, purchase, manual
   - When collecting pending payment later from Bill Detail screen, app needs to
     post a separate income entry for the collected amount.
   - Using source_type = 'bill' fails due to unique constraint on
     (source_type, source_id, account_id) — original bill entry already occupies that slot.

   Fix:
   - Extend entries_source_type_check to also allow 'bill_payment'.
   - 'bill_payment' entries use source_id = bill.id (UUID safe) but represent
     a follow-up collection on a pending/partial bill, not the original sale.
   ============================================================================= */

ALTER TABLE public.entries
    DROP CONSTRAINT IF EXISTS entries_source_type_check;

ALTER TABLE public.entries
    ADD CONSTRAINT entries_source_type_check
        CHECK (
            source_type IS NULL
            OR source_type IN ('bill', 'bill_return', 'purchase', 'manual', 'bill_payment')
        );

COMMENT ON CONSTRAINT entries_source_type_check ON public.entries IS
    'Restricts source_type to known values: bill, bill_return, purchase, manual, bill_payment.
     bill_payment is used when collecting pending/remaining amount after original bill was partially paid.';

-- <<< end: 49_add_bill_payment_source_type_to_entries.sql

-- >>> begin: 50_transactions_totals_rpc.sql
/* =============================================================================
   MODULE — TRANSACTIONS TOTALS RPC
   Migration: get_transactions_totals()

   Returns system-wide totals across all non-deleted accounting entries:
   - total_entries_count
   - total_income (sum of income entries)
   - total_expense (sum of expense entries)
   ============================================================================= */

CREATE OR REPLACE FUNCTION public.get_transactions_totals()
RETURNS TABLE (
  total_entries_count bigint,
  total_income double precision,
  total_expense double precision
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    COUNT(*) AS total_entries_count,
    COALESCE(SUM(CASE WHEN entry_type = 'income'  THEN amount ELSE 0 END), 0)::double precision AS total_income,
    COALESCE(SUM(CASE WHEN entry_type = 'expense' THEN amount ELSE 0 END), 0)::double precision AS total_expense
  FROM public.entries
  WHERE is_deleted = false;
$$;


-- <<< end: 50_transactions_totals_rpc.sql
