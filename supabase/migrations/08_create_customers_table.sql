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
