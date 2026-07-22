/* =============================================================================
   Migration 54 — Bootstrap default accounts + accounting categories per company

   Option A (tenant provisioning):
   - When a new row is inserted into public.companies, seed that company with:
       * accounting_categories: Sales (income), Purchase (expense), Sales Return (expense)
         — names/types must match AccountingRepositoryImpl lookups.
       * accounts: Cash in Hand (default), Bank Account
   - Idempotent via ON CONFLICT on (company_id, name[, type]).

   Also backfills existing companies that are missing these rows (e.g. created before
   multi-tenant seeds or without defaults).

   Security:
   - bootstrap_company_accounting_defaults is SECURITY DEFINER (bypasses RLS for inserts).
   - Not exposed to anon/authenticated RPC callers; trigger + migrations only.
   ============================================================================= */

BEGIN;

CREATE OR REPLACE FUNCTION public.bootstrap_company_accounting_defaults(p_company_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_company_id IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO public.accounting_categories (company_id, name, type, description, is_active)
  VALUES
    (p_company_id, 'Sales', 'income', 'Sales income from customer bills', true),
    (p_company_id, 'Purchase', 'expense', 'Stock-in / inventory purchases', true),
    (p_company_id, 'Sales Return', 'expense', 'Sales return / customer refunds', true)
  ON CONFLICT (company_id, name, type) DO NOTHING;

  INSERT INTO public.accounts (company_id, name, description, opening_balance, is_default, is_active)
  VALUES
    (p_company_id, 'Cash in Hand', 'Cash account', 0, true, true),
    (p_company_id, 'Bank Account', 'Bank account', 0, false, true)
  ON CONFLICT (company_id, name) DO NOTHING;
END;
$$;

COMMENT ON FUNCTION public.bootstrap_company_accounting_defaults(uuid) IS
  'Seeds default accounting_categories and accounts for a tenant company. Idempotent. Used by AFTER INSERT on companies and one-time backfills.';

CREATE OR REPLACE FUNCTION public.fn_companies_after_insert_bootstrap_accounting()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.bootstrap_company_accounting_defaults(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_companies_bootstrap_accounting_defaults ON public.companies;
CREATE TRIGGER trg_companies_bootstrap_accounting_defaults
  AFTER INSERT ON public.companies
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_companies_after_insert_bootstrap_accounting();

COMMENT ON TRIGGER trg_companies_bootstrap_accounting_defaults ON public.companies IS
  'Provisions default accounts + income/expense categories for new tenants.';

-- One-time backfill for companies already in the database.
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT id FROM public.companies
  LOOP
    PERFORM public.bootstrap_company_accounting_defaults(r.id);
  END LOOP;
END;
$$;

-- Prevent arbitrary company_id provisioning via PostgREST/RPC; trigger still runs internally.
REVOKE ALL ON FUNCTION public.bootstrap_company_accounting_defaults(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.bootstrap_company_accounting_defaults(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.bootstrap_company_accounting_defaults(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.bootstrap_company_accounting_defaults(uuid) TO service_role;

COMMIT;
