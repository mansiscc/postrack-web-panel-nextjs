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
