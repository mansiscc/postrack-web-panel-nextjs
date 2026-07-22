/* =============================================================================
   MODULE — USER PERMISSIONS
   Migration: permission_type enum and user_permissions table
   Extends users with granular permissions (stock_in, stock_out) for role-based
   access. Admin: full access; Staff: access per user_permissions rows.
   ============================================================================= */

/* STEP 1 — CREATE PERMISSION ENUM */
CREATE TYPE permission_type AS ENUM (
  'stock_in',
  'stock_out'
);

COMMENT ON TYPE permission_type IS 'Granular permissions: stock_in (storekeeper), stock_out (cashier), both (supervisor).';

/* STEP 2 — CREATE USER PERMISSIONS TABLE */
CREATE TABLE public.user_permissions (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL,
  permission permission_type NOT NULL,
  granted    boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT fk_user_permissions_user
    FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE RESTRICT
);

COMMENT ON TABLE public.user_permissions IS 'Per-user permissions for Staff; Admin has full access regardless of rows here.';
COMMENT ON COLUMN public.user_permissions.granted IS 'true = permission granted, false = explicitly revoked.';

/* STEP 3 — PREVENT DUPLICATE PERMISSIONS */
ALTER TABLE public.user_permissions
ADD CONSTRAINT unique_user_permission
UNIQUE (user_id, permission);

/* STEP 4 — INDEXES FOR PERFORMANCE */
CREATE INDEX idx_user_permissions_user
ON public.user_permissions(user_id);

CREATE INDEX idx_user_permissions_permission
ON public.user_permissions(permission);

/* STEP 5 — AUTO UPDATE updated_at (reuses existing function from 01_create_users_table_and_auth_setup) */
CREATE TRIGGER trigger_update_user_permissions_updated_at
BEFORE UPDATE ON public.user_permissions
FOR EACH ROW
EXECUTE PROCEDURE update_updated_at_column();

/* STEP 6 — ROW LEVEL SECURITY */
ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;

-- Admin users can manage permissions (full CRUD)
CREATE POLICY "Admin manage permissions"
ON public.user_permissions
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid()
    AND u.role = 'Admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid()
    AND u.role = 'Admin'
  )
);

-- Users can read their own permissions
CREATE POLICY "User read own permissions"
ON public.user_permissions
FOR SELECT
USING (
  user_id = auth.uid()
);

/* =============================================================================
   BUSINESS RULES (application logic; not enforced in DB)
   -----------------------------------------------------------------------------
   Admin:   Full system access; ignore user_permissions table.
   Manager: Default operational access (optional future rule).
   Staff:   Access depends on rows in user_permissions:
     - Cashier:     permission = stock_out
     - Storekeeper: permission = stock_in
     - Supervisor:  permission = stock_in + stock_out
   ============================================================================= */
