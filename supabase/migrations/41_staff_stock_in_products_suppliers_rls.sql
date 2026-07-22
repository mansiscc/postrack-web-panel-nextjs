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
