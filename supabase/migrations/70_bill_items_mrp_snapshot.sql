/* =============================================================================
   Migration: MRP snapshot on bill_items for receipt "** Saved Rs. X/- on MRP **"
   ============================================================================= */

BEGIN;

ALTER TABLE public.bill_items
  ADD COLUMN IF NOT EXISTS mrp numeric(18, 2);

COMMENT ON COLUMN public.bill_items.mrp IS
  'Product MRP at time of billing; used to show customer savings on receipt when MRP > unit_price.';

COMMIT;
