/* =============================================================================
   Migration: Bill number format — <prefix>YYMM-<n>
   Example: B2606-1, POS2606-2
   Sequence: per company, per calendar month; MAX(existing suffix) + 1.
   ============================================================================= */

BEGIN;

CREATE OR REPLACE FUNCTION public.generate_bill_number()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_today       date := CURRENT_DATE;
  v_period_text text := to_char(v_today, 'YYMM');
  v_prefix      text;
  v_max_seq     integer;
  v_seq         integer;
  v_lock_key    bigint;
  v_company     uuid;
  v_number_base text;
BEGIN
  IF NEW.company_id IS NULL THEN
    NEW.company_id := public.get_my_company_id();
  END IF;
  v_company := NEW.company_id;

  IF NEW.bill_number IS NOT NULL AND trim(NEW.bill_number) <> '' THEN
    RETURN NEW;
  END IF;

  SELECT bp.invoice_prefix
    INTO v_prefix
    FROM public.companies bp
   WHERE bp.id = v_company
   LIMIT 1;

  v_prefix := upper(trim(coalesce(v_prefix, '')));
  IF v_prefix = '' THEN
    v_prefix := 'B';
  END IF;

  v_prefix := regexp_replace(v_prefix, '[^A-Z0-9]', '', 'g');
  IF v_prefix = '' THEN
    v_prefix := 'B';
  END IF;

  v_number_base := v_prefix || v_period_text;

  v_lock_key := (
    (to_char(v_today, 'YYMM')::bigint) * 100000
    + (abs(hashtext(v_company::text)) % 10000) * 10
    + (abs(hashtext(v_prefix)) % 10)
  );
  PERFORM pg_advisory_xact_lock(v_lock_key);

  SELECT COALESCE(MAX(
    CASE
      WHEN split_part(b.bill_number, '-', 2) ~ '^[0-9]+$'
      THEN split_part(b.bill_number, '-', 2)::integer
      ELSE NULL
    END
  ), 0)
    INTO v_max_seq
    FROM public.bills b
   WHERE b.company_id = v_company
     AND to_char(b.created_at, 'YYMM') = v_period_text
     AND b.bill_number LIKE (v_number_base || '-%');

  v_seq := v_max_seq + 1;
  NEW.bill_number := v_number_base || '-' || v_seq::text;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.generate_bill_number() IS
  'Trigger: sets bill_number to <prefix>YYMM-<n> using companies.invoice_prefix; sequence per company per month (n starts at 1).';

COMMIT;
