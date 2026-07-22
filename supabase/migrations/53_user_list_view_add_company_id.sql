/* Expose company_id on user list view for multi-tenant clients. */

BEGIN;

CREATE OR REPLACE VIEW public.user_list_with_permissions_view
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
  u.company_id AS company_id
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
  u.company_id;

COMMIT;
