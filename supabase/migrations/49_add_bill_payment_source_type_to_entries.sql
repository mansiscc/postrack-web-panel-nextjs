/* =============================================================================
   MIGRATION — Add 'bill_payment' to entries source_type allowed values

   Problem:
   - entries_source_type_check only allows: bill, bill_return, purchase, manual
   - When collecting pending payment later from Bill Detail screen, app needs to
     post a separate income entry for the collected amount.
   - Using source_type = 'bill' fails due to unique constraint on
     (source_type, source_id, account_id) — original bill entry already occupies that slot.

   Fix:
   - Extend entries_source_type_check to also allow 'bill_payment'.
   - 'bill_payment' entries use source_id = bill.id (UUID safe) but represent
     a follow-up collection on a pending/partial bill, not the original sale.
   ============================================================================= */

ALTER TABLE public.entries
    DROP CONSTRAINT IF EXISTS entries_source_type_check;

ALTER TABLE public.entries
    ADD CONSTRAINT entries_source_type_check
        CHECK (
            source_type IS NULL
            OR source_type IN ('bill', 'bill_return', 'purchase', 'manual', 'bill_payment')
        );

COMMENT ON CONSTRAINT entries_source_type_check ON public.entries IS
    'Restricts source_type to known values: bill, bill_return, purchase, manual, bill_payment.
     bill_payment is used when collecting pending/remaining amount after original bill was partially paid.';
