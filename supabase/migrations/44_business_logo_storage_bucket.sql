BEGIN;

INSERT INTO storage.buckets (id, name, public)
VALUES ('business-logos', 'business-logos', true)
ON CONFLICT (id) DO UPDATE
SET public = EXCLUDED.public;

DROP POLICY IF EXISTS "Public can read business logos" ON storage.objects;
CREATE POLICY "Public can read business logos"
ON storage.objects
FOR SELECT
USING (bucket_id = 'business-logos');

DROP POLICY IF EXISTS "Admin can upload business logos" ON storage.objects;
CREATE POLICY "Admin can upload business logos"
ON storage.objects
FOR INSERT
WITH CHECK (
    bucket_id = 'business-logos'
    AND EXISTS (
        SELECT 1
        FROM public.users u
        WHERE u.id = auth.uid()
          AND u.role = 'Admin'
    )
);

DROP POLICY IF EXISTS "Admin can update business logos" ON storage.objects;
CREATE POLICY "Admin can update business logos"
ON storage.objects
FOR UPDATE
USING (
    bucket_id = 'business-logos'
    AND EXISTS (
        SELECT 1
        FROM public.users u
        WHERE u.id = auth.uid()
          AND u.role = 'Admin'
    )
)
WITH CHECK (
    bucket_id = 'business-logos'
    AND EXISTS (
        SELECT 1
        FROM public.users u
        WHERE u.id = auth.uid()
          AND u.role = 'Admin'
    )
);

DROP POLICY IF EXISTS "Admin can delete business logos" ON storage.objects;
CREATE POLICY "Admin can delete business logos"
ON storage.objects
FOR DELETE
USING (
    bucket_id = 'business-logos'
    AND EXISTS (
        SELECT 1
        FROM public.users u
        WHERE u.id = auth.uid()
          AND u.role = 'Admin'
    )
);

COMMIT;
