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
