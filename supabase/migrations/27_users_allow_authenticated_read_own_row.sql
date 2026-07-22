/* =============================================================================
   Ensure authenticated users can always read their own row from public.users.
   Fixes "User not found" when the row exists but role-based policies (get_my_role)
   or RLS edge cases prevent the select from returning the row.
   ============================================================================= */

-- Allow any authenticated user to read their own user row (id = auth.uid()).
-- This does not grant access to other users' rows; Admin/Manager policies still
-- control access to other rows.
CREATE POLICY "Authenticated read own user row"
ON public.users
FOR SELECT
USING (id = auth.uid());
