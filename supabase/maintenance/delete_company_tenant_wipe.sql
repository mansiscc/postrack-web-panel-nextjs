/* =============================================================================
   MAINTENANCE — Full tenant wipe for one company (public data + storage + auth)

   Purpose:
     Permanently remove one tenant’s POS data, their rows in public.users,
     and corresponding auth.users rows so those logins no longer exist.

   Storage (business-logos):
     Hosted Supabase blocks direct DELETE on storage.objects (trigger
     storage.protect_delete). After this script, remove logo files via
     Dashboard → Storage or the Storage API (service role); see RAISE NOTICE
     output for user id prefixes and logo object path hints.

   When to use:
     Staging resets, GDPR-style erasure for a single company, or cleaning a
     botched provisioning run. This is irreversible.

   When NOT to use:
     Prefer soft-delete (public.companies.is_deleted) or deactivating users if
     you only need to block access.

   Prerequisites:
     - Run in Supabase SQL Editor as a role that can modify auth and public
       (database superuser / postgres connection), or use psql.
     - RLS does not apply to table owners; maintenance roles bypass RLS.

   Conventions for manual Storage cleanup (migrations 44, 51, Android
   BusinessLogoStorageRemoteDataSource):
     - Bucket id: business-logos
     - Object names: "<auth_user_id>/<uuid>.<ext>" (first path segment is
       auth uid, not the company uuid).

   Leads (public.leads):
     converted_company_id is ON DELETE SET NULL. Deleting the company clears
     that link. To also delete those lead rows, enable the optional block below.

   If auth.users DELETE fails:
     Your Supabase version may require deleting via Dashboard → Authentication
     or the Auth Admin API after public.users are removed.

   Usage:
     1) Set v_company inside the DO block to the tenant uuid.
     2) Optionally set v_delete_linked_leads := true to remove CRM lead rows.
     3) Run the entire file (BEGIN … COMMIT) in one session.

   ============================================================================= */

BEGIN;

DO $$
DECLARE
  /*
   * Target tenant. Replace before running (keep the uuid cast).
   * Example: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid
   */
  v_company uuid := '00000000-0000-0000-0000-000000000000'::uuid;

  /* All public.users ids for this company (same as auth.users ids). */
  v_user_ids uuid[];

  /* Company logo URL from DB (may point at storage or an external https URL). */
  v_logo_url text;

  /* Relative object path inside bucket business-logos, derived from logo_url. */
  v_logo_object_name text;

  /* Optional: set true to DELETE leads rows linked via converted_company_id. */
  v_delete_linked_leads boolean := false;

  /* Migration 01 adds this; some DBs may not have it — only toggle if present. */
  v_has_prevent_user_delete_trigger boolean;
BEGIN
  IF v_company = '00000000-0000-0000-0000-000000000000'::uuid THEN
    RAISE EXCEPTION
      'Set v_company to the real company id (replace the all-zero placeholder).';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.companies c WHERE c.id = v_company) THEN
    RAISE EXCEPTION 'No public.companies row found for id %', v_company;
  END IF;

  /* -------------------------------------------------------------------------
     Collect auth user ids for this tenant before any deletes.
     ------------------------------------------------------------------------- */
  SELECT coalesce(array_agg(u.id), '{}'::uuid[])
  INTO v_user_ids
  FROM public.users u
  WHERE u.company_id = v_company;

  SELECT c.logo_url
  INTO v_logo_url
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

  /*
   * Single subtransaction: if any step fails, all writes below roll back together
   * and trigger_prevent_user_delete is re-enabled when it was disabled.
   */
  BEGIN
    /* -----------------------------------------------------------------------
       Storage — business-logos

       Direct DELETE on storage.objects is rejected by storage.protect_delete()
       on hosted Supabase; use Dashboard or Storage API after this script.
       ----------------------------------------------------------------------- */
    RAISE NOTICE
      'Storage cleanup (manual/API): bucket business-logos — delete objects '
      'with name prefix "<user_id>/" for each id in %; optional exact logo path: %.',
      v_user_ids,
      coalesce(v_logo_object_name, '(none parsed from logo_url)');

    IF v_delete_linked_leads THEN
      DELETE FROM public.leads l
      WHERE l.converted_company_id = v_company;
    END IF;

    /* Migration 01 — hard delete on public.users is normally blocked. */
    IF v_has_prevent_user_delete_trigger THEN
      ALTER TABLE public.users DISABLE TRIGGER trigger_prevent_user_delete;
    END IF;

    /* -----------------------------------------------------------------------
       public schema — FK-safe order (tenant FKs to companies do not CASCADE
       in migration 51).
       ----------------------------------------------------------------------- */
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

    /* activity_log.user_id is ON DELETE RESTRICT — remove before users. */
    DELETE FROM public.activity_log WHERE company_id = v_company;

    DELETE FROM public.user_permissions up
    WHERE up.user_id = ANY (v_user_ids);

    DELETE FROM public.users u
    WHERE u.company_id = v_company;

    IF v_has_prevent_user_delete_trigger THEN
      ALTER TABLE public.users ENABLE TRIGGER trigger_prevent_user_delete;
    END IF;

    /* -----------------------------------------------------------------------
       Auth — same ids as public.users; cascades to identities/sessions on
       hosted Supabase. If this fails, finish removal via Dashboard or Admin API.
       ----------------------------------------------------------------------- */
    DELETE FROM auth.users au
    WHERE au.id = ANY (v_user_ids);

    DELETE FROM public.companies c
    WHERE c.id = v_company;
  EXCEPTION
    WHEN OTHERS THEN
      IF v_has_prevent_user_delete_trigger THEN
        ALTER TABLE public.users ENABLE TRIGGER trigger_prevent_user_delete;
      END IF;
      RAISE;
  END;
END
$$;

COMMIT;
