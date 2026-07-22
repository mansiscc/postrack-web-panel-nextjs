/* =============================================================================
   MAINTENANCE — Full tenant wipe for every company with is_deleted = true

   Purpose:
     Same permanent removal as delete_company_tenant_wipe.sql, but for all
     tenants that were soft-deleted (public.companies.is_deleted = true).
     Removes POS data, public.users, auth.users, and the company row for each.

   Storage (business-logos):
     Hosted Supabase blocks direct DELETE on storage.objects (trigger
     storage.protect_delete). After this script, remove logo files via
     Dashboard → Storage or the Storage API (service role); see RAISE NOTICE
     output for user id prefixes and logo object path hints.

   When to use:
     Purging soft-deleted companies after a retention period, or cleaning
     staging. Irreversible.

   Prerequisites:
     - Run in Supabase SQL Editor as a role that can modify auth and public
       (database superuser / postgres connection), or use psql.
     - RLS does not apply to table owners; maintenance roles bypass RLS.

   Conventions for manual Storage cleanup:
     - Bucket id: business-logos
     - Object names: "<auth_user_id>/<uuid>.<ext>"

   Leads (public.leads):
     converted_company_id is ON DELETE SET NULL. Deleting the company clears
     that link. To also delete those lead rows, set v_delete_linked_leads
     to true below.

   Per-company failures:
     Each company runs in an inner BEGIN … EXCEPTION block. If one tenant
     fails (e.g. auth.users delete), that iteration’s database changes roll
     back automatically and a WARNING is raised; other companies in the batch
     still commit. (SAVEPOINT / ROLLBACK TO cannot be used inside EXCEPTION
     blocks in PL/pgSQL.)

   Usage:
     1) Optionally set v_delete_linked_leads := true.
     2) Run the entire file (BEGIN … COMMIT) in one session.

   ============================================================================= */

BEGIN;

DO $$
DECLARE
  v_company uuid;

  v_user_ids uuid[];

  v_company_name text;

  v_logo_url text;

  v_logo_object_name text;

  v_delete_linked_leads boolean := false;

  v_has_prevent_user_delete_trigger boolean;

  v_total int;

  v_ok int := 0;

  v_fail int := 0;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'users'
      AND t.tgname = 'trigger_prevent_user_delete'
      AND NOT t.tgisinternal
  )
  INTO v_has_prevent_user_delete_trigger;

  SELECT count(*)::int
  INTO v_total
  FROM public.companies c
  WHERE c.is_deleted = true;

  RAISE NOTICE 'Soft-deleted companies to wipe: %', v_total;

  IF v_total = 0 THEN
    RAISE NOTICE 'Nothing to do (no rows with public.companies.is_deleted = true).';
    RETURN;
  END IF;

  FOR v_company IN
    SELECT c.id
    FROM public.companies c
    WHERE c.is_deleted = true
    ORDER BY c.id
  LOOP
    v_company_name := NULL;

    BEGIN
      SELECT coalesce(array_agg(u.id), '{}'::uuid[])
      INTO v_user_ids
      FROM public.users u
      WHERE u.company_id = v_company;

      SELECT c.business_name, c.logo_url
      INTO v_company_name, v_logo_url
      FROM public.companies c
      WHERE c.id = v_company;

      v_logo_object_name := NULL;
      IF v_logo_url IS NOT NULL AND length(trim(v_logo_url)) > 0 THEN
        v_logo_object_name := substring(v_logo_url from 'business-logos/(.+)$');
        IF v_logo_object_name IS NOT NULL AND length(trim(v_logo_object_name)) > 0 THEN
          v_logo_object_name := regexp_replace(trim(v_logo_object_name), '[?#].*$', '');
        ELSE
          v_logo_object_name := NULL;
        END IF;
      END IF;

      RAISE NOTICE
        'Company "%" (%) — storage hints: user ids %; logo path: %.',
        coalesce(v_company_name, ''),
        v_company,
        v_user_ids,
        coalesce(v_logo_object_name, '(none parsed from logo_url)');

      IF v_delete_linked_leads THEN
        DELETE FROM public.leads l
        WHERE l.converted_company_id = v_company;
      END IF;

      IF v_has_prevent_user_delete_trigger THEN
        ALTER TABLE public.users DISABLE TRIGGER trigger_prevent_user_delete;
      END IF;

      DELETE FROM public.bill_return_items WHERE company_id = v_company;
      DELETE FROM public.bill_returns WHERE company_id = v_company;
      DELETE FROM public.bill_items WHERE company_id = v_company;
      DELETE FROM public.bills WHERE company_id = v_company;

      DELETE FROM public.entries WHERE company_id = v_company;

      DELETE FROM public.stock_transactions WHERE company_id = v_company;
      DELETE FROM public.stock_in_items WHERE company_id = v_company;
      DELETE FROM public.stock_in WHERE company_id = v_company;

      DELETE FROM public.products WHERE company_id = v_company;

      DELETE FROM public.customers WHERE company_id = v_company;
      DELETE FROM public.suppliers WHERE company_id = v_company;
      DELETE FROM public.taxes WHERE company_id = v_company;
      DELETE FROM public.product_categories WHERE company_id = v_company;
      DELETE FROM public.accounting_categories WHERE company_id = v_company;

      DELETE FROM public.accounts WHERE company_id = v_company;

      DELETE FROM public.activity_log WHERE company_id = v_company;

      DELETE FROM public.user_permissions up
      WHERE up.user_id = ANY (v_user_ids);

      DELETE FROM public.users u
      WHERE u.company_id = v_company;

      IF v_has_prevent_user_delete_trigger THEN
        ALTER TABLE public.users ENABLE TRIGGER trigger_prevent_user_delete;
      END IF;

      DELETE FROM auth.users au
      WHERE au.id = ANY (v_user_ids);

      DELETE FROM public.companies c
      WHERE c.id = v_company;

      v_ok := v_ok + 1;

      RAISE NOTICE
        'Successfully deleted company "%" (id: %). Running total removed: %.',
        coalesce(nullif(trim(v_company_name), ''), '(no name)'),
        v_company,
        v_ok;
    EXCEPTION
      WHEN OTHERS THEN
        v_fail := v_fail + 1;
        RAISE WARNING
          'Failed to wipe soft-deleted company "%" (%): %',
          coalesce(nullif(trim(v_company_name), ''), '(no name)'),
          v_company,
          SQLERRM;
    END;
  END LOOP;

  RAISE NOTICE
    'Finished. Companies permanently removed: % (failed: %; soft-deleted rows seen at start: %).',
    v_ok,
    v_fail,
    v_total;
END
$$;

COMMIT;
