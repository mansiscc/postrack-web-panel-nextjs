-- =============================================================================
-- 66_postgrest_grants_public_users.sql
--
-- PostgREST uses database roles anon / authenticated / service_role. Table-level
-- GRANT is separate from RLS: without privileges, Postgres returns
-- "permission denied for table users" (42501) before policies run.
--
-- The Edge Function provision-company-admin inserts into public.users via the
-- service_role REST client. Migration 64 granted platform tables but omitted
-- public.users; this migration fixes that gap.
-- =============================================================================

BEGIN;

GRANT ALL PRIVILEGES ON TABLE public.users TO authenticated;
GRANT ALL PRIVILEGES ON TABLE public.users TO service_role;

COMMIT;
