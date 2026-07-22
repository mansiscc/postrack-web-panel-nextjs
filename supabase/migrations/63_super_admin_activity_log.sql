/* =============================================================================
   Migration 63 — Super Admin Activity Log (platform audit)

   Why:
   - public.activity_log already exists but is POS tenant-scoped (public.users).
   - Super admins live in public.super_admins and need their own centralized log.

   Notes:
   - Logs are generated at backend level via DB triggers for success events.
   - For edge-function actions, functions can call the insert helper too.
   ============================================================================= */

BEGIN;

CREATE TABLE IF NOT EXISTS public.super_admin_activity_log (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES public.super_admins(id) ON DELETE RESTRICT,
  user_name   text NOT NULL,
  action_type text NOT NULL CHECK (action_type IN ('Create', 'Update', 'Delete', 'Login', 'Logout')),
  module_name text NOT NULL,
  record_id   text,
  description text NOT NULL,
  status      text NOT NULL CHECK (status IN ('Success', 'Failed')),
  ip_address  text,
  old_values  jsonb,
  new_values  jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.super_admin_activity_log IS
  'Platform (super admin) audit trail: who, action, module, record, outcome; append-only by design.';

CREATE INDEX IF NOT EXISTS idx_sa_activity_created_at
  ON public.super_admin_activity_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sa_activity_user
  ON public.super_admin_activity_log(user_id);
CREATE INDEX IF NOT EXISTS idx_sa_activity_action
  ON public.super_admin_activity_log(action_type);
CREATE INDEX IF NOT EXISTS idx_sa_activity_module
  ON public.super_admin_activity_log(module_name);
CREATE INDEX IF NOT EXISTS idx_sa_activity_status
  ON public.super_admin_activity_log(status);

ALTER TABLE public.super_admin_activity_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS sa_activity_service_role_all ON public.super_admin_activity_log;
CREATE POLICY sa_activity_service_role_all
  ON public.super_admin_activity_log
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS sa_activity_select_super_admin ON public.super_admin_activity_log;
CREATE POLICY sa_activity_select_super_admin
  ON public.super_admin_activity_log
  FOR SELECT
  TO authenticated
  USING (public.is_super_admin());

/* -----------------------------------------------------------------------------
   Helper insert function (SECURITY DEFINER) — used by triggers & edge functions.
   Must not break primary operations: on any error, swallow + warn.
----------------------------------------------------------------------------- */

CREATE OR REPLACE FUNCTION public.log_super_admin_activity(
  p_user_id uuid,
  p_action_type text,
  p_module_name text,
  p_record_id text,
  p_description text,
  p_status text,
  p_ip_address text DEFAULT NULL,
  p_old_values jsonb DEFAULT NULL,
  p_new_values jsonb DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name text;
BEGIN
  SELECT COALESCE(NULLIF(trim(sa.full_name), ''), sa.email)
    INTO v_name
    FROM public.super_admins sa
   WHERE sa.id = p_user_id
   LIMIT 1;

  INSERT INTO public.super_admin_activity_log (
    user_id,
    user_name,
    action_type,
    module_name,
    record_id,
    description,
    status,
    ip_address,
    old_values,
    new_values
  )
  VALUES (
    p_user_id,
    COALESCE(v_name, 'Super Admin'),
    p_action_type,
    p_module_name,
    p_record_id,
    p_description,
    p_status,
    p_ip_address,
    p_old_values,
    p_new_values
  );
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '[log_super_admin_activity] failed: %', SQLERRM;
END;
$$;

REVOKE ALL ON FUNCTION public.log_super_admin_activity(uuid, text, text, text, text, text, text, jsonb, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_super_admin_activity(uuid, text, text, text, text, text, text, jsonb, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.log_super_admin_activity(uuid, text, text, text, text, text, text, jsonb, jsonb) TO authenticated;

/* -----------------------------------------------------------------------------
   Generic trigger to log successful Create/Update/Delete by super admins.
----------------------------------------------------------------------------- */

CREATE OR REPLACE FUNCTION public.trg_log_super_admin_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_action text;
  v_module text := COALESCE(TG_ARGV[0], TG_TABLE_NAME);
  v_record_id text;
  v_desc text;
  v_old jsonb;
  v_new jsonb;
BEGIN
  IF NOT public.is_super_admin() THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  v_action :=
    CASE TG_OP
      WHEN 'INSERT' THEN 'Create'
      WHEN 'UPDATE' THEN 'Update'
      WHEN 'DELETE' THEN 'Delete'
      ELSE 'Update'
    END;

  v_record_id := COALESCE((NEW).id::text, (OLD).id::text, NULL);
  v_old := CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) ELSE NULL END;
  v_new := CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) ELSE NULL END;

  v_desc := format('%s %s', v_action, v_module);

  PERFORM public.log_super_admin_activity(
    auth.uid(),
    v_action,
    v_module,
    v_record_id,
    v_desc,
    'Success',
    NULL,
    v_old,
    v_new
  );

  RETURN COALESCE(NEW, OLD);
EXCEPTION WHEN OTHERS THEN
  -- Never block primary operation
  RAISE WARNING '[trg_log_super_admin_activity] failed: %', SQLERRM;
  RETURN COALESCE(NEW, OLD);
END;
$$;

REVOKE ALL ON FUNCTION public.trg_log_super_admin_activity() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.trg_log_super_admin_activity() TO service_role;
GRANT EXECUTE ON FUNCTION public.trg_log_super_admin_activity() TO authenticated;

/* Attach triggers to super-admin-managed modules */
DROP TRIGGER IF EXISTS trg_sa_log_leads ON public.leads;
CREATE TRIGGER trg_sa_log_leads
  AFTER INSERT OR UPDATE OR DELETE ON public.leads
  FOR EACH ROW
  EXECUTE PROCEDURE public.trg_log_super_admin_activity('Leads');

DROP TRIGGER IF EXISTS trg_sa_log_companies ON public.companies;
CREATE TRIGGER trg_sa_log_companies
  AFTER INSERT OR UPDATE OR DELETE ON public.companies
  FOR EACH ROW
  EXECUTE PROCEDURE public.trg_log_super_admin_activity('Companies');

DROP TRIGGER IF EXISTS trg_sa_log_users ON public.users;
CREATE TRIGGER trg_sa_log_users
  AFTER INSERT OR UPDATE OR DELETE ON public.users
  FOR EACH ROW
  EXECUTE PROCEDURE public.trg_log_super_admin_activity('Users');

/* -----------------------------------------------------------------------------
   Delete logs by date range (with self-logging)
----------------------------------------------------------------------------- */

CREATE OR REPLACE FUNCTION public.delete_super_admin_activity_logs(
  p_from timestamptz,
  p_to timestamptz
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count bigint;
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  IF p_from IS NULL OR p_to IS NULL THEN
    RAISE EXCEPTION 'From/To date range is required';
  END IF;
  IF p_to < p_from THEN
    RAISE EXCEPTION 'Invalid date range';
  END IF;

  PERFORM public.log_super_admin_activity(
    auth.uid(),
    'Delete',
    'Activity Logs',
    NULL,
    format('Deleted activity logs from %s to %s', p_from, p_to),
    'Success',
    NULL,
    NULL,
    NULL
  );

  DELETE FROM public.super_admin_activity_log
   WHERE created_at >= p_from
     AND created_at <= p_to;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_super_admin_activity_logs(timestamptz, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_super_admin_activity_logs(timestamptz, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_super_admin_activity_logs(timestamptz, timestamptz) TO service_role;

COMMIT;

