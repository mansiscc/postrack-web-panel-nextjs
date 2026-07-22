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
