# POS Billing System — Database Schema

> **Generated from:** Supabase migrations in `supabase/migrations/`, including **`51_multi_tenant_foundation.sql`** (multi-tenant, `activity_log`, RLS) and **`52_leads_status_values.sql`** (`leads.status` CHECK + data backfill), plus edge functions in `supabase/functions/`
>
> **Database:** Supabase (PostgreSQL) with Row Level Security (RLS)
>
> **Last updated:** April 2026

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Tables](#2-tables)
   - [users](#21-users)
   - [user_permissions](#22-user_permissions)
   - [product_categories](#23-product_categories)
   - [accounting_categories](#24-accounting_categories)
   - [taxes](#25-taxes)
   - [products](#26-products)
   - [suppliers](#27-suppliers)
   - [customers](#28-customers)
   - [stock_in](#29-stock_in)
   - [stock_in_items](#210-stock_in_items)
   - [stock_transactions](#211-stock_transactions)
   - [bills](#212-bills)
   - [bill_items](#213-bill_items)
   - [bill_returns](#214-bill_returns)
   - [bill_return_items](#215-bill_return_items)
   - [super_admins (platform / admin panel)](#216-super_admins-platform--admin-panel)
   - [leads](#217-leads)
   - [companies](#218-companies)
   - [activity_log](#219-activity_log)
   - [Tenant `company_id` (migration 51)](#220-tenant-company_id-migration-51)
3. [Enums](#3-enums)
4. [Functions & RPCs](#4-functions--rpcs)
5. [Triggers](#5-triggers)
6. [Row Level Security (RLS) Summary](#6-row-level-security-rls-summary)
7. [Edge Functions](#7-edge-functions)
8. [Stock Transaction Types Reference](#8-stock-transaction-types-reference)
9. [Entity Relationship Diagram](#9-entity-relationship-diagram)
10. [Seed / Default Data](#10-seed--default-data)
11. [Notes for Future Development](#11-notes-for-future-development)

---

## 1. Architecture Overview

**Multi-tenant & admin web (migration 51):** Store staff live in **`public.users`** with a required **`company_id`** → **`public.companies`** (tenant profile). The **central admin panel** uses **`public.super_admins`** (platform operators, separate from `users`) and **`public.leads`** (inbound pipeline). The former singleton `business_profile` table is renamed to **`companies`**.

```
┌─────────────────────────────────────────────────────────────────┐
│                        Supabase Auth                            │
│                      (auth.users table)                         │
└────────────────────────────┬────────────────────────────────────┘
                             │ 1:1 (id)
┌────────────────────────────▼────────────────────────────────────┐
│                       public.users                              │
│         (Admin / Manager / Staff) + company_id → companies    │
└──────┬──────────────┬───────────────────────────────────────────┘
       │              │
       │ 1:N          │ 1:N
       ▼              ▼
 user_permissions   bills (created_by_user_id)
                      │
        ┌─────────────┼─────────────┐
        │             │             │
        ▼             ▼             ▼
   bill_items    bill_returns   customers
        │             │
        │             ▼
        │      bill_return_items
        │             │
        └──────┬──────┘
               ▼
           products ◄──── product_categories
               │
        ┌──────┼──────┐
        ▼      ▼      ▼
   stock_in  stock_in_items  stock_transactions
        │
        ▼
    suppliers
```

---

## 2. Tables

After **migration 51**, POS business data is partitioned by **`company_id`** → **`companies`**. Full table list and uniqueness rules are in [§2.20](#220-tenant-company_id-migration-51); individual §2.x sections below remain the primary column reference—update **`UNIQUE`** / **`bill_number`** notes where migration 51 changed constraints.

### 2.1 `users`

App users linked 1:1 with `auth.users`. No hard delete — use `status = 'Inactive'` instead.

| Column | Type | Nullable | Default | Constraints |
|--------|------|----------|---------|-------------|
| `id` | `uuid` | NO | — | **PK**, FK → `auth.users(id)` ON DELETE RESTRICT |
| `full_name` | `text` | NO | — | |
| `email` | `text` | NO | — | UNIQUE |
| `phone` | `text` | YES | — | |
| `role` | `text` | NO | — | CHECK (`'Admin'`, `'Manager'`, `'Staff'`) |
| `status` | `text` | NO | `'Active'` | CHECK (`'Active'`, `'Inactive'`) |
| `created_at` | `timestamptz` | YES | `now()` | |
| `updated_at` | `timestamptz` | YES | `now()` | Auto-updated by trigger |
| `created_by` | `uuid` | YES | — | FK → `users(id)` ON DELETE SET NULL |
| `company_id` | `uuid` | NO | — | **FK** → `companies(id)` ON DELETE RESTRICT — tenant (store); every POS user belongs to one company (migration 51) |

**Indexes:** `idx_users_email`, `idx_users_role`, `idx_users_status`, `idx_users_company_id`

**Triggers:**
- `trigger_update_users_updated_at` → auto-sets `updated_at` on UPDATE
- `trigger_prevent_user_delete` → raises exception on DELETE (soft delete only)

---

### 2.2 `user_permissions`

Granular permissions for Staff users. Admin has full access regardless.

| Column | Type | Nullable | Default | Constraints |
|--------|------|----------|---------|-------------|
| `id` | `uuid` | NO | `gen_random_uuid()` | **PK** |
| `user_id` | `uuid` | NO | — | FK → `users(id)` ON DELETE RESTRICT |
| `permission` | `permission_type` | NO | — | Enum: `'stock_in'`, `'stock_out'` |
| `granted` | `boolean` | NO | `true` | |
| `created_at` | `timestamptz` | YES | `now()` | |
| `updated_at` | `timestamptz` | YES | `now()` | Auto-updated by trigger |

**Unique constraint:** `(user_id, permission)`

**Indexes:** `idx_user_permissions_user`, `idx_user_permissions_permission`

**Business Rules (application-enforced):**
| Role | Access |
|------|--------|
| Admin | Full system access; ignores this table |
| Manager | Default operational access |
| Staff — Cashier | `permission = 'stock_out'` |
| Staff — Storekeeper | `permission = 'stock_in'` |
| Staff — Supervisor | `permission = 'stock_in'` + `'stock_out'` |

---

### 2.3 `product_categories`

Product-only categories for product catalog.

| Column | Type | Nullable | Default | Constraints |
|--------|------|----------|---------|-------------|
| `id` | `uuid` | NO | `gen_random_uuid()` | **PK** |
| `company_id` | `uuid` | NO | — | FK → `companies(id)` (migration 51) |
| `name` | `text` | NO | — | UNIQUE per tenant: **`(company_id, name)`** — `uq_product_categories_company_name` |
| `description` | `text` | YES | — | |
| `is_active` | `boolean` | NO | `true` | |
| `created_at` | `timestamptz` | NO | `now()` | |
| `updated_at` | `timestamptz` | NO | `now()` | Auto-updated by trigger |
| `created_by` | `uuid` | YES | — | FK → `users(id)` ON DELETE SET NULL |
| `updated_by` | `uuid` | YES | — | FK → `users(id)` ON DELETE SET NULL |

**Indexes:** `idx_product_categories_is_active`, `idx_product_categories_company_id`

---

### 2.4 `accounting_categories`

Income and expense categories for future accounting module.

| Column | Type | Nullable | Default | Constraints |
|--------|------|----------|---------|-------------|
| `id` | `uuid` | NO | `gen_random_uuid()` | **PK** |
| `company_id` | `uuid` | NO | — | FK → `companies(id)` (migration 51) |
| `name` | `text` | NO | — | |
| `type` | `text` | NO | — | CHECK (`'income'`, `'expense'`) |
| `description` | `text` | YES | — | |
| `is_active` | `boolean` | NO | `true` | |
| `created_at` | `timestamptz` | NO | `now()` | |
| `updated_at` | `timestamptz` | NO | `now()` | Auto-updated by trigger |
| `created_by` | `uuid` | YES | — | FK → `users(id)` ON DELETE SET NULL |
| `updated_by` | `uuid` | YES | — | FK → `users(id)` ON DELETE SET NULL |

**Unique constraint:** **`(company_id, name, type)`** — `uq_accounting_categories_company_name_type` (migration 51)

**Indexes:** `idx_accounting_categories_type`, `idx_accounting_categories_is_active`, `idx_accounting_categories_company_id`

---

### 2.5 `taxes`

Tax definitions for products and billing. Percentage supports decimals.

| Column | Type | Nullable | Default | Constraints |
|--------|------|----------|---------|-------------|
| `id` | `uuid` | NO | `uuid_generate_v4()` | **PK** |
| `company_id` | `uuid` | NO | — | FK → `companies(id)` (migration 51) |
| `name` | `text` | NO | — | |
| `percentage` | `numeric(5,2)` | NO | — | |
| `is_active` | `boolean` | NO | `true` | |
| `created_at` | `timestamptz` | NO | `now()` | |
| `updated_at` | `timestamptz` | YES | — | Auto-updated by trigger |

**Indexes:** `idx_taxes_is_active`, `idx_taxes_company_id`

**Note:** `taxes` is not linked to `products` (FK removed in migration 06). After migration **51**, each tax row is **scoped to `company_id`** (per-tenant GST/rate masters). Tax can still be applied at billing time or re-linked to products in future.

---

### 2.6 `products`

Product master: pricing, inventory, and catalog data.

| Column | Type | Nullable | Default | Constraints |
|--------|------|----------|---------|-------------|
| `id` | `uuid` | NO | `uuid_generate_v4()` | **PK** |
| `company_id` | `uuid` | NO | — | FK → `companies(id)` (migration 51) |
| `name` | `text` | NO | — | |
| `barcode` | `text` | YES | — | UNIQUE per tenant for non-null barcodes: **partial index** `uq_products_company_barcode` on `(company_id, barcode)` WHERE `barcode IS NOT NULL` (migration 51). Soft-deleted products still hold their barcode. |
| `purchase_price` | `numeric(10,2)` | YES | — | |
| `selling_price` | `numeric(10,2)` | YES | — | |
| `mrp` | `numeric(10,2)` | YES | — | |
| `unit` | `text` | YES | — | |
| `low_stock_alert_qty` | `numeric(10,2)` | NO | `0` | |
| `is_active` | `boolean` | NO | `true` | Activate/deactivate (separate from soft delete) |
| `is_deleted` | `boolean` | NO | `false` | Soft delete (migration **75**). Hidden from default lists & billing search; restore via Deleted filter. Barcode remains reserved. |
| `created_at` | `timestamptz` | NO | `now()` | |
| `updated_at` | `timestamptz` | YES | `now()` | Auto-updated by trigger |
| `product_category_id` | `uuid` | YES | — | FK → `product_categories(id)` ON DELETE SET NULL |
| `stock_quantity` | `numeric(10,2)` | NO | `0` | Maintained by triggers and RPCs |

**Indexes:** `idx_products_name`, `idx_products_barcode`, `idx_products_is_active`, `idx_products_is_deleted`, `idx_products_product_category`, `idx_products_company_id`

**Triggers:**
- `trigger_update_products_updated_at` → auto-sets `updated_at`
- `trg_products_stock_adjustment` → logs `ADJUSTMENT_IN` / `ADJUSTMENT_OUT` in `stock_transactions` when `stock_quantity` changes via direct product edit (suppressed during billing, returns, and stock-in)

**Removed columns (via migrations):** `sku`, `category_id`, `tax_id`, `opening_stock`

---

### 2.7 `suppliers`

Supplier master for purchase management.

| Column | Type | Nullable | Default | Constraints |
|--------|------|----------|---------|-------------|
| `id` | `uuid` | NO | `uuid_generate_v4()` | **PK** |
| `company_id` | `uuid` | NO | — | FK → `companies(id)` (migration 51) |
| `supplier_name` | `text` | NO | — | |
| `contact_person` | `text` | YES | — | |
| `phone` | `text` | YES | — | |
| `email` | `text` | YES | — | |
| `address` | `text` | YES | — | |
| `gst_number` | `text` | YES | — | |
| `opening_balance` | `numeric(12,2)` | YES | `0` | |
| `created_at` | `timestamptz` | YES | `now()` | |
| `updated_at` | `timestamptz` | YES | `now()` | Auto-updated by trigger |
| `is_deleted` | `boolean` | YES | `false` | Soft delete flag |

**Indexes:** `idx_supplier_name`, `idx_supplier_phone`, `idx_suppliers_company_id`

---

### 2.8 `customers`

Customer master for POS billing and search.

| Column | Type | Nullable | Default | Constraints |
|--------|------|----------|---------|-------------|
| `id` | `uuid` | NO | `uuid_generate_v4()` | **PK** |
| `company_id` | `uuid` | NO | — | FK → `companies(id)` (migration 51) |
| `name` | `text` | NO | — | |
| `phone` | `text` | NO | — | UNIQUE per tenant: **`(company_id, phone)`** — `uq_customers_company_phone` (migration 51) |
| `email` | `text` | YES | — | |
| `address` | `text` | YES | — | |
| `is_active` | `boolean` | NO | `true` | Soft delete flag |
| `created_at` | `timestamptz` | NO | `now()` | |
| `updated_at` | `timestamptz` | NO | `now()` | Auto-updated by trigger |

**Indexes:** `idx_customers_phone`, `idx_customers_name`, `idx_customers_is_active`, `idx_customers_company_id`

---

### 2.9 `stock_in`

Stock-in (purchase) headers. One row per purchase entry.

| Column | Type | Nullable | Default | Constraints |
|--------|------|----------|---------|-------------|
| `id` | `uuid` | NO | `gen_random_uuid()` | **PK** |
| `company_id` | `uuid` | NO | — | FK → `companies(id)` (migration 51) |
| `date` | `date` | NO | — | Date of purchase entry |
| `supplier_id` | `uuid` | YES | — | Optional reference to suppliers |
| `invoice_number` | `text` | YES | — | `'OPENING'` for opening stock entries |
| `notes` | `text` | YES | — | |
| `total_items` | `integer` | NO | `0` | Number of line items |
| `total_amount` | `numeric(18,2)` | NO | `0` | Sum of all row_total |
| `account_id` | `uuid` | NO | — | FK → `accounts(id)` — payment account for this purchase (migration 32) |
| `created_by` | `uuid` | YES | — | User who created this entry |
| `created_at` | `timestamptz` | NO | `now()` | |
| `updated_at` | `timestamptz` | NO | `now()` | Auto-updated by trigger |

**Indexes:** `idx_stock_in_date`, `idx_stock_in_company_id`

**Note:** `supplier_id` is not an enforced FK to `suppliers` table. It is stored as a UUID reference — enforce via application or add FK in future.

---

### 2.10 `stock_in_items`

Per-product line items for each stock-in (purchase).

| Column | Type | Nullable | Default | Constraints |
|--------|------|----------|---------|-------------|
| `id` | `uuid` | NO | `gen_random_uuid()` | **PK** |
| `company_id` | `uuid` | NO | — | FK → `companies(id)` (migration 51; aligned with parent `stock_in`) |
| `stock_in_id` | `uuid` | NO | — | FK → `stock_in(id)` ON DELETE CASCADE |
| `product_id` | `uuid` | NO | — | FK → `products(id)` ON DELETE RESTRICT |
| `manufacturing_date` | `date` | YES | — | |
| `purchase_price` | `numeric(18,2)` | NO | — | Unit cost at stock-in (migration 42) |
| `selling_price` | `numeric(18,2)` | YES | — | Snapshot (migration 42) |
| `mrp` | `numeric(18,2)` | YES | — | Snapshot (migration 42) |
| `quantity` | `numeric(18,3)` | NO | — | |
| `row_total` | `numeric(18,2)` | NO | — | Total cost for this line item |
| `created_at` | `timestamptz` | NO | `now()` | |

**Indexes:** `idx_stock_in_items_product_id`, `idx_stock_in_items_stock_in_id`, `idx_stock_in_items_company_id`

---

### 2.11 `stock_transactions`

Append-only log of all stock movements across the system.

| Column | Type | Nullable | Default | Constraints |
|--------|------|----------|---------|-------------|
| `id` | `uuid` | NO | `gen_random_uuid()` | **PK** |
| `product_id` | `uuid` | NO | — | FK → `products(id)` ON DELETE RESTRICT |
| `transaction_type` | `text` | NO | — | See [Transaction Types](#8-stock-transaction-types-reference) |
| `quantity` | `numeric(18,3)` | NO | — | Positive = stock in, Negative = stock out |
| `reference_type` | `text` | NO | — | Source type (e.g. `'STOCK_IN'`, `'BILL'`) |
| `reference_id` | `uuid` | NO | — | Points to the source record |
| `notes` | `text` | YES | — | |
| `created_at` | `timestamptz` | NO | `now()` | |
| `company_id` | `uuid` | NO | — | FK → `companies(id)` — tenant scope for RLS and reporting (migration 51) |

**Indexes:** `idx_stock_transactions_product_id`, `idx_stock_transactions_reference_id`, `idx_stock_transactions_company_id`

---

### 2.12 `bills`

POS bill headers with amounts, payment, and status.

| Column | Type | Nullable | Default | Constraints |
|--------|------|----------|---------|-------------|
| `id` | `uuid` | NO | `gen_random_uuid()` | **PK** |
| `company_id` | `uuid` | NO | — | FK → `companies(id)` (migration 51) |
| `bill_number` | `text` | YES | — | UNIQUE per tenant: **`(company_id, bill_number)`** — `uq_bills_company_bill_number`; auto-generated (migration **71**: prefix from `companies.invoice_prefix`, unpadded monthly sequence, e.g. `B2606-1`) |
| `customer_id` | `uuid` | YES | — | FK → `customers(id)` ON DELETE SET NULL |
| `subtotal_amount` | `numeric(18,2)` | NO | `0` | Sum of line items before discounts |
| `other_items_amount` | `numeric(18,2)` | NO | `0` | Additional manual charges |
| `discount_type` | `text` | YES | — | CHECK (`'AMOUNT'`, `'PERCENT'`) |
| `discount_value` | `numeric(18,2)` | YES | — | Raw entered value |
| `discount_amount` | `numeric(18,2)` | NO | `0` | Final calculated discount |
| `total_payable_amount` | `numeric(18,2)` | NO | `0` | Final payable after all adjustments |
| `payment_mode` | `text` | NO | — | CHECK (`'Cash'`, `'UPI'`, `'Card'`, `'Mixed'`) |
| `cash_amount` | `numeric(18,2)` | NO | `0` | |
| `online_amount` | `numeric(18,2)` | NO | `0` | |
| `received_amount_total` | `numeric(18,2)` | NO | `0` | |
| `status` | `text` | NO | `'PENDING'` | CHECK (`'PENDING'`, `'PARTIALLY_PAID'`, `'PAID'`, `'RETURNED'`, `'PARTIAL_RETURN'`) |
| `return_note` | `text` | YES | — | |
| `returned_at` | `timestamptz` | YES | — | |
| `created_by_user_id` | `uuid` | YES | — | FK → `users(id)` ON DELETE SET NULL |
| `created_at` | `timestamptz` | NO | `now()` | |
| `updated_at` | `timestamptz` | NO | `now()` | Auto-updated by trigger |

**Indexes:** `idx_bills_bill_number`, `idx_bills_customer_id`, `idx_bills_status`, `idx_bills_created_at`, `idx_bills_created_by_user_id`, `idx_bills_company_id`

**Bill number format (migration 71):** `<invoice_prefix>YYMM-<n>` (default prefix `B`, `n` starts at 1 per month), per **`company_id`**, advisory-locked for concurrency.

---

### 2.13 `bill_items`

Line items per bill with product snapshots for historical accuracy.

| Column | Type | Nullable | Default | Constraints |
|--------|------|----------|---------|-------------|
| `id` | `uuid` | NO | `gen_random_uuid()` | **PK** |
| `company_id` | `uuid` | NO | — | FK → `companies(id)` (migration 51; aligned with parent `bills`) |
| `bill_id` | `uuid` | NO | — | FK → `bills(id)` ON DELETE CASCADE |
| `product_id` | `uuid` | NO | — | FK → `products(id)` ON DELETE RESTRICT |
| `product_name` | `text` | NO | — | Snapshot at billing time |
| `barcode` | `text` | YES | — | Snapshot at billing time |
| `unit_price` | `numeric(18,2)` | NO | — | Selling price at billing time |
| `quantity` | `numeric(18,3)` | NO | — | CHECK `> 0` |
| `row_total` | `numeric(18,2)` | NO | — | CHECK `>= 0`, = `unit_price × quantity` |

**Indexes:** `idx_bill_items_bill_id`, `idx_bill_items_product_id`, `idx_bill_items_company_id`

**Trigger:** On INSERT, automatically calls `reduce_product_stock()` → decreases `products.stock_quantity` and logs `SALE` in `stock_transactions`.

---

### 2.14 `bill_returns`

Return/refund header records for bills.

| Column | Type | Nullable | Default | Constraints |
|--------|------|----------|---------|-------------|
| `id` | `uuid` | NO | `gen_random_uuid()` | **PK** |
| `company_id` | `uuid` | NO | — | FK → `companies(id)` (migration 51; aligned with parent bill) |
| `bill_id` | `uuid` | NO | — | FK → `bills(id)` ON DELETE CASCADE |
| `return_number` | `varchar(50)` | NO | — | UNIQUE per tenant: **`(company_id, return_number)`** — `uq_bill_returns_company_return_number`; auto-generated `R-YYYYMMDD-XXX` (migration **51**: sequence scoped by `company_id`) |
| `return_note` | `text` | YES | — | |
| `total_return_amount` | `numeric(18,2)` | NO | — | CHECK `>= 0` |
| `refund_method` | `text` | NO | `'Cash'` | CHECK (`'Cash'`, `'UPI'`, `'Card'`, `'Mixed'`) |
| `refund_status` | `varchar(20)` | NO | `'pending'` | CHECK (`'pending'`, `'refunded'`) |
| `created_by` | `uuid` | NO | — | FK → `users(id)` |
| `created_at` | `timestamptz` | NO | `now()` | |
| `updated_at` | `timestamptz` | NO | `now()` | Auto-updated by trigger |

**Indexes:** `idx_bill_returns_bill_id`, `idx_bill_returns_created_at`, `idx_bill_returns_return_number`, `idx_bill_returns_company_id`

**Return Number Format:** `R-YYYYMMDD-XXX` — same pattern as bill numbers with separate advisory lock.

---

### 2.15 `bill_return_items`

Line items per bill return. Stock is restored on insert.

| Column | Type | Nullable | Default | Constraints |
|--------|------|----------|---------|-------------|
| `id` | `uuid` | NO | `gen_random_uuid()` | **PK** |
| `company_id` | `uuid` | NO | — | FK → `companies(id)` (migration 51; aligned with parent `bill_returns`) |
| `return_id` | `uuid` | NO | — | FK → `bill_returns(id)` ON DELETE CASCADE |
| `bill_item_id` | `uuid` | NO | — | FK → `bill_items(id)` |
| `product_id` | `uuid` | NO | — | FK → `products(id)` |
| `product_name` | `text` | NO | — | Snapshot |
| `quantity` | `integer` | NO | — | CHECK `> 0` |
| `unit_price` | `numeric(18,2)` | NO | — | CHECK `>= 0` |
| `line_total` | `numeric(18,2)` | NO | — | CHECK `>= 0` |
| `created_at` | `timestamptz` | NO | `now()` | |

**Indexes:** `idx_bill_return_items_return_id`, `idx_bill_return_items_bill_item_id`, `idx_bill_return_items_product_id`, `idx_bill_return_items_company_id`

**Triggers:**
- `trg_validate_return_qty` (BEFORE INSERT) → prevents returning more than `sold_qty - already_returned`
- `trg_restore_stock_after_return` (AFTER INSERT) → increases `products.stock_quantity` and logs `RETURN_IN` in `stock_transactions`

---

### 2.16 `super_admins` (platform / admin panel)

**Purpose:** Central **admin panel / web** operators (platform staff). These identities are **not** store staff: they do **not** appear in `public.users` and do **not** have `company_id`. The POS Android app should not treat them as tenant logins.

> **Naming:** In product language you may call these “admin users”; the database table name is **`super_admins`**.

| Column | Type | Nullable | Default | Constraints |
|--------|------|----------|---------|-------------|
| `id` | `uuid` | NO | — | **PK**, FK → `auth.users(id)` ON DELETE CASCADE (Supabase Auth user used only for the admin console) |
| `email` | `text` | NO | — | UNIQUE |
| `full_name` | `text` | YES | — | |
| `status` | `text` | NO | `'Active'` | CHECK (`'Active'`, `'Inactive'`) |
| `created_at` | `timestamptz` | NO | `now()` | |
| `updated_at` | `timestamptz` | NO | `now()` | Auto-updated by trigger |

**Triggers:** `trigger_update_super_admins_updated_at`

**RLS (summary):** `service_role` full access; authenticated active row may `SELECT` own row (`id = auth.uid()`); active super admins may `SELECT` all `super_admins`. Row creation is intended via **service role** (or SQL as database owner), not from the POS app.

**Related SQL helper:** `public.is_super_admin()` — returns true when `auth.uid()` matches an **Active** `super_admins` row.

---

### 2.17 `leads`

**Purpose:** Inbound pipeline for the **admin panel** (e.g. website signup interest, contact requests). Managed by platform super admins; optional link to a provisioned tenant.

| Column | Type | Nullable | Default | Constraints |
|--------|------|----------|---------|-------------|
| `id` | `uuid` | NO | `gen_random_uuid()` | **PK** |
| `business_name` | `text` | YES | — | |
| `contact_name` | `text` | YES | — | |
| `email` | `text` | NO | — | |
| `phone` | `text` | YES | — | |
| `message` | `text` | YES | — | |
| `status` | `text` | NO | `'New'` | CHECK (`'New'`, `'Contacted'`, `'Interested'`, `'Approved'`, `'Not Interested'`) |
| `converted_company_id` | `uuid` | YES | — | FK → `companies(id)` ON DELETE SET NULL — set when a lead becomes a tenant |
| `created_at` | `timestamptz` | NO | `now()` | |
| `updated_at` | `timestamptz` | NO | `now()` | Auto-updated by trigger |

**Indexes:** `idx_leads_status`, `idx_leads_created_at`

**Triggers:** `trigger_update_leads_updated_at`

**RLS (summary):** Authenticated **super admin** only (`is_super_admin()`), plus `service_role` for server-side ingestion (e.g. Edge Function).

**`status` migrations:** `51_multi_tenant_foundation.sql` defines the table. If you first deployed an older 51 revision with lowercase statuses, apply **`52_leads_status_values.sql`** — it renames `leads_status_check` to allow **`New`**, **`Contacted`**, **`Interested`**, **`Approved`**, **`Not Interested`** and migrates legacy values.

---

### 2.18 `companies`

**Purpose:** One row per **tenant (store / organization)** — branding, invoice prefix, activation, etc. Replaces the old singleton **`business_profile`** table (renamed in migration 51). POS users read/update **their** company via `users.company_id`.

| Column | Type | Nullable | Default | Constraints |
|--------|------|----------|---------|-------------|
| `id` | `uuid` | NO | `gen_random_uuid()` | **PK** |
| `business_name` | `text` | NO | — | |
| `logo_url` | `text` | YES | — | |
| `phone` | `text` | YES | — | |
| `email` | `text` | YES | — | |
| `address` | `text` | YES | — | |
| `gstin` | `text` | YES | — | |
| `invoice_prefix` | `text` | NO | `'B'` | Used in generated `bill_number` (e.g. `PREFIX2606-1`) |
| `receipt_footer` | `text` | YES | — | |
| `show_logo_on_bill` | `boolean` | NO | `true` | Whether to print logo on receipts when available (migration 45) |
| `owner_email` | `text` | YES | — | Primary owner / billing contact (migration 51) |
| `is_active` | `boolean` | NO | `true` | Tenant suspended when `false` (migration 51) |
| `created_at` | `timestamptz` | NO | `now()` | |
| `updated_at` | `timestamptz` | NO | `now()` | Auto-updated by trigger |

**Triggers:** `trigger_update_companies_updated_at` (renamed from `trigger_update_business_profile_updated_at` when the table was renamed)

**RLS (summary):** Tenant users `SELECT` their company (`id = get_my_company_id()`); tenant **Admin** may `UPDATE` that row; **super admin** may `INSERT`/`UPDATE` across companies for provisioning (admin web).

**Admin / web vs POS:** Use `super_admins` + `leads` + `companies` for the central console; use `users` + `companies` for store staff and tenant data access.

---

### 2.19 `activity_log`

**Purpose:** Append-only **POS** audit trail (who did what, when, on which module, success/failure). **Not** used for super-admin console actions. Scoped by **`company_id`**.

| Column | Type | Nullable | Default | Constraints |
|--------|------|----------|---------|-------------|
| `id` | `uuid` | NO | `gen_random_uuid()` | **PK** |
| `company_id` | `uuid` | NO | — | FK → `companies(id)` ON DELETE CASCADE |
| `user_id` | `uuid` | NO | — | FK → `users(id)` ON DELETE RESTRICT |
| `user_name` | `text` | NO | — | Snapshot at log time |
| `action_type` | `text` | NO | — | CHECK (`'Create'`, `'Update'`, `'Delete'`, `'Login'`, `'Logout'`) |
| `module_name` | `text` | NO | — | |
| `record_id` | `text` | YES | — | Affected record identifier |
| `description` | `text` | NO | — | |
| `status` | `text` | NO | — | CHECK (`'Success'`, `'Failed'`) |
| `ip_address` | `text` | YES | — | |
| `old_values` | `jsonb` | YES | — | Optional snapshot |
| `new_values` | `jsonb` | YES | — | Optional snapshot |
| `created_at` | `timestamptz` | NO | `now()` | |

**Indexes:** `idx_activity_log_company_created`, `idx_activity_log_company_user`, `idx_activity_log_company_action`, `idx_activity_log_company_module`, `idx_activity_log_company_status`

**Triggers:** `trg_activity_log_default_company` (BEFORE INSERT) → sets `company_id` from `get_my_company_id()` when omitted.

**RLS (summary):** INSERT only as self (`user_id = auth.uid()`) in own company; SELECT for **Admin/Manager** (all company rows) or **Staff** (own rows only); DELETE for **Admin** only (same company).

---

### 2.20 Tenant `company_id` (migration 51)

**Column:** `company_id uuid NOT NULL` → **`companies(id)`** on every row in the tenant’s dataset (backfilled from the first company, then enforced).

**Tables carrying `company_id` in addition to §2.3–§2.15, §2.19 above:** `taxes`, `suppliers`, `customers`, `product_categories`, `accounting_categories`, `products`, `stock_in`, `stock_in_items`, `stock_transactions`, `bills`, `bill_items`, `bill_returns`, `bill_return_items`, **`accounts`**, **`entries`** (accounting module tables from migration 30; not fully documented in earlier §2 subsections).

**Composite / partial uniqueness (migration 51):**

| Table | Constraint / index | Rule |
|-------|-------------------|------|
| `customers` | `uq_customers_company_phone` | UNIQUE (`company_id`, `phone`) |
| `product_categories` | `uq_product_categories_company_name` | UNIQUE (`company_id`, `name`) |
| `accounting_categories` | `uq_accounting_categories_company_name_type` | UNIQUE (`company_id`, `name`, `type`) |
| `accounts` | `uq_accounts_company_name` | UNIQUE (`company_id`, `name`) |
| `products` | `uq_products_company_barcode` | UNIQUE (`company_id`, `barcode`) WHERE `barcode IS NOT NULL` |
| `bills` | `uq_bills_company_bill_number` | UNIQUE (`company_id`, `bill_number`) |
| `bill_returns` | `uq_bill_returns_company_return_number` | UNIQUE (`company_id`, `return_number`) |

**BEFORE INSERT helpers:** `tenant_default_company_id()` and related triggers on many tables set `company_id` when the client omits it (legacy POS payloads).

---

## 3. Enums

| Enum Name | Values | Used By |
|-----------|--------|---------|
| `permission_type` | `'stock_in'`, `'stock_out'` | `user_permissions.permission` |

All other constrained values use `CHECK` constraints on `text` columns (not enums).

---

## 4. Functions & RPCs

### 4.1 Utility Functions

| Function | Returns | Purpose |
|----------|---------|---------|
| `update_updated_at_column()` | `trigger` | Generic trigger to auto-set `updated_at = now()` on UPDATE. Used by all tables with `updated_at`. |
| `prevent_user_delete()` | `trigger` | Raises exception on DELETE against `users`. Enforces soft-delete only. |
| `get_my_role()` | `text` | **SECURITY DEFINER** — returns current user's `role` from `users` without triggering RLS. Used in tenant RLS policies. |
| `get_my_company_id()` | `uuid` | **SECURITY DEFINER** — returns current user's `company_id` from `users` (migration **51**). Used to scope POS RLS. |
| `is_super_admin()` | `boolean` | **SECURITY DEFINER** — true when `auth.uid()` is an **Active** row in `super_admins` (migration **51**). Admin web / `leads` / cross-tenant `companies` provisioning. |
| `has_granted_permission(permission_type)` | `boolean` | **SECURITY DEFINER** — Admin/Manager always true; Staff true when `user_permissions` grants the permission (used for stock-in product/supplier writes). |
| `tenant_default_company_id()` | `trigger` | **SECURITY DEFINER** — BEFORE INSERT: sets `NEW.company_id` from `get_my_company_id()` when null (migration **51**). |

### 4.2 Product RPC

| Function | Signature | Returns |
|----------|-----------|---------|
| `create_product_with_opening_stock` | `(p_name text, p_barcode text, p_purchase_price numeric, p_selling_price numeric, p_mrp numeric, p_unit text, p_low_stock_alert_qty numeric DEFAULT 0, p_product_category_id uuid DEFAULT NULL, p_opening_stock numeric DEFAULT 0, p_id uuid DEFAULT NULL, p_is_active boolean DEFAULT true, p_created_by uuid DEFAULT NULL, p_account_id uuid DEFAULT NULL)` | `TABLE(id uuid)` |

**Behavior:**
1. Inserts a product row (**`company_id`** from `get_my_company_id()` — migration **51**)
2. If `p_opening_stock > 0`: creates a `stock_in` entry (invoice = `'OPENING'`), a `stock_in_items` row, and an `OPENING` stock transaction (all stamped with the same **`company_id`**)
3. Returns the new product `id`

### 4.3 Stock-In RPC

| Function | Signature | Returns |
|----------|-----------|---------|
| `create_stock_in` | `(p_date date, p_items jsonb, p_supplier_id uuid DEFAULT NULL, p_invoice_number text DEFAULT NULL, p_notes text DEFAULT NULL, p_created_by uuid DEFAULT NULL, p_account_id uuid DEFAULT NULL)` | `TABLE(id uuid)` |

**`p_items` JSON format:**
```json
[
  {
    "product_id": "uuid",
    "quantity": 10,
    "row_total": 500.00,
    "manufacturing_date": "2026-01-15"  // optional
  }
]
```

**Behavior (atomic transaction):**
1. Validates `p_items` is a non-empty JSON array
2. Computes totals from items
3. Resolves default payment account **`accounts`** row named **`Cash in Hand`** for the caller’s **`company_id`** (migration **51**)
4. Inserts `stock_in` header with **`company_id`**
5. For each item: inserts `stock_in_items`, updates `products.stock_quantity`, inserts `PURCHASE` **`stock_transactions`** row including **`company_id`**
6. Suppresses the product adjustment trigger to prevent duplicate logging
7. Returns the `stock_in.id`

### 4.4 Billing Functions

| Function | Signature | Returns | Purpose |
|----------|-----------|---------|---------|
| `reduce_product_stock` | `(p_product_id uuid, p_quantity numeric, p_bill_id uuid)` | `boolean` | **SECURITY DEFINER** — decreases stock, inserts `SALE` into `stock_transactions` **with `company_id`** (migration **51**); not granted to `authenticated` (trigger path only). |
| `generate_bill_number` | `()` | `trigger` | On `bills` INSERT: sets `company_id` if null, then `bill_number` as **`<prefix>YYMM-<n>`** from **`companies.invoice_prefix`** (migration **71**). |
| `trigger_bill_items_deduct_stock` | `()` | `trigger` | **SECURITY DEFINER** — calls `reduce_product_stock()` after `bill_items` INSERT |

### 4.5 Return Functions

| Function | Signature | Returns | Purpose |
|----------|-----------|---------|---------|
| `generate_return_number` | `()` | `trigger` | Sets `company_id` from parent bill if needed, then `return_number` scoped per **`company_id`** (migration **51**). |
| `restore_product_stock` | `()` | `trigger` | **SECURITY DEFINER** — restores stock + inserts `RETURN_IN` with **`company_id`** (migration **51**). |
| `validate_return_quantity` | `()` | `trigger` | Prevents returning more than sold minus already returned |

### 4.6 Stock Adjustment

| Function | Returns | Purpose |
|----------|---------|---------|
| `log_product_stock_adjustment()` | `trigger` | Fires on `products.stock_quantity` UPDATE. Logs `ADJUSTMENT_IN` / `ADJUSTMENT_OUT`. **Skips** when `app.suppress_stock_adjustment = 'true'` (set by billing, returns, and stock-in functions). |

---

## 5. Triggers

| Table | Trigger Name | Event | Function |
|-------|-------------|-------|----------|
| `users` | `trigger_update_users_updated_at` | BEFORE UPDATE | `update_updated_at_column()` |
| `users` | `trigger_prevent_user_delete` | BEFORE DELETE | `prevent_user_delete()` |
| `user_permissions` | `trigger_update_user_permissions_updated_at` | BEFORE UPDATE | `update_updated_at_column()` |
| `product_categories` | `trigger_update_product_categories_updated_at` | BEFORE UPDATE | `update_updated_at_column()` |
| `accounting_categories` | `trigger_update_accounting_categories_updated_at` | BEFORE UPDATE | `update_updated_at_column()` |
| `taxes` | `trigger_update_taxes_updated_at` | BEFORE UPDATE | `update_updated_at_column()` |
| `products` | `trigger_update_products_updated_at` | BEFORE UPDATE | `update_updated_at_column()` |
| `products` | `trg_products_stock_adjustment` | AFTER UPDATE OF `stock_quantity` | `log_product_stock_adjustment()` |
| `suppliers` | `trigger_update_suppliers_updated_at` | BEFORE UPDATE | `update_updated_at_column()` |
| `customers` | `trigger_update_customers_updated_at` | BEFORE UPDATE | `update_updated_at_column()` |
| `stock_in` | `trigger_update_stock_in_updated_at` | BEFORE UPDATE | `update_updated_at_column()` |
| `bills` | `trigger_update_bills_updated_at` | BEFORE UPDATE | `update_updated_at_column()` |
| `bills` | `trigger_bills_generate_bill_number` | BEFORE INSERT | `generate_bill_number()` |
| `bill_items` | `trigger_bill_items_after_insert_deduct_stock` | AFTER INSERT | `trigger_bill_items_deduct_stock()` |
| `bill_returns` | `trigger_update_bill_returns_updated_at` | BEFORE UPDATE | `update_updated_at_column()` |
| `bill_returns` | `trigger_bill_returns_generate_return_number` | BEFORE INSERT | `generate_return_number()` |
| `bill_return_items` | `trg_validate_return_qty` | BEFORE INSERT | `validate_return_quantity()` |
| `bill_return_items` | `trg_restore_stock_after_return` | AFTER INSERT | `restore_product_stock()` |
| `activity_log` | `trg_activity_log_default_company` | BEFORE INSERT | `tenant_default_company_id()` |
| `taxes`, `suppliers`, `customers`, `product_categories`, `accounting_categories`, `products`, `stock_in`, `bills`, `accounts` | `trg_*_default_company` | BEFORE INSERT | `tenant_default_company_id()` (migration **51**) |
| `stock_in_items` | `trg_stock_in_items_default_company` | BEFORE INSERT | `tenant_default_company_id_from_stock_in()` |
| `bill_items` | `trg_bill_items_default_company` | BEFORE INSERT | `tenant_default_company_id_from_bill()` |
| `bill_return_items` | `trg_bill_return_items_default_company` | BEFORE INSERT | `tenant_default_company_id_from_return()` |
| `entries` | `trg_entries_default_company` | BEFORE INSERT | `tenant_default_company_id_from_account()` |

---

## 6. Row Level Security (RLS) Summary

After **migration 51**, POS data policies are **tenant-scoped**: rows must satisfy **`company_id = get_my_company_id()`** unless noted. Helpers: **`get_my_role()`**, **`get_my_company_id()`**, **`has_granted_permission()`** (SECURITY DEFINER). **`is_super_admin()`** applies only to platform tables (`leads`, `super_admins`, cross-tenant `companies` operations).

| Table | Policy pattern (authenticated) |
|-------|--------------------------------|
| `companies` | SELECT own company or super admin; INSERT super admin; UPDATE tenant Admin (own row) or super admin |
| `users` | Admin **same `company_id`** (ALL); Manager **same company** SELECT; Staff SELECT self; anyone SELECT own row by `id = auth.uid()` |
| `user_permissions` | Admin **same company** as target `user_id` (ALL); user SELECT own rows |
| `leads` | Super admin (`is_super_admin()`) ALL; `service_role` ALL |
| `super_admins` | `service_role` ALL; self SELECT if active; super admin SELECT all |
| `product_categories`, `taxes`, `customers` | SELECT/INSERT/UPDATE/DELETE within company + role (Admin/Manager; DELETE Admin where applicable) |
| `accounting_categories` | SELECT company; Admin ALL company; Manager/Staff SELECT |
| `products`, `suppliers` | SELECT company; INSERT/UPDATE when **`has_granted_permission('stock_in')`**; DELETE products: Admin company |
| `stock_in`, `stock_in_items` | SELECT/INSERT own company |
| `stock_transactions` | SELECT/INSERT own company |
| `bills`, `bill_items` | SELECT/INSERT/UPDATE bills + SELECT/INSERT bill_items — own company |
| `bill_returns`, `bill_return_items` | SELECT/INSERT/UPDATE returns + SELECT/INSERT items — own company |
| `accounts`, `entries` | Admin ALL company; Manager/Staff SELECT accounts; entries SELECT/INSERT company; entries UPDATE/DELETE Admin |
| `activity_log` | INSERT as self (`user_id = auth.uid()`), own company; SELECT Admin/Manager all company, Staff own rows; DELETE Admin company |

**Note:** Exact policy names live in `51_multi_tenant_foundation.sql`. Pre-51 “any authenticated” access is **removed** for the tables above.

---

## 7. Edge Functions

### 7.1 `create-user` (POST)

**Path:** `supabase/functions/create-user/index.ts`

**Access:** Admin only (verified via caller JWT → `public.users.role`)

**Request body:**
```json
{
  "fullName": "string",
  "email": "string",
  "password": "string",
  "phone": "string | null",
  "role": "Admin | Manager | Staff",
  "status": "Active | Inactive",
  "createdBy": "uuid",
  "permissionStockIn": true,
  "permissionStockOut": false
}
```

**Behavior:**
1. Validates caller is Admin
2. Creates `auth.users` entry (email confirmed)
3. Inserts `public.users` row
4. If role is Staff: inserts `user_permissions` rows for granted permissions
5. On failure: rolls back auth user and public row

---

### 7.2 `change-user-password` (POST)

**Path:** `supabase/functions/change-user-password/index.ts`

**Access:** Active platform `super_admins` (any tenant user), or tenant `Admin` for users in the same `company_id`

**Request body:**
```json
{
  "user_id": "uuid",
  "new_password": "string (min 6 chars)"
}
```

**Behavior:** Updates the target user's password via `auth.admin.updateUserById`.

---

## 8. Stock Transaction Types Reference

| transaction_type | quantity | reference_type | reference_id | When |
|------------------|----------|----------------|--------------|------|
| `OPENING` | `+` (positive) | `STOCK_IN` | `stock_in.id` | Product created with opening stock |
| `PURCHASE` | `+` (positive) | `STOCK_IN` | `stock_in.id` | Stock-in (purchase from supplier) |
| `SALE` | `−` (negative) | `BILL` | `bills.id` | POS billing |
| `RETURN_IN` | `+` (positive) | `BILL_RETURN` | `bill_returns.id` | Bill return (stock restored) |
| `ADJUSTMENT_IN` | `+` (positive) | `PRODUCT_EDIT` | `products.id` | Manual stock increase via product edit |
| `ADJUSTMENT_OUT` | `−` (negative) | `PRODUCT_EDIT` | `products.id` | Manual stock decrease via product edit |

**Suppression mechanism:** When `reduce_product_stock`, `restore_product_stock`, or `create_stock_in` update `products.stock_quantity`, they set `app.suppress_stock_adjustment = 'true'` (transaction-local GUC) so the generic adjustment trigger doesn't double-log.

---

## 9. Entity Relationship Diagram

```
auth.users
    │ 1:1
    ▼
┌──────────┐       ┌──────────────────┐
│  users   │──1:N──│ user_permissions  │
└────┬─────┘       └──────────────────┘
     │  (migration 51: `users.company_id` → `companies` — not drawn)
     │ created_by / created_by_user_id
     ├─────────────────────────────────────────────┐
     │                                             │
     ▼                                             ▼
┌──────────┐    ┌──────────────────┐         ┌──────────┐
│  bills   │───►│   bill_items     │         │ stock_in │
└────┬─────┘    └───────┬──────────┘         └────┬─────┘
     │                  │                         │
     │ customer_id      │ product_id              │ stock_in_id
     │                  ▼                         ▼
     │           ┌──────────┐              ┌──────────────┐
     │           │ products │◄─────────────│stock_in_items│
     │           └────┬─────┘              └──────────────┘
     │                │
     │                │ product_category_id
     │                ▼
     │        ┌───────────────────┐
     │        │product_categories │
     │        └───────────────────┘
     │
     ▼
┌────────────┐
│ customers  │
└────────────┘

┌──────────┐         ┌──────────────────┐
│  bills   │──1:N──►│  bill_returns     │
└──────────┘         └───────┬──────────┘
                             │
                             │ 1:N
                             ▼
                     ┌───────────────────┐
                     │ bill_return_items  │──► bill_items
                     └───────────────────┘──► products

products ◄──── stock_transactions (all movements logged here)

┌────────────────────────┐    ┌──────────┐
│ accounting_categories  │    │  taxes   │
│ (→ entries, per company)│   │ (per company) │
└────────────────────────┘    └──────────┘

┌──────────┐
│suppliers │  (referenced by stock_in.supplier_id, not FK-enforced)
└──────────┘
```

---

## 10. Seed / Default Data

### Taxes (inserted in migration 04)

| name | percentage |
|------|------------|
| GST 0% | 0.00 |
| GST 5% | 5.00 |
| GST 12% | 12.00 |
| GST 18% | 18.00 |
| GST 28% | 28.00 |

---

## 11. Notes for Future Development

### Admin panel / web vs POS

- **REST / PostgREST:** The Android app historically queried `business_profile`; after migration 51 the table name is **`companies`**. Admin web should use **`super_admins`**, **`leads`**, and **`companies`** as documented in sections [2.16](#216-super_admins-platform--admin-panel)–[2.18](#218-companies); POS continues to use **`users`** plus tenant-scoped business tables.
- **POS audit:** **`activity_log`** and tenant **`company_id`** matrix are in [§2.19](#219-activity_log) and [§2.20](#220-tenant-company_id-migration-51).
- Full column layouts for **`super_admins`**, **`leads`**, **`companies`**, and the extended **`users`** row (including `company_id`) are in **§2** above.

### Currently Standalone / Unused Tables
- **`taxes`** — Not linked to products (FK removed in migration 06); after migration **51** rows are **per `company_id`**. Can be re-linked for tax-at-billing or tax-on-product features.
- **`suppliers`** — Referenced by `stock_in.supplier_id` but without a foreign key constraint. Consider adding FK.

### Potential Improvements
1. **`stock_in.supplier_id`** — Add FK → `suppliers(id)` ON DELETE SET NULL for referential integrity.
2. **`bill_return_items.quantity`** — Currently `integer`; consider `numeric(18,3)` to match `bill_items.quantity` (which supports fractional units).
3. **Tax on bills** — `bills` has no tax columns. If per-bill or per-item tax is needed, add `tax_id` / `tax_amount` to `bill_items` or `bills`.
4. **Supplier balance tracking** — `suppliers.opening_balance` exists but no transaction table tracks supplier payments/credits yet.
5. **Expense / Income tracking** — **`entries`** and **`accounts`** exist (migration 30); both are **per `company_id`** after migration **51**. Further reporting/RPC hardening may still be needed.
6. **Bill DELETE policy** — No RLS policy allows deleting bills or bill items. Add if bill cancellation is needed.
7. **Stock-in UPDATE/DELETE** — No RLS policy allows updating or deleting stock-in entries. Add if stock-in editing/reversal is needed.
8. **Audit columns** — `stock_in_items`, `stock_transactions`, `bill_items` lack `created_by`. Consider adding for traceability.
9. **Bill number timezone** — `CURRENT_DATE` uses the database timezone (UTC on Supabase). If store-local dates are needed, pass the date or adjust timezone settings.

### Stock Flow Summary

```
Product Creation (with opening stock)
  └─► create_product_with_opening_stock() RPC
        ├─► INSERT products (stock_quantity = opening_stock)
        ├─► INSERT stock_in (invoice = 'OPENING')
        ├─► INSERT stock_in_items
        └─► INSERT stock_transactions (type = 'OPENING')

Stock-In (Purchase)
  └─► create_stock_in() RPC
        ├─► INSERT stock_in header
        ├─► INSERT stock_in_items (per product)
        ├─► UPDATE products.stock_quantity (+quantity)
        └─► INSERT stock_transactions (type = 'PURCHASE')

Billing (Sale)
  └─► INSERT bills → trigger generates bill_number
  └─► INSERT bill_items → trigger calls reduce_product_stock()
        ├─► UPDATE products.stock_quantity (-quantity)
        └─► INSERT stock_transactions (type = 'SALE')

Bill Return
  └─► INSERT bill_returns → trigger generates return_number
  └─► INSERT bill_return_items
        ├─► BEFORE: validate_return_quantity (prevents over-return)
        ├─► UPDATE products.stock_quantity (+quantity)
        └─► INSERT stock_transactions (type = 'RETURN_IN')

Manual Stock Edit
  └─► UPDATE products.stock_quantity directly
        └─► Trigger: log_product_stock_adjustment()
              └─► INSERT stock_transactions (type = 'ADJUSTMENT_IN' or 'ADJUSTMENT_OUT')
```
