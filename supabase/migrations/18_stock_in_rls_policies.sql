/* =============================================================================
   MODULE — STOCK_IN & STOCK_IN_ITEMS RLS
   Migration: Enable RLS (if not already) and add policies so that
   create_product_with_opening_stock and create_stock_in RPCs can insert
   into stock_in and stock_in_items when called by an authenticated user.

   Fixes error:
   "new row violates row-level security policy for table \"stock_in\""
   ============================================================================= */

/* -----------------------------------------------------------------------------
   STEP 1: Ensure RLS is enabled on stock_in and stock_in_items
   ----------------------------------------------------------------------------- */
ALTER TABLE public.stock_in ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_in_items ENABLE ROW LEVEL SECURITY;

/* -----------------------------------------------------------------------------
   STEP 2: Policies for stock_in — authenticated users can read and insert
   ----------------------------------------------------------------------------- */
DROP POLICY IF EXISTS "Authenticated users can read stock_in" ON public.stock_in;
CREATE POLICY "Authenticated users can read stock_in"
ON public.stock_in
FOR SELECT
USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can insert stock_in" ON public.stock_in;
CREATE POLICY "Authenticated users can insert stock_in"
ON public.stock_in
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

/* -----------------------------------------------------------------------------
   STEP 3: Policies for stock_in_items — authenticated users can read and insert
   ----------------------------------------------------------------------------- */
DROP POLICY IF EXISTS "Authenticated users can read stock_in_items" ON public.stock_in_items;
CREATE POLICY "Authenticated users can read stock_in_items"
ON public.stock_in_items
FOR SELECT
USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can insert stock_in_items" ON public.stock_in_items;
CREATE POLICY "Authenticated users can insert stock_in_items"
ON public.stock_in_items
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);
