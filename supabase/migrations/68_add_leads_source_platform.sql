/* =============================================================================
   Migration 68 — Add source & platform to public.leads

   - source: acquisition channel (website, social network, referral, etc.)
   - platform: product surface (web, android, admin, …)
   ============================================================================= */

BEGIN;

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS source text,
  ADD COLUMN IF NOT EXISTS platform text;

COMMENT ON COLUMN public.leads.source IS
  'Acquisition channel: website, social network id, referral, admin-manual, etc.';
COMMENT ON COLUMN public.leads.platform IS
  'Product surface that captured the lead: web, android, ios, admin, other.';

CREATE INDEX IF NOT EXISTS idx_leads_source ON public.leads(source);
CREATE INDEX IF NOT EXISTS idx_leads_platform ON public.leads(platform);

COMMIT;
