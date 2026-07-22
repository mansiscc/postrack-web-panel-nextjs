/* =============================================================================
   MODULE — STOCK TRANSACTIONS RLS
   Migration: Enable row-level security and add policies
   so application code and triggers can insert and read rows
   in public.stock_transactions without RLS violations.

   Fixes error:
   "new row violates row-level security policy for table \"stock_transactions\""
   when inserting products that cause stock_transactions trigger inserts.
   ============================================================================= */

/* STEP 1: ENABLE ROW LEVEL SECURITY (idempotent) */
ALTER TABLE public.stock_transactions ENABLE ROW LEVEL SECURITY;

/* STEP 2: POLICIES */

-- Authenticated users can read stock_transactions
CREATE POLICY "Authenticated users can read stock_transactions"
ON public.stock_transactions
FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Authenticated users can insert stock_transactions
-- (includes inserts performed via triggers on products / stock_in_items)
CREATE POLICY "Authenticated users can insert stock_transactions"
ON public.stock_transactions
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

