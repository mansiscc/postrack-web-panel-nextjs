---
name: Android-to-Web audit
overview: Audit the Android POSTrack app as the source of truth, extract its business rules/data/contracts, and turn that into a complete Next.js admin-panel architecture and implementation roadmap without writing code yet.
todos:
  - id: audit-architecture
    content: Map Android app architecture, package structure, navigation model, and cross-cutting services from activities, viewmodels, repositories, DI, and resources.
    status: pending
  - id: audit-features
    content: Build a complete screen and module matrix including purpose, actions, validations, states, permissions, and desktop redesign opportunities.
    status: pending
  - id: audit-business-rules
    content: Extract and normalize all business rules for billing, inventory, purchases, returns, accounting, soft delete, and activity logging.
    status: pending
  - id: audit-data-auth-api
    content: Derive the entity catalog, ER narrative, API/RPC inventory, auth flow, roles, permissions, and tenant-isolation model from Kotlin and Supabase artifacts.
    status: pending
  - id: design-web-architecture
    content: Define the target Next.js desktop architecture, module decomposition, folder structure, and server/client responsibility boundaries.
    status: pending
  - id: roadmap-and-gap-analysis
    content: Produce milestone-based implementation roadmap, risks, and value-adding missing-feature recommendations for a professional POS web admin panel.
    status: pending
isProject: false
---

# POSTrack Admin Panel Migration Plan

## Objective
Produce a source-of-truth migration blueprint for a desktop-first Next.js admin panel that preserves Android business logic, role gating, and tenant isolation while redesigning workflows for desktop efficiency.

## Audit Status
Three parallel deep-dive audits are complete. All findings below are grounded in direct code evidence, not inference.

## Verified Source Inputs
The plan treats Android and Supabase as primary evidence, and existing markdown specs as secondary cross-checks.

- App structure, activities, permissions, and declared feature surface are anchored in [`/Users/dreamworld/Documents/next-js/postrack/POS-Billing-System/app/src/main/AndroidManifest.xml`](/Users/dreamworld/Documents/next-js/postrack/POS-Billing-System/app/src/main/AndroidManifest.xml).
- Main navigation, tab visibility, module entry points, and desktop-aware rail behavior are anchored in [`/Users/dreamworld/Documents/next-js/postrack/POS-Billing-System/app/src/main/java/com/scc/posbillingsystem/features/home/HomeActivity.kt`](/Users/dreamworld/Documents/next-js/postrack/POS-Billing-System/app/src/main/java/com/scc/posbillingsystem/features/home/HomeActivity.kt) and [`/Users/dreamworld/Documents/next-js/postrack/POS-Billing-System/app/src/main/java/com/scc/posbillingsystem/features/home/HomeScreen.kt`](/Users/dreamworld/Documents/next-js/postrack/POS-Billing-System/app/src/main/java/com/scc/posbillingsystem/features/home/HomeScreen.kt).
- Auth/session/company-active checks are anchored in [`/Users/dreamworld/Documents/next-js/postrack/POS-Billing-System/app/src/main/java/com/scc/posbillingsystem/features/splash/MainActivity.kt`](/Users/dreamworld/Documents/next-js/postrack/POS-Billing-System/app/src/main/java/com/scc/posbillingsystem/features/splash/MainActivity.kt), [`/Users/dreamworld/Documents/next-js/postrack/POS-Billing-System/app/src/main/java/com/scc/posbillingsystem/features/auth/LoginViewModel.kt`](/Users/dreamworld/Documents/next-js/postrack/POS-Billing-System/app/src/main/java/com/scc/posbillingsystem/features/auth/LoginViewModel.kt), and [`/Users/dreamworld/Documents/next-js/postrack/POS-Billing-System/app/src/main/java/com/scc/posbillingsystem/features/home/MoreViewModel.kt`](/Users/dreamworld/Documents/next-js/postrack/POS-Billing-System/app/src/main/java/com/scc/posbillingsystem/features/home/MoreViewModel.kt).
- Billing rules are anchored in [`/Users/dreamworld/Documents/next-js/postrack/POS-Billing-System/app/src/main/java/com/scc/posbillingsystem/features/billing/BillingViewModel.kt`](/Users/dreamworld/Documents/next-js/postrack/POS-Billing-System/app/src/main/java/com/scc/posbillingsystem/features/billing/BillingViewModel.kt), [`/Users/dreamworld/Documents/next-js/postrack/POS-Billing-System/app/src/main/java/com/scc/posbillingsystem/domain/usecase/billing/SaveBillUseCase.kt`](/Users/dreamworld/Documents/next-js/postrack/POS-Billing-System/app/src/main/java/com/scc/posbillingsystem/domain/usecase/billing/SaveBillUseCase.kt), and [`/Users/dreamworld/Documents/next-js/postrack/POS-Billing-System/app/src/main/java/com/scc/posbillingsystem/domain/model/BillingModels.kt`](/Users/dreamworld/Documents/next-js/postrack/POS-Billing-System/app/src/main/java/com/scc/posbillingsystem/domain/model/BillingModels.kt).
- Purchase/stock-in rules are anchored in [`/Users/dreamworld/Documents/next-js/postrack/POS-Billing-System/app/src/main/java/com/scc/posbillingsystem/features/purchase/presentation/stockin/StockInAddEditViewModel.kt`](/Users/dreamworld/Documents/next-js/postrack/POS-Billing-System/app/src/main/java/com/scc/posbillingsystem/features/purchase/presentation/stockin/StockInAddEditViewModel.kt).
- Remote API usage and RPC/view dependencies are anchored in [`/Users/dreamworld/Documents/next-js/postrack/POS-Billing-System/app/src/main/java/com/scc/posbillingsystem/data/remote/billing/BillingRemoteDataSource.kt`](/Users/dreamworld/Documents/next-js/postrack/POS-Billing-System/app/src/main/java/com/scc/posbillingsystem/data/remote/billing/BillingRemoteDataSource.kt) and [`/Users/dreamworld/Documents/next-js/postrack/POS-Billing-System/app/src/main/java/com/scc/posbillingsystem/data/remote/product/ProductRemoteDataSource.kt`](/Users/dreamworld/Documents/next-js/postrack/POS-Billing-System/app/src/main/java/com/scc/posbillingsystem/data/remote/product/ProductRemoteDataSource.kt).
- Schema, RLS, soft delete, analytics, numbering, and stock/accounting bridges are anchored in [`/Users/dreamworld/Documents/next-js/postrack/POS-Billing-System/supabase/migrations_consolidated/0017_product_soft_delete_batches_users_analytics.sql`](/Users/dreamworld/Documents/next-js/postrack/POS-Billing-System/supabase/migrations_consolidated/0017_product_soft_delete_batches_users_analytics.sql) plus the rest of [`/Users/dreamworld/Documents/next-js/postrack/POS-Billing-System/supabase/migrations`](/Users/dreamworld/Documents/next-js/postrack/POS-Billing-System/supabase/migrations).
- Existing admin-panel intent/spec is useful but secondary: [`/Users/dreamworld/Documents/next-js/postrack/POS-Billing-System/docs/TENANT_ADMIN_PANEL_SPEC.md`](/Users/dreamworld/Documents/next-js/postrack/POS-Billing-System/docs/TENANT_ADMIN_PANEL_SPEC.md).

## What The Audit Will Produce

### 1. Reverse-Engineered Product Report
Create a module-by-module audit of the Android app covering:
- Architecture, package map, DI, state management, local persistence, remote integrations, and background capabilities.
- Full screen inventory with purpose, entry/exit points, user actions, validation, loading/empty/error/success states, permissions, and connected data/API dependencies.
- Hidden and cross-cutting flows such as legal pages, app update checks, device/printer management, barcode scan, PDF/WhatsApp sharing, and inactive-company handling.

### 2. Business-Rule Canon
Extract the non-negotiable business rules before any web implementation work starts:
- Auth rules: session bootstrap, inactive/deleted user handling, company active checks, stored permission hydration, logout clearing.
- Billing rules: batch-based stock usage, manual line items, bill-level discount only, mixed payment behavior, partial-payment status calculation, account selection requirement, walk-in vs existing vs auto-created customer handling, receipt/share flow.
- Purchase rules: optional supplier, required payment account, row merging by product plus effective price tuple, batch naming, opening-stock treatment, totals behavior.
- Lifecycle rules: soft-delete/restore semantics, last-admin protections, reference-aware delete behavior, reserved barcodes, tenant-scoped records, and activity logging.

### 3. Data And Contract Blueprint
Produce a build-ready backend design packet:
- Entity catalog with fields, nullability, defaults, unique constraints, foreign keys, status flags, audit columns, soft-delete columns, and inferred indexes.
- ER description based on Supabase migrations and domain models.
- API/RPC inventory showing which calls are simple table CRUD, which depend on views, and which are business-rule RPCs that should stay server-side in the web version.
- Auth/RLS mapping for roles `Admin`, `Manager`, `Staff`, plus staff permission flags `stock_in` and `stock_out` and company isolation.

### 4. Desktop UX Redesign Blueprint
Translate mobile modules into desktop-first workflows rather than screen copies:
- Replace mobile tab hopping with sidebar navigation, breadcrumb context, large data tables, saved filters, quick actions, and bulk operations where applicable.
- Redesign high-frequency flows like POS billing, product management, purchase entry, sales history, and accounting around keyboard-first desktop productivity.
- Preserve functional parity while improving information density, side-by-side context, print/share previewing, and analytics readability.

### 5. Web Architecture Specification
Define the target Next.js architecture using the requested stack:
- `Next.js` latest with App Router, `TypeScript`, `Tailwind`, `shadcn/ui`, `Supabase`, `PostgreSQL`, `React Hook Form`, `Zod`, `TanStack Query`, `TanStack Table`, `Recharts`, `Lucide`.
- Server Components for read-heavy views, Server Actions or route handlers for privileged mutations, and a feature-sliced frontend structure around domain modules.
- Clear boundaries for `app`, `components`, `features`, `repositories`, `services`, `schemas`, `types`, `lib`, `utils`, and `middleware`.
- A decision matrix for what logic stays in SQL/RPC versus moves to typed server-side application services.

## Migration Principles
- Preserve DB-backed business rules exactly unless a rule is proven Android-only presentation logic.
- Keep multi-tenant and role-based restrictions enforced server-side first, UI second.
- Treat calculations involving stock, payments, profit, returns, and balances as shared domain logic with regression coverage.
- Prefer reusable list/detail/form patterns across modules, but not at the expense of domain clarity.
- Mark every inferred rule explicitly when it is derived from code behavior rather than directly documented.

## Complete Screen & Module Matrix

### Module 1: Auth
| Screen | Purpose | Desktop improvement |
|--------|---------|---------------------|
| Login | Email + password, company-active check | Remember email, keyboard submit, clear error inline |
| Inactive company | Block suspended tenants | Informative lockout page with contact info |

### Module 2: Dashboard (Admin only)
| Screen | Key data | Desktop improvement |
|--------|---------|---------------------|
| Dashboard | KPIs (sales, profit, COGS, bill count, refunds, payment breakdown), inventory alerts, out-of-stock list, quick nav | Wide card grid, sparkline charts, collapsible sections, live date range picker |

### Module 3: Business Profile (Admin, Manager)
Edit `companies` row: name, category, logo, phone, email, address, GSTIN, invoice prefix, receipt footer, show logo on bill, active status.

### Module 4: User Management (Admin)
List → Add → Edit → Delete/Restore → Change Password. Role filter, status filter, staff permission display. Uses Edge Functions for create/delete/password.

### Module 5: Activity Log (Admin)
Paginated table. Filters: action type, module, date range, user. Columns: timestamp, user, action, module, description, status. Export PDF/Excel.

### Module 6: Product Categories (Admin, Manager)
List with product count. Add, edit name/description, toggle active. Block delete when products linked.

### Module 7: Products (Admin, Manager, Staff stock_in)
Paginated list. Search by name/barcode. Filter: category, stock status, active/inactive/deleted. Add, edit, activate/deactivate, soft delete, restore. Image upload via `/api/uploads/image`. Product detail shows stock summary, financial summary, batch list, movement history.

### Module 8: Inventory Overview (Admin, Manager, Staff stock_in)
Summary cards (total products, total stock value, low/out-of-stock counts). Filterable product table with qty, purchase price, stock value columns.

### Module 9: Suppliers (Admin, Manager, Staff stock_in)
List, search, add, edit, detail view with purchase history. Soft delete.

### Module 10: Purchase Management / Stock-In (Admin, Manager, Staff stock_in)
List (paginated, search by invoice/supplier). Create: date, supplier, invoice #, notes, account, line items (product, purchase price, selling price, MRP, qty, batch name). Detail view. Uses `create_stock_in` RPC.

### Module 11: Customers (Admin, Manager)
List, search, add, edit, detail with bill history. Deactivate. Unique phone per company enforced.

### Module 12: POS Billing (Admin, Manager, Staff stock_out)
Search/scan to add products (active + in-stock only). Batch selection when multiple batches. Manual line items. Other-items charge. Bill-level discount (amount or %). Customer (walk-in, existing, or new). Payment mode (Cash, UPI, Card, Mixed). Receiving account. Partial payment. Save → auto bill number, stock deduction, accounting entry. Print/PDF/share.

### Module 13: Sales / Bill History (Admin, Manager, Staff stock_out)
Paginated table. Search, date range, payment mode, status filters. Bill detail view. Return flow: select items/qtys, refund method, auto return number, stock restore.

### Module 14: Account Categories (Admin, Manager)
Income/expense categories. Add, edit, toggle active. Default categories: Sales (income), Sales Return (income), Purchase (expense).

### Module 15: Bank Accounts (Admin, Manager)
List with running balance. Add, edit, detail with recent transactions. Block delete if entries exist or default account.

### Module 16: Transactions (Admin, Manager)
Paginated list. Filter: type (income/expense), date range, account, category. Manual entry form. System entries (from bills/purchases/returns) view-only. Admin can edit/delete manual entries.

### Module 17: Sales Analytics (Admin, Manager)
Date range (Today, Week, Month, Custom). KPIs (total sales, bill count, returns, gross profit). Payment breakdown. Top selling products. Daily sales trend chart.

### Module 18: Purchase Insights (Admin, Manager)
Date range. Total purchase, count. Top suppliers by spend. Top purchased products. Trend chart.

## Desktop UX Redesign Recommendations

### Navigation
Replace Android bottom tabs with a persistent collapsible sidebar. Group modules under labeled sections. Use icons + labels when expanded, icons-only when collapsed. Active route highlighted. Breadcrumbs for deep pages.

### Data Tables (Critical)
All list views use TanStack Table: sticky header, column sorting, server-side pagination, saved filters per session, URL-synced filter state, row actions (edit, delete, restore) as dropdown menus. Bulk select + bulk actions where applicable.

### Forms
React Hook Form + Zod on all forms. Multi-column layout on wide screens (2–3 columns). Inline validation. Sheet/drawer for add/edit instead of navigating away from list.

### POS Billing (Critical)
Two-column desktop layout: left = product search + cart, right = payment summary. Keyboard shortcuts: `Enter` to add product, `Esc` to cancel, `/` to focus search. Barcode input via keyboard scanner (no camera required for desktop, camera optional via browser API). Real-time totals. Quick customer lookup in right panel.

### Analytics
Full-width Recharts charts. Date range picker with presets. KPI stat cards row at top. Tables below charts for detailed breakdowns.

### Print / Receipt
No Bluetooth dependency on web. Use `window.print()` with print-specific CSS for thermal-style receipt, or generate PDF via `@react-pdf/renderer`. WhatsApp sharing via WhatsApp Web URL with encoded message.

### Activity Log
Large table, date range + user + module + action filters. Export to CSV/Excel.

## Proposed Navigation For Desktop
Use the Android module surface as the baseline, then reorganize for desktop:
- `Dashboard`
- `Sales`: `POS Billing`, `Sales History`, `Returns`
- `Inventory`: `Products`, `Categories`, `Inventory Overview`, `Suppliers`, `Purchases`
- `Finance`: `Transactions`, `Account Categories`, `Accounts`
- `Management`: `Customers`, `Users`, `Activity Log`, `Business Profile`
- `Reports`: `Sales Analytics`, `Purchase Insights`, `Performance Analytics` if retained
- `System`: `Device/Printer Management`, `Legal`, `App Updates` where appropriate for web

## Target Next.js Architecture

### Stack
- `Next.js 15` App Router, `TypeScript`
- `Tailwind CSS` + `shadcn/ui` (Radix-based component library)
- `Supabase` — same project, same RLS, using `@supabase/ssr` for server-side sessions
- `React Hook Form` + `Zod` for all form validation
- `TanStack Query v5` for data fetching and cache
- `TanStack Table v8` for data grids
- `Recharts` for analytics charts
- `Lucide React` for icons

### Rendering Strategy
- Server Components for data-heavy read pages (product list, sales history, inventory, activity log)
- Client Components for interactive forms, cart, real-time search, modals
- Server Actions for mutations that need server-side validation (or thin API route handlers)
- All privileged mutations proxy through server-side code that verifies the JWT role before hitting Supabase

### Folder Structure
```
app/
  (auth)/
    login/
  (dashboard)/
    layout.tsx          ← shell with sidebar + topbar
    page.tsx            ← dashboard
    products/
    categories/
    inventory/
    suppliers/
    purchases/
    billing/
    sales/
    returns/
    customers/
    users/
    activity-log/
    transactions/
    accounts/
    account-categories/
    analytics/sales/
    analytics/purchases/
    business-profile/
  api/
    uploads/image/      ← Cloudinary proxy (replaces Android UPLOAD_API_BASE_URL)

components/
  ui/                   ← shadcn generated components
  layout/               ← Sidebar, Topbar, Breadcrumb, PageHeader
  data-table/           ← Generic TanStack Table wrapper
  forms/                ← Reusable field components
  charts/               ← Recharts wrappers
  dialogs/              ← Confirm, Delete, Restore dialogs
  receipt/              ← Print-optimized receipt component

features/               ← One folder per domain module
  auth/
  dashboard/
  products/
  categories/
  inventory/
  suppliers/
  purchases/
  billing/
  sales/
  returns/
  customers/
  users/
  activity-log/
  transactions/
  accounts/
  analytics/
  business-profile/

repositories/           ← One file per entity; Supabase queries only
  products.ts
  bills.ts
  stock-in.ts
  users.ts
  ...

services/               ← Business logic orchestration (mirrors Android Use Cases)
  billing.service.ts    ← SaveBill logic, customer resolution
  stock-in.service.ts   ← Calls create_stock_in RPC
  product.service.ts    ← createProductWithOpeningStock RPC
  user.service.ts       ← Edge Function calls for create/delete/password
  ...

schemas/                ← Zod schemas matching DB column constraints
  product.schema.ts
  bill.schema.ts
  ...

types/                  ← TypeScript interfaces derived from DB schema
  database.types.ts     ← Auto-generated from Supabase CLI
  domain/               ← Mapped domain types

lib/
  supabase/
    client.ts           ← browser client
    server.ts           ← server-side client (@supabase/ssr)
    middleware.ts

hooks/                  ← React Query hooks per feature
  use-products.ts
  use-billing.ts
  ...

utils/
  billing-calculator.ts ← Port of BillingCalculator.kt
  formatting.ts
  permissions.ts        ← Role/permission guards

middleware.ts           ← Session verification + route protection
```

### Middleware & Auth Guard
`middleware.ts` runs on every protected route. Reads Supabase session from cookie. Redirects to `/login` if no session. Passes role + company_id in response headers for Server Components. Module-level access is enforced both in middleware (coarse) and per-page Server Components (fine-grained).

## High-Risk Areas To Validate Early
- Stock integrity across purchases, bill saves, and returns.
- Accounting side effects from bills, purchases, manual entries, and returns.
- Company isolation and RLS parity between Android and web admin access.
- Product batch selection and cost/profit reporting consistency.
- Print/share replacement strategy for desktop receipts, PDFs, and WhatsApp-adjacent workflows.
- Areas where the Android spec doc may lag the actual Kotlin/Supabase implementation.

## Gap Analysis — Features to Add (Not in Android)

| Feature | Priority | Justification |
|---------|---------|---------------|
| Export to CSV/Excel (sales, purchases, transactions) | Critical | Professional admin panel requirement |
| Receipt PDF download | Critical | Browser has no Bluetooth; replaces thermal print |
| Keyboard shortcuts in POS billing | Recommended | Power user productivity on desktop |
| Bulk product activate/deactivate | Recommended | Reduces repetitive admin |
| Inventory adjustment screen (manual `ADJUSTMENT_IN/OUT`) | Recommended | Partially hidden in Android via product edit; should be first-class |
| Supplier ledger / balance tracking | Recommended | `opening_balance` exists but no transaction history |
| Customer ledger / outstanding bills view | Recommended | `bill.status = PARTIALLY_PAID/PENDING` data exists |
| Purchase return flow | Recommended | Not in Android; needed for professional POS |
| Dark mode | Optional | shadcn/ui supports it trivially |
| Role-based sidebar (only show permitted modules) | Critical | Preserves Android tab visibility rules |
| Activity log export (PDF/CSV) | Recommended | Admin compliance requirement |
| WhatsApp share via WhatsApp Web link | Recommended | Replaces Android native share |
| Keyboard barcode scanner input | Critical | ESC/POS is desktop-ready via HID; camera optional |
| Save draft bill | Optional | Not in Android; useful for large orders |
| Low stock alert notifications (in-app) | Optional | Dashboard shows alerts; real-time badge is nice-to-have |

## Deliverables Sequence
1. Audit report of Android architecture and feature inventory.
2. Screen matrix with business behaviors and desktop recommendations.
3. Data model and ER narrative from Supabase migrations plus domain models.
4. API/auth/permission matrix.
5. Desktop IA and UX redesign recommendations.
6. Next.js architecture, folder structure, and module decomposition.
7. Milestone-based implementation roadmap with complexity, dependencies, and risks.
8. Gap analysis for professional POS capabilities not yet present in Android.

## Implementation Roadmap (Milestone Detail)

### Milestone 1 — Foundation (Low complexity, no dependencies)
- `Next.js 15` project setup, TypeScript, Tailwind, shadcn/ui
- Supabase client setup (`@supabase/ssr`), middleware, session cookies
- Auto-generated `database.types.ts` from Supabase CLI
- Zod base schemas, ESLint/Prettier config

### Milestone 2 — Authentication (Medium complexity)
- Login page (email + password)
- Middleware session guard + route protection
- Inactive company/user handling (lockout page)
- Role and permission loading from `users` + `user_permissions`
- Logout + session clearing
- Risk: company-active RLS must work from SSR context

### Milestone 3 — Shell Layout & Navigation (Low complexity)
- Collapsible sidebar with role-aware module visibility
- Topbar (user info, logout, breadcrumb)
- Generic page header, data table shell, confirm dialog

### Milestone 4 — Master Data: Categories, Business Profile, Users (Medium complexity)
- Product categories CRUD
- Business profile edit (logo upload via `/api/uploads/image`)
- User management (list, add via Edge Function, edit, delete via Edge Function, restore, change password)
- Activity log list with filters
- Risk: `create-user` and `delete-user` Edge Functions require Auth header forwarding from server actions

### Milestone 5 — Products & Inventory (High complexity)
- Product list with filters, search, pagination
- Add product (with opening stock via RPC)
- Edit product, toggle active, soft delete, restore
- Product detail (summaries, batches, movement history via `get_product_details` RPC)
- Inventory overview
- Image upload proxy
- Risk: `create_product_with_opening_stock` RPC signature has many optional params; match exactly

### Milestone 6 — Suppliers & Purchases (Medium complexity)
- Supplier list, add, edit, detail with purchase history
- Purchase list (using `stock_in_list_view`)
- Create purchase (calls `create_stock_in` RPC with JSONB items array)
- Purchase detail
- Barcode scanner input for purchase line items
- Risk: RPC item format must match exactly including `manufacturing_date` optional field

### Milestone 7 — Customers (Low complexity)
- Customer list, add, edit, detail with bill history
- Phone uniqueness per company enforced via Zod + Supabase conflict error handling

### Milestone 8 — POS Billing (High complexity — highest risk)
- Product search (active + in-stock filter) with debounce
- Batch selection when multiple batches
- Manual line items (uses `get_manual_bill_product_id` RPC)
- Cart state management (persistent in localStorage, mirrors Android DataStore cart)
- Other items amount
- Bill-level discount (amount / percent) with real-time total calculation
- Customer lookup / auto-create on save
- Payment modes: Cash, UPI, Card, Mixed (cash + UPI split only)
- Partial payment → status calculation
- Account selection (default pre-selected)
- Save bill → items → accounting entry (mirrors `SaveBillUseCase` orchestration)
- Receipt print (browser print CSS) and PDF download
- Risk: `BillingCalculator` logic must be ported exactly; batch qty enforcement is client+server

### Milestone 9 — Sales History & Returns (High complexity)
- Sales history list (`bill_history_sales_view`) with filters
- Bill detail view with print
- Return flow: select items, validate qty (client + DB trigger), refund method, auto return number
- Return updates bill status to `RETURNED` or `PARTIAL_RETURN`
- Risk: over-return is DB-blocked; surface the error message gracefully

### Milestone 10 — Finance / Accounting (Medium complexity)
- Account categories CRUD (with default category seeding logic)
- Bank accounts CRUD with balance display
- Transactions list (`transactions_list_view`) with filters
- Manual entry form (income/expense)
- System entries view-only lock
- Transactions totals from `get_transactions_totals` RPC

### Milestone 11 — Analytics & Reports (Medium complexity)
- Sales analytics (`get_sales_analytics_summary` RPC) with date range, charts, top products
- Purchase insights with date range, charts, top suppliers
- Export to CSV/Excel for sales, purchases, transactions, activity log

### Milestone 12 — Hardening & Release (Medium complexity)
- Accessibility audit (WCAG 2.1 AA minimum)
- Performance audit (LCP on data-heavy pages, TanStack Query cache tuning)
- E2E tests for critical flows (billing, return, stock-in)
- Security review: RBAC enforcement on server actions, image upload validation
- Mobile-responsive fallback (tablet-friendly at minimum)
- Dark mode toggle

## Implementation Roadmap Shape
The eventual build plan should be sequenced roughly as:
1. Platform foundation and design system.
2. Auth, session, company isolation, and RBAC.
3. Shell layout, navigation, and shared data-grid/form primitives.
4. Master data: business profile, users, categories, products, customers, suppliers.
5. Inventory and purchase workflows.
6. Billing, bill history, returns, receipt/print/share flows.
7. Accounting and transaction modules.
8. Dashboards and analytics.
9. Hardening: audit logs, accessibility, performance, tests, and release readiness.

## Confirmed Technical Findings (from audit)

### Android Architecture
- **Language / UI:** Kotlin + Jetpack Compose (Material 3). Multi-Activity shell. `HomeScreen` renders a NavigationRail on screens ≥ 840 dp (already desktop-aware).
- **DI:** Hilt throughout — single `SupabaseClient` injected via `SupabaseModule`, uses Auth, Postgrest, and Storage plugins.
- **State:** `ViewModel` + `StateFlow` + Use Case layer per Clean Architecture. No Room/SQLite — 100% Supabase-backed.
- **Local persistence:** `StorePreferenceManager` (Jetpack DataStore / SharedPreferences) caches current user, company, and staff permissions for cold-start performance and offline reads of identity context only.
- **Printing:** `ESCPOS-ThermalPrinter-Android` library via Bluetooth (`BLUETOOTH_CONNECT`, `BLUETOOTH_SCAN`). ESC/POS receipt printing is hardware-dependent — desktop equivalent is browser-based print layout or PDF download.
- **Barcode:** Camera-based (`CameraX` + `ML Kit barcode-scanning`). Desktop equivalent: keyboard barcode scanner input, or webcam via browser API.
- **Sharing:** WhatsApp sharing (ACTION_SEND) with PDF export via `FileProvider`. Desktop equivalent: download PDF + mailto/WhatsApp web link.
- **App update check:** Custom `app_updates` table + `AppUpdateCheckViewModel` shown in `HomeActivity`. Web admin does not need this.

### Backend & Data Contract
- **Auth:** Supabase email/password. No public signup. Email auto-confirmed. Password min 6 chars enforced server-side. Android `CredentialManager` for saved credentials (irrelevant for web).
- **Session:** Supabase SDK manages JWT. Android does NOT manually store tokens. Web admin will use Supabase SSR session (`@supabase/ssr`).
- **Tenant isolation:** Every POS business table carries `company_id → companies(id)`. RLS enforces it via `get_my_company_id()` (SECURITY DEFINER). Tenant identity is embedded in the JWT via `users.company_id`.
- **Role model:** 3 roles in `users.role` CHECK constraint: `'Admin'`, `'Manager'`, `'Staff'`. One enum type in DB: `permission_type` with values `'stock_in'`, `'stock_out'`.
- **Staff permissions:** stored in `user_permissions` table. `has_granted_permission()` SECURITY DEFINER RLS helper gates product/supplier writes.
- **Soft delete:** `users` — `status = 'Inactive'` + `is_deleted = true`. Hard delete blocked by DB trigger. `products` — `is_deleted boolean`. `suppliers` — `is_deleted boolean`. `customers` — `is_active boolean`.
- **Company active check:** RLS in migration 58 (`enforce_active_company_rls`) gates all tenant data writes behind `is_my_company_active()`. Login flow also checks this client-side and routes to `InactiveCompanyActivity`.

### Key Database Tables (all confirmed from `DATABASE_SCHEMA.md`)
| Table | Key columns | Notable constraints |
|-------|-------------|---------------------|
| `companies` | `id`, `business_name`, `invoice_prefix` (default `'B'`), `is_active`, `is_deleted`, `logo_url`, `show_logo_on_bill`, `gstin`, `receipt_footer`, `owner_email` | Tenant root |
| `users` | `id = auth.uid()`, `company_id`, `role`, `status`, `is_deleted`, `created_by` | Soft-delete only; ON DELETE RESTRICT on auth FK |
| `user_permissions` | `user_id`, `permission` (enum), `granted` | UNIQUE `(user_id, permission)` |
| `products` | `company_id`, `name`, `barcode`, `purchase_price`, `selling_price`, `mrp`, `stock_quantity`, `is_active`, `is_deleted`, `image_url`, `low_stock_alert_qty` | Partial UNIQUE `(company_id, barcode)` WHERE barcode IS NOT NULL |
| `product_categories` | `company_id`, `name`, `is_active` | UNIQUE `(company_id, name)` |
| `suppliers` | `company_id`, `supplier_name`, `opening_balance`, `is_deleted` | supplier_id in stock_in is NOT FK-enforced |
| `customers` | `company_id`, `name`, `phone`, `is_active` | UNIQUE `(company_id, phone)` |
| `stock_in` | `company_id`, `date`, `supplier_id`, `invoice_number`, `account_id`, `total_items`, `total_amount` | `invoice_number = 'OPENING'` for opening stock |
| `stock_in_items` | `stock_in_id`, `product_id`, `purchase_price`, `selling_price`, `mrp`, `quantity`, `row_total` | snapshot prices |
| `stock_transactions` | `product_id`, `transaction_type`, `quantity`, `reference_type`, `reference_id`, `company_id` | append-only ledger |
| `bills` | `company_id`, `bill_number` (auto `<prefix>YYMM-<n>`), `customer_id`, `subtotal_amount`, `other_items_amount`, `discount_type`, `discount_value`, `discount_amount`, `total_payable_amount`, `payment_mode`, `cash_amount`, `online_amount`, `received_amount_total`, `status` | UNIQUE `(company_id, bill_number)` |
| `bill_items` | `bill_id`, `product_id`, `product_name` (snapshot), `barcode` (snapshot), `unit_price`, `quantity`, `row_total` | INSERT trigger deducts stock |
| `bill_returns` | `bill_id`, `return_number` (auto `R-YYYYMMDD-XXX`), `total_return_amount`, `refund_method`, `refund_status` | UNIQUE `(company_id, return_number)` |
| `bill_return_items` | `return_id`, `bill_item_id`, `product_id`, `quantity`, `unit_price`, `line_total` | BEFORE trigger validates qty; AFTER trigger restores stock |
| `accounts` | `company_id`, `name`, `opening_balance`, `is_default`, `is_active` | UNIQUE `(company_id, name)` |
| `entries` | `company_id`, `account_id`, `entry_type` (`income`/`expense`), `source_type` (`manual`/`purchase`/`bill`/`return`), `amount`, `entry_date`, `payment_mode` | system entries are view-only |
| `accounting_categories` | `company_id`, `name`, `type` (`income`/`expense`), `is_active` | UNIQUE `(company_id, name, type)` |
| `activity_log` | `company_id`, `user_id`, `user_name` (snapshot), `action_type`, `module_name`, `record_id`, `description`, `status`, `old_values` (jsonb), `new_values` (jsonb) | append-only |
| `product_batches` | `product_id`, `batch_name`, `batch_seq`, `remaining_qty` | queried via RPC |
| `taxes` | `company_id`, `name`, `percentage`, `is_active` | Not linked to products currently |

### Stock Flow (DB-enforced)
```
Opening stock → create_product_with_opening_stock() RPC → stock_in(OPENING) + stock_in_items + stock_transactions(OPENING)
Purchase     → create_stock_in() RPC (atomic) → stock_in header + stock_in_items + products.stock_quantity(+) + stock_transactions(PURCHASE)
Sale         → INSERT bills + INSERT bill_items → trigger: reduce_product_stock() → products.stock_quantity(-) + stock_transactions(SALE)
Return       → INSERT bill_returns + INSERT bill_return_items → trigger: validate_qty then restore_product_stock() → stock_quantity(+) + stock_transactions(RETURN_IN)
Manual edit  → UPDATE products.stock_quantity directly → trigger: log_product_stock_adjustment() → stock_transactions(ADJUSTMENT_IN/OUT)
```
Stock manipulation is **DB-enforced via triggers/RPCs**. The web admin must use the same RPCs — no client-side stock math.

### Key Supabase RPCs & Views (web admin will reuse all)
| Name | Type | Purpose |
|------|------|---------|
| `create_product_with_opening_stock` | RPC | Atomic product + opening stock creation |
| `create_stock_in` | RPC | Atomic purchase (stock-in) creation |
| `get_product_batches_with_stock` | RPC | Batches with remaining qty for billing |
| `get_product_details` | RPC | Full product detail with summaries and movements |
| `get_admin_dashboard_totals` | RPC | Dashboard KPIs, payment breakdown, inventory alerts, profit |
| `get_sales_analytics_summary` | RPC | Sales analytics KPIs, top products, trend |
| `get_transactions_totals` | RPC | Income/expense/balance totals |
| `get_manual_bill_product_id` | RPC | Placeholder product ID for manual bill items |
| `restore_user` | RPC | Restore soft-deleted user |
| `user_list_with_permissions_view` | View | Users joined with permissions |
| `bill_history_sales_view` | View | Bills joined with customer + created_by name |
| `stock_in_list_view` | View | Purchases joined with supplier + created_by |
| `transactions_list_view` | View | Entries joined with account/category names |

### Edge Functions (web admin will call same functions)
| Function | Caller | Purpose |
|----------|--------|---------|
| `create-user` | Admin only (verified JWT) | Create auth + public user + permissions atomically |
| `delete-user` | Admin only | Soft or hard delete with last-admin guard |
| `change-user-password` | Admin / super_admin | Password reset without knowing old password |
| `provision-company-admin` | super_admin only | Onboard new tenant |
| `create-lead` | Public | Demo/contact lead intake |

### Business Rules Canon
**Auth & session:**
- Login: verify auth → check `users.status` and `is_deleted` → check `company_id` → check `companies.is_active/is_deleted` → load permissions for Staff → record login to `activity_log`.
- Inactive/deleted user or inactive company → sign out and block.
- Logout: record logout to `activity_log` → `signOut()` → clear local prefs/cart.

**Billing:**
- Product search for billing: active + stock > 0 only.
- When a product has multiple batches with stock → show batch selection sheet; user must pick a batch.
- Qty cannot exceed batch `remaining_qty`.
- Manual line items (name + price) use a placeholder product ID from `get_manual_bill_product_id()`.
- `other_items_amount` is a lump-sum non-inventory charge (no stock effect).
- Discount is bill-level only: `AMOUNT` or `PERCENT`; `discount_amount` calculated from `(subtotal + other_items) * pct` or raw amount.
- `total_payable = subtotal + other_items - discount_amount`.
- Bill status: `PAID` if `received >= payable`, `PARTIALLY_PAID` if `0 < received < payable`, `PENDING` if `received = 0`.
- Payment account is required; accounting entry created for `received_amount_total > 0`.
- Customer: walk-in (null), existing (by phone), or auto-created on save using phone uniqueness check.
- Bill number auto-generated server-side: `<invoice_prefix>YYMM-<monthly_seq>`.
- Cart persisted locally (DataStore) so it survives app background/foreground.

**Purchase / Stock-In:**
- `create_stock_in` RPC is atomic: validates items, inserts header + line items, updates `stock_quantity`, writes `PURCHASE` stock transactions.
- Supplier is optional (walk-in purchase).
- Payment account required.
- If same product+price-tuple already in list → merge quantities (not duplicate rows).
- Batch name on a purchase creates/updates a `product_batches` row.
- Opening stock uses `invoice_number = 'OPENING'` and separate RPC.

**Returns:**
- Return qty per item cannot exceed `sold_qty - already_returned` (DB trigger enforces).
- Stock is restored automatically (DB trigger on `bill_return_items` INSERT).
- Return number auto-generated: `R-YYYYMMDD-XXX`.
- Bill status updated to `RETURNED` or `PARTIAL_RETURN`.

**User management:**
- All user creation/deletion goes through Edge Functions (not direct PostgREST) because they need service-role access.
- Hard delete only when no references exist in: `activity_log`, `bill_returns`, `bills`, `entries`, `stock_in`, `product_categories`, `accounting_categories`, `accounts`, `users.created_by`.
- Last active Admin cannot be deleted.
- Deleted users cannot be edited until restored.
- Restore sets `is_deleted = false` and `status = Active`.

**Activity logging:**
- Logged for: Create, Update, Delete, Login, Logout.
- Fields: `user_name` (snapshot), `action_type`, `module_name`, `record_id`, `description`, `status`, `old_values` (jsonb), `new_values` (jsonb).
- Modules logged: Billing, Products, ProductCategories, Suppliers, Purchases, Customers, Users, AccountingCategories, Accounts, Transactions, BusinessProfile, Auth.

## Expected Output Standard
The final architecture packet must be detailed enough that a senior engineer can implement the Next.js admin panel without reopening the Android codebase, except for edge-case verification.