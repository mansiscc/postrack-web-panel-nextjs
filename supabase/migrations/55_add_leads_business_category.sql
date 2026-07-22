/* =============================================================================
   Migration 55 — Add business_category to public.leads

   Keeps website lead form category in a structured column.
   This file is intentionally duplicated in POS-Web/supabase/migrations/.
   ============================================================================= */

BEGIN;

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS business_category text;

CREATE INDEX IF NOT EXISTS idx_leads_business_category
  ON public.leads(business_category);

COMMIT;

