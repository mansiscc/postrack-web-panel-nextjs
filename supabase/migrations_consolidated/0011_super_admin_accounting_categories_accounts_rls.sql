-- =============================================================================
-- 0011_super_admin_accounting_categories_accounts_rls.sql
--
-- Mirrors incremental migration 65_super_admin_accounting_categories_accounts_rls.sql
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
