-- =============================================================================
-- 67_postgrest_grants_public_schema.sql
--
-- PostgREST uses anon / authenticated / service_role. Table-level GRANT is
-- required before RLS runs; otherwise every screen hits "permission denied".
--
-- Migrations 64–66 only granted platform tables + public.users. This migration
-- covers all other relations in public (user_permissions, customers, suppliers,
-- product_categories, products, views, etc.) and sets defaults for new objects.
--
-- If the app still shows permission denied after deploying, run this entire file
-- in the Supabase SQL Editor against the same database (idempotent).
-- =============================================================================

BEGIN;

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated, service_role;
GRANT EXECUTE ON ALL PROCEDURES IN SCHEMA public TO anon, authenticated, service_role;

-- Per-relation pass (tables, views, matviews, partition roots, foreign tables).
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
