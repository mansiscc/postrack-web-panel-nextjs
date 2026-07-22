/* Treat companies.is_deleted like suspension: tenant data RLS must block access.
   companies_tenant_select stays permissive so the mobile app can still read the row
   and show inactive / removed-company UI (same pattern as is_active). */

BEGIN;

CREATE OR REPLACE FUNCTION public.is_my_company_active()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(c.is_active, false)
    AND NOT COALESCE(c.is_deleted, false)
  FROM public.companies c
  WHERE c.id = public.get_my_company_id()
  LIMIT 1;
$$;

COMMENT ON FUNCTION public.is_my_company_active() IS
  'RLS helper: true when the current user''s company is active and not soft-deleted.';

/* Block tenant Admin updates to companies when the tenant is inactive or deleted. */
DROP POLICY IF EXISTS companies_tenant_admin_update ON public.companies;
CREATE POLICY companies_tenant_admin_update
  ON public.companies
  FOR UPDATE
  TO authenticated
  USING (
    public.get_my_role() = 'Admin'
    AND id = public.get_my_company_id()
    AND public.is_my_company_active()
  )
  WITH CHECK (
    public.get_my_role() = 'Admin'
    AND id = public.get_my_company_id()
    AND public.is_my_company_active()
  );

COMMIT;
