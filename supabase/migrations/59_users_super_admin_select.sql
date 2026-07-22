/* Allow platform super admins (admin panel) to read all tenant users for
   support, company detail user counts, and user listings. Tenant-scoped
   policies remain unchanged for POS app users. */

BEGIN;

DROP POLICY IF EXISTS users_super_admin_select ON public.users;

CREATE POLICY users_super_admin_select
  ON public.users
  FOR SELECT
  TO authenticated
  USING (public.is_super_admin());

COMMIT;
