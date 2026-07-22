-- =============================================================================
-- Consolidated migration (module bundle): 0002_master_data_catalog.sql
-- Sources merged in order (do not reorder):
--   03_create_categories_table.sql
--   04_create_taxes_table.sql
--   05_create_products_table.sql
--   06_refactor_categories_and_products.sql
--   07_create_suppliers_table.sql
--   08_create_customers_table.sql
--   09_create_user_permissions.sql
--   10_drop_product_sku_and_optional_category.sql
-- =============================================================================


-- >>> begin: 03_create_categories_table.sql
/* =============================================================================
   MODULE — CATEGORIES
   Migration: category_type enum, categories table, indexes, RLS, policies
   Supports: Product Categories, Expense Categories, Income Categories
   ============================================================================= */

/* STEP 1: CREATE CATEGORY TYPE ENUM */
CREATE TYPE public.category_type AS ENUM ('PRODUCT', 'EXPENSE', 'INCOME');

/* STEP 2: CREATE CATEGORIES TABLE */
CREATE TABLE public.categories (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text        NOT NULL,
  type        public.category_type NOT NULL,
  description text,
  is_active   boolean     NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  created_by  uuid        REFERENCES public.users(id) ON DELETE SET NULL,
  updated_by  uuid        REFERENCES public.users(id) ON DELETE SET NULL,

  CONSTRAINT uq_categories_name_type UNIQUE (name, type)
);

COMMENT ON TABLE public.categories IS 'Shared categories for products, expenses, and income streams.';

/* STEP 3: INDEXES */
CREATE INDEX idx_categories_type      ON public.categories(type);
CREATE INDEX idx_categories_is_active ON public.categories(is_active);

/* STEP 4: AUTO-UPDATE updated_at (reuses existing trigger function) */
CREATE TRIGGER trigger_update_categories_updated_at
BEFORE UPDATE ON public.categories
FOR EACH ROW
EXECUTE PROCEDURE update_updated_at_column();

/* STEP 5: ROW LEVEL SECURITY — default deny */
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

/* STEP 6: RLS POLICIES (use get_my_role() to avoid recursion) */

-- Authenticated users can read categories
CREATE POLICY "Authenticated users can read categories"
ON public.categories
FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Admin and Manager can insert categories
CREATE POLICY "Admin and Manager can insert categories"
ON public.categories
FOR INSERT
WITH CHECK (public.get_my_role() IN ('Admin', 'Manager'));

-- Admin and Manager can update categories
CREATE POLICY "Admin and Manager can update categories"
ON public.categories
FOR UPDATE
USING  (public.get_my_role() IN ('Admin', 'Manager'))
WITH CHECK (public.get_my_role() IN ('Admin', 'Manager'));

-- Only Admin can delete categories
CREATE POLICY "Admin can delete categories"
ON public.categories
FOR DELETE
USING (public.get_my_role() = 'Admin');

-- <<< end: 03_create_categories_table.sql

-- >>> begin: 04_create_taxes_table.sql
/* =============================================================================
   MODULE — TAXES
   Migration: taxes table for Product and Billing modules
   Stores tax percentages (e.g. GST 5%, 18%) with decimal support.
   ============================================================================= */

/* STEP 1: ENSURE UUID EXTENSION (for uuid_generate_v4) */
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

/* STEP 2: CREATE TAXES TABLE */
CREATE TABLE public.taxes (
  id         uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name       text NOT NULL,
  percentage numeric(5,2) NOT NULL,
  is_active  boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz
);

COMMENT ON TABLE public.taxes IS 'Tax definitions for products and billing; percentage supports decimals (e.g. 2.5%, 7.25%, 18%).';

/* STEP 3: INDEXES */
CREATE INDEX idx_taxes_is_active ON public.taxes(is_active);

/* STEP 4: AUTO-UPDATE updated_at */
CREATE TRIGGER trigger_update_taxes_updated_at
BEFORE UPDATE ON public.taxes
FOR EACH ROW
EXECUTE PROCEDURE update_updated_at_column();

/* STEP 5: ROW LEVEL SECURITY — default deny */
ALTER TABLE public.taxes ENABLE ROW LEVEL SECURITY;

/* STEP 6: RLS POLICIES — API access for authenticated users */

-- Authenticated users can read taxes (needed for Product and Billing modules)
CREATE POLICY "Authenticated users can read taxes"
ON public.taxes
FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Admin and Manager can insert taxes
CREATE POLICY "Admin and Manager can insert taxes"
ON public.taxes
FOR INSERT
WITH CHECK (public.get_my_role() IN ('Admin', 'Manager'));

-- Admin and Manager can update taxes
CREATE POLICY "Admin and Manager can update taxes"
ON public.taxes
FOR UPDATE
USING  (public.get_my_role() IN ('Admin', 'Manager'))
WITH CHECK (public.get_my_role() IN ('Admin', 'Manager'));

-- Only Admin can delete taxes
CREATE POLICY "Admin can delete taxes"
ON public.taxes
FOR DELETE
USING (public.get_my_role() = 'Admin');

/* STEP 7: DEFAULT TAX RECORDS */
INSERT INTO public.taxes (name, percentage) VALUES
('GST 0%', 0.00),
('GST 5%', 5.00),
('GST 12%', 12.00),
('GST 18%', 18.00),
('GST 28%', 28.00);

-- <<< end: 04_create_taxes_table.sql

-- >>> begin: 05_create_products_table.sql
/* =============================================================================
   MODULE — PRODUCTS
   Migration: products table for Product Management, Billing, Inventory, Reports
   Stores product master data, pricing, and inventory configuration.
   ============================================================================= */

/* STEP 1: ENSURE UUID EXTENSION (for uuid_generate_v4) */
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

/* STEP 2: CREATE PRODUCTS TABLE */
CREATE TABLE public.products (
  id                  uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name                text NOT NULL,
  category_id         uuid,
  barcode             text,
  sku                 text,
  purchase_price      numeric(10,2),
  selling_price       numeric(10,2),
  mrp                 numeric(10,2),
  tax_id              uuid,
  opening_stock       numeric(10,2) NOT NULL DEFAULT 0,
  unit                text,
  low_stock_alert_qty numeric(10,2) NOT NULL DEFAULT 0,
  is_active           boolean NOT NULL DEFAULT true,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz
);

COMMENT ON TABLE public.products IS 'Product master: name, pricing, inventory config; supports Product Management, Billing, Inventory, Sales Reports, Low Stock Alerts.';

/* STEP 3: FOREIGN KEYS */
ALTER TABLE public.products
ADD CONSTRAINT fk_product_category
FOREIGN KEY (category_id)
REFERENCES public.categories(id)
ON DELETE SET NULL;

ALTER TABLE public.products
ADD CONSTRAINT fk_product_tax
FOREIGN KEY (tax_id)
REFERENCES public.taxes(id)
ON DELETE SET NULL;

/* STEP 4: INDEXES */
CREATE INDEX idx_products_category ON public.products(category_id);
CREATE INDEX idx_products_tax ON public.products(tax_id);
CREATE INDEX idx_products_name ON public.products(name);
CREATE INDEX idx_products_barcode ON public.products(barcode);
CREATE INDEX idx_products_sku ON public.products(sku);
CREATE INDEX idx_products_is_active ON public.products(is_active);

/* STEP 5: AUTO-UPDATE updated_at */
CREATE TRIGGER trigger_update_products_updated_at
BEFORE UPDATE ON public.products
FOR EACH ROW
EXECUTE PROCEDURE update_updated_at_column();

/* STEP 6: ROW LEVEL SECURITY — default deny */
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

/* STEP 7: RLS POLICIES */

-- Authenticated users can read products (Product list, Billing, Reports)
CREATE POLICY "Authenticated users can read products"
ON public.products
FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Admin and Manager can insert products
CREATE POLICY "Admin and Manager can insert products"
ON public.products
FOR INSERT
WITH CHECK (public.get_my_role() IN ('Admin', 'Manager'));

-- Admin and Manager can update products
CREATE POLICY "Admin and Manager can update products"
ON public.products
FOR UPDATE
USING  (public.get_my_role() IN ('Admin', 'Manager'))
WITH CHECK (public.get_my_role() IN ('Admin', 'Manager'));

-- Only Admin can delete products
CREATE POLICY "Admin can delete products"
ON public.products
FOR DELETE
USING (public.get_my_role() = 'Admin');

-- <<< end: 05_create_products_table.sql

-- >>> begin: 06_refactor_categories_and_products.sql
/* =============================================================================
   REFACTOR — SPLIT CATEGORIES & UPDATE PRODUCTS
   - Create product_categories (product-only)
   - Create accounting_categories (income/expense)
   - Migrate data from categories
   - Update products: product_category_id, stock_quantity, remove tax_id
   - Drop old categories table
   ============================================================================= */

/* -----------------------------------------------------------------------------
   STEP 1: CREATE product_categories
   ----------------------------------------------------------------------------- */
CREATE TABLE public.product_categories (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text        NOT NULL,
  description text,
  is_active   boolean     NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  created_by  uuid        REFERENCES public.users(id) ON DELETE SET NULL,
  updated_by  uuid        REFERENCES public.users(id) ON DELETE SET NULL,
  CONSTRAINT uq_product_categories_name UNIQUE (name)
);

COMMENT ON TABLE public.product_categories IS 'Product-only categories for product master and catalog.';

CREATE INDEX idx_product_categories_is_active ON public.product_categories(is_active);

CREATE TRIGGER trigger_update_product_categories_updated_at
BEFORE UPDATE ON public.product_categories
FOR EACH ROW
EXECUTE PROCEDURE update_updated_at_column();

ALTER TABLE public.product_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read product_categories"
ON public.product_categories FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admin and Manager can insert product_categories"
ON public.product_categories FOR INSERT
WITH CHECK (public.get_my_role() IN ('Admin', 'Manager'));

CREATE POLICY "Admin and Manager can update product_categories"
ON public.product_categories FOR UPDATE
USING  (public.get_my_role() IN ('Admin', 'Manager'))
WITH CHECK (public.get_my_role() IN ('Admin', 'Manager'));

CREATE POLICY "Admin can delete product_categories"
ON public.product_categories FOR DELETE
USING (public.get_my_role() = 'Admin');

/* -----------------------------------------------------------------------------
   STEP 2: CREATE accounting_categories (income / expense)
   ----------------------------------------------------------------------------- */
CREATE TABLE public.accounting_categories (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text        NOT NULL,
  type        text        NOT NULL CHECK (type IN ('income', 'expense')),
  description text,
  is_active   boolean     NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  created_by  uuid        REFERENCES public.users(id) ON DELETE SET NULL,
  updated_by  uuid        REFERENCES public.users(id) ON DELETE SET NULL,
  CONSTRAINT uq_accounting_categories_name_type UNIQUE (name, type)
);

COMMENT ON TABLE public.accounting_categories IS 'Income and expense categories for accounting module.';

CREATE INDEX idx_accounting_categories_type ON public.accounting_categories(type);
CREATE INDEX idx_accounting_categories_is_active ON public.accounting_categories(is_active);

CREATE TRIGGER trigger_update_accounting_categories_updated_at
BEFORE UPDATE ON public.accounting_categories
FOR EACH ROW
EXECUTE PROCEDURE update_updated_at_column();

ALTER TABLE public.accounting_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read accounting_categories"
ON public.accounting_categories FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admin and Manager can insert accounting_categories"
ON public.accounting_categories FOR INSERT
WITH CHECK (public.get_my_role() IN ('Admin', 'Manager'));

CREATE POLICY "Admin and Manager can update accounting_categories"
ON public.accounting_categories FOR UPDATE
USING  (public.get_my_role() IN ('Admin', 'Manager'))
WITH CHECK (public.get_my_role() IN ('Admin', 'Manager'));

CREATE POLICY "Admin can delete accounting_categories"
ON public.accounting_categories FOR DELETE
USING (public.get_my_role() = 'Admin');

/* -----------------------------------------------------------------------------
   STEP 3: MIGRATE DATA from categories
   ----------------------------------------------------------------------------- */
INSERT INTO public.product_categories (id, name, description, is_active, created_at, updated_at, created_by, updated_by)
SELECT id, name, description, is_active, created_at, updated_at, created_by, updated_by
FROM public.categories
WHERE type = 'PRODUCT';

INSERT INTO public.accounting_categories (id, name, type, description, is_active, created_at, updated_at, created_by, updated_by)
SELECT id, name, lower(type::text), description, is_active, created_at, updated_at, created_by, updated_by
FROM public.categories
WHERE type IN ('EXPENSE', 'INCOME');

/* -----------------------------------------------------------------------------
   STEP 4: ALTER products — add product_category_id and stock_quantity
   ----------------------------------------------------------------------------- */
ALTER TABLE public.products
  ADD COLUMN product_category_id uuid,
  ADD COLUMN stock_quantity numeric(10,2) NOT NULL DEFAULT 0;

UPDATE public.products
SET product_category_id = category_id
WHERE category_id IS NOT NULL;

UPDATE public.products
SET stock_quantity = COALESCE(opening_stock, 0)
WHERE stock_quantity = 0;

ALTER TABLE public.products
  DROP COLUMN IF EXISTS opening_stock;

/* -----------------------------------------------------------------------------
   STEP 5: DROP old category FK and column; ADD new FK
   ----------------------------------------------------------------------------- */
ALTER TABLE public.products
  DROP CONSTRAINT IF EXISTS fk_product_category;

ALTER TABLE public.products
  DROP COLUMN IF EXISTS category_id;

ALTER TABLE public.products
  ADD CONSTRAINT fk_products_product_category
  FOREIGN KEY (product_category_id)
  REFERENCES public.product_categories(id)
  ON DELETE SET NULL;

CREATE INDEX idx_products_product_category ON public.products(product_category_id);

/* -----------------------------------------------------------------------------
   STEP 6: REMOVE tax_id from products
   ----------------------------------------------------------------------------- */
ALTER TABLE public.products
  DROP CONSTRAINT IF EXISTS fk_product_tax;

DROP INDEX IF EXISTS public.idx_products_tax;

ALTER TABLE public.products
  DROP COLUMN IF EXISTS tax_id;

/* -----------------------------------------------------------------------------
   STEP 7: DROP old categories table and enum
   ----------------------------------------------------------------------------- */
DROP TABLE IF EXISTS public.categories;

DROP TYPE IF EXISTS public.category_type;

-- <<< end: 06_refactor_categories_and_products.sql

-- >>> begin: 07_create_suppliers_table.sql
/* =============================================================================
   MODULE — SUPPLIERS
   Migration: suppliers table for Supplier Management
   Stores supplier master data, contact info, and opening balance.
   ============================================================================= */

/* STEP 1: ENSURE UUID EXTENSION (for uuid_generate_v4) */
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

/* STEP 2: CREATE SUPPLIERS TABLE */
CREATE TABLE public.suppliers (
  id               uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  supplier_name    text NOT NULL,
  contact_person   text,
  phone            text,
  email            text,
  address          text,
  gst_number       text,
  opening_balance  numeric(12,2) DEFAULT 0,
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now(),
  is_deleted       boolean DEFAULT false
);

COMMENT ON TABLE public.suppliers IS 'Supplier master: name, contact, GST, opening balance; supports Supplier Management and Purchase.';

/* STEP 3: INDEXES FOR SEARCH PERFORMANCE */
CREATE INDEX idx_supplier_name ON public.suppliers(supplier_name);
CREATE INDEX idx_supplier_phone ON public.suppliers(phone);

/* STEP 4: AUTO-UPDATE updated_at */
CREATE TRIGGER trigger_update_suppliers_updated_at
BEFORE UPDATE ON public.suppliers
FOR EACH ROW
EXECUTE PROCEDURE update_updated_at_column();

/* STEP 5: ROW LEVEL SECURITY — default deny */
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;

/* STEP 6: RLS POLICIES */

-- Authenticated users can read suppliers
CREATE POLICY "Authenticated users can read suppliers"
ON public.suppliers
FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Admin and Manager can insert suppliers
CREATE POLICY "Admin and Manager can insert suppliers"
ON public.suppliers
FOR INSERT
WITH CHECK (public.get_my_role() IN ('Admin', 'Manager'));

-- Admin and Manager can update suppliers
CREATE POLICY "Admin and Manager can update suppliers"
ON public.suppliers
FOR UPDATE
USING (public.get_my_role() IN ('Admin', 'Manager'))
WITH CHECK (public.get_my_role() IN ('Admin', 'Manager'));

-- Only Admin can delete suppliers
CREATE POLICY "Admin can delete suppliers"
ON public.suppliers
FOR DELETE
USING (public.get_my_role() = 'Admin');

-- <<< end: 07_create_suppliers_table.sql

-- >>> begin: 08_create_customers_table.sql
/* =============================================================================
   MODULE — CUSTOMERS
   Migration: customers table for Customer Management
   Stores customer master data for POS billing, search, and future bill history.
   Referenced by bills table via customer_id (UUID) for purchase statistics.
   ============================================================================= */

/* STEP 1: ENSURE UUID EXTENSION (for uuid_generate_v4) */
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

/* STEP 2: CREATE CUSTOMERS TABLE */
CREATE TABLE public.customers (
  id         uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name       text NOT NULL,
  phone      text NOT NULL,
  email      text,
  address    text,
  is_active  boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_customers_phone UNIQUE (phone)
);

COMMENT ON TABLE public.customers IS 'Customer master: name, phone, email, address; supports POS billing, search, quick-add, and future bill history.';
COMMENT ON COLUMN public.customers.phone IS 'Required; unique per customer. Used for search and quick lookup at POS.';
COMMENT ON COLUMN public.customers.is_active IS 'Soft delete: false = deleted. Default lists and search filter by is_active = true.';

/* STEP 3: INDEXES FOR SEARCH PERFORMANCE */
CREATE INDEX idx_customers_phone ON public.customers(phone);
CREATE INDEX idx_customers_name ON public.customers(name);
CREATE INDEX idx_customers_is_active ON public.customers(is_active);

/* STEP 4: AUTO-UPDATE updated_at */
CREATE TRIGGER trigger_update_customers_updated_at
BEFORE UPDATE ON public.customers
FOR EACH ROW
EXECUTE PROCEDURE update_updated_at_column();

/* STEP 5: ROW LEVEL SECURITY — default deny all */
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

/* STEP 6: RLS POLICIES (refine role/scope when bills and branches are introduced) */

-- Authenticated users can read customers (POS search, profile, bill history)
CREATE POLICY "Authenticated users can read customers"
ON public.customers
FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Admin and Manager can insert customers (quick-add at POS may later allow Staff)
CREATE POLICY "Admin and Manager can insert customers"
ON public.customers
FOR INSERT
WITH CHECK (public.get_my_role() IN ('Admin', 'Manager'));

-- Admin and Manager can update customers
CREATE POLICY "Admin and Manager can update customers"
ON public.customers
FOR UPDATE
USING (public.get_my_role() IN ('Admin', 'Manager'))
WITH CHECK (public.get_my_role() IN ('Admin', 'Manager'));

-- Only Admin can delete customers (prefer soft delete: set is_active = false)
CREATE POLICY "Admin can delete customers"
ON public.customers
FOR DELETE
USING (public.get_my_role() = 'Admin');

-- <<< end: 08_create_customers_table.sql

-- >>> begin: 09_create_user_permissions.sql
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

-- <<< end: 09_create_user_permissions.sql

-- >>> begin: 10_drop_product_sku_and_optional_category.sql
/* =============================================================================
   PRODUCT MODULE — Remove SKU, make category optional
   - Drop sku column and index from products
   - Ensure product_category_id is nullable (optional category)
   ============================================================================= */

/* Drop index on sku before dropping column (recommended) */
DROP INDEX IF EXISTS public.idx_products_sku;

/* Remove sku column from products */
ALTER TABLE public.products
  DROP COLUMN IF EXISTS sku;

/* Ensure product_category_id allows NULL (optional category) */
ALTER TABLE public.products
  ALTER COLUMN product_category_id DROP NOT NULL;

-- <<< end: 10_drop_product_sku_and_optional_category.sql
