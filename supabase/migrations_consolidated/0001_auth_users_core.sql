-- =============================================================================
-- Consolidated migration (module bundle): 0001_auth_users_core.sql
-- Sources merged in order (do not reorder):
--   01_create_users_table_and_auth_setup.sql
--   02_fix_users_rls_recursion.sql
-- =============================================================================


-- >>> begin: 01_create_users_table_and_auth_setup.sql
/* =============================================================================
   MODULE 1 — AUTHENTICATION & USER MANAGEMENT
   Migration: users table, FKs, RLS, indexes, triggers
   Run after configuring Auth in Supabase Dashboard (see SUPABASE_USER_MODULE_SETUP.md)
   ============================================================================= */

/* STEP 2: CREATE USERS TABLE */
CREATE TABLE public.users (
  id uuid PRIMARY KEY,
  full_name text NOT NULL,
  email text NOT NULL UNIQUE,
  phone text,
  role text NOT NULL CHECK (role IN ('Admin', 'Manager', 'Staff')),
  status text NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Inactive')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid NULL
);

COMMENT ON TABLE public.users IS 'App users; id matches auth.users(id). No hard delete — use status = Inactive.';

/* STEP 3: FOREIGN KEYS (NO ON DELETE CASCADE) */
-- Link to Supabase Auth; restrict auth user deletion so app user row is preserved
ALTER TABLE public.users
ADD CONSTRAINT fk_users_auth
FOREIGN KEY (id)
REFERENCES auth.users(id)
ON DELETE RESTRICT;

-- Self-reference for audit; if creator is removed, set created_by to NULL
ALTER TABLE public.users
ADD CONSTRAINT fk_users_created_by
FOREIGN KEY (created_by)
REFERENCES public.users(id)
ON DELETE SET NULL;

/* STEP 4: ROW LEVEL SECURITY */
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Admin: full access (SELECT, INSERT, UPDATE; DELETE blocked by trigger below)
CREATE POLICY "Admin full access"
ON public.users
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid()
    AND u.role = 'Admin'
  )
);

-- Manager: read only
CREATE POLICY "Manager read"
ON public.users
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid()
    AND u.role = 'Manager'
  )
);

-- Staff: own record only
CREATE POLICY "Staff own record"
ON public.users
FOR SELECT
USING (id = auth.uid());

/* STEP 5: INDEXES (email, role, status) */
CREATE INDEX idx_users_email ON public.users(email);
CREATE INDEX idx_users_role ON public.users(role);
CREATE INDEX idx_users_status ON public.users(status);

/* STEP 6: AUTO UPDATE updated_at */
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_users_updated_at
BEFORE UPDATE ON public.users
FOR EACH ROW
EXECUTE PROCEDURE update_updated_at_column();

/* BUSINESS RULE: NO HARD DELETE - use status = Inactive only */
CREATE OR REPLACE FUNCTION prevent_user_delete()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Hard delete not allowed. Set status to Inactive instead.';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_prevent_user_delete
BEFORE DELETE ON public.users
FOR EACH ROW
EXECUTE PROCEDURE prevent_user_delete();

-- 1) Disable hard-delete protection
-- DROP TRIGGER IF EXISTS trigger_prevent_user_delete ON public.users;
-- DROP FUNCTION IF EXISTS prevent_user_delete();
-- <<< end: 01_create_users_table_and_auth_setup.sql

-- >>> begin: 02_fix_users_rls_recursion.sql
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

-- <<< end: 02_fix_users_rls_recursion.sql
