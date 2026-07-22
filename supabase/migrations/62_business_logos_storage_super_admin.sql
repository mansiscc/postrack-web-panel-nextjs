/* =============================================================================
   Migration 62 — Allow platform super admins to manage business-logos storage

   Admin panel operators live in public.super_admins only (not public.users).
   Migration 44 restricted uploads to tenant Admins, so logo changes from the
   panel failed with: new row violates row-level security policy.
   ============================================================================= */

BEGIN;

DROP POLICY IF EXISTS "Admin can upload business logos" ON storage.objects;
CREATE POLICY "Admin can upload business logos"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'business-logos'
  AND (
    public.is_super_admin()
    OR EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = auth.uid()
        AND u.role = 'Admin'
    )
  )
);

DROP POLICY IF EXISTS "Admin can update business logos" ON storage.objects;
CREATE POLICY "Admin can update business logos"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'business-logos'
  AND (
    public.is_super_admin()
    OR EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = auth.uid()
        AND u.role = 'Admin'
    )
  )
)
WITH CHECK (
  bucket_id = 'business-logos'
  AND (
    public.is_super_admin()
    OR EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = auth.uid()
        AND u.role = 'Admin'
    )
  )
);

DROP POLICY IF EXISTS "Admin can delete business logos" ON storage.objects;
CREATE POLICY "Admin can delete business logos"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'business-logos'
  AND (
    public.is_super_admin()
    OR EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = auth.uid()
        AND u.role = 'Admin'
    )
  )
);

COMMIT;
