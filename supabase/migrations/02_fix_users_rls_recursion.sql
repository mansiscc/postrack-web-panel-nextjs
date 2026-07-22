/* =============================================================================
   Fix: infinite recursion in RLS policies on public.users
   Cause: Policies used EXISTS (SELECT FROM public.users), which re-triggered RLS.
   Fix: Use a SECURITY DEFINER function to read current user's role (bypasses RLS).
   ============================================================================= */

/* Helper: returns the current user's role from public.users without triggering RLS */
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.users WHERE id = auth.uid() LIMIT 1;
$$;

COMMENT ON FUNCTION public.get_my_role() IS 'Current user role for RLS; avoids recursion by not using RLS when reading users.';

/* Drop policies that caused recursion (they selected from public.users) */
DROP POLICY IF EXISTS "Admin full access" ON public.users;
DROP POLICY IF EXISTS "Manager read" ON public.users;
DROP POLICY IF EXISTS "Staff own record" ON public.users;

/* Recreate policies using get_my_role() so no policy reads from users */
CREATE POLICY "Admin full access"
ON public.users
FOR ALL
USING (public.get_my_role() = 'Admin')
WITH CHECK (public.get_my_role() = 'Admin');

CREATE POLICY "Manager read"
ON public.users
FOR SELECT
USING (public.get_my_role() = 'Manager');

CREATE POLICY "Staff own record"
ON public.users
FOR SELECT
USING (id = auth.uid());
