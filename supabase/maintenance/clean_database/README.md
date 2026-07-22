## Supabase database cleanup scripts

These scripts help you **clean data** without breaking core POS functionality.

### What is “required” for app functionality?

From your migrations, the app depends on these *master / required* tables and seeded rows:

- **`public.users`**: app users (tied to `auth.users`)
- **`public.user_permissions`**: per-user staff permissions (stock in/out)
- **`public.product_categories`**: product master categorization (optional but used by UI)
- **`public.products`**: product master
- **`public.suppliers`**, **`public.customers`**: master data used by purchases and billing
- **`public.accounts`**: required by accounting + purchases; migration `30_...` seeds defaults:
  - `Cash in Hand`
  - `Bank Account`
  - `Online Payments`
- **`public.accounting_categories`**: required by accounting entries; migrations seed:
  - `Purchase` (expense)
  - `Sales Return` (expense)
  - `Sales` (income)
- **`public.taxes`**: seeded GST slab list (currently not referenced by latest `products` schema, but safe to keep)

Transactional tables you can safely wipe and recreate by using the app:

- **Billing**: `bills`, `bill_items`, `bill_returns`, `bill_return_items`
- **Inventory movements**: `stock_in`, `stock_in_items`, `stock_transactions`
- **Accounting movements**: `entries`

### Scripts

- **`cleanup_transactional.sql`**: deletes only transactional data and resets `products.stock_quantity` to 0.
- **`cleanup_everything_except_required_master.sql`**: stronger cleanup; also removes non-required master data (products/customers/suppliers/categories), but keeps required seeded rows (accounts, accounting_categories, taxes) and keeps `users`.
- **`../delete_company_tenant_wipe.sql`** (parent `maintenance/` folder): **destructive** full removal of **one** tenant — all `company_id` rows, `public.users`, `auth.users`, and the `companies` row. **Storage:** hosted Supabase disallows SQL deletes on `storage.objects`; the script prints `NOTICE` hints so you can remove `business-logos` files via Dashboard or the Storage API. Use only when you intend to erase that company completely.

### How to run

Run in Supabase SQL editor (recommended), or via `psql` connected to your Supabase DB.

If you use the SQL editor, run the script as-is.

