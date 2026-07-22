-- =============================================================================
-- 72_app_updates_super_admin_rls.sql
--
-- POS Track admin panel operators live in public.super_admins (not public.users).
-- Migration 39 only granted write access to company Admin users; add super-admin
-- policies and activity logging for the App Updates module.
-- =============================================================================

BEGIN;

DROP POLICY IF EXISTS app_updates_super_admin_all ON public.app_updates;
CREATE POLICY app_updates_super_admin_all
  ON public.app_updates
  FOR ALL
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

DROP TRIGGER IF EXISTS trg_sa_log_app_updates ON public.app_updates;
CREATE TRIGGER trg_sa_log_app_updates
  AFTER INSERT OR UPDATE OR DELETE ON public.app_updates
  FOR EACH ROW
  EXECUTE PROCEDURE public.trg_log_super_admin_activity('App Updates');

COMMIT;
