BEGIN;

ALTER TABLE public.business_profile
DROP COLUMN IF EXISTS upi_id,
DROP COLUMN IF EXISTS upi_name,
DROP COLUMN IF EXISTS upi_qr_enabled;

COMMIT;
