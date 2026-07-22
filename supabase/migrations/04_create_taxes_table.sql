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
