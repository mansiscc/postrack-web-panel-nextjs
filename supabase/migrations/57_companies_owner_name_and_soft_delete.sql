/* =============================================================================
   Migration 57 — Update public.companies owner/deletion columns

   Changes:
   - Remove legacy billing email column from companies
   - Add owner_name for display/ownership metadata
   - Add is_deleted soft-delete flag

   If you keep mirrored migrations in admin-panel, copy this file there too.
   ============================================================================= */

BEGIN;

ALTER TABLE public.companies
  DROP COLUMN IF EXISTS email;

ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS owner_name text,
  ADD COLUMN IF NOT EXISTS is_deleted boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_companies_is_deleted
  ON public.companies(is_deleted);

COMMIT;
