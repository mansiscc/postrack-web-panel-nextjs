/* =============================================================================
   Migration 39 — App updates table + RLS policies
   Purpose:
   - Centralize Android app update control from Supabase.
   - Allow public (anon + authenticated) read for startup version checks.
   - Restrict write operations to Admin users only.
   ============================================================================= */

BEGIN;

/* -----------------------------------------------------------------------------
   STEP 1: TABLE
   ----------------------------------------------------------------------------- */
CREATE TABLE IF NOT EXISTS public.app_updates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform text NOT NULL CHECK (platform IN ('android', 'ios')),
  latest_version_code integer NOT NULL CHECK (latest_version_code > 0),
  min_version_code integer NOT NULL CHECK (min_version_code > 0),
  force_update boolean NOT NULL DEFAULT false,
  is_blocked boolean NOT NULL DEFAULT false,
  update_message text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NULL REFERENCES public.users(id) ON DELETE SET NULL,
  updated_by uuid NULL REFERENCES public.users(id) ON DELETE SET NULL,
  is_active boolean NOT NULL DEFAULT true,
  CONSTRAINT app_updates_version_range_chk CHECK (min_version_code <= latest_version_code)
);

COMMENT ON TABLE public.app_updates IS
  'App version control records (latest/min/force/block) per platform.';

COMMENT ON COLUMN public.app_updates.platform IS
  'Client platform key, currently android/ios.';

COMMENT ON COLUMN public.app_updates.latest_version_code IS
  'Newest app build versionCode available for update.';

COMMENT ON COLUMN public.app_updates.min_version_code IS
  'Minimum allowed app build versionCode.';

/* -----------------------------------------------------------------------------
   STEP 2: INDEXES
   ----------------------------------------------------------------------------- */
CREATE INDEX IF NOT EXISTS idx_app_updates_platform_created_at
  ON public.app_updates(platform, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_app_updates_is_active
  ON public.app_updates(is_active);

/* -----------------------------------------------------------------------------
   STEP 3: updated_at trigger
   Reuses update_updated_at_column() created in migration 01.
   ----------------------------------------------------------------------------- */
DROP TRIGGER IF EXISTS trigger_update_app_updates_updated_at ON public.app_updates;
CREATE TRIGGER trigger_update_app_updates_updated_at
BEFORE UPDATE ON public.app_updates
FOR EACH ROW
EXECUTE PROCEDURE update_updated_at_column();

/* -----------------------------------------------------------------------------
   STEP 4: RLS + POLICIES
   ----------------------------------------------------------------------------- */
ALTER TABLE public.app_updates ENABLE ROW LEVEL SECURITY;

-- Keep this migration re-runnable in non-prod/reset environments.
DROP POLICY IF EXISTS "Public read app updates" ON public.app_updates;
DROP POLICY IF EXISTS "Admin manage app updates" ON public.app_updates;

-- Required for startup check with no authentication dependency.
CREATE POLICY "Public read app updates"
ON public.app_updates
FOR SELECT
USING (is_active = true);

-- Only Admin can insert/update/delete update rules.
CREATE POLICY "Admin manage app updates"
ON public.app_updates
FOR ALL
USING (
  EXISTS (
    SELECT 1
    FROM public.users u
    WHERE u.id = auth.uid()
      AND u.role = 'Admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.users u
    WHERE u.id = auth.uid()
      AND u.role = 'Admin'
  )
);

COMMIT;

