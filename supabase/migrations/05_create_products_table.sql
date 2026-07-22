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
