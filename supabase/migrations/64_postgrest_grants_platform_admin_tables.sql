-- =============================================================================
-- 64_postgrest_grants_platform_admin_tables.sql
--
-- Mirrors migrations_consolidated/0010_postgrest_grants_platform_admin_tables.sql
--
-- PostgREST connects as anon / authenticated / service_role. Table-level
-- privileges (GRANT) are separate from RLS: without SELECT (etc.), Postgres
-- returns "permission denied for table …" (42501) before row filters apply.
--
-- Platform tables from 51_multi_tenant_foundation.sql had RLS policies but no
-- explicit GRANTs; the website lead API uses the service role key server-side.
-- =============================================================================

BEGIN;

GRANT ALL PRIVILEGES ON TABLE public.leads TO authenticated;
GRANT ALL PRIVILEGES ON TABLE public.leads TO service_role;

GRANT ALL PRIVILEGES ON TABLE public.companies TO authenticated;
GRANT ALL PRIVILEGES ON TABLE public.companies TO service_role;

GRANT ALL PRIVILEGES ON TABLE public.super_admins TO authenticated;
GRANT ALL PRIVILEGES ON TABLE public.super_admins TO service_role;

GRANT ALL PRIVILEGES ON TABLE public.super_admin_activity_log TO authenticated;
GRANT ALL PRIVILEGES ON TABLE public.super_admin_activity_log TO service_role;

COMMIT;
