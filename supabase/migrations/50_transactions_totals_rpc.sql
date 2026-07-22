/* =============================================================================
   MODULE — TRANSACTIONS TOTALS RPC
   Migration: get_transactions_totals()

   Returns system-wide totals across all non-deleted accounting entries:
   - total_entries_count
   - total_income (sum of income entries)
   - total_expense (sum of expense entries)
   ============================================================================= */

CREATE OR REPLACE FUNCTION public.get_transactions_totals()
RETURNS TABLE (
  total_entries_count bigint,
  total_income double precision,
  total_expense double precision
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    COUNT(*) AS total_entries_count,
    COALESCE(SUM(CASE WHEN entry_type = 'income'  THEN amount ELSE 0 END), 0)::double precision AS total_income,
    COALESCE(SUM(CASE WHEN entry_type = 'expense' THEN amount ELSE 0 END), 0)::double precision AS total_expense
  FROM public.entries
  WHERE is_deleted = false;
$$;

