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
