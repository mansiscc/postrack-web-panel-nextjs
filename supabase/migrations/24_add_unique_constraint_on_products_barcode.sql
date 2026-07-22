/* =============================================================================
   Migration 24: Ensure unique product barcodes

   - Adds a UNIQUE constraint on products.barcode so that
     no two products can share the same non-null barcode.

   NOTE:
   - Column remains nullable; PostgreSQL allows multiple NULL values.
   - If this migration fails because of existing duplicates, clean up
     duplicated barcodes first, then re-run the migration.
   ============================================================================= */

ALTER TABLE public.products
ADD CONSTRAINT uq_products_barcode UNIQUE (barcode);

