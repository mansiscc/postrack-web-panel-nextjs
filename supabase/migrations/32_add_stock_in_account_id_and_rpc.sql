-- =========================================
-- Migration 32: Add account_id to stock_in and update create_stock_in RPC
--
-- Purpose:
--   - Link each purchase (stock_in) to the account used for payment.
--   - Enables accounting entry creation for purchases (expense from account).
--
-- Rules:
--   - Only adds column account_id to stock_in; no other schema changes.
--   - Existing rows get default 'Cash in Hand' account.
--   - create_stock_in RPC gains p_account_id and inserts it into stock_in.
-- =========================================

BEGIN;

-- =========================================
-- STEP 1: Add account_id to stock_in
-- =========================================

ALTER TABLE public.stock_in
  ADD COLUMN IF NOT EXISTS account_id uuid REFERENCES public.accounts(id) ON UPDATE CASCADE ON DELETE RESTRICT;

-- Backfill existing rows with 'Cash in Hand' account
UPDATE public.stock_in
SET account_id = (
  SELECT public.accounts.id
  FROM public.accounts
  WHERE name = 'Cash in Hand'
  LIMIT 1
)
WHERE account_id IS NULL;

-- Enforce NOT NULL after backfill
ALTER TABLE public.stock_in
  ALTER COLUMN account_id SET NOT NULL;

COMMENT ON COLUMN public.stock_in.account_id IS 'Account used to pay for this purchase (e.g. Cash in Hand, Bank).';

-- =========================================
-- STEP 2: Update create_stock_in to accept and use p_account_id
-- =========================================

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

  v_total_items   integer        := 0;
  v_total_amount  numeric(18,2)  := 0;
BEGIN
  IF p_items IS NULL
     OR jsonb_typeof(p_items) <> 'array'
     OR jsonb_array_length(p_items) = 0
  THEN
    RAISE EXCEPTION 'p_items must be a non-empty JSON array of line items';
  END IF;

  -- Resolve account: required for purchase payment
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
    v_product_id         := (v_item->>'product_id')::uuid;
    v_manufacturing_date  := (v_item->>'manufacturing_date')::date;
    v_quantity            := COALESCE((v_item->>'quantity')::numeric(18,3), 0);
    v_row_total           := COALESCE((v_item->>'row_total')::numeric(18,2), 0);

    INSERT INTO public.stock_in_items (
      stock_in_id,
      product_id,
      manufacturing_date,
      quantity,
      row_total
    )
    VALUES (
      v_stock_in_id,
      v_product_id,
      v_manufacturing_date,
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
  'Creates a stock_in purchase entry with items and account_id, updates products.stock_quantity, and logs PURCHASE stock_transactions. Suppresses adjustment trigger. Defaults account to Cash in Hand if p_account_id is null.';

-- =========================================
-- =========================================

INSERT INTO public.accounting_categories (name, type, description, is_active)
VALUES 
  ('Purchase', 'expense', 'Stock-in / inventory purchases', true),
  ('Sales Return', 'expense', 'Sales return / customer refunds', true)
ON CONFLICT (name, type) DO NOTHING;

COMMIT;
