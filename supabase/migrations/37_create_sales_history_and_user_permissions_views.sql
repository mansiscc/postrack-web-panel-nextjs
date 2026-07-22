-- =========================================
-- Migration 37: Sales history + user permissions views
-- =========================================
-- Creates a DB view that returns all fields needed for the Sales/Bills history screen
-- in a single query (bills + customers + users).
-- This removes the need for N+1 requests for customer/user names on the client.

BEGIN;

CREATE OR REPLACE VIEW public.bill_history_sales_view
WITH (security_invoker = true) AS
SELECT
  b.id AS id,
  b.bill_number AS bill_number,

  COALESCE(c.name, 'Walk-in') AS customer_name,
  COALESCE(c.phone, '') AS customer_phone,

  COALESCE(u.full_name, '') AS created_by_name,

  b.created_at AS created_at,
  b.total_payable_amount AS total_payable_amount,
  b.payment_mode AS payment_mode,
  b.status AS status
FROM public.bills b
LEFT JOIN public.customers c
  ON c.id = b.customer_id
 AND c.is_active = true
LEFT JOIN public.users u
  ON u.id = b.created_by_user_id;

COMMIT;

-- =========================================
-- View security options
-- =========================================
-- Make sure permissions/RLS are evaluated using the querying user
-- (not the view owner), to avoid "SECURITY DEFINER" style warnings.
-- Note: we set `security_invoker` on CREATE VIEW below so tooling
-- can detect it reliably (and permissions/RLS are checked for the caller).

-- =========================================
-- Migration 37 (continued): Transactions list view
-- =========================================
-- Creates a DB view that returns transaction rows (entries) with
-- account name + accounting category name already joined.
-- This lets the client fetch the transactions list in a single request.

BEGIN;

CREATE OR REPLACE VIEW public.transactions_list_view
WITH (security_invoker = true) AS
SELECT
  e.id AS id,
  e.entry_date::text AS entry_date,
  e.entry_type AS entry_type,
  e.account_id AS account_id,
  COALESCE(a.name, '—') AS account_name,
  COALESCE(c.name, '—') AS category_name,
  e.amount AS amount,
  e.remarks AS remarks,
  e.created_at AS created_at
FROM public.entries e
LEFT JOIN public.accounts a
  ON a.id = e.account_id
  AND a.is_active = true
LEFT JOIN public.accounting_categories c
  ON c.id = e.category_id
WHERE e.is_deleted = false;

COMMIT;

-- =========================================
-- Migration 37 (continued): Stock-in list view
-- =========================================
-- Creates a DB view that returns stock-in history rows (headers)
-- with supplier name and created-by user name already joined.
-- This removes N+1 API calls for supplier/user names on the client.

BEGIN;

CREATE OR REPLACE VIEW public.stock_in_list_view
WITH (security_invoker = true) AS
SELECT
  si.id AS id,
  si.date::text AS date,
  si.invoice_number AS invoice_number,
  si.notes AS notes,
  si.total_items AS total_items,
  si.total_amount AS total_amount,

  CASE
    WHEN si.invoice_number = 'OPENING' THEN 'Opening Stock'
    ELSE COALESCE(s.supplier_name, 'Walk-in Purchase')
  END AS supplier_name,

  u.full_name AS created_by_name,

  si.created_at AS created_at
FROM public.stock_in si
LEFT JOIN public.suppliers s
  ON s.id = si.supplier_id
  AND s.is_deleted = false
LEFT JOIN public.users u
  ON u.id = si.created_by;

COMMIT;

-- =========================================
-- Migration 37 (continued): User list with permissions view
-- =========================================
-- Creates a DB view that returns:
-- - user fields needed by the UserList screen
-- - a pre-aggregated `permissions` JSON array for each user
--
-- This removes the client-side N+1 pattern:
--   getUsers() + getUserPermissions() per Staff user
-- and allows the app to fetch everything in one request.

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
  ) AS permissions
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
  u.created_by;

COMMIT;

