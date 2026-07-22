/* =============================================================================
   File: manual_create_company_and_company_admin_auth_and_user_row.sql
   Purpose: Manually provision a tenant company (public.companies) and its
            company owner/admin user in ONE run:
              - Supabase Auth: auth.users + auth.identities (email + password)
              - App table: public.users (role = 'Admin', company_id = new company)
            This mirrors what the admin panel does via edge function
            supabase/functions/provision-company-admin.

   Notes:
   - This is NOT an auto migration: keep under supabase/manual_migrations/
     so `supabase db push` ignores it.
   - Run in Supabase Dashboard → SQL Editor (or psql) as postgres/service role.
   - The `public.companies` AFTER INSERT trigger (migration 54) will automatically
     seed default accounts + accounting categories for the new company.

   Before running: set v_company_name, v_owner_email, v_plain_password, etc.
   ============================================================================= */

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
DECLARE
  /* ----------------------------
     Required inputs
  ---------------------------- */
  v_company_name    text := 'POSTrack DEMO';
  v_invoice_prefix  text := 'D';
  v_owner_email     text := 'admin@postrack.com';
  v_plain_password  text := 'Admin123'; -- must be >= 8 chars
  v_owner_phone     text := '9999999999';

  /* ----------------------------
     Optional company metadata
  ---------------------------- */
  v_owner_name       text := 'POSTrack';
  v_business_category text := 'Clothing'; -- ex: 'Grocery', 'Pharmacy', etc.
  v_company_is_active boolean := true;

  /* ----------------------------
     Generated ids
  ---------------------------- */
  v_company_id   uuid;
  v_user_id      uuid;
  v_instance_id  uuid;
  v_encrypted_pw text;

  /* ----------------------------
     Demo seed: clothing catalog
  ---------------------------- */
  v_cat_tshirts    uuid;
  v_cat_shirts     uuid;
  v_cat_jeans      uuid;
  v_cat_trousers   uuid;
  v_cat_kurta      uuid;
  v_cat_saree      uuid;
  v_cat_innerwear  uuid;
  v_cat_footwear   uuid;

  /* ----------------------------
     Demo seed: common ids for inserts
  ---------------------------- */
  v_customer_1 uuid;
  v_customer_2 uuid;
  v_customer_3 uuid;

  v_supplier_1 uuid;
  v_supplier_2 uuid;
  v_supplier_3 uuid;

  v_cash_account_id uuid;
  v_bank_account_id uuid;

  v_sales_cat_id uuid;
  v_purchase_cat_id uuid;
  v_sales_return_cat_id uuid;

  v_purchase_1 uuid;
  v_purchase_2 uuid;
  v_purchase_3 uuid;

  v_bill_1 uuid;
  v_bill_2 uuid;
  v_bill_3 uuid;
BEGIN
  /* ----------------------------
     Basic sanity checks
  ---------------------------- */
  IF to_regclass('public.companies') IS NULL THEN
    RAISE EXCEPTION 'public.companies is missing; apply schema migrations first.';
  END IF;
  IF to_regclass('public.users') IS NULL THEN
    RAISE EXCEPTION 'public.users is missing; apply schema migrations first.';
  END IF;

  IF v_plain_password IS NULL OR length(v_plain_password) < 8 THEN
    RAISE EXCEPTION 'Set v_plain_password to a strong password (at least 8 characters).';
  END IF;

  v_company_name := trim(coalesce(v_company_name, ''));
  v_owner_email := lower(trim(coalesce(v_owner_email, '')));
  v_invoice_prefix := upper(regexp_replace(trim(coalesce(v_invoice_prefix, 'B')), '[^A-Z0-9]', '', 'g'));

  IF v_company_name = '' THEN
    RAISE EXCEPTION 'Set v_company_name.';
  END IF;
  IF v_owner_email = '' OR position('@' IN v_owner_email) < 2 THEN
    RAISE EXCEPTION 'Set v_owner_email to a valid email address.';
  END IF;
  IF v_invoice_prefix = '' THEN
    v_invoice_prefix := 'B';
  END IF;

  v_owner_phone := NULLIF(trim(coalesce(v_owner_phone, '')), '');

  /* ----------------------------
     Create / find Auth user id
  ---------------------------- */
  SELECT id INTO v_instance_id FROM auth.instances LIMIT 1;
  IF v_instance_id IS NULL THEN
    v_instance_id := '00000000-0000-0000-0000-000000000000'::uuid;
  END IF;

  SELECT id INTO v_user_id
  FROM auth.users
  WHERE lower(email) = v_owner_email
  LIMIT 1;

  IF v_user_id IS NULL THEN
    v_user_id := gen_random_uuid();
    v_encrypted_pw := crypt(v_plain_password, gen_salt('bf'));

    /* GoTrue scans these as strings; NULL can cause auth issues. */
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
    )
    VALUES (
      v_instance_id,
      v_user_id,
      'authenticated',
      'authenticated',
      v_owner_email,
      v_encrypted_pw,
      now(),
      '',
      '',
      '',
      '',
      jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
      jsonb_build_object('full_name', v_owner_name),
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
    )
    VALUES (
      v_user_id,
      jsonb_build_object(
        'sub', v_user_id::text,
        'email', v_owner_email,
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
    /* Ensure an email identity exists (idempotent). */
    IF NOT EXISTS (
      SELECT 1 FROM auth.identities i
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
      )
      VALUES (
        v_user_id,
        jsonb_build_object(
          'sub', v_user_id::text,
          'email', v_owner_email,
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

  /* Heal rows created by manual inserts that left token columns NULL. */
  UPDATE auth.users SET
    confirmation_token = coalesce(confirmation_token, ''),
    recovery_token = coalesce(recovery_token, ''),
    email_change = coalesce(email_change, ''),
    email_change_token_new = coalesce(email_change_token_new, '')
  WHERE id = v_user_id;

  /* ----------------------------
     Create company row
  ---------------------------- */
  v_company_id := gen_random_uuid();

  /* Ensure show_logo_on_bill exists on companies (was added on business_profile in migration 45). */
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'companies'
      AND column_name = 'show_logo_on_bill'
  ) THEN
    ALTER TABLE public.companies
      ADD COLUMN IF NOT EXISTS show_logo_on_bill boolean NOT NULL DEFAULT true;
  END IF;

  INSERT INTO public.companies (
    id,
    business_name,
    invoice_prefix,
    owner_email,
    owner_name,
    business_category,
    is_active,
    is_deleted,
    show_logo_on_bill
  )
  VALUES (
    v_company_id,
    v_company_name,
    v_invoice_prefix,
    v_owner_email,
    NULLIF(trim(coalesce(v_owner_name, '')), ''),
    NULLIF(trim(coalesce(v_business_category, '')), ''),
    coalesce(v_company_is_active, true),
    false,
    false  -- disable logo on printed bill for this demo company
  );

  /* ----------------------------
     Create/ensure tenant admin row in public.users
     Mirrors provision-company-admin: role='Admin', status='Active'
  ---------------------------- */
  IF NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = v_user_id) THEN
    INSERT INTO public.users (
      id,
      company_id,
      full_name,
      email,
      phone,
      role,
      status,
      created_by
    )
    VALUES (
      v_user_id,
      v_company_id,
      COALESCE(NULLIF(trim(coalesce(v_owner_name, '')), ''), v_company_name),
      v_owner_email,
      v_owner_phone,
      'Admin',
      'Active',
      NULL
    );
  ELSE
    /* If user row exists already, do not silently move them between companies. */
    IF EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = v_user_id
        AND u.company_id IS DISTINCT FROM v_company_id
    ) THEN
      RAISE EXCEPTION 'public.users row already exists for % (id %) with different company_id. Not changing it.', v_owner_email, v_user_id;
    END IF;
  END IF;

  /* If the accounting bootstrap trigger is missing, run it manually (best-effort). */
  IF to_regprocedure('public.bootstrap_company_accounting_defaults(uuid)') IS NOT NULL THEN
    PERFORM public.bootstrap_company_accounting_defaults(v_company_id);
  END IF;

  /* ----------------------------
     Seed demo product categories + products (Clothing store)
     - Creates a small catalog for demo/testing after provisioning.
     - Safe to re-run: uses ON CONFLICT / WHERE NOT EXISTS checks.
  ---------------------------- */
  IF to_regclass('public.product_categories') IS NOT NULL THEN
    INSERT INTO public.product_categories (company_id, name, description, is_active, created_by, updated_by)
    VALUES
      (v_company_id, 'T-Shirts',   'Casual and printed tees', true, v_user_id, v_user_id),
      (v_company_id, 'Shirts',     'Formal and casual shirts', true, v_user_id, v_user_id),
      (v_company_id, 'Jeans',      'Denim jeans', true, v_user_id, v_user_id),
      (v_company_id, 'Trousers',   'Formal trousers and chinos', true, v_user_id, v_user_id),
      (v_company_id, 'Kurta',      'Traditional kurtas', true, v_user_id, v_user_id),
      (v_company_id, 'Saree',      'Sarees and ethnic wear', true, v_user_id, v_user_id),
      (v_company_id, 'Innerwear',  'Vests, briefs, lingerie', true, v_user_id, v_user_id),
      (v_company_id, 'Footwear',   'Slippers, sandals, shoes', true, v_user_id, v_user_id)
    ON CONFLICT (company_id, name) DO NOTHING;

    SELECT id INTO v_cat_tshirts   FROM public.product_categories WHERE company_id = v_company_id AND name = 'T-Shirts'   LIMIT 1;
    SELECT id INTO v_cat_shirts    FROM public.product_categories WHERE company_id = v_company_id AND name = 'Shirts'     LIMIT 1;
    SELECT id INTO v_cat_jeans     FROM public.product_categories WHERE company_id = v_company_id AND name = 'Jeans'      LIMIT 1;
    SELECT id INTO v_cat_trousers  FROM public.product_categories WHERE company_id = v_company_id AND name = 'Trousers'   LIMIT 1;
    SELECT id INTO v_cat_kurta     FROM public.product_categories WHERE company_id = v_company_id AND name = 'Kurta'      LIMIT 1;
    SELECT id INTO v_cat_saree     FROM public.product_categories WHERE company_id = v_company_id AND name = 'Saree'      LIMIT 1;
    SELECT id INTO v_cat_innerwear FROM public.product_categories WHERE company_id = v_company_id AND name = 'Innerwear'  LIMIT 1;
    SELECT id INTO v_cat_footwear  FROM public.product_categories WHERE company_id = v_company_id AND name = 'Footwear'   LIMIT 1;
  ELSE
    RAISE NOTICE 'Skipping clothing demo seed: public.product_categories not found.';
  END IF;

  IF to_regclass('public.products') IS NOT NULL THEN
    /* Insert a demo catalog. We avoid barcodes to not hit uniqueness constraints. */
    INSERT INTO public.products (
      id,
      company_id,
      name,
      purchase_price,
      selling_price,
      mrp,
      unit,
      low_stock_alert_qty,
      is_active,
      product_category_id,
      stock_quantity
    )
    SELECT
      gen_random_uuid(),
      v_company_id,
      p.name,
      p.purchase_price,
      p.selling_price,
      p.mrp,
      p.unit,
      p.low_stock_alert_qty,
      true,
      p.product_category_id,
      p.stock_quantity
    FROM (
      VALUES
        ('T-Shirt - Round Neck (M)',      220::numeric, 299::numeric, 399::numeric, 'pcs', 5::numeric, v_cat_tshirts,   20::numeric),
        ('T-Shirt - Polo (L)',            280::numeric, 399::numeric, 499::numeric, 'pcs', 5::numeric, v_cat_tshirts,   15::numeric),
        ('Shirt - Formal White (40)',     520::numeric, 699::numeric, 899::numeric, 'pcs', 3::numeric, v_cat_shirts,    10::numeric),
        ('Shirt - Denim Blue (42)',       650::numeric, 899::numeric, 1099::numeric,'pcs', 3::numeric, v_cat_shirts,     8::numeric),
        ('Jeans - Slim Fit (32)',         900::numeric, 1299::numeric, 1599::numeric,'pcs', 3::numeric, v_cat_jeans,      9::numeric),
        ('Jeans - Regular Fit (34)',      880::numeric, 1199::numeric, 1499::numeric,'pcs', 3::numeric, v_cat_jeans,      7::numeric),
        ('Trouser - Chino (32)',          820::numeric, 1099::numeric, 1399::numeric,'pcs', 3::numeric, v_cat_trousers,   6::numeric),
        ('Kurta - Cotton (L)',            650::numeric, 899::numeric, 1199::numeric,'pcs', 2::numeric, v_cat_kurta,      5::numeric),
        ('Saree - Silk',                  1500::numeric, 1999::numeric, 2499::numeric,'pcs', 1::numeric, v_cat_saree,      3::numeric),
        ('Innerwear - Vest (M)',          120::numeric, 179::numeric, 199::numeric, 'pcs', 10::numeric, v_cat_innerwear, 30::numeric),
        ('Footwear - Slippers (8)',       180::numeric, 249::numeric, 299::numeric, 'pair', 5::numeric, v_cat_footwear,  12::numeric)
    ) AS p(name, purchase_price, selling_price, mrp, unit, low_stock_alert_qty, product_category_id, stock_quantity)
    WHERE p.product_category_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1
        FROM public.products pr
        WHERE pr.company_id = v_company_id
          AND pr.name = p.name
      );
  ELSE
    RAISE NOTICE 'Skipping clothing demo seed: public.products not found.';
  END IF;

  /* ----------------------------
     Seed demo customers (3)
  ---------------------------- */
  IF to_regclass('public.customers') IS NOT NULL THEN
    INSERT INTO public.customers (id, company_id, name, phone, email, address, is_active)
    VALUES
      (gen_random_uuid(), v_company_id, 'Aarav Sharma',  '9000000001', 'aarav@example.com',  'Mumbai', true),
      (gen_random_uuid(), v_company_id, 'Diya Patel',    '9000000002', 'diya@example.com',   'Ahmedabad', true),
      (gen_random_uuid(), v_company_id, 'Kabir Singh',   '9000000003', 'kabir@example.com',  'Delhi', true)
    ON CONFLICT DO NOTHING;

    SELECT id INTO v_customer_1 FROM public.customers WHERE company_id = v_company_id AND phone = '9000000001' LIMIT 1;
    SELECT id INTO v_customer_2 FROM public.customers WHERE company_id = v_company_id AND phone = '9000000002' LIMIT 1;
    SELECT id INTO v_customer_3 FROM public.customers WHERE company_id = v_company_id AND phone = '9000000003' LIMIT 1;
  ELSE
    RAISE NOTICE 'Skipping customers seed: public.customers not found.';
  END IF;

  /* ----------------------------
     Seed demo suppliers (3)
  ---------------------------- */
  IF to_regclass('public.suppliers') IS NOT NULL THEN
    INSERT INTO public.suppliers (id, company_id, supplier_name, contact_person, phone, email, address, gst_number, opening_balance, is_deleted)
    VALUES
      (gen_random_uuid(), v_company_id, 'Alpha Garments', 'Rohit', '9100000001', 'alpha@example.com', 'Surat',  '24ABCDE1234F1Z5', 0, false),
      (gen_random_uuid(), v_company_id, 'Denim House',    'Meera', '9100000002', 'denim@example.com', 'Tirupur','33ABCDE1234F1Z5', 0, false),
      (gen_random_uuid(), v_company_id, 'Footwear Hub',   'Sahil', '9100000003', 'footwear@example.com', 'Agra','09ABCDE1234F1Z5', 0, false)
    ON CONFLICT DO NOTHING;

    SELECT id INTO v_supplier_1 FROM public.suppliers WHERE company_id = v_company_id AND supplier_name = 'Alpha Garments' LIMIT 1;
    SELECT id INTO v_supplier_2 FROM public.suppliers WHERE company_id = v_company_id AND supplier_name = 'Denim House' LIMIT 1;
    SELECT id INTO v_supplier_3 FROM public.suppliers WHERE company_id = v_company_id AND supplier_name = 'Footwear Hub' LIMIT 1;
  ELSE
    RAISE NOTICE 'Skipping suppliers seed: public.suppliers not found.';
  END IF;

  /* ----------------------------
     Resolve demo accounts + accounting categories
  ---------------------------- */
  IF to_regclass('public.accounts') IS NOT NULL THEN
    SELECT a.id INTO v_cash_account_id
    FROM public.accounts a
    WHERE a.company_id = v_company_id AND a.name = 'Cash in Hand' AND a.is_active = true
    LIMIT 1;

    SELECT a.id INTO v_bank_account_id
    FROM public.accounts a
    WHERE a.company_id = v_company_id AND a.name = 'Bank Account' AND a.is_active = true
    LIMIT 1;
  END IF;

  IF to_regclass('public.accounting_categories') IS NOT NULL THEN
    SELECT ac.id INTO v_sales_cat_id
    FROM public.accounting_categories ac
    WHERE ac.company_id = v_company_id AND ac.name = 'Sales' AND ac.type = 'income'
    LIMIT 1;

    SELECT ac.id INTO v_purchase_cat_id
    FROM public.accounting_categories ac
    WHERE ac.company_id = v_company_id AND ac.name = 'Purchase' AND ac.type = 'expense'
    LIMIT 1;

    SELECT ac.id INTO v_sales_return_cat_id
    FROM public.accounting_categories ac
    WHERE ac.company_id = v_company_id AND ac.name = 'Sales Return' AND ac.type = 'expense'
    LIMIT 1;
  END IF;

  /* ----------------------------
     Seed demo purchases (stock_in + items) (3)
     Also updates products.stock_quantity and inserts stock_transactions PURCHASE.
  ---------------------------- */
  IF to_regclass('public.stock_in') IS NOT NULL AND to_regclass('public.stock_in_items') IS NOT NULL THEN
    v_purchase_1 := gen_random_uuid();
    v_purchase_2 := gen_random_uuid();
    v_purchase_3 := gen_random_uuid();

    INSERT INTO public.stock_in (id, company_id, date, supplier_id, invoice_number, notes, total_items, total_amount, created_by, account_id)
    VALUES
      (v_purchase_1, v_company_id, CURRENT_DATE - 7, v_supplier_1, 'PUR-0001', 'Demo purchase 1', 2, 2200, v_user_id, v_cash_account_id),
      (v_purchase_2, v_company_id, CURRENT_DATE - 5, v_supplier_2, 'PUR-0002', 'Demo purchase 2', 2, 3000, v_user_id, v_cash_account_id),
      (v_purchase_3, v_company_id, CURRENT_DATE - 3, v_supplier_3, 'PUR-0003', 'Demo purchase 3', 1, 900,  v_user_id, v_cash_account_id)
    ON CONFLICT (id) DO NOTHING;

    /* Purchase 1 items */
    INSERT INTO public.stock_in_items (
      stock_in_id, company_id, product_id, manufacturing_date,
      purchase_price, selling_price, mrp, quantity, row_total
    )
    SELECT v_purchase_1, v_company_id, p.id, NULL, p.purchase_price, p.selling_price, p.mrp, x.qty, (p.purchase_price * x.qty)
    FROM (
      VALUES
        ('T-Shirt - Round Neck (M)', 5::numeric),
        ('Innerwear - Vest (M)', 10::numeric)
    ) AS x(name, qty)
    JOIN public.products p
      ON p.company_id = v_company_id AND p.name = x.name
    ON CONFLICT DO NOTHING;

    /* Purchase 2 items */
    INSERT INTO public.stock_in_items (
      stock_in_id, company_id, product_id, manufacturing_date,
      purchase_price, selling_price, mrp, quantity, row_total
    )
    SELECT v_purchase_2, v_company_id, p.id, NULL, p.purchase_price, p.selling_price, p.mrp, x.qty, (p.purchase_price * x.qty)
    FROM (
      VALUES
        ('Jeans - Slim Fit (32)', 2::numeric),
        ('Shirt - Formal White (40)', 2::numeric)
    ) AS x(name, qty)
    JOIN public.products p
      ON p.company_id = v_company_id AND p.name = x.name
    ON CONFLICT DO NOTHING;

    /* Purchase 3 items */
    INSERT INTO public.stock_in_items (
      stock_in_id, company_id, product_id, manufacturing_date,
      purchase_price, selling_price, mrp, quantity, row_total
    )
    SELECT v_purchase_3, v_company_id, p.id, NULL, p.purchase_price, p.selling_price, p.mrp, x.qty, (p.purchase_price * x.qty)
    FROM (
      VALUES
        ('Footwear - Slippers (8)', 5::numeric)
    ) AS x(name, qty)
    JOIN public.products p
      ON p.company_id = v_company_id AND p.name = x.name
    ON CONFLICT DO NOTHING;

    /* Apply stock increase */
    UPDATE public.products pr
    SET stock_quantity = pr.stock_quantity + addq.qty
    FROM (
      SELECT si.product_id, sum(si.quantity)::numeric AS qty
      FROM public.stock_in_items si
      WHERE si.company_id = v_company_id
        AND si.stock_in_id IN (v_purchase_1, v_purchase_2, v_purchase_3)
      GROUP BY si.product_id
    ) addq
    WHERE pr.id = addq.product_id AND pr.company_id = v_company_id;

    /* Stock transactions (PURCHASE) */
    IF to_regclass('public.stock_transactions') IS NOT NULL THEN
      INSERT INTO public.stock_transactions (company_id, product_id, transaction_type, quantity, reference_type, reference_id, notes)
      SELECT
        v_company_id,
        si.product_id,
        'PURCHASE',
        si.quantity,
        'STOCK_IN',
        si.stock_in_id,
        'Demo purchase'
      FROM public.stock_in_items si
      WHERE si.company_id = v_company_id
        AND si.stock_in_id IN (v_purchase_1, v_purchase_2, v_purchase_3);
    END IF;

    /* Accounting entries for purchases (manual/linked to purchase) */
    IF to_regclass('public.entries') IS NOT NULL AND v_cash_account_id IS NOT NULL AND v_purchase_cat_id IS NOT NULL THEN
      INSERT INTO public.entries (company_id, entry_type, account_id, category_id, amount, entry_date, remarks, source_type, source_id, is_deleted, created_by, payment_mode)
      VALUES
        (v_company_id, 'expense', v_cash_account_id, v_purchase_cat_id, 2200, CURRENT_DATE - 7, 'Demo purchase PUR-0001', 'purchase', v_purchase_1, false, v_user_id, 'Cash'),
        (v_company_id, 'expense', v_cash_account_id, v_purchase_cat_id, 3000, CURRENT_DATE - 5, 'Demo purchase PUR-0002', 'purchase', v_purchase_2, false, v_user_id, 'Cash'),
        (v_company_id, 'expense', v_cash_account_id, v_purchase_cat_id, 900,  CURRENT_DATE - 3, 'Demo purchase PUR-0003', 'purchase', v_purchase_3, false, v_user_id, 'Cash')
      ON CONFLICT DO NOTHING;
    END IF;
  ELSE
    RAISE NOTICE 'Skipping purchases seed: stock_in tables not found.';
  END IF;

  /* ----------------------------
     Seed demo sales (bills + bill_items) (3)
     bill_items INSERT triggers may reduce stock; initial stock seeded above should be enough.
  ---------------------------- */
  IF to_regclass('public.bills') IS NOT NULL AND to_regclass('public.bill_items') IS NOT NULL THEN
    v_bill_1 := gen_random_uuid();
    v_bill_2 := gen_random_uuid();
    v_bill_3 := gen_random_uuid();

    INSERT INTO public.bills (
      id, company_id, bill_number, customer_id, subtotal_amount, other_items_amount,
      discount_type, discount_value, discount_amount,
      total_payable_amount, payment_mode, cash_amount, online_amount,
      received_amount_total, status, created_by_user_id, created_at
    )
    VALUES
      (v_bill_1, v_company_id, 'D-DEMO-' || replace(left(v_bill_1::text, 8), '-', ''), v_customer_1, 0, 0, NULL, NULL, 0, 0, 'Cash', 0, 0, 0, 'PAID', v_user_id, now() - interval '2 days'),
      (v_bill_2, v_company_id, 'D-DEMO-' || replace(left(v_bill_2::text, 8), '-', ''), v_customer_2, 0, 0, NULL, NULL, 0, 0, 'UPI', 0, 0, 0, 'PAID', v_user_id, now() - interval '1 days'),
      (v_bill_3, v_company_id, 'D-DEMO-' || replace(left(v_bill_3::text, 8), '-', ''), v_customer_3, 0, 0, NULL, NULL, 0, 0, 'Mixed', 0, 0, 0, 'PAID', v_user_id, now())
    ON CONFLICT (id) DO NOTHING;

    /* Bill 1 items */
    INSERT INTO public.bill_items (bill_id, company_id, product_id, product_name, barcode, unit_price, quantity, row_total)
    SELECT v_bill_1, v_company_id, p.id, p.name, p.barcode, p.selling_price, x.qty, (p.selling_price * x.qty)
    FROM (VALUES
      ('T-Shirt - Round Neck (M)', 1::numeric),
      ('Innerwear - Vest (M)', 2::numeric)
    ) AS x(name, qty)
    JOIN public.products p ON p.company_id = v_company_id AND p.name = x.name;

    /* Bill 2 items */
    INSERT INTO public.bill_items (bill_id, company_id, product_id, product_name, barcode, unit_price, quantity, row_total)
    SELECT v_bill_2, v_company_id, p.id, p.name, p.barcode, p.selling_price, x.qty, (p.selling_price * x.qty)
    FROM (VALUES
      ('Jeans - Slim Fit (32)', 1::numeric),
      ('Shirt - Formal White (40)', 1::numeric)
    ) AS x(name, qty)
    JOIN public.products p ON p.company_id = v_company_id AND p.name = x.name;

    /* Bill 3 items */
    INSERT INTO public.bill_items (bill_id, company_id, product_id, product_name, barcode, unit_price, quantity, row_total)
    SELECT v_bill_3, v_company_id, p.id, p.name, p.barcode, p.selling_price, x.qty, (p.selling_price * x.qty)
    FROM (VALUES
      ('Footwear - Slippers (8)', 1::numeric),
      ('T-Shirt - Polo (L)', 1::numeric)
    ) AS x(name, qty)
    JOIN public.products p ON p.company_id = v_company_id AND p.name = x.name;

    /* Update bill totals from items */
    UPDATE public.bills b
    SET
      subtotal_amount = s.subtotal,
      total_payable_amount = s.subtotal,
      discount_amount = 0,
      cash_amount = CASE b.payment_mode WHEN 'Cash' THEN s.subtotal WHEN 'Mixed' THEN round(s.subtotal/2,2) ELSE 0 END,
      online_amount = CASE b.payment_mode WHEN 'UPI' THEN s.subtotal WHEN 'Mixed' THEN s.subtotal - round(s.subtotal/2,2) ELSE 0 END,
      received_amount_total = s.subtotal
    FROM (
      SELECT bill_id, sum(row_total)::numeric(18,2) AS subtotal
      FROM public.bill_items
      WHERE company_id = v_company_id
        AND bill_id IN (v_bill_1, v_bill_2, v_bill_3)
      GROUP BY bill_id
    ) s
    WHERE b.id = s.bill_id;

    /* Accounting entries for sales */
    IF to_regclass('public.entries') IS NOT NULL AND v_cash_account_id IS NOT NULL AND v_sales_cat_id IS NOT NULL THEN
      INSERT INTO public.entries (company_id, entry_type, account_id, category_id, amount, entry_date, remarks, source_type, source_id, is_deleted, created_by, payment_mode)
      SELECT
        v_company_id,
        'income',
        v_cash_account_id,
        v_sales_cat_id,
        b.total_payable_amount,
        b.created_at::date,
        'Demo sale ' || coalesce(b.bill_number, b.id::text),
        'bill',
        b.id,
        false,
        v_user_id,
        b.payment_mode
      FROM public.bills b
      WHERE b.company_id = v_company_id
        AND b.id IN (v_bill_1, v_bill_2, v_bill_3)
      ON CONFLICT DO NOTHING;
    END IF;
  ELSE
    RAISE NOTICE 'Skipping sales seed: bills tables not found.';
  END IF;

  /* ----------------------------
     Manual income/expense entries (3 each)
  ---------------------------- */
  IF to_regclass('public.entries') IS NOT NULL AND v_cash_account_id IS NOT NULL THEN
    /* Ensure two demo categories exist (manual) */
    IF to_regclass('public.accounting_categories') IS NOT NULL THEN
      INSERT INTO public.accounting_categories (company_id, name, type, description, is_active)
      VALUES
        (v_company_id, 'Manual Income', 'income', 'Demo manual income category', true),
        (v_company_id, 'Manual Expense', 'expense', 'Demo manual expense category', true)
      ON CONFLICT (company_id, name, type) DO NOTHING;
    END IF;

    INSERT INTO public.entries (company_id, entry_type, account_id, category_id, amount, entry_date, remarks, source_type, source_id, is_deleted, created_by, payment_mode)
    VALUES
      (v_company_id, 'income',  v_cash_account_id,
        (SELECT id FROM public.accounting_categories WHERE company_id = v_company_id AND name = 'Manual Income' AND type = 'income' LIMIT 1),
        500, CURRENT_DATE - 4, 'Demo manual income: other', 'manual', NULL, false, v_user_id, 'Cash'),
      (v_company_id, 'income',  v_cash_account_id,
        (SELECT id FROM public.accounting_categories WHERE company_id = v_company_id AND name = 'Manual Income' AND type = 'income' LIMIT 1),
        1200, CURRENT_DATE - 2, 'Demo manual income: tailoring', 'manual', NULL, false, v_user_id, 'Cash'),
      (v_company_id, 'income',  v_cash_account_id,
        (SELECT id FROM public.accounting_categories WHERE company_id = v_company_id AND name = 'Manual Income' AND type = 'income' LIMIT 1),
        800, CURRENT_DATE, 'Demo manual income: commission', 'manual', NULL, false, v_user_id, 'Cash'),

      (v_company_id, 'expense', v_cash_account_id,
        (SELECT id FROM public.accounting_categories WHERE company_id = v_company_id AND name = 'Manual Expense' AND type = 'expense' LIMIT 1),
        300, CURRENT_DATE - 6, 'Demo manual expense: chai/water', 'manual', NULL, false, v_user_id, 'Cash'),
      (v_company_id, 'expense', v_cash_account_id,
        (SELECT id FROM public.accounting_categories WHERE company_id = v_company_id AND name = 'Manual Expense' AND type = 'expense' LIMIT 1),
        1500, CURRENT_DATE - 3, 'Demo manual expense: electricity', 'manual', NULL, false, v_user_id, 'Cash'),
      (v_company_id, 'expense', v_cash_account_id,
        (SELECT id FROM public.accounting_categories WHERE company_id = v_company_id AND name = 'Manual Expense' AND type = 'expense' LIMIT 1),
        700, CURRENT_DATE - 1, 'Demo manual expense: packaging', 'manual', NULL, false, v_user_id, 'Cash')
    ON CONFLICT DO NOTHING;
  END IF;

  RAISE NOTICE 'Company created: % (company_id=%).', v_company_name, v_company_id;
  RAISE NOTICE 'Company admin ready: % (auth/user id=%).', v_owner_email, v_user_id;
END;
$$;

