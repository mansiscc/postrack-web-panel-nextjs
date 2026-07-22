/* =============================================================================
   File: manual_create_platform_super_admin_auth_and_super_admins_row.sql
   Purpose: Manually create a platform (admin panel) super admin in ONE run:
            - Supabase Auth: auth.users + auth.identities (email + password)
            - App table: public.super_admins (same UUID as auth user)

   Not a CLI migration: lives under manual_migrations/ so `supabase db push` ignores it.
   Run in Dashboard → SQL Editor (or psql) after schema migration 51+ exists.

   Before running: set v_email, v_plain_password (≥8 chars), and optionally v_full_name.
   ============================================================================= */

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
DECLARE
  v_email          text := 'admin@postrack.com';
  v_plain_password text := 'Admin123';
  v_full_name      text := 'Platform Super Admin';
  v_user_id        uuid;
  v_instance_id    uuid;
  v_encrypted_pw   text;
BEGIN
  IF to_regclass('public.super_admins') IS NULL THEN
    RAISE EXCEPTION 'public.super_admins is missing; apply migration 51 (multi_tenant_foundation) first.';
  END IF;

  IF v_plain_password IS NULL OR length(v_plain_password) < 8 THEN
    RAISE EXCEPTION 'Set v_plain_password to a strong password (at least 8 characters).';
  END IF;

  IF v_email IS NULL OR position('@' IN v_email) < 2 THEN
    RAISE EXCEPTION 'Set v_email to a valid email address.';
  END IF;

  SELECT id INTO v_instance_id FROM auth.instances LIMIT 1;
  IF v_instance_id IS NULL THEN
    v_instance_id := '00000000-0000-0000-0000-000000000000'::uuid;
  END IF;

  SELECT id INTO v_user_id FROM auth.users WHERE lower(email) = lower(trim(v_email)) LIMIT 1;

  IF v_user_id IS NULL THEN
    v_user_id := gen_random_uuid();
    v_encrypted_pw := crypt(v_plain_password, gen_salt('bf'));

    /* GoTrue scans these as strings; NULL causes 500 / "Database error querying schema" on login.
       See https://github.com/supabase/auth/issues/1940 */
    INSERT INTO auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      confirmation_token,
      recovery_token,
      email_change,
      email_change_token_new,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at
    ) VALUES (
      v_instance_id,
      v_user_id,
      'authenticated',
      'authenticated',
      trim(v_email),
      v_encrypted_pw,
      now(),
      '',
      '',
      '',
      '',
      jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
      jsonb_build_object('full_name', v_full_name),
      now(),
      now()
    );

    INSERT INTO auth.identities (
      user_id,
      identity_data,
      provider,
      provider_id,
      last_sign_in_at,
      created_at,
      updated_at
    ) VALUES (
      v_user_id,
      jsonb_build_object(
        'sub', v_user_id::text,
        'email', trim(v_email),
        'email_verified', true,
        'phone_verified', false
      ),
      'email',
      v_user_id::text,
      now(),
      now(),
      now()
    );
  ELSE
    IF NOT EXISTS (
      SELECT 1
      FROM auth.identities i
      WHERE i.user_id = v_user_id
        AND i.provider = 'email'
    ) THEN
      INSERT INTO auth.identities (
        user_id,
        identity_data,
        provider,
        provider_id,
        last_sign_in_at,
        created_at,
        updated_at
      ) VALUES (
        v_user_id,
        jsonb_build_object(
          'sub', v_user_id::text,
          'email', trim(v_email),
          'email_verified', true,
          'phone_verified', false
        ),
        'email',
        v_user_id::text,
        now(),
        now(),
        now()
      );
    END IF;
  END IF;

  /* Heal rows created by older versions of this script (or any manual insert) that left token columns NULL. */
  UPDATE auth.users SET
    confirmation_token = coalesce(confirmation_token, ''),
    recovery_token = coalesce(recovery_token, ''),
    email_change = coalesce(email_change, ''),
    email_change_token_new = coalesce(email_change_token_new, '')
  WHERE id = v_user_id;

  IF NOT EXISTS (SELECT 1 FROM public.super_admins sa WHERE sa.id = v_user_id) THEN
    INSERT INTO public.super_admins (id, email, full_name, status)
    VALUES (v_user_id, trim(v_email), v_full_name, 'Active');
  END IF;

  RAISE NOTICE 'Super admin ready for % (user id %).', trim(v_email), v_user_id;
END;
$$;
