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