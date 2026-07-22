-- =============================================================================
-- 65_super_admin_accounting_categories_accounts_rls.sql
--
-- Problem:
--   After migration 54, new companies get default rows in accounting_categories
--   and accounts via AFTER INSERT trigger → bootstrap_company_accounting_defaults().
--   That trigger runs in the same session as the caller (platform super admin).
--   RLS on those tables (migration 58) only allows tenant Admin rows where
--   company_id = get_my_company_id(). Super admins are not that tenant Admin,
--   so bootstrap INSERTs fail with "new row violates row-level security policy"
--   and the whole companies INSERT rolls back — "Convert to company" breaks.
--
-- Fix:
--   Add permissive super-admin policies (same pattern as companies_super_admin_*).
-- =============================================================================

BEGIN;

DROP POLICY IF EXISTS accounting_categories_super_admin_all ON public.accounting_categories;
CREATE POLICY accounting_categories_super_admin_all
  ON public.accounting_categories
  FOR ALL
  TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS accounts_super_admin_all ON public.accounts;
CREATE POLICY accounts_super_admin_all
  ON public.accounts
  FOR ALL
  TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

COMMIT;
