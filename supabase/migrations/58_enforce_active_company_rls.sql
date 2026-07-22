/* =============================================================================
   Migration 58 — Enforce "active company" access for tenant business data

   Goal:
   - When a platform admin marks a company inactive (companies.is_active = false),
     tenant users must NOT be able to read/write any tenant business data.
   - Keep `public.companies` readable for the tenant so the mobile app can detect
     inactive status and show a dedicated "Company inactive" screen.

   Approach:
   - Add helper function public.is_my_company_active() used by RLS.
   - Update tenant policies (created in migration 51) to additionally require
     public.is_my_company_active() for SELECT/INSERT/UPDATE/DELETE.
   ============================================================================= */

BEGIN;

CREATE OR REPLACE FUNCTION public.is_my_company_active()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(c.is_active, false)
  FROM public.companies c
  WHERE c.id = public.get_my_company_id()
  LIMIT 1;
$$;

COMMENT ON FUNCTION public.is_my_company_active() IS
  'RLS helper: true when the current authenticated user belongs to an active company.';

REVOKE ALL ON FUNCTION public.is_my_company_active() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_my_company_active() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_my_company_active() TO service_role;

/* -----------------------------------------------------------------------------
   Tenant-scoped business tables: require active company
   ----------------------------------------------------------------------------- */

/* users + permissions (block tenant admin UI when inactive; keep own-row read policy intact) */
DROP POLICY IF EXISTS users_admin_same_company_all ON public.users;
CREATE POLICY users_admin_same_company_all
  ON public.users
  FOR ALL
  USING (
    public.get_my_role() = 'Admin'
    AND public.is_my_company_active()
    AND company_id = public.get_my_company_id()
    AND users.company_id = public.get_my_company_id()
  )
  WITH CHECK (
    public.get_my_role() = 'Admin'
    AND public.is_my_company_active()
    AND company_id = public.get_my_company_id()
    AND users.company_id = public.get_my_company_id()
  );

DROP POLICY IF EXISTS users_manager_same_company_select ON public.users;
CREATE POLICY users_manager_same_company_select
  ON public.users
  FOR SELECT
  USING (
    public.get_my_role() = 'Manager'
    AND public.is_my_company_active()
    AND users.company_id = public.get_my_company_id()
  );

DROP POLICY IF EXISTS user_permissions_admin_same_company ON public.user_permissions;
CREATE POLICY user_permissions_admin_same_company
  ON public.user_permissions
  FOR ALL
  USING (
    public.get_my_role() = 'Admin'
    AND public.is_my_company_active()
    AND EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = user_permissions.user_id
        AND u.company_id = public.get_my_company_id()
    )
  )
  WITH CHECK (
    public.get_my_role() = 'Admin'
    AND public.is_my_company_active()
    AND EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = user_permissions.user_id
        AND u.company_id = public.get_my_company_id()
    )
  );

/* taxes */
DROP POLICY IF EXISTS taxes_select_tenant ON public.taxes;
CREATE POLICY taxes_select_tenant ON public.taxes FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL AND company_id = public.get_my_company_id() AND public.is_my_company_active());
DROP POLICY IF EXISTS taxes_insert_tenant ON public.taxes;
CREATE POLICY taxes_insert_tenant ON public.taxes FOR INSERT TO authenticated
  WITH CHECK (company_id = public.get_my_company_id() AND public.is_my_company_active() AND public.get_my_role() IN ('Admin', 'Manager'));
DROP POLICY IF EXISTS taxes_update_tenant ON public.taxes;
CREATE POLICY taxes_update_tenant ON public.taxes FOR UPDATE TO authenticated
  USING (company_id = public.get_my_company_id() AND public.is_my_company_active() AND public.get_my_role() IN ('Admin', 'Manager'))
  WITH CHECK (company_id = public.get_my_company_id() AND public.is_my_company_active() AND public.get_my_role() IN ('Admin', 'Manager'));
DROP POLICY IF EXISTS taxes_delete_tenant ON public.taxes;
CREATE POLICY taxes_delete_tenant ON public.taxes FOR DELETE TO authenticated
  USING (company_id = public.get_my_company_id() AND public.is_my_company_active() AND public.get_my_role() = 'Admin');

/* suppliers */
DROP POLICY IF EXISTS suppliers_select_tenant ON public.suppliers;
CREATE POLICY suppliers_select_tenant ON public.suppliers FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL AND company_id = public.get_my_company_id() AND public.is_my_company_active());
DROP POLICY IF EXISTS suppliers_insert_tenant ON public.suppliers;
CREATE POLICY suppliers_insert_tenant ON public.suppliers FOR INSERT TO authenticated
  WITH CHECK (company_id = public.get_my_company_id() AND public.is_my_company_active() AND public.has_granted_permission('stock_in'::permission_type));
DROP POLICY IF EXISTS suppliers_update_tenant ON public.suppliers;
CREATE POLICY suppliers_update_tenant ON public.suppliers FOR UPDATE TO authenticated
  USING (company_id = public.get_my_company_id() AND public.is_my_company_active() AND public.has_granted_permission('stock_in'::permission_type))
  WITH CHECK (company_id = public.get_my_company_id() AND public.is_my_company_active() AND public.has_granted_permission('stock_in'::permission_type));
DROP POLICY IF EXISTS suppliers_delete_tenant ON public.suppliers;
CREATE POLICY suppliers_delete_tenant ON public.suppliers FOR DELETE TO authenticated
  USING (company_id = public.get_my_company_id() AND public.is_my_company_active() AND public.get_my_role() = 'Admin');

/* customers */
DROP POLICY IF EXISTS customers_select_tenant ON public.customers;
CREATE POLICY customers_select_tenant ON public.customers FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL AND company_id = public.get_my_company_id() AND public.is_my_company_active());
DROP POLICY IF EXISTS customers_insert_tenant ON public.customers;
CREATE POLICY customers_insert_tenant ON public.customers FOR INSERT TO authenticated
  WITH CHECK (company_id = public.get_my_company_id() AND public.is_my_company_active() AND public.get_my_role() IN ('Admin', 'Manager'));
DROP POLICY IF EXISTS customers_update_tenant ON public.customers;
CREATE POLICY customers_update_tenant ON public.customers FOR UPDATE TO authenticated
  USING (company_id = public.get_my_company_id() AND public.is_my_company_active() AND public.get_my_role() IN ('Admin', 'Manager'))
  WITH CHECK (company_id = public.get_my_company_id() AND public.is_my_company_active() AND public.get_my_role() IN ('Admin', 'Manager'));
DROP POLICY IF EXISTS customers_delete_tenant ON public.customers;
CREATE POLICY customers_delete_tenant ON public.customers FOR DELETE TO authenticated
  USING (company_id = public.get_my_company_id() AND public.is_my_company_active() AND public.get_my_role() = 'Admin');

/* product_categories */
DROP POLICY IF EXISTS product_categories_select_tenant ON public.product_categories;
CREATE POLICY product_categories_select_tenant ON public.product_categories FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL AND company_id = public.get_my_company_id() AND public.is_my_company_active());
DROP POLICY IF EXISTS product_categories_insert_tenant ON public.product_categories;
CREATE POLICY product_categories_insert_tenant ON public.product_categories FOR INSERT TO authenticated
  WITH CHECK (company_id = public.get_my_company_id() AND public.is_my_company_active() AND public.get_my_role() IN ('Admin', 'Manager'));
DROP POLICY IF EXISTS product_categories_update_tenant ON public.product_categories;
CREATE POLICY product_categories_update_tenant ON public.product_categories FOR UPDATE TO authenticated
  USING (company_id = public.get_my_company_id() AND public.is_my_company_active() AND public.get_my_role() IN ('Admin', 'Manager'))
  WITH CHECK (company_id = public.get_my_company_id() AND public.is_my_company_active() AND public.get_my_role() IN ('Admin', 'Manager'));
DROP POLICY IF EXISTS product_categories_delete_admin ON public.product_categories;
CREATE POLICY product_categories_delete_admin ON public.product_categories FOR DELETE TO authenticated
  USING (company_id = public.get_my_company_id() AND public.is_my_company_active() AND public.get_my_role() = 'Admin');

/* accounting_categories */
DROP POLICY IF EXISTS accounting_categories_select_tenant ON public.accounting_categories;
CREATE POLICY accounting_categories_select_tenant ON public.accounting_categories FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL AND company_id = public.get_my_company_id() AND public.is_my_company_active());
DROP POLICY IF EXISTS accounting_categories_admin_all ON public.accounting_categories;
CREATE POLICY accounting_categories_admin_all ON public.accounting_categories FOR ALL TO authenticated
  USING (company_id = public.get_my_company_id() AND public.is_my_company_active() AND public.get_my_role() = 'Admin')
  WITH CHECK (company_id = public.get_my_company_id() AND public.is_my_company_active() AND public.get_my_role() = 'Admin');
DROP POLICY IF EXISTS accounting_categories_mgr_staff_select ON public.accounting_categories;
CREATE POLICY accounting_categories_mgr_staff_select ON public.accounting_categories FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL AND company_id = public.get_my_company_id() AND public.is_my_company_active() AND public.get_my_role() IN ('Manager', 'Staff'));

/* products */
DROP POLICY IF EXISTS products_select_tenant ON public.products;
CREATE POLICY products_select_tenant ON public.products FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL AND company_id = public.get_my_company_id() AND public.is_my_company_active());
DROP POLICY IF EXISTS products_insert_tenant ON public.products;
CREATE POLICY products_insert_tenant ON public.products FOR INSERT TO authenticated
  WITH CHECK (company_id = public.get_my_company_id() AND public.is_my_company_active() AND public.has_granted_permission('stock_in'::permission_type));
DROP POLICY IF EXISTS products_update_tenant ON public.products;
CREATE POLICY products_update_tenant ON public.products FOR UPDATE TO authenticated
  USING (company_id = public.get_my_company_id() AND public.is_my_company_active() AND public.has_granted_permission('stock_in'::permission_type))
  WITH CHECK (company_id = public.get_my_company_id() AND public.is_my_company_active() AND public.has_granted_permission('stock_in'::permission_type));
DROP POLICY IF EXISTS products_delete_admin ON public.products;
CREATE POLICY products_delete_admin ON public.products FOR DELETE TO authenticated
  USING (company_id = public.get_my_company_id() AND public.is_my_company_active() AND public.get_my_role() = 'Admin');

/* stock_in */
DROP POLICY IF EXISTS stock_in_select_tenant ON public.stock_in;
CREATE POLICY stock_in_select_tenant ON public.stock_in FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL AND company_id = public.get_my_company_id() AND public.is_my_company_active());
DROP POLICY IF EXISTS stock_in_insert_tenant ON public.stock_in;
CREATE POLICY stock_in_insert_tenant ON public.stock_in FOR INSERT TO authenticated
  WITH CHECK (company_id = public.get_my_company_id() AND public.is_my_company_active() AND auth.uid() IS NOT NULL);

/* stock_in_items */
DROP POLICY IF EXISTS stock_in_items_select_tenant ON public.stock_in_items;
CREATE POLICY stock_in_items_select_tenant ON public.stock_in_items FOR SELECT TO authenticated
  USING (company_id = public.get_my_company_id() AND public.is_my_company_active());
DROP POLICY IF EXISTS stock_in_items_insert_tenant ON public.stock_in_items;
CREATE POLICY stock_in_items_insert_tenant ON public.stock_in_items FOR INSERT TO authenticated
  WITH CHECK (company_id = public.get_my_company_id() AND public.is_my_company_active());

/* stock_transactions */
DROP POLICY IF EXISTS stock_transactions_select_tenant ON public.stock_transactions;
CREATE POLICY stock_transactions_select_tenant ON public.stock_transactions FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL AND company_id = public.get_my_company_id() AND public.is_my_company_active());
DROP POLICY IF EXISTS stock_transactions_insert_tenant ON public.stock_transactions;
CREATE POLICY stock_transactions_insert_tenant ON public.stock_transactions FOR INSERT TO authenticated
  WITH CHECK (company_id = public.get_my_company_id() AND public.is_my_company_active() AND auth.uid() IS NOT NULL);

/* bills */
DROP POLICY IF EXISTS bills_select_tenant ON public.bills;
CREATE POLICY bills_select_tenant ON public.bills FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL AND company_id = public.get_my_company_id() AND public.is_my_company_active());
DROP POLICY IF EXISTS bills_insert_tenant ON public.bills;
CREATE POLICY bills_insert_tenant ON public.bills FOR INSERT TO authenticated
  WITH CHECK (company_id = public.get_my_company_id() AND public.is_my_company_active() AND auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS bills_update_tenant ON public.bills;
CREATE POLICY bills_update_tenant ON public.bills FOR UPDATE TO authenticated
  USING (company_id = public.get_my_company_id() AND public.is_my_company_active() AND auth.uid() IS NOT NULL)
  WITH CHECK (company_id = public.get_my_company_id() AND public.is_my_company_active());

/* bill_items */
DROP POLICY IF EXISTS bill_items_select_tenant ON public.bill_items;
CREATE POLICY bill_items_select_tenant ON public.bill_items FOR SELECT TO authenticated
  USING (company_id = public.get_my_company_id() AND public.is_my_company_active());
DROP POLICY IF EXISTS bill_items_insert_tenant ON public.bill_items;
CREATE POLICY bill_items_insert_tenant ON public.bill_items FOR INSERT TO authenticated
  WITH CHECK (company_id = public.get_my_company_id() AND public.is_my_company_active());

/* bill_returns */
DROP POLICY IF EXISTS bill_returns_select_tenant ON public.bill_returns;
CREATE POLICY bill_returns_select_tenant ON public.bill_returns FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL AND company_id = public.get_my_company_id() AND public.is_my_company_active());
DROP POLICY IF EXISTS bill_returns_insert_tenant ON public.bill_returns;
CREATE POLICY bill_returns_insert_tenant ON public.bill_returns FOR INSERT TO authenticated
  WITH CHECK (company_id = public.get_my_company_id() AND public.is_my_company_active() AND auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS bill_returns_update_tenant ON public.bill_returns;
CREATE POLICY bill_returns_update_tenant ON public.bill_returns FOR UPDATE TO authenticated
  USING (company_id = public.get_my_company_id() AND public.is_my_company_active() AND auth.uid() IS NOT NULL)
  WITH CHECK (company_id = public.get_my_company_id() AND public.is_my_company_active());

/* bill_return_items */
DROP POLICY IF EXISTS bill_return_items_select_tenant ON public.bill_return_items;
CREATE POLICY bill_return_items_select_tenant ON public.bill_return_items FOR SELECT TO authenticated
  USING (company_id = public.get_my_company_id() AND public.is_my_company_active());
DROP POLICY IF EXISTS bill_return_items_insert_tenant ON public.bill_return_items;
CREATE POLICY bill_return_items_insert_tenant ON public.bill_return_items FOR INSERT TO authenticated
  WITH CHECK (company_id = public.get_my_company_id() AND public.is_my_company_active());

/* accounts */
DROP POLICY IF EXISTS accounts_admin_full_access_tenant ON public.accounts;
CREATE POLICY accounts_admin_full_access_tenant ON public.accounts FOR ALL TO authenticated
  USING (auth.uid() IS NOT NULL AND company_id = public.get_my_company_id() AND public.is_my_company_active() AND public.get_my_role() = 'Admin')
  WITH CHECK (company_id = public.get_my_company_id() AND public.is_my_company_active() AND public.get_my_role() = 'Admin');
DROP POLICY IF EXISTS accounts_manager_staff_select_tenant ON public.accounts;
CREATE POLICY accounts_manager_staff_select_tenant ON public.accounts FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL AND company_id = public.get_my_company_id() AND public.is_my_company_active() AND public.get_my_role() IN ('Admin', 'Manager', 'Staff'));

/* entries */
DROP POLICY IF EXISTS entries_admin_full_access_tenant ON public.entries;
CREATE POLICY entries_admin_full_access_tenant ON public.entries FOR ALL TO authenticated
  USING (auth.uid() IS NOT NULL AND company_id = public.get_my_company_id() AND public.is_my_company_active() AND public.get_my_role() = 'Admin')
  WITH CHECK (company_id = public.get_my_company_id() AND public.is_my_company_active() AND public.get_my_role() = 'Admin');
DROP POLICY IF EXISTS entries_select_tenant ON public.entries;
CREATE POLICY entries_select_tenant ON public.entries FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL AND company_id = public.get_my_company_id() AND public.is_my_company_active() AND public.get_my_role() IN ('Admin', 'Manager', 'Staff'));
DROP POLICY IF EXISTS entries_insert_tenant ON public.entries;
CREATE POLICY entries_insert_tenant ON public.entries FOR INSERT TO authenticated
  WITH CHECK (company_id = public.get_my_company_id() AND public.is_my_company_active() AND public.get_my_role() IN ('Admin', 'Manager', 'Staff'));
DROP POLICY IF EXISTS entries_admin_update_tenant ON public.entries;
CREATE POLICY entries_admin_update_tenant ON public.entries FOR UPDATE TO authenticated
  USING (company_id = public.get_my_company_id() AND public.is_my_company_active() AND public.get_my_role() = 'Admin')
  WITH CHECK (company_id = public.get_my_company_id() AND public.is_my_company_active() AND public.get_my_role() = 'Admin');
DROP POLICY IF EXISTS entries_admin_delete_tenant ON public.entries;
CREATE POLICY entries_admin_delete_tenant ON public.entries FOR DELETE TO authenticated
  USING (company_id = public.get_my_company_id() AND public.is_my_company_active() AND public.get_my_role() = 'Admin');

/* activity_log */
DROP POLICY IF EXISTS activity_log_insert_own ON public.activity_log;
CREATE POLICY activity_log_insert_own
  ON public.activity_log
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND public.is_my_company_active()
    AND user_id = auth.uid()
    AND company_id = public.get_my_company_id()
  );

DROP POLICY IF EXISTS activity_log_select_admin_manager ON public.activity_log;
CREATE POLICY activity_log_select_admin_manager
  ON public.activity_log
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() IS NOT NULL
    AND public.is_my_company_active()
    AND company_id = public.get_my_company_id()
    AND public.get_my_role() IN ('Admin', 'Manager')
  );

DROP POLICY IF EXISTS activity_log_select_own_staff ON public.activity_log;
CREATE POLICY activity_log_select_own_staff
  ON public.activity_log
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() IS NOT NULL
    AND public.is_my_company_active()
    AND company_id = public.get_my_company_id()
    AND public.get_my_role() = 'Staff'
    AND user_id = auth.uid()
  );

DROP POLICY IF EXISTS activity_log_delete_admin ON public.activity_log;
CREATE POLICY activity_log_delete_admin
  ON public.activity_log
  FOR DELETE
  TO authenticated
  USING (
    public.is_my_company_active()
    AND company_id = public.get_my_company_id()
    AND public.get_my_role() = 'Admin'
  );

COMMIT;

