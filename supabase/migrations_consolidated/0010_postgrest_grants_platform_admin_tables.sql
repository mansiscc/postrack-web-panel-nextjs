-- =============================================================================
-- 0010_postgrest_grants_platform_admin_tables.sql
--
-- PostgREST connects as anon / authenticated / service_role. Table-level
-- privileges (GRANT) are separate from RLS: without SELECT (etc.), Postgres
-- returns "permission denied for table …" before row filters apply.
--
-- Platform tables from 0009 often had RLS policies but no explicit GRANTs in
-- consolidated migrations; grants added at project setup do not always cover
-- tables created in later migrations. This migration aligns privileges with
-- other public.app tables for the Supabase API roles.
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
