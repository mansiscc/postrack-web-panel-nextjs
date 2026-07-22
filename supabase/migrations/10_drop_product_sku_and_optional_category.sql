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
