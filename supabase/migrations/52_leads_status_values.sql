/* =============================================================================
   Migration 52 — Leads pipeline status values (already applied DBs)

   Replaces legacy lowercase statuses with:
   New | Contacted | Interested | Approved | Not Interested

   Run after 51_multi_tenant_foundation.sql when 51 used the old CHECK values.
   ============================================================================= */

BEGIN;

UPDATE public.leads SET status = 'New' WHERE lower(status) = 'new';
UPDATE public.leads SET status = 'Contacted' WHERE lower(status) = 'contacted';
UPDATE public.leads SET status = 'Approved' WHERE lower(status) = 'approved';
UPDATE public.leads SET status = 'Not Interested' WHERE lower(status) = 'rejected';

UPDATE public.leads
SET status = 'New'
WHERE status IS NOT NULL
  AND status NOT IN ('New', 'Contacted', 'Interested', 'Approved', 'Not Interested');

ALTER TABLE public.leads DROP CONSTRAINT IF EXISTS leads_status_check;

ALTER TABLE public.leads
  ADD CONSTRAINT leads_status_check CHECK (
    status IN ('New', 'Contacted', 'Interested', 'Approved', 'Not Interested')
  );

ALTER TABLE public.leads
  ALTER COLUMN status SET DEFAULT 'New';

COMMIT;
