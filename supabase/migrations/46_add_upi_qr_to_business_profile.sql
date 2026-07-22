BEGIN;

ALTER TABLE public.business_profile
ADD COLUMN IF NOT EXISTS upi_id text,
ADD COLUMN IF NOT EXISTS upi_name text,
ADD COLUMN IF NOT EXISTS upi_qr_enabled boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.business_profile.upi_id IS
  'Merchant UPI VPA used to generate fixed-amount bill payment QR codes.';

COMMENT ON COLUMN public.business_profile.upi_name IS
  'Payee name used in UPI payment QR payloads.';

COMMENT ON COLUMN public.business_profile.upi_qr_enabled IS
  'Controls whether bill payment QR should be generated from the business profile.';

COMMIT;
