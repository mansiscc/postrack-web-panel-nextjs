/* =============================================================================
   Migration 56 — Add business_category to public.companies

   Stores the tenant’s business category on the company profile (aligned with
   website lead form / admin panel). Backfills from public.leads where a lead
   was converted to that company.

   Copy this same file into pos-track-admin-panel/supabase/migrations/.
   ============================================================================= */

BEGIN;

ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS business_category text;

CREATE INDEX IF NOT EXISTS idx_companies_business_category
  ON public.companies(business_category);

/* Backfill from the most recently updated lead per converted company */
UPDATE public.companies c
SET business_category = sub.business_category
FROM (
  SELECT DISTINCT ON (converted_company_id)
    converted_company_id,
    business_category
  FROM public.leads
  WHERE converted_company_id IS NOT NULL
    AND business_category IS NOT NULL
    AND trim(business_category) <> ''
  ORDER BY converted_company_id, updated_at DESC
) sub
WHERE c.id = sub.converted_company_id
  AND (c.business_category IS NULL OR trim(c.business_category) = '');

COMMIT;
