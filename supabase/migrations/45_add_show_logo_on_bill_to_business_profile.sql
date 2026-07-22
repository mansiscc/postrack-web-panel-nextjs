BEGIN;

ALTER TABLE public.business_profile
ADD COLUMN IF NOT EXISTS show_logo_on_bill boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.business_profile.show_logo_on_bill IS
  'Controls whether the business logo should be printed on receipts when a logo is available.';

COMMIT;
