-- =============================================================================
-- 0012_postgrest_grants_public_users.sql
--
-- Mirrors incremental migration 66_postgrest_grants_public_users.sql
-- =============================================================================

BEGIN;

GRANT ALL PRIVILEGES ON TABLE public.users TO authenticated;
GRANT ALL PRIVILEGES ON TABLE public.users TO service_role;

COMMIT;
