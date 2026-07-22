/* =============================================================================
   Migration 82 — User soft delete + conditional hard delete

   - Adds users.is_deleted (default false)
   - Soft delete when user has business references; hard delete otherwise
   - Updates user list view; relaxes prevent_user_delete for controlled hard delete
   ============================================================================= */

BEGIN;

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS is_deleted boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.users.is_deleted IS
  'Soft delete flag. When true, user is hidden from default lists and cannot sign in.';

CREATE INDEX IF NOT EXISTS idx_users_is_deleted
  ON public.users(is_deleted);

CREATE INDEX IF NOT EXISTS idx_users_company_not_deleted
  ON public.users(company_id)
  WHERE is_deleted = false;

/* Allow hard delete only when explicitly enabled (maintenance / delete-user flow). */
CREATE OR REPLACE FUNCTION public.prevent_user_delete()
RETURNS TRIGGER AS $$
BEGIN
  IF current_setting('app.allow_user_hard_delete', true) = 'on' THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'Hard delete not allowed. Use delete_user or set status to Inactive.';
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.user_has_business_references(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.activity_log al WHERE al.user_id = p_user_id
    UNION ALL
    SELECT 1 FROM public.bill_returns br WHERE br.created_by = p_user_id
    UNION ALL
    SELECT 1 FROM public.bills b WHERE b.created_by_user_id = p_user_id
    UNION ALL
    SELECT 1 FROM public.entries e WHERE e.created_by = p_user_id
    UNION ALL
    SELECT 1 FROM public.stock_in si WHERE si.created_by = p_user_id
    UNION ALL
    SELECT 1 FROM public.product_categories pc
      WHERE pc.created_by = p_user_id OR pc.updated_by = p_user_id
    UNION ALL
    SELECT 1 FROM public.accounting_categories ac
      WHERE ac.created_by = p_user_id OR ac.updated_by = p_user_id
    UNION ALL
    SELECT 1 FROM public.accounts a
      WHERE a.created_by = p_user_id OR a.updated_by = p_user_id
    UNION ALL
    SELECT 1 FROM public.users u
      WHERE u.created_by = p_user_id AND u.id <> p_user_id
  );
$$;

COMMENT ON FUNCTION public.user_has_business_references(uuid) IS
  'True when the user is linked to audit/billing/stock/master-data rows; hard delete must not run.';

CREATE OR REPLACE FUNCTION public.hard_delete_user_row(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.user_permissions WHERE user_id = p_user_id;
  PERFORM set_config('app.allow_user_hard_delete', 'on', true);
  DELETE FROM public.users WHERE id = p_user_id;
END;
$$;

COMMENT ON FUNCTION public.hard_delete_user_row(uuid) IS
  'Removes public.users row (and permissions). Caller must delete auth.users separately.';

CREATE OR REPLACE FUNCTION public.restore_user(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id uuid := auth.uid();
  v_caller_company uuid;
  v_target public.users%ROWTYPE;
BEGIN
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT u.company_id INTO v_caller_company
  FROM public.users u
  WHERE u.id = v_caller_id
    AND u.role = 'Admin'
    AND u.status = 'Active'
    AND NOT u.is_deleted;

  IF v_caller_company IS NULL THEN
    RAISE EXCEPTION 'Forbidden – admin only';
  END IF;

  SELECT * INTO v_target FROM public.users WHERE id = p_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  IF v_target.company_id IS DISTINCT FROM v_caller_company THEN
    RAISE EXCEPTION 'Forbidden – different company';
  END IF;

  IF NOT v_target.is_deleted THEN
    RAISE EXCEPTION 'User is not deleted';
  END IF;

  UPDATE public.users
  SET is_deleted = false,
      status = 'Active',
      updated_at = now()
  WHERE id = p_user_id;

  RETURN jsonb_build_object('user_id', p_user_id, 'action', 'restored');
END;
$$;

/* Recreate view: CREATE OR REPLACE cannot insert columns mid-definition (53 → 82). */
DROP VIEW IF EXISTS public.user_list_with_permissions_view;

CREATE VIEW public.user_list_with_permissions_view
WITH (security_invoker = true) AS
SELECT
  u.id AS id,
  u.full_name AS full_name,
  u.email AS email,
  u.phone AS phone,
  u.role AS role,
  u.status AS status,
  u.created_at AS created_at,
  u.updated_at AS updated_at,
  u.created_by AS created_by,
  COALESCE(
    jsonb_agg(up.permission::text ORDER BY up.permission),
    '[]'::jsonb
  ) AS permissions,
  u.company_id AS company_id,
  u.is_deleted AS is_deleted
FROM public.users u
LEFT JOIN public.user_permissions up
  ON up.user_id = u.id
 AND up.granted IS TRUE
GROUP BY
  u.id,
  u.full_name,
  u.email,
  u.phone,
  u.role,
  u.status,
  u.created_at,
  u.updated_at,
  u.created_by,
  u.company_id,
  u.is_deleted;

REVOKE ALL ON FUNCTION public.user_has_business_references(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.user_has_business_references(uuid) TO service_role;

REVOKE ALL ON FUNCTION public.hard_delete_user_row(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.hard_delete_user_row(uuid) TO service_role;

REVOKE ALL ON FUNCTION public.restore_user(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.restore_user(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.restore_user(uuid) TO service_role;

COMMIT;
