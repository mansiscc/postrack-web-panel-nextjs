/* =============================================================================
   Migration 51 — Multi-tenant foundation (companies, leads, super_admins, company_id, activity_log)

   Goals:
   - Introduce public.leads (website / sales pipeline).
   - Introduce public.activity_log (POS tenant audit trail; not for super_admins).
   - Introduce public.super_admins (platform operators; not in public.users).
   - Rename public.business_profile → public.companies and drop singleton guard.
   - Add company_id across tenant-owned tables; backfill from the existing company row.
   - Add helpers: get_my_company_id(), is_super_admin().
   - Scope bill / return number generation and stock_transactions by company.
   - Replace permissive RLS with company-scoped policies (POS remains tenant-only).

   Notes:
   - First super admin row should be inserted with service_role (or SQL as postgres);
     POS app does not use super_admins.
   - Legacy clients that omit company_id on INSERT get company_id filled by BEFORE
     triggers where listed, using get_my_company_id().
   ============================================================================= */

BEGIN;

/* -----------------------------------------------------------------------------
   1) super_admins (no dependency on companies)
   ----------------------------------------------------------------------------- */
CREATE TABLE IF NOT EXISTS public.super_admins (
  id         uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email      text NOT NULL UNIQUE,
  full_name  text,
  status     text NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Inactive')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.super_admins IS
  'Platform operators (admin panel). Not tenant users; must not appear in public.users.';

DROP TRIGGER IF EXISTS trigger_update_super_admins_updated_at ON public.super_admins;
CREATE TRIGGER trigger_update_super_admins_updated_at
  BEFORE UPDATE ON public.super_admins
  FOR EACH ROW
  EXECUTE PROCEDURE public.update_updated_at_column();

/* -----------------------------------------------------------------------------
   2) Rename business_profile → companies; tenant columns; comments
   ----------------------------------------------------------------------------- */
DO $$
BEGIN
  IF to_regclass('public.business_profile') IS NOT NULL
     AND to_regclass('public.companies') IS NULL THEN
    ALTER TABLE public.business_profile RENAME TO companies;
  END IF;
END;
$$;

ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS owner_email text,
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

COMMENT ON TABLE public.companies IS
  'Tenant (store) profile: branding, invoice prefix, activation; one row per company.';

DROP INDEX IF EXISTS public.uq_business_profile_singleton;

INSERT INTO public.companies (business_name, invoice_prefix, owner_email, is_active)
SELECT 'Default company', 'B', NULL, true
WHERE NOT EXISTS (SELECT 1 FROM public.companies);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'companies'
      AND t.tgname = 'trigger_update_business_profile_updated_at'
  ) THEN
    EXECUTE 'ALTER TRIGGER trigger_update_business_profile_updated_at ON public.companies RENAME TO trigger_update_companies_updated_at';
  END IF;
END;
$$;

/* -----------------------------------------------------------------------------
   2b) leads (references companies)
   ----------------------------------------------------------------------------- */
CREATE TABLE IF NOT EXISTS public.leads (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_name        text,
  contact_name         text,
  email                text NOT NULL,
  phone                text,
  message              text,
  status               text NOT NULL DEFAULT 'New'
    CHECK (status IN ('New', 'Contacted', 'Interested', 'Approved', 'Not Interested')),
  converted_company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.leads DROP COLUMN IF EXISTS metadata;

COMMENT ON TABLE public.leads IS
  'Inbound leads from website or other channels; managed by platform super admins.';

CREATE INDEX IF NOT EXISTS idx_leads_status ON public.leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_created_at ON public.leads(created_at);

DROP TRIGGER IF EXISTS trigger_update_leads_updated_at ON public.leads;
CREATE TRIGGER trigger_update_leads_updated_at
  BEFORE UPDATE ON public.leads
  FOR EACH ROW
  EXECUTE PROCEDURE public.update_updated_at_column();

/* -----------------------------------------------------------------------------
   3) users.company_id (required after backfill)
   ----------------------------------------------------------------------------- */
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id) ON DELETE RESTRICT;

UPDATE public.users u
SET company_id = c.id
FROM (
  SELECT id
  FROM public.companies
  ORDER BY created_at ASC
  LIMIT 1
) c
WHERE u.company_id IS NULL;

ALTER TABLE public.users
  ALTER COLUMN company_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_users_company_id ON public.users(company_id);

/* -----------------------------------------------------------------------------
   3b) activity_log — POS app audit trail (company-scoped; not used by super_admins)
   Aligns with ACTIVITY_LOG_MODULE: who, what, when, record, result; optional snapshots & IP.
   ----------------------------------------------------------------------------- */
CREATE TABLE IF NOT EXISTS public.activity_log (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id       uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  user_name     text NOT NULL,
  action_type   text NOT NULL
    CHECK (action_type IN ('Create', 'Update', 'Delete', 'Login', 'Logout')),
  module_name   text NOT NULL,
  record_id     text,
  description   text NOT NULL,
  status        text NOT NULL CHECK (status IN ('Success', 'Failed')),
  ip_address    text,
  old_values    jsonb,
  new_values    jsonb,
  created_at    timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.activity_log IS
  'Append-only POS activity audit: user, action, module, record, outcome; scoped by company_id.';

CREATE INDEX IF NOT EXISTS idx_activity_log_company_created
  ON public.activity_log(company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_log_company_user
  ON public.activity_log(company_id, user_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_company_action
  ON public.activity_log(company_id, action_type);
CREATE INDEX IF NOT EXISTS idx_activity_log_company_module
  ON public.activity_log(company_id, module_name);
CREATE INDEX IF NOT EXISTS idx_activity_log_company_status
  ON public.activity_log(company_id, status);

/* -----------------------------------------------------------------------------
   4) Tenant column on business tables (nullable → backfill → NOT NULL)
   ----------------------------------------------------------------------------- */
ALTER TABLE public.taxes ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id);
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id);
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id);
ALTER TABLE public.product_categories ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id);
ALTER TABLE public.accounting_categories ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id);
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id);
ALTER TABLE public.stock_in ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id);
ALTER TABLE public.stock_in_items ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id);
ALTER TABLE public.stock_transactions ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id);
ALTER TABLE public.bills ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id);
ALTER TABLE public.bill_items ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id);
ALTER TABLE public.bill_returns ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id);
ALTER TABLE public.bill_return_items ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id);
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id);
ALTER TABLE public.entries ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id);

UPDATE public.taxes t
SET company_id = c.id
FROM (SELECT id FROM public.companies ORDER BY created_at ASC LIMIT 1) c
WHERE t.company_id IS NULL;

UPDATE public.suppliers s
SET company_id = c.id
FROM (SELECT id FROM public.companies ORDER BY created_at ASC LIMIT 1) c
WHERE s.company_id IS NULL;

UPDATE public.customers cu
SET company_id = c.id
FROM (SELECT id FROM public.companies ORDER BY created_at ASC LIMIT 1) c
WHERE cu.company_id IS NULL;

UPDATE public.product_categories pc
SET company_id = c.id
FROM (SELECT id FROM public.companies ORDER BY created_at ASC LIMIT 1) c
WHERE pc.company_id IS NULL;

UPDATE public.accounting_categories ac
SET company_id = c.id
FROM (SELECT id FROM public.companies ORDER BY created_at ASC LIMIT 1) c
WHERE ac.company_id IS NULL;

UPDATE public.products p
SET company_id = c.id
FROM (SELECT id FROM public.companies ORDER BY created_at ASC LIMIT 1) c
WHERE p.company_id IS NULL;

UPDATE public.stock_in si
SET company_id = c.id
FROM (SELECT id FROM public.companies ORDER BY created_at ASC LIMIT 1) c
WHERE si.company_id IS NULL;

UPDATE public.stock_in_items sii
SET company_id = si.company_id
FROM public.stock_in si
WHERE sii.stock_in_id = si.id AND sii.company_id IS NULL;

UPDATE public.bills b
SET company_id = c.id
FROM (SELECT id FROM public.companies ORDER BY created_at ASC LIMIT 1) c
WHERE b.company_id IS NULL;

UPDATE public.bill_items bi
SET company_id = b.company_id
FROM public.bills b
WHERE bi.bill_id = b.id AND bi.company_id IS NULL;

UPDATE public.bill_returns br
SET company_id = b.company_id
FROM public.bills b
WHERE br.bill_id = b.id AND br.company_id IS NULL;

UPDATE public.bill_return_items bri
SET company_id = br.company_id
FROM public.bill_returns br
WHERE bri.return_id = br.id AND bri.company_id IS NULL;

UPDATE public.accounts a
SET company_id = c.id
FROM (SELECT id FROM public.companies ORDER BY created_at ASC LIMIT 1) c
WHERE a.company_id IS NULL;

UPDATE public.entries e
SET company_id = a.company_id
FROM public.accounts a
WHERE e.account_id = a.id AND e.company_id IS NULL;

UPDATE public.stock_transactions st
SET company_id = p.company_id
FROM public.products p
WHERE st.product_id = p.id AND st.company_id IS NULL;

ALTER TABLE public.taxes ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE public.suppliers ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE public.customers ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE public.product_categories ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE public.accounting_categories ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE public.products ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE public.stock_in ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE public.stock_in_items ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE public.stock_transactions ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE public.bills ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE public.bill_items ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE public.bill_returns ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE public.bill_return_items ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE public.accounts ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE public.entries ALTER COLUMN company_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_taxes_company_id ON public.taxes(company_id);
CREATE INDEX IF NOT EXISTS idx_suppliers_company_id ON public.suppliers(company_id);
CREATE INDEX IF NOT EXISTS idx_customers_company_id ON public.customers(company_id);
CREATE INDEX IF NOT EXISTS idx_product_categories_company_id ON public.product_categories(company_id);
CREATE INDEX IF NOT EXISTS idx_accounting_categories_company_id ON public.accounting_categories(company_id);
CREATE INDEX IF NOT EXISTS idx_products_company_id ON public.products(company_id);
CREATE INDEX IF NOT EXISTS idx_stock_in_company_id ON public.stock_in(company_id);
CREATE INDEX IF NOT EXISTS idx_stock_in_items_company_id ON public.stock_in_items(company_id);
CREATE INDEX IF NOT EXISTS idx_stock_transactions_company_id ON public.stock_transactions(company_id);
CREATE INDEX IF NOT EXISTS idx_bills_company_id ON public.bills(company_id);
CREATE INDEX IF NOT EXISTS idx_bill_items_company_id ON public.bill_items(company_id);
CREATE INDEX IF NOT EXISTS idx_bill_returns_company_id ON public.bill_returns(company_id);
CREATE INDEX IF NOT EXISTS idx_bill_return_items_company_id ON public.bill_return_items(company_id);
CREATE INDEX IF NOT EXISTS idx_accounts_company_id ON public.accounts(company_id);
CREATE INDEX IF NOT EXISTS idx_entries_company_id ON public.entries(company_id);

/* -----------------------------------------------------------------------------
   5) Composite / partial uniqueness (per company)
   ----------------------------------------------------------------------------- */
ALTER TABLE public.customers DROP CONSTRAINT IF EXISTS uq_customers_company_phone;
ALTER TABLE public.customers DROP CONSTRAINT IF EXISTS uq_customers_phone;
ALTER TABLE public.customers
  ADD CONSTRAINT uq_customers_company_phone UNIQUE (company_id, phone);

ALTER TABLE public.product_categories DROP CONSTRAINT IF EXISTS uq_product_categories_company_name;
ALTER TABLE public.product_categories DROP CONSTRAINT IF EXISTS uq_product_categories_name;
ALTER TABLE public.product_categories
  ADD CONSTRAINT uq_product_categories_company_name UNIQUE (company_id, name);

ALTER TABLE public.accounting_categories DROP CONSTRAINT IF EXISTS uq_accounting_categories_company_name_type;
ALTER TABLE public.accounting_categories DROP CONSTRAINT IF EXISTS uq_accounting_categories_name_type;
ALTER TABLE public.accounting_categories
  ADD CONSTRAINT uq_accounting_categories_company_name_type UNIQUE (company_id, name, type);

DROP INDEX IF EXISTS public.accounts_name_unique_idx;
CREATE UNIQUE INDEX IF NOT EXISTS uq_accounts_company_name
  ON public.accounts(company_id, name);

ALTER TABLE public.products DROP CONSTRAINT IF EXISTS uq_products_barcode;
CREATE UNIQUE INDEX IF NOT EXISTS uq_products_company_barcode
  ON public.products(company_id, barcode)
  WHERE barcode IS NOT NULL;

ALTER TABLE public.bills DROP CONSTRAINT IF EXISTS uq_bills_company_bill_number;
ALTER TABLE public.bills DROP CONSTRAINT IF EXISTS uq_bills_bill_number;
ALTER TABLE public.bills
  ADD CONSTRAINT uq_bills_company_bill_number UNIQUE (company_id, bill_number);

ALTER TABLE public.bill_returns DROP CONSTRAINT IF EXISTS uq_bill_returns_company_return_number;
ALTER TABLE public.bill_returns DROP CONSTRAINT IF EXISTS bill_returns_return_number_key;
ALTER TABLE public.bill_returns
  ADD CONSTRAINT uq_bill_returns_company_return_number UNIQUE (company_id, return_number);

/* -----------------------------------------------------------------------------
   6) Helper functions (tenant + platform) — before policies that call them
   ----------------------------------------------------------------------------- */
CREATE OR REPLACE FUNCTION public.get_my_company_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT company_id FROM public.users WHERE id = auth.uid() LIMIT 1;
$$;

COMMENT ON FUNCTION public.get_my_company_id() IS
  'Current POS user company_id from public.users; bypasses RLS.';

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.super_admins sa
    WHERE sa.id = auth.uid()
      AND sa.status = 'Active'
  );
$$;

COMMENT ON FUNCTION public.is_super_admin() IS
  'True when auth.uid() is an Active row in public.super_admins.';

REVOKE ALL ON FUNCTION public.get_my_company_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_company_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_company_id() TO service_role;

REVOKE ALL ON FUNCTION public.is_super_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_super_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_super_admin() TO service_role;

/* -----------------------------------------------------------------------------
   7) RLS: leads & super_admins
   ----------------------------------------------------------------------------- */
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS leads_super_admin_all ON public.leads;
CREATE POLICY leads_super_admin_all
  ON public.leads
  FOR ALL
  TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS leads_service_role_all ON public.leads;
CREATE POLICY leads_service_role_all
  ON public.leads
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

ALTER TABLE public.super_admins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS super_admins_service_role_all ON public.super_admins;
CREATE POLICY super_admins_service_role_all
  ON public.super_admins
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS super_admins_self_read ON public.super_admins;
CREATE POLICY super_admins_self_read
  ON public.super_admins
  FOR SELECT
  TO authenticated
  USING (id = auth.uid() AND status = 'Active');

DROP POLICY IF EXISTS super_admins_select_all_if_super ON public.super_admins;
CREATE POLICY super_admins_select_all_if_super
  ON public.super_admins
  FOR SELECT
  TO authenticated
  USING (public.is_super_admin());

/* -----------------------------------------------------------------------------
   8) companies RLS (replace legacy business_profile policies)
   ----------------------------------------------------------------------------- */
DROP POLICY IF EXISTS "Authenticated users can read business_profile" ON public.companies;
DROP POLICY IF EXISTS "Admin can insert business_profile" ON public.companies;
DROP POLICY IF EXISTS "Admin can update business_profile" ON public.companies;

DROP POLICY IF EXISTS companies_tenant_select ON public.companies;
CREATE POLICY companies_tenant_select
  ON public.companies
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() IS NOT NULL
    AND (
      id = public.get_my_company_id()
      OR public.is_super_admin()
    )
  );

DROP POLICY IF EXISTS companies_super_admin_insert ON public.companies;
CREATE POLICY companies_super_admin_insert
  ON public.companies
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS companies_tenant_admin_update ON public.companies;
CREATE POLICY companies_tenant_admin_update
  ON public.companies
  FOR UPDATE
  TO authenticated
  USING (
    public.get_my_role() = 'Admin'
    AND id = public.get_my_company_id()
  )
  WITH CHECK (
    public.get_my_role() = 'Admin'
    AND id = public.get_my_company_id()
  );

DROP POLICY IF EXISTS companies_super_admin_update ON public.companies;
CREATE POLICY companies_super_admin_update
  ON public.companies
  FOR UPDATE
  TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

/* -----------------------------------------------------------------------------
   9) users RLS — same company
   ----------------------------------------------------------------------------- */
DROP POLICY IF EXISTS "Admin full access" ON public.users;
DROP POLICY IF EXISTS "Manager read" ON public.users;
DROP POLICY IF EXISTS "Staff own record" ON public.users;
DROP POLICY IF EXISTS "Authenticated read own user row" ON public.users;

CREATE POLICY users_admin_same_company_all
  ON public.users
  FOR ALL
  USING (
    public.get_my_role() = 'Admin'
    AND company_id = public.get_my_company_id()
    AND users.company_id = public.get_my_company_id()
  )
  WITH CHECK (
    public.get_my_role() = 'Admin'
    AND company_id = public.get_my_company_id()
    AND users.company_id = public.get_my_company_id()
  );

CREATE POLICY users_manager_same_company_select
  ON public.users
  FOR SELECT
  USING (
    public.get_my_role() = 'Manager'
    AND users.company_id = public.get_my_company_id()
  );

CREATE POLICY users_staff_own_select
  ON public.users
  FOR SELECT
  USING (id = auth.uid());

CREATE POLICY users_authenticated_read_own_row
  ON public.users
  FOR SELECT
  USING (id = auth.uid());

/* -----------------------------------------------------------------------------
   10) user_permissions — same company as target user
   ----------------------------------------------------------------------------- */
DROP POLICY IF EXISTS "Admin manage permissions" ON public.user_permissions;
CREATE POLICY user_permissions_admin_same_company
  ON public.user_permissions
  FOR ALL
  USING (
    public.get_my_role() = 'Admin'
    AND EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = user_permissions.user_id
        AND u.company_id = public.get_my_company_id()
    )
  )
  WITH CHECK (
    public.get_my_role() = 'Admin'
    AND EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = user_permissions.user_id
        AND u.company_id = public.get_my_company_id()
    )
  );

/* -----------------------------------------------------------------------------
   11) BEFORE INSERT: default company_id when omitted (legacy clients)
   ----------------------------------------------------------------------------- */
CREATE OR REPLACE FUNCTION public.tenant_default_company_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.company_id IS NULL THEN
    NEW.company_id := public.get_my_company_id();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_taxes_default_company ON public.taxes;
CREATE TRIGGER trg_taxes_default_company
  BEFORE INSERT ON public.taxes
  FOR EACH ROW
  EXECUTE PROCEDURE public.tenant_default_company_id();

DROP TRIGGER IF EXISTS trg_suppliers_default_company ON public.suppliers;
CREATE TRIGGER trg_suppliers_default_company
  BEFORE INSERT ON public.suppliers
  FOR EACH ROW
  EXECUTE PROCEDURE public.tenant_default_company_id();

DROP TRIGGER IF EXISTS trg_customers_default_company ON public.customers;
CREATE TRIGGER trg_customers_default_company
  BEFORE INSERT ON public.customers
  FOR EACH ROW
  EXECUTE PROCEDURE public.tenant_default_company_id();

DROP TRIGGER IF EXISTS trg_product_categories_default_company ON public.product_categories;
CREATE TRIGGER trg_product_categories_default_company
  BEFORE INSERT ON public.product_categories
  FOR EACH ROW
  EXECUTE PROCEDURE public.tenant_default_company_id();

DROP TRIGGER IF EXISTS trg_accounting_categories_default_company ON public.accounting_categories;
CREATE TRIGGER trg_accounting_categories_default_company
  BEFORE INSERT ON public.accounting_categories
  FOR EACH ROW
  EXECUTE PROCEDURE public.tenant_default_company_id();

DROP TRIGGER IF EXISTS trg_products_default_company ON public.products;
CREATE TRIGGER trg_products_default_company
  BEFORE INSERT ON public.products
  FOR EACH ROW
  EXECUTE PROCEDURE public.tenant_default_company_id();

DROP TRIGGER IF EXISTS trg_stock_in_default_company ON public.stock_in;
CREATE TRIGGER trg_stock_in_default_company
  BEFORE INSERT ON public.stock_in
  FOR EACH ROW
  EXECUTE PROCEDURE public.tenant_default_company_id();

DROP TRIGGER IF EXISTS trg_bills_default_company ON public.bills;
CREATE TRIGGER trg_bills_default_company
  BEFORE INSERT ON public.bills
  FOR EACH ROW
  EXECUTE PROCEDURE public.tenant_default_company_id();

DROP TRIGGER IF EXISTS trg_accounts_default_company ON public.accounts;
CREATE TRIGGER trg_accounts_default_company
  BEFORE INSERT ON public.accounts
  FOR EACH ROW
  EXECUTE PROCEDURE public.tenant_default_company_id();

DROP TRIGGER IF EXISTS trg_activity_log_default_company ON public.activity_log;
CREATE TRIGGER trg_activity_log_default_company
  BEFORE INSERT ON public.activity_log
  FOR EACH ROW
  EXECUTE PROCEDURE public.tenant_default_company_id();

CREATE OR REPLACE FUNCTION public.tenant_default_company_id_from_stock_in()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_c uuid;
BEGIN
  IF NEW.company_id IS NULL AND NEW.stock_in_id IS NOT NULL THEN
    SELECT si.company_id INTO v_c FROM public.stock_in si WHERE si.id = NEW.stock_in_id;
    NEW.company_id := v_c;
  END IF;
  IF NEW.company_id IS NULL THEN
    NEW.company_id := public.get_my_company_id();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_stock_in_items_default_company ON public.stock_in_items;
CREATE TRIGGER trg_stock_in_items_default_company
  BEFORE INSERT ON public.stock_in_items
  FOR EACH ROW
  EXECUTE PROCEDURE public.tenant_default_company_id_from_stock_in();

CREATE OR REPLACE FUNCTION public.tenant_default_company_id_from_bill()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_c uuid;
BEGIN
  IF NEW.company_id IS NULL AND NEW.bill_id IS NOT NULL THEN
    SELECT b.company_id INTO v_c FROM public.bills b WHERE b.id = NEW.bill_id;
    NEW.company_id := v_c;
  END IF;
  IF NEW.company_id IS NULL THEN
    NEW.company_id := public.get_my_company_id();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bill_items_default_company ON public.bill_items;
CREATE TRIGGER trg_bill_items_default_company
  BEFORE INSERT ON public.bill_items
  FOR EACH ROW
  EXECUTE PROCEDURE public.tenant_default_company_id_from_bill();

CREATE OR REPLACE FUNCTION public.tenant_default_company_id_from_return()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_c uuid;
BEGIN
  IF NEW.company_id IS NULL AND NEW.return_id IS NOT NULL THEN
    SELECT br.company_id INTO v_c FROM public.bill_returns br WHERE br.id = NEW.return_id;
    NEW.company_id := v_c;
  END IF;
  IF NEW.company_id IS NULL THEN
    NEW.company_id := public.get_my_company_id();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bill_return_items_default_company ON public.bill_return_items;
CREATE TRIGGER trg_bill_return_items_default_company
  BEFORE INSERT ON public.bill_return_items
  FOR EACH ROW
  EXECUTE PROCEDURE public.tenant_default_company_id_from_return();

CREATE OR REPLACE FUNCTION public.tenant_default_company_id_from_account()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_c uuid;
BEGIN
  IF NEW.company_id IS NULL AND NEW.account_id IS NOT NULL THEN
    SELECT a.company_id INTO v_c FROM public.accounts a WHERE a.id = NEW.account_id;
    NEW.company_id := v_c;
  END IF;
  IF NEW.company_id IS NULL THEN
    NEW.company_id := public.get_my_company_id();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_entries_default_company ON public.entries;
CREATE TRIGGER trg_entries_default_company
  BEFORE INSERT ON public.entries
  FOR EACH ROW
  EXECUTE PROCEDURE public.tenant_default_company_id_from_account();

/* -----------------------------------------------------------------------------
   12) Bill number + return number (scoped by company_id)
   ----------------------------------------------------------------------------- */
CREATE OR REPLACE FUNCTION public.generate_bill_number()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_today      date := CURRENT_DATE;
  v_date_text  text := to_char(v_today, 'YYYYMMDD');
  v_prefix     text;
  v_count      integer;
  v_seq        integer;
  v_lock_key   bigint;
  v_company    uuid;
BEGIN
  IF NEW.company_id IS NULL THEN
    NEW.company_id := public.get_my_company_id();
  END IF;
  v_company := NEW.company_id;

  IF NEW.bill_number IS NOT NULL AND trim(NEW.bill_number) <> '' THEN
    RETURN NEW;
  END IF;

  SELECT bp.invoice_prefix
    INTO v_prefix
    FROM public.companies bp
   WHERE bp.id = v_company
   LIMIT 1;

  v_prefix := upper(trim(coalesce(v_prefix, '')));
  IF v_prefix = '' THEN
    v_prefix := 'B';
  END IF;

  v_prefix := regexp_replace(v_prefix, '[^A-Z0-9]', '', 'g');
  IF v_prefix = '' THEN
    v_prefix := 'B';
  END IF;

  v_lock_key := (
    (to_char(v_today, 'YYYYMMDD')::bigint) * 100000
    + (abs(hashtext(v_company::text)) % 10000) * 10
    + (abs(hashtext(v_prefix)) % 10)
  );
  PERFORM pg_advisory_xact_lock(v_lock_key);

  SELECT COUNT(*)::integer
    INTO v_count
    FROM public.bills b
   WHERE b.company_id = v_company
     AND b.created_at::date = v_today
     AND b.bill_number LIKE (v_prefix || '-' || v_date_text || '-%');

  v_seq := v_count + 1;
  NEW.bill_number := v_prefix || '-' || v_date_text || '-' || lpad(v_seq::text, 4, '0');

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.generate_bill_number() IS
  'Trigger: sets bill_number using companies.invoice_prefix; sequence per company per day.';

CREATE OR REPLACE FUNCTION public.generate_return_number()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_today     date := CURRENT_DATE;
  v_lock_key  bigint;
  v_count     integer;
  v_seq       integer;
  v_company   uuid;
BEGIN
  IF NEW.company_id IS NULL THEN
    SELECT b.company_id INTO v_company FROM public.bills b WHERE b.id = NEW.bill_id;
    NEW.company_id := COALESCE(v_company, public.get_my_company_id());
  END IF;
  v_company := NEW.company_id;

  IF NEW.return_number IS NOT NULL AND trim(NEW.return_number) <> '' THEN
    RETURN NEW;
  END IF;

  v_lock_key := 9000000000000000::bigint
    + (to_char(v_today, 'YYYYMMDD')::bigint * 1000)
    + (abs(hashtext(v_company::text)) % 1000);
  PERFORM pg_advisory_xact_lock(v_lock_key);

  SELECT COUNT(*)::integer
    INTO v_count
    FROM public.bill_returns br
   WHERE br.company_id = v_company
     AND br.created_at::date = v_today;

  v_seq := v_count + 1;
  NEW.return_number := 'R-' || to_char(v_today, 'YYYYMMDD') || '-' || lpad(v_seq::text, 3, '0');
  RETURN NEW;
END;
$$;

/* -----------------------------------------------------------------------------
   13) Stock movement functions — stamp stock_transactions.company_id
   ----------------------------------------------------------------------------- */
CREATE OR REPLACE FUNCTION public.reduce_product_stock(
  p_product_id   uuid,
  p_quantity     numeric,
  p_bill_id      uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_updated   integer;
  v_company   uuid;
BEGIN
  SELECT p.company_id INTO v_company FROM public.products p WHERE p.id = p_product_id;
  IF v_company IS NULL THEN
    RAISE EXCEPTION 'Product % has no company_id', p_product_id;
  END IF;

  PERFORM set_config('app.suppress_stock_adjustment', 'true', true);

  UPDATE public.products
  SET stock_quantity = stock_quantity - p_quantity
  WHERE id = p_product_id
    AND stock_quantity >= p_quantity;

  GET DIAGNOSTICS v_updated = ROW_COUNT;

  IF v_updated = 0 THEN
    RAISE EXCEPTION 'Insufficient stock for product %', p_product_id;
  END IF;

  INSERT INTO public.stock_transactions (
    product_id,
    transaction_type,
    quantity,
    reference_type,
    reference_id,
    notes,
    company_id
  )
  VALUES (
    p_product_id,
    'SALE',
    -p_quantity,
    'BILL',
    p_bill_id,
    'POS sale',
    v_company
  );

  RETURN true;
END;
$fn$;

COMMENT ON FUNCTION public.reduce_product_stock(uuid, numeric, uuid) IS
  'Decreases stock for billing; logs SALE with company_id. SECURITY DEFINER.';

REVOKE ALL ON FUNCTION public.reduce_product_stock(uuid, numeric, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reduce_product_stock(uuid, numeric, uuid) FROM anon;
REVOKE ALL ON FUNCTION public.reduce_product_stock(uuid, numeric, uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.reduce_product_stock(uuid, numeric, uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.restore_product_stock()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company uuid;
BEGIN
  PERFORM set_config('app.suppress_stock_adjustment', 'true', true);

  SELECT br.company_id INTO v_company FROM public.bill_returns br WHERE br.id = NEW.return_id;

  UPDATE public.products
  SET stock_quantity = stock_quantity + NEW.quantity
  WHERE id = NEW.product_id;

  INSERT INTO public.stock_transactions (
    product_id,
    transaction_type,
    quantity,
    reference_type,
    reference_id,
    notes,
    company_id
  )
  VALUES (
    NEW.product_id,
    'RETURN_IN',
    NEW.quantity,
    'BILL_RETURN',
    NEW.return_id,
    'Bill return',
    v_company
  );

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.log_product_stock_adjustment()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_old   numeric(18,3);
  v_new   numeric(18,3);
  v_diff  numeric(18,3);
  v_type  text;
BEGIN
  IF current_setting('app.suppress_stock_adjustment', true) = 'true' THEN
    RETURN NEW;
  END IF;

  v_old  := COALESCE(OLD.stock_quantity, 0);
  v_new  := COALESCE(NEW.stock_quantity, 0);
  v_diff := v_new - v_old;

  IF v_diff <> 0 THEN
    v_type := CASE WHEN v_diff > 0 THEN 'ADJUSTMENT_IN' ELSE 'ADJUSTMENT_OUT' END;

    INSERT INTO public.stock_transactions (
      product_id,
      transaction_type,
      quantity,
      reference_type,
      reference_id,
      notes,
      company_id
    )
    VALUES (
      NEW.id,
      v_type,
      v_diff,
      'PRODUCT_EDIT',
      NEW.id,
      'Stock adjusted via product edit',
      NEW.company_id
    );
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_stock_in(
  p_date           date,
  p_items          jsonb,
  p_supplier_id    uuid DEFAULT NULL,
  p_invoice_number text DEFAULT NULL,
  p_notes          text DEFAULT NULL,
  p_created_by     uuid DEFAULT NULL,
  p_account_id     uuid DEFAULT NULL
)
RETURNS TABLE(id uuid)
LANGUAGE plpgsql
AS $$
DECLARE
  v_stock_in_id   uuid;
  v_item          jsonb;
  v_account_id    uuid;
  v_company_id    uuid;

  v_product_id         uuid;
  v_manufacturing_date date;
  v_quantity           numeric(18,3);
  v_row_total          numeric(18,2);
  v_purchase_price     numeric(18,2);
  v_selling_price      numeric(18,2);
  v_mrp                numeric(18,2);

  v_total_items   integer        := 0;
  v_total_amount  numeric(18,2)  := 0;
BEGIN
  v_company_id := public.get_my_company_id();

  IF p_items IS NULL
     OR jsonb_typeof(p_items) <> 'array'
     OR jsonb_array_length(p_items) = 0
  THEN
    RAISE EXCEPTION 'p_items must be a non-empty JSON array of line items';
  END IF;

  v_account_id := COALESCE(
    p_account_id,
    (
      SELECT a.id
      FROM public.accounts a
      WHERE a.name = 'Cash in Hand'
        AND a.is_active = true
        AND a.company_id = v_company_id
      LIMIT 1
    )
  );
  IF v_account_id IS NULL THEN
    RAISE EXCEPTION 'No payment account available for this company.';
  END IF;

  FOR v_item IN
    SELECT value
    FROM jsonb_array_elements(p_items) AS t(value)
  LOOP
    v_quantity  := COALESCE((v_item->>'quantity')::numeric(18,3), 0);
    v_row_total := COALESCE((v_item->>'row_total')::numeric(18,2), 0);

    v_total_items  := v_total_items + 1;
    v_total_amount := v_total_amount + v_row_total;
  END LOOP;

  INSERT INTO public.stock_in (
    date,
    supplier_id,
    invoice_number,
    notes,
    total_items,
    total_amount,
    created_by,
    account_id,
    company_id
  )
  VALUES (
    p_date,
    p_supplier_id,
    p_invoice_number,
    p_notes,
    v_total_items,
    v_total_amount,
    p_created_by,
    v_account_id,
    v_company_id
  )
  RETURNING public.stock_in.id INTO v_stock_in_id;

  PERFORM set_config('app.suppress_stock_adjustment', 'true', true);

  FOR v_item IN
    SELECT value
    FROM jsonb_array_elements(p_items) AS t(value)
  LOOP
    v_product_id := (v_item->>'product_id')::uuid;
    v_manufacturing_date := CASE
      WHEN NULLIF(trim(COALESCE(v_item->>'manufacturing_date', '')), '') IS NOT NULL
      THEN (NULLIF(trim(COALESCE(v_item->>'manufacturing_date', '')), ''))::date
      ELSE NULL
    END;
    v_quantity  := COALESCE((v_item->>'quantity')::numeric(18,3), 0);
    v_row_total := COALESCE((v_item->>'row_total')::numeric(18,2), 0);

    v_purchase_price := CASE
      WHEN NULLIF(trim(COALESCE(v_item->>'purchase_price', '')), '') IS NOT NULL
      THEN (NULLIF(trim(COALESCE(v_item->>'purchase_price', '')), ''))::numeric(18,2)
      ELSE CASE
        WHEN COALESCE(v_quantity, 0) <> 0 THEN round(v_row_total / v_quantity, 2)
        ELSE 0::numeric(18,2)
      END
    END;

    v_selling_price := CASE
      WHEN NULLIF(trim(COALESCE(v_item->>'selling_price', '')), '') IS NOT NULL
      THEN (NULLIF(trim(COALESCE(v_item->>'selling_price', '')), ''))::numeric(18,2)
      ELSE NULL
    END;

    v_mrp := CASE
      WHEN NULLIF(trim(COALESCE(v_item->>'mrp', '')), '') IS NOT NULL
      THEN (NULLIF(trim(COALESCE(v_item->>'mrp', '')), ''))::numeric(18,2)
      ELSE NULL
    END;

    INSERT INTO public.stock_in_items (
      stock_in_id,
      product_id,
      manufacturing_date,
      purchase_price,
      selling_price,
      mrp,
      quantity,
      row_total,
      company_id
    )
    VALUES (
      v_stock_in_id,
      v_product_id,
      v_manufacturing_date,
      v_purchase_price,
      v_selling_price,
      v_mrp,
      v_quantity,
      v_row_total,
      v_company_id
    );

    UPDATE public.products AS p
    SET stock_quantity = COALESCE(p.stock_quantity, 0) + v_quantity
    WHERE p.id = v_product_id
      AND p.company_id = v_company_id;

    INSERT INTO public.stock_transactions (
      product_id,
      transaction_type,
      quantity,
      reference_type,
      reference_id,
      notes,
      company_id
    )
    VALUES (
      v_product_id,
      'PURCHASE',
      v_quantity,
      'STOCK_IN',
      v_stock_in_id,
      p_invoice_number,
      v_company_id
    );
  END LOOP;

  RETURN QUERY SELECT v_stock_in_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_product_with_opening_stock(
  p_name                text,
  p_barcode             text,
  p_purchase_price      numeric,
  p_selling_price       numeric,
  p_mrp                 numeric,
  p_unit                text,
  p_low_stock_alert_qty numeric DEFAULT 0,
  p_product_category_id uuid DEFAULT NULL,
  p_opening_stock       numeric DEFAULT 0,
  p_id                  uuid DEFAULT NULL,
  p_is_active           boolean DEFAULT true,
  p_created_by          uuid DEFAULT NULL,
  p_account_id          uuid DEFAULT NULL
)
RETURNS TABLE(id uuid)
LANGUAGE plpgsql
AS $$
DECLARE
  v_product_id   uuid;
  v_stock_in_id  uuid;
  v_company_id   uuid;
BEGIN
  v_company_id := public.get_my_company_id();
  v_product_id := COALESCE(p_id, gen_random_uuid());

  INSERT INTO public.products (
    id,
    name,
    barcode,
    purchase_price,
    selling_price,
    mrp,
    unit,
    low_stock_alert_qty,
    product_category_id,
    stock_quantity,
    is_active,
    company_id
  )
  VALUES (
    v_product_id,
    p_name,
    p_barcode,
    p_purchase_price,
    p_selling_price,
    p_mrp,
    p_unit,
    COALESCE(p_low_stock_alert_qty, 0),
    p_product_category_id,
    COALESCE(p_opening_stock, 0),
    COALESCE(p_is_active, true),
    v_company_id
  );

  IF COALESCE(p_opening_stock, 0) > 0 THEN
    v_stock_in_id := gen_random_uuid();

    INSERT INTO public.stock_in (
      id,
      date,
      supplier_id,
      invoice_number,
      notes,
      total_items,
      total_amount,
      created_by,
      account_id,
      company_id
    )
    VALUES (
      v_stock_in_id,
      CURRENT_DATE,
      NULL,
      'OPENING',
      'Opening stock from product creation',
      1,
      COALESCE(p_purchase_price, 0) * p_opening_stock,
      p_created_by,
      COALESCE(
        p_account_id,
        (
          SELECT a.id
          FROM public.accounts a
          WHERE a.name = 'Cash in Hand'
            AND a.is_active = true
            AND a.company_id = v_company_id
          LIMIT 1
        )
      ),
      v_company_id
    );

    INSERT INTO public.stock_in_items (
      stock_in_id,
      product_id,
      manufacturing_date,
      purchase_price,
      selling_price,
      mrp,
      quantity,
      row_total,
      company_id
    )
    VALUES (
      v_stock_in_id,
      v_product_id,
      NULL,
      COALESCE(p_purchase_price, 0),
      p_selling_price,
      p_mrp,
      p_opening_stock,
      COALESCE(p_purchase_price, 0) * p_opening_stock,
      v_company_id
    );

    INSERT INTO public.stock_transactions (
      product_id,
      transaction_type,
      quantity,
      reference_type,
      reference_id,
      notes,
      company_id
    )
    VALUES (
      v_product_id,
      'OPENING',
      p_opening_stock,
      'STOCK_IN',
      v_stock_in_id,
      'Opening stock',
      v_company_id
    );
  END IF;

  RETURN QUERY SELECT v_product_id;
END;
$$;

/* -----------------------------------------------------------------------------
   14) Tenant-scoped RLS on business tables (replace global authenticated policies)
   ----------------------------------------------------------------------------- */
ALTER TABLE public.taxes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated users can read taxes" ON public.taxes;
DROP POLICY IF EXISTS "Admin and Manager can insert taxes" ON public.taxes;
DROP POLICY IF EXISTS "Admin and Manager can update taxes" ON public.taxes;
DROP POLICY IF EXISTS "Admin can delete taxes" ON public.taxes;

CREATE POLICY taxes_select_tenant ON public.taxes FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL AND company_id = public.get_my_company_id());
CREATE POLICY taxes_insert_tenant ON public.taxes FOR INSERT TO authenticated
  WITH CHECK (company_id = public.get_my_company_id() AND public.get_my_role() IN ('Admin', 'Manager'));
CREATE POLICY taxes_update_tenant ON public.taxes FOR UPDATE TO authenticated
  USING (company_id = public.get_my_company_id() AND public.get_my_role() IN ('Admin', 'Manager'))
  WITH CHECK (company_id = public.get_my_company_id() AND public.get_my_role() IN ('Admin', 'Manager'));
CREATE POLICY taxes_delete_tenant ON public.taxes FOR DELETE TO authenticated
  USING (company_id = public.get_my_company_id() AND public.get_my_role() = 'Admin');

ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated users can read suppliers" ON public.suppliers;
DROP POLICY IF EXISTS "Admin and Manager can insert suppliers" ON public.suppliers;
DROP POLICY IF EXISTS "Admin and Manager can update suppliers" ON public.suppliers;
DROP POLICY IF EXISTS "Admin can delete suppliers" ON public.suppliers;

CREATE POLICY suppliers_select_tenant ON public.suppliers FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL AND company_id = public.get_my_company_id());
CREATE POLICY suppliers_insert_tenant ON public.suppliers FOR INSERT TO authenticated
  WITH CHECK (company_id = public.get_my_company_id() AND public.has_granted_permission('stock_in'::permission_type));
CREATE POLICY suppliers_update_tenant ON public.suppliers FOR UPDATE TO authenticated
  USING (company_id = public.get_my_company_id() AND public.has_granted_permission('stock_in'::permission_type))
  WITH CHECK (company_id = public.get_my_company_id() AND public.has_granted_permission('stock_in'::permission_type));
CREATE POLICY suppliers_delete_tenant ON public.suppliers FOR DELETE TO authenticated
  USING (company_id = public.get_my_company_id() AND public.get_my_role() = 'Admin');

ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated users can read customers" ON public.customers;
DROP POLICY IF EXISTS "Admin and Manager can insert customers" ON public.customers;
DROP POLICY IF EXISTS "Admin and Manager can update customers" ON public.customers;
DROP POLICY IF EXISTS "Admin can delete customers" ON public.customers;

CREATE POLICY customers_select_tenant ON public.customers FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL AND company_id = public.get_my_company_id());
CREATE POLICY customers_insert_tenant ON public.customers FOR INSERT TO authenticated
  WITH CHECK (company_id = public.get_my_company_id() AND public.get_my_role() IN ('Admin', 'Manager'));
CREATE POLICY customers_update_tenant ON public.customers FOR UPDATE TO authenticated
  USING (company_id = public.get_my_company_id() AND public.get_my_role() IN ('Admin', 'Manager'))
  WITH CHECK (company_id = public.get_my_company_id() AND public.get_my_role() IN ('Admin', 'Manager'));
CREATE POLICY customers_delete_tenant ON public.customers FOR DELETE TO authenticated
  USING (company_id = public.get_my_company_id() AND public.get_my_role() = 'Admin');

ALTER TABLE public.product_categories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated users can read product_categories" ON public.product_categories;
DROP POLICY IF EXISTS "Admin and Manager can insert product_categories" ON public.product_categories;
DROP POLICY IF EXISTS "Admin and Manager can update product_categories" ON public.product_categories;
DROP POLICY IF EXISTS "Admin can delete product_categories" ON public.product_categories;

CREATE POLICY product_categories_select_tenant ON public.product_categories FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL AND company_id = public.get_my_company_id());
CREATE POLICY product_categories_insert_tenant ON public.product_categories FOR INSERT TO authenticated
  WITH CHECK (company_id = public.get_my_company_id() AND public.get_my_role() IN ('Admin', 'Manager'));
CREATE POLICY product_categories_update_tenant ON public.product_categories FOR UPDATE TO authenticated
  USING (company_id = public.get_my_company_id() AND public.get_my_role() IN ('Admin', 'Manager'))
  WITH CHECK (company_id = public.get_my_company_id() AND public.get_my_role() IN ('Admin', 'Manager'));
CREATE POLICY product_categories_delete_admin ON public.product_categories FOR DELETE TO authenticated
  USING (company_id = public.get_my_company_id() AND public.get_my_role() = 'Admin');

ALTER TABLE public.accounting_categories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated users can read accounting_categories" ON public.accounting_categories;
DROP POLICY IF EXISTS "Admin and Manager can insert accounting_categories" ON public.accounting_categories;
DROP POLICY IF EXISTS "Admin and Manager can update accounting_categories" ON public.accounting_categories;
DROP POLICY IF EXISTS "Admin can delete accounting_categories" ON public.accounting_categories;

CREATE POLICY accounting_categories_select_tenant ON public.accounting_categories FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL AND company_id = public.get_my_company_id());
CREATE POLICY accounting_categories_admin_all ON public.accounting_categories FOR ALL TO authenticated
  USING (company_id = public.get_my_company_id() AND public.get_my_role() = 'Admin')
  WITH CHECK (company_id = public.get_my_company_id() AND public.get_my_role() = 'Admin');
CREATE POLICY accounting_categories_mgr_staff_select ON public.accounting_categories FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL AND company_id = public.get_my_company_id() AND public.get_my_role() IN ('Manager', 'Staff'));

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated users can read products" ON public.products;
DROP POLICY IF EXISTS "Admin and Manager can insert products" ON public.products;
DROP POLICY IF EXISTS "Admin and Manager can update products" ON public.products;
DROP POLICY IF EXISTS "Admin can delete products" ON public.products;

CREATE POLICY products_select_tenant ON public.products FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL AND company_id = public.get_my_company_id());
CREATE POLICY products_insert_tenant ON public.products FOR INSERT TO authenticated
  WITH CHECK (company_id = public.get_my_company_id() AND public.has_granted_permission('stock_in'::permission_type));
CREATE POLICY products_update_tenant ON public.products FOR UPDATE TO authenticated
  USING (company_id = public.get_my_company_id() AND public.has_granted_permission('stock_in'::permission_type))
  WITH CHECK (company_id = public.get_my_company_id() AND public.has_granted_permission('stock_in'::permission_type));
CREATE POLICY products_delete_admin ON public.products FOR DELETE TO authenticated
  USING (company_id = public.get_my_company_id() AND public.get_my_role() = 'Admin');

ALTER TABLE public.stock_in ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_in_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated users can read stock_in" ON public.stock_in;
DROP POLICY IF EXISTS "Authenticated users can insert stock_in" ON public.stock_in;
DROP POLICY IF EXISTS "Authenticated users can read stock_in_items" ON public.stock_in_items;
DROP POLICY IF EXISTS "Authenticated users can insert stock_in_items" ON public.stock_in_items;

CREATE POLICY stock_in_select_tenant ON public.stock_in FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL AND company_id = public.get_my_company_id());
CREATE POLICY stock_in_insert_tenant ON public.stock_in FOR INSERT TO authenticated
  WITH CHECK (company_id = public.get_my_company_id() AND auth.uid() IS NOT NULL);
CREATE POLICY stock_in_items_select_tenant ON public.stock_in_items FOR SELECT TO authenticated
  USING (company_id = public.get_my_company_id());
CREATE POLICY stock_in_items_insert_tenant ON public.stock_in_items FOR INSERT TO authenticated
  WITH CHECK (company_id = public.get_my_company_id());

ALTER TABLE public.stock_transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated users can read stock_transactions" ON public.stock_transactions;
DROP POLICY IF EXISTS "Authenticated users can insert stock_transactions" ON public.stock_transactions;

CREATE POLICY stock_transactions_select_tenant ON public.stock_transactions FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL AND company_id = public.get_my_company_id());
CREATE POLICY stock_transactions_insert_tenant ON public.stock_transactions FOR INSERT TO authenticated
  WITH CHECK (company_id = public.get_my_company_id() AND auth.uid() IS NOT NULL);

ALTER TABLE public.bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bill_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated users can read bills" ON public.bills;
DROP POLICY IF EXISTS "Authenticated users can insert bills" ON public.bills;
DROP POLICY IF EXISTS "Authenticated users can update bills" ON public.bills;
DROP POLICY IF EXISTS "Authenticated users can read bill_items" ON public.bill_items;
DROP POLICY IF EXISTS "Authenticated users can insert bill_items" ON public.bill_items;

CREATE POLICY bills_select_tenant ON public.bills FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL AND company_id = public.get_my_company_id());
CREATE POLICY bills_insert_tenant ON public.bills FOR INSERT TO authenticated
  WITH CHECK (company_id = public.get_my_company_id() AND auth.uid() IS NOT NULL);
CREATE POLICY bills_update_tenant ON public.bills FOR UPDATE TO authenticated
  USING (company_id = public.get_my_company_id() AND auth.uid() IS NOT NULL)
  WITH CHECK (company_id = public.get_my_company_id());
CREATE POLICY bill_items_select_tenant ON public.bill_items FOR SELECT TO authenticated
  USING (company_id = public.get_my_company_id());
CREATE POLICY bill_items_insert_tenant ON public.bill_items FOR INSERT TO authenticated
  WITH CHECK (company_id = public.get_my_company_id());

ALTER TABLE public.bill_returns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bill_return_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated users can read bill_returns" ON public.bill_returns;
DROP POLICY IF EXISTS "Authenticated users can insert bill_returns" ON public.bill_returns;
DROP POLICY IF EXISTS "Authenticated users can update bill_returns" ON public.bill_returns;
DROP POLICY IF EXISTS "Authenticated users can read bill_return_items" ON public.bill_return_items;
DROP POLICY IF EXISTS "Authenticated users can insert bill_return_items" ON public.bill_return_items;

CREATE POLICY bill_returns_select_tenant ON public.bill_returns FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL AND company_id = public.get_my_company_id());
CREATE POLICY bill_returns_insert_tenant ON public.bill_returns FOR INSERT TO authenticated
  WITH CHECK (company_id = public.get_my_company_id() AND auth.uid() IS NOT NULL);
CREATE POLICY bill_returns_update_tenant ON public.bill_returns FOR UPDATE TO authenticated
  USING (company_id = public.get_my_company_id() AND auth.uid() IS NOT NULL)
  WITH CHECK (company_id = public.get_my_company_id());
CREATE POLICY bill_return_items_select_tenant ON public.bill_return_items FOR SELECT TO authenticated
  USING (company_id = public.get_my_company_id());
CREATE POLICY bill_return_items_insert_tenant ON public.bill_return_items FOR INSERT TO authenticated
  WITH CHECK (company_id = public.get_my_company_id());

DROP POLICY IF EXISTS accounts_admin_full_access ON public.accounts;
DROP POLICY IF EXISTS accounts_manager_staff_select ON public.accounts;
DROP POLICY IF EXISTS accounting_categories_admin_full_access ON public.accounting_categories;
DROP POLICY IF EXISTS accounting_categories_manager_staff_select ON public.accounting_categories;
DROP POLICY IF EXISTS entries_admin_full_access ON public.entries;
DROP POLICY IF EXISTS entries_manager_staff_select ON public.entries;
DROP POLICY IF EXISTS entries_manager_staff_insert ON public.entries;
DROP POLICY IF EXISTS entries_admin_update ON public.entries;
DROP POLICY IF EXISTS entries_admin_delete ON public.entries;

CREATE POLICY accounts_admin_full_access_tenant ON public.accounts FOR ALL TO authenticated
  USING (auth.uid() IS NOT NULL AND company_id = public.get_my_company_id() AND public.get_my_role() = 'Admin')
  WITH CHECK (company_id = public.get_my_company_id() AND public.get_my_role() = 'Admin');
CREATE POLICY accounts_manager_staff_select_tenant ON public.accounts FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL AND company_id = public.get_my_company_id() AND public.get_my_role() IN ('Admin', 'Manager', 'Staff'));

CREATE POLICY entries_admin_full_access_tenant ON public.entries FOR ALL TO authenticated
  USING (auth.uid() IS NOT NULL AND company_id = public.get_my_company_id() AND public.get_my_role() = 'Admin')
  WITH CHECK (company_id = public.get_my_company_id() AND public.get_my_role() = 'Admin');
CREATE POLICY entries_select_tenant ON public.entries FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL AND company_id = public.get_my_company_id() AND public.get_my_role() IN ('Admin', 'Manager', 'Staff'));
CREATE POLICY entries_insert_tenant ON public.entries FOR INSERT TO authenticated
  WITH CHECK (company_id = public.get_my_company_id() AND public.get_my_role() IN ('Admin', 'Manager', 'Staff'));
CREATE POLICY entries_admin_update_tenant ON public.entries FOR UPDATE TO authenticated
  USING (company_id = public.get_my_company_id() AND public.get_my_role() = 'Admin')
  WITH CHECK (company_id = public.get_my_company_id() AND public.get_my_role() = 'Admin');
CREATE POLICY entries_admin_delete_tenant ON public.entries FOR DELETE TO authenticated
  USING (company_id = public.get_my_company_id() AND public.get_my_role() = 'Admin');

/* activity_log — POS only: insert as self; read company (Admin/Manager or own rows); Admin delete */
ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS activity_log_insert_own ON public.activity_log;
CREATE POLICY activity_log_insert_own
  ON public.activity_log
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() IS NOT NULL
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
    company_id = public.get_my_company_id()
    AND public.get_my_role() = 'Admin'
  );

COMMIT;
