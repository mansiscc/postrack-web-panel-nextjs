-- =============================================================================
-- 0013_postgrest_grants_public_schema.sql
--
-- Mirrors incremental migration 67_postgrest_grants_public_schema.sql.
-- Must run last in the consolidated bundle (after every CREATE TABLE/VIEW).
-- =============================================================================

BEGIN;

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated, service_role;
GRANT EXECUTE ON ALL PROCEDURES IN SCHEMA public TO anon, authenticated, service_role;

DO $$
DECLARE
  rel record;
BEGIN
  FOR rel IN
    SELECT c.relname
    FROM pg_catalog.pg_class c
    JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind IN ('r', 'v', 'm', 'p', 'f')
  LOOP
    EXECUTE format(
      'GRANT ALL PRIVILEGES ON TABLE public.%I TO anon, authenticated, service_role',
      rel.relname
    );
  END LOOP;

  FOR rel IN
    SELECT c.relname
    FROM pg_catalog.pg_class c
    JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind = 'S'
  LOOP
    EXECUTE format(
      'GRANT ALL PRIVILEGES ON SEQUENCE public.%I TO anon, authenticated, service_role',
      rel.relname
    );
  END LOOP;
END $$;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL PRIVILEGES ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL PRIVILEGES ON SEQUENCES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT EXECUTE ON FUNCTIONS TO anon, authenticated, service_role;

COMMIT;
