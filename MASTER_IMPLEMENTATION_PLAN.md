# POSTrack — Master Implementation Plan

**Version:** 1.0  
**Date:** July 2026  
**Status:** Authoritative blueprint for Next.js Admin Panel development  
**Source of truth:** Android audit (`.cursor/plans/android-to-web_audit_e83764b2.plan.md`), `DATABASE_SCHEMA.md`, `TENANT_ADMIN_PANEL_SPEC.md`

---

## Document Purpose

This document is the **single master architecture and implementation blueprint** for the POSTrack desktop web admin panel. Any senior engineer should be able to build the complete application from this document without re-inspecting the Android codebase.

**Rules for all future development:**
1. Review this document before implementing any module.
2. Business logic must remain identical to the audit canon unless explicitly changed by product.
3. Desktop UX may improve; business behavior must not drift.
4. No random code generation — every module follows the Feature Module Standard (Section 4).
5. UI planning (Section 16) must be approved before coding each module.

---

# SECTION 1 — Project Overview

## 1.1 Project Goals

Build a **production-grade, desktop-first Next.js admin panel** for POSTrack — a multi-tenant POS & Inventory Management System — that:

- Preserves **100% functional parity** with the Android application for all tenant-facing modules.
- Reuses the **existing Supabase backend** (PostgreSQL, RLS, RPCs, Edge Functions) without schema changes unless approved.
- Delivers a **modern desktop UX** optimized for keyboard, large screens, data density, and power-user workflows.
- Is **maintainable, testable, and scalable** for future modules (multi-branch, purchase returns, CRM, etc.).

## 1.2 Business Domain

POSTrack is a **retail POS and inventory system** for small-to-medium businesses (stores, shops, warehouses). Core workflows:

| Domain | Capabilities |
|--------|-------------|
| **Sales** | POS billing, bill history, returns/refunds, partial payments, mixed payments |
| **Inventory** | Products, categories, batches, stock movements, low-stock alerts |
| **Procurement** | Suppliers, stock-in (purchases), opening stock |
| **Customers** | Customer master, bill history per customer |
| **Finance** | Bank accounts, income/expense categories, transactions, manual entries |
| **Analytics** | Sales analytics, purchase insights, admin dashboard KPIs |
| **Administration** | Users, roles, permissions, business profile, activity audit log |

## 1.3 Users

| User Type | Description |
|-----------|-------------|
| **Tenant Admin** | Store owner or head administrator. Full access to all modules within their company. |
| **Manager** | Operational manager. Access to day-to-day operations; no user management or activity log. |
| **Staff (Stock-in)** | Warehouse/storekeeper. Products, suppliers, purchases, inventory overview only. |
| **Staff (Stock-out)** | Cashier/sales staff. POS billing and sales history only. |
| **Platform Super Admin** | Out of scope for this tenant admin panel. Uses separate `super_admins` table and platform console. |

## 1.4 User Roles & Permissions

### Roles (`users.role`)

| Role | Scope |
|------|-------|
| `Admin` | Full tenant access; ignores `user_permissions` table |
| `Manager` | Operational access; no User Management, no Activity Log |
| `Staff` | Subset defined by `user_permissions` |

### Staff Permissions (`user_permissions.permission`)

| Permission | DB Value | Grants Access To |
|------------|----------|------------------|
| Stock-in | `stock_in` | Products, Suppliers, Purchases, Inventory Overview |
| Stock-out | `stock_out` | POS Billing, Sales / Bill History |

Staff may have one or both permissions. Admin and Manager do not use this table.

## 1.5 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Browser (Desktop / Tablet)                   │
│  Next.js 15 App Router — React Server Components + Client Islands│
└────────────────────────────┬────────────────────────────────────┘
                             │
         ┌───────────────────┼───────────────────┐
         │                   │                   │
         ▼                   ▼                   ▼
   Server Components    Server Actions      API Routes
   (read-heavy pages)  (mutations)         (/api/uploads/image)
         │                   │                   │
         └───────────────────┼───────────────────┘
                             │
         ┌───────────────────┼───────────────────┐
         │                   │                   │
         ▼                   ▼                   ▼
    Service Layer       Repository Layer    Utils (pure)
    (business logic)    (Supabase I/O)      (calculators)
         │                   │
         └───────────────────┼───────────────────┘
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Supabase (PostgreSQL)                         │
│  Auth │ PostgREST │ RLS │ RPCs │ Triggers │ Edge Functions      │
└─────────────────────────────────────────────────────────────────┘
```

**Data flow:** `UI → Hook/Action → Service → Repository → Supabase`

**Authorization layers (defense in depth):**
1. **Middleware** — session exists, route coarse-guard
2. **Server Action / Route Handler** — role + permission check
3. **PostgreSQL RLS** — `company_id`, `get_my_role()`, `has_granted_permission()`
4. **UI** — hide/disable unauthorized controls (never sole enforcement)

## 1.6 Technology Stack

| Layer | Technology | Version / Notes |
|-------|------------|-----------------|
| Framework | Next.js (App Router) | 15.x |
| Language | TypeScript | strict mode |
| Styling | Tailwind CSS | 4.x |
| Components | shadcn/ui (Radix) | latest |
| Icons | Lucide React | latest |
| Forms | React Hook Form | 7.x |
| Validation | Zod | 3.x |
| Data fetching (client) | TanStack Query | v5 |
| Tables | TanStack Table | v8 |
| Charts | Recharts | 2.x |
| Backend | Supabase | Auth + PostgREST + Storage + Edge Functions |
| Database | PostgreSQL | via Supabase |
| Session | @supabase/ssr | cookie-based SSR sessions |
| PDF (receipts) | @react-pdf/renderer or print CSS | TBD at Milestone 8 |
| Testing | Vitest + Playwright | unit + E2E |
| Linting | ESLint + Prettier | enforced in CI |

## 1.7 Development Philosophy

1. **Audit-first** — Android audit + this document define behavior; no guessing.
2. **Server-first** — default to Server Components; add `"use client"` only when needed.
3. **DB as source of truth for stock/finance** — never duplicate stock math in the client; use RPCs and triggers.
4. **Feature-sliced** — one folder per domain module with identical internal structure.
5. **Typed end-to-end** — generated DB types, Zod schemas, domain types, no `any`.
6. **Incremental delivery** — milestone-based; each milestone is shippable and testable.
7. **No premature abstraction** — shared components yes; premature generic frameworks no.

## 1.8 Desktop-First Approach

The Android app already uses a NavigationRail at ≥840px. The web admin **extends** this for true desktop:

- Persistent collapsible **sidebar** (not bottom tabs or hamburger-only).
- **Master-detail** layouts for lists (products, customers, bills).
- **3-pane POS billing** (catalog | cart | payment).
- **Spreadsheet-style** purchase entry with editable line grid.
- **Keyboard shortcuts** for billing and navigation.
- **URL-synced filters** for shareable/bookmarkable list states.
- **Large data tables** with sticky headers, column resize, export.
- Tablet layout (≥768px) as minimum responsive fallback; mobile is secondary.

## 1.9 Scalability Goals

| Goal | How Architecture Supports It |
|------|------------------------------|
| Multi-tenant | `company_id` on all tables; RLS enforced |
| New modules | Feature folder standard; plug into sidebar |
| Multi-branch (future) | Add `branch_id` column + RLS extension |
| High data volume | Server-side pagination, virtualized tables, RPC aggregations |
| API integrations (future) | Service layer boundary; webhooks via Edge Functions |
| Team scaling | Consistent module structure; clear layer boundaries |

---

# SECTION 2 — Architecture Principles

| Principle | Definition | Why It Exists |
|-----------|------------|---------------|
| **Feature-first architecture** | Code organized by business domain (`features/products/`), not by technical type at top level | Engineers find all product code in one place; modules can be owned by one developer |
| **Reusable components** | Shared UI in `components/`; domain-specific UI in `features/*/components/` | Visual consistency; DRY without coupling domains |
| **Server-first rendering** | Default Server Components for lists, details, dashboards | Faster initial load, smaller JS bundle, SEO-irrelevant but better security (secrets stay server-side) |
| **Business logic isolation** | All rules in `services/` and `utils/` (pure functions); never in components or repositories | Testable; identical behavior across UI surfaces; mirrors Android UseCase layer |
| **Repository pattern** | `repositories/` = Supabase I/O only; returns typed DTOs/domain models | Swappable data source; clear separation from business rules |
| **Service layer** | `services/` orchestrate repositories, RPCs, Edge Functions, activity logging | Single place for multi-step workflows (e.g., SaveBill) |
| **No duplicated logic** | `BillingCalculator`, permission guards, formatters live in `utils/` once | Prevents billing total drift between POS and reports |
| **Single responsibility** | One file = one concern (e.g., `product.repository.ts` only queries products) | Easier review, testing, and refactoring |
| **Composition over inheritance** | Compose shadcn primitives; no deep class hierarchies | React/TS idiomatic; flexible UI |
| **Strict typing** | `strict: true`; generated `database.types.ts`; Zod at boundaries | Catch errors at compile time; self-documenting APIs |
| **Server-side authorization** | Every Server Action checks role/permission before mutation | Client-side checks are UX only; never trusted |
| **Validation everywhere** | Zod (client + server), DB constraints, RPC validation | Defense in depth; user-friendly errors + data integrity |
| **Clean folder structure** | Identical module layout (Section 4) | Onboarding speed; code review predictability |
| **Consistency across modules** | Same list/filter/form/dialog patterns for every CRUD module | Users learn once; developers copy established patterns |

---

# SECTION 3 — Project Folder Structure

```
postrack-admin/                          # Next.js application root
├── app/
│   ├── (auth)/
│   │   ├── login/page.tsx               # Public login
│   │   └── inactive/page.tsx            # Tenant lockout screen
│   ├── (dashboard)/                     # Authenticated shell (sidebar layout)
│   │   ├── layout.tsx                   # AppShell: sidebar + topbar + main
│   │   ├── page.tsx                     # Dashboard (Admin only)
│   │   ├── products/
│   │   ├── categories/
│   │   ├── inventory/
│   │   ├── suppliers/
│   │   ├── purchases/
│   │   ├── billing/
│   │   ├── sales/
│   │   ├── sales/[id]/
│   │   ├── sales/[id]/return/
│   │   ├── customers/
│   │   ├── users/
│   │   ├── activity-log/
│   │   ├── transactions/
│   │   ├── accounts/
│   │   ├── account-categories/
│   │   ├── analytics/sales/
│   │   ├── analytics/purchases/
│   │   └── settings/business-profile/
│   ├── api/
│   │   └── uploads/
│   │       └── image/route.ts           # Cloudinary signed upload proxy
│   ├── layout.tsx                       # Root layout (fonts, providers)
│   ├── globals.css
│   └── not-found.tsx
│
├── components/
│   ├── ui/                              # shadcn/ui primitives (auto-generated)
│   ├── layout/                          # AppShell, Sidebar, Topbar, Breadcrumb, PageHeader
│   ├── data-table/                      # DataTable, columns helpers, pagination, toolbar
│   ├── forms/                           # FormField wrappers, CurrencyInput, BarcodeInput, etc.
│   ├── charts/                          # ChartCard, KpiCard, TrendChart wrappers
│   ├── dialogs/                         # ConfirmDialog, DeleteDialog, RestoreDialog
│   ├── feedback/                        # EmptyState, ErrorState, LoadingSkeleton, Toast
│   └── receipt/                         # ReceiptLayout, PrintLayout, InvoiceLayout
│
├── features/                            # Domain modules (see Section 4)
│   ├── auth/
│   ├── dashboard/
│   ├── products/
│   ├── categories/
│   ├── inventory/
│   ├── suppliers/
│   ├── purchases/
│   ├── billing/
│   ├── sales/
│   ├── returns/
│   ├── customers/
│   ├── users/
│   ├── activity-log/
│   ├── transactions/
│   ├── accounts/
│   ├── account-categories/
│   ├── analytics/
│   └── business-profile/
│
├── hooks/                               # Shared React hooks (useDebounce, useMediaQuery)
│   └── queries/                         # TanStack Query hooks per domain
│
├── repositories/                        # Supabase data access (one file per aggregate)
│   ├── products.repository.ts
│   ├── bills.repository.ts
│   ├── stock-in.repository.ts
│   ├── users.repository.ts
│   └── ...
│
├── services/                            # Business logic orchestration
│   ├── billing.service.ts
│   ├── product.service.ts
│   ├── stock-in.service.ts
│   ├── user.service.ts
│   └── ...
│
├── schemas/                             # Zod schemas (shared client + server)
│   ├── product.schema.ts
│   ├── bill.schema.ts
│   └── ...
│
├── types/
│   ├── database.types.ts                # Auto-generated from Supabase CLI
│   ├── domain/                          # Mapped domain types
│   ├── auth.ts                          # SessionUser, Role, Permission enums
│   └── api.ts                           # API response wrappers
│
├── lib/
│   ├── supabase/
│   │   ├── client.ts                    # Browser Supabase client
│   │   ├── server.ts                    # Server Supabase client (@supabase/ssr)
│   │   └── middleware.ts                # Middleware session refresh
│   ├── auth/
│   │   ├── session.ts                   # getSessionUser(), requireRole()
│   │   └── permissions.ts               # canAccessModule(), hasPermission()
│   └── activity-log.ts                  # logActivity() helper
│
├── utils/
│   ├── billing-calculator.ts            # Port of Android BillingCalculator
│   ├── currency.ts                      # formatCurrency(), parseCurrency()
│   ├── date.ts                          # formatDate(), dateRangePresets
│   ├── permissions.ts                   # Role matrix helpers
│   └── errors.ts                        # mapSupabaseError(), user-friendly messages
│
├── middleware.ts                        # Auth session refresh + route guards
│
├── public/
│   ├── fonts/
│   └── images/
│
├── styles/
│   └── print.css                        # @media print rules for receipts
│
├── tests/
│   ├── unit/
│   └── e2e/
│
├── .env.example
├── .env.local                           # gitignored
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
├── components.json                      # shadcn config
└── package.json
```

### Folder Purposes

| Folder | Purpose |
|--------|---------|
| `app/` | Next.js routes only — thin pages that compose feature components |
| `components/ui/` | shadcn primitives; never import domain logic |
| `components/layout/` | App shell, navigation, page scaffolding |
| `components/data-table/` | Generic table infrastructure |
| `components/forms/` | Reusable form controls with consistent validation wiring |
| `features/` | Domain-specific UI, hooks, and co-located components |
| `hooks/` | Cross-cutting React hooks |
| `repositories/` | Raw Supabase queries; no business rules |
| `services/` | Business workflows; calls repositories + RPCs + logs activity |
| `schemas/` | Zod definitions used by forms AND server actions |
| `types/` | TypeScript types; `database.types.ts` is generated |
| `lib/` | Framework integrations (Supabase, auth helpers) |
| `utils/` | Pure functions (calculators, formatters) |
| `middleware.ts` | Edge middleware for session |
| `public/` | Static assets |
| `styles/` | Global and print-specific CSS |
| `tests/` | Unit and E2E tests |

---

# SECTION 4 — Feature Module Standard

Every feature module under `features/<module>/` follows this structure. Route pages in `app/` import from here.

```
features/<module>/
├── components/
│   ├── <Module>Table.tsx          # List table (client)
│   ├── <Module>Filters.tsx        # Filter bar (client)
│   ├── <Module>Form.tsx           # Create/edit form (client)
│   ├── <Module>Details.tsx        # Detail view sections
│   ├── <Module>DeleteDialog.tsx   # Soft-delete confirmation
│   ├── <Module>RestoreDialog.tsx  # Restore confirmation (if applicable)
│   └── columns.tsx                # TanStack Table column definitions
├── hooks/
│   └── use-<module>.ts            # TanStack Query hooks
├── actions.ts                     # Server Actions (mutations)
├── service.ts                     # Re-export or thin wrapper → services/<module>.service.ts
├── repository.ts                  # Re-export or thin wrapper → repositories/<module>.repository.ts
├── schema.ts                      # Zod schemas for this module
├── types.ts                       # Module-specific TypeScript types
├── constants.ts                   # Module constants (status labels, filter options)
└── index.ts                       # Public API of the feature
```

### File Responsibilities

| File | Responsibility |
|------|----------------|
| `page.tsx` (in `app/`) | Server Component: fetch initial data, check permissions, render layout + feature components |
| `loading.tsx` | Suspense fallback skeleton for the route |
| `error.tsx` | Route-level error boundary |
| `actions.ts` | Server Actions: validate with Zod, check auth, call service, revalidate paths |
| `<Module>Table.tsx` | Client component: TanStack Table with sorting, pagination callbacks |
| `<Module>Filters.tsx` | Client component: filter controls synced to URL search params |
| `<Module>Form.tsx` | Client component: React Hook Form + Zod, submit via Server Action |
| `<Module>Details.tsx` | Detail panels (can be Server or Client depending on interactivity) |
| `<Module>DeleteDialog.tsx` | Confirm + call delete Server Action |
| `columns.tsx` | Column defs, cell renderers, action menu |
| `schema.ts` | Zod schemas: `createSchema`, `updateSchema`, `filterSchema` |
| `types.ts` | `Product`, `ProductListItem`, `ProductFilters`, etc. |
| `hooks/use-*.ts` | `useProducts`, `useProduct`, `useCreateProduct` (TanStack Query) |
| `service.ts` | Business logic entry points for this module |
| `repository.ts` | Supabase query functions for this module |

### Modules Requiring This Standard

| Module | Route Prefix | Notes |
|--------|-------------|-------|
| auth | `/login`, `/inactive` | No table; login form only |
| dashboard | `/` | KPI cards + charts; no CRUD |
| products | `/products` | Full standard + image upload |
| categories | `/categories` | Inline sheet form |
| inventory | `/inventory` | Read-only overview |
| suppliers | `/suppliers` | Full standard |
| purchases | `/purchases` | Custom line-item grid form |
| billing | `/billing` | 3-pane workspace; cart state |
| sales | `/sales` | List + detail; no create form |
| returns | `/sales/[id]/return` | Sub-flow of sales |
| customers | `/customers` | Full standard |
| users | `/users` | Edge Function mutations |
| activity-log | `/activity-log` | Read-only + export |
| transactions | `/transactions` | List + manual entry |
| accounts | `/accounts` | Full standard |
| account-categories | `/account-categories` | Full standard |
| analytics | `/analytics/*` | Read-only dashboards |
| business-profile | `/settings/business-profile` | Single-record edit form |

---

# SECTION 5 — Design System

All components live under `components/`. Domain-specific compositions live in `features/*/components/`. **One implementation per primitive — never duplicate.**

## 5.1 Form Controls

| Component | Path | Purpose |
|-----------|------|---------|
| `Button` | `ui/button` | Primary, secondary, destructive, ghost, link variants |
| `Input` | `ui/input` | Text input with error state |
| `Textarea` | `ui/textarea` | Multi-line text |
| `NumberInput` | `forms/number-input` | Numeric with min/max/step; blocks non-numeric keys |
| `CurrencyInput` | `forms/currency-input` | ₹ prefix, 2 decimal places, Indian formatting |
| `PhoneInput` | `forms/phone-input` | 10-digit Indian phone; digits only |
| `BarcodeInput` | `forms/barcode-input` | Auto-focus, scan-friendly; submits on Enter |
| `AddressInput` | `forms/address-input` | Textarea with optional structured fields |
| `Select` | `ui/select` | Native shadcn select |
| `Combobox` | `forms/combobox` | Searchable select (products, customers, suppliers) |
| `SearchInput` | `forms/search-input` | Debounced search with clear button |
| `DatePicker` | `forms/date-picker` | Single date; uses `react-day-picker` |
| `DateRangePicker` | `forms/date-range-picker` | Presets: Today, Week, Month, Custom |
| `FileUpload` | `forms/file-upload` | Drag-drop + click; image validation |
| `AvatarUpload` | `forms/avatar-upload` | Circular preview; business logo |
| `FormField` | `forms/form-field` | Label + control + error message wrapper |
| `Switch` | `ui/switch` | Boolean toggles (active status, show logo) |
| `Checkbox` | `ui/checkbox` | Multi-select permissions |

## 5.2 Display Components

| Component | Path | Purpose |
|-----------|------|---------|
| `StatusBadge` | `forms/status-badge` | Active/Inactive/Deleted/Paid/Partial/Unpaid/Returned |
| `KpiCard` | `charts/kpi-card` | Metric label + value + optional trend + icon |
| `ChartCard` | `charts/chart-card` | Card wrapper with title + Recharts chart |
| `Badge` | `ui/badge` | Generic labeled badge |
| `Avatar` | `ui/avatar` | User/business avatar with fallback initials |
| `Card` | `ui/card` | Section container |
| `Separator` | `ui/separator` | Visual divider |
| `Tooltip` | `ui/tooltip` | Hover explanations |
| `Timeline` | `feedback/timeline` | Stock movement history, activity log diffs |

## 5.3 Overlay Components

| Component | Path | Purpose |
|-----------|------|---------|
| `Sheet` | `ui/sheet` | Side drawer for add/edit forms |
| `Drawer` | `ui/drawer` | Bottom/side drawer (mobile fallback) |
| `Dialog` | `ui/dialog` | Modal dialog |
| `AlertDialog` | `ui/alert-dialog` | Destructive confirmation |
| `ConfirmDialog` | `dialogs/confirm-dialog` | Generic yes/no |
| `DeleteDialog` | `dialogs/delete-dialog` | Soft-delete with reason optional |
| `RestoreDialog` | `dialogs/restore-dialog` | Restore soft-deleted record |
| `Popover` | `ui/popover` | Dropdown panels |
| `DropdownMenu` | `ui/dropdown-menu` | Row action menus |

## 5.4 Data Display

| Component | Path | Purpose |
|-----------|------|---------|
| `DataTable` | `data-table/data-table` | TanStack Table wrapper: sorting, pagination, selection |
| `DataTableToolbar` | `data-table/toolbar` | Search + filters + export + add button |
| `DataTablePagination` | `data-table/pagination` | Page size, page nav, total count |
| `DataTableColumnHeader` | `data-table/column-header` | Sortable column header |
| `FilterPanel` | `data-table/filter-panel` | Collapsible advanced filters |
| `Pagination` | `ui/pagination` | Standalone pagination |

## 5.5 Layout Components

| Component | Path | Purpose |
|-----------|------|---------|
| `AppShell` | `layout/app-shell` | Sidebar + topbar + main content area |
| `Sidebar` | `layout/sidebar` | Collapsible nav with role-aware items |
| `SidebarNav` | `layout/sidebar-nav` | Nav groups and items |
| `Topbar` | `layout/topbar` | User menu, notifications placeholder, breadcrumb |
| `Breadcrumb` | `layout/breadcrumb` | Auto from route or manual |
| `PageHeader` | `layout/page-header` | Title + description + actions slot |
| `Tabs` | `ui/tabs` | Tab navigation within a page |
| `Accordion` | `ui/accordion` | Collapsible sections |

## 5.6 Feedback Components

| Component | Path | Purpose |
|-----------|------|---------|
| `Skeleton` | `ui/skeleton` | Loading placeholder |
| `LoadingSpinner` | `feedback/loading-spinner` | Inline spinner |
| `PageSkeleton` | `feedback/page-skeleton` | Full page loading state |
| `EmptyState` | `feedback/empty-state` | Icon + message + CTA |
| `ErrorState` | `feedback/error-state` | Error message + retry |
| `Toast` | `ui/sonner` | Success/error/warning notifications via sonner |
| `Alert` | `ui/alert` | Inline alert banners |

## 5.7 Print & Document Layouts

| Component | Path | Purpose |
|-----------|------|---------|
| `ReceiptLayout` | `receipt/receipt-layout` | Thermal-width (80mm) receipt for `window.print()` |
| `PrintLayout` | `receipt/print-layout` | Print wrapper with `@media print` styles |
| `InvoiceLayout` | `receipt/invoice-layout` | A4 invoice PDF layout |

---

# SECTION 6 — UI Standards

## 6.1 Spacing

- Base unit: **4px** (Tailwind default).
- Page padding: `p-6` (24px) on desktop; `p-4` on tablet.
- Card padding: `p-4` or `p-6`.
- Form field gap: `gap-4` between fields; `gap-6` between sections.
- Section gap: `space-y-6` between major page sections.
- Table cell padding: `px-4 py-3`.

## 6.2 Typography

| Element | Class | Usage |
|---------|-------|-------|
| Page title | `text-2xl font-semibold tracking-tight` | PageHeader title |
| Section title | `text-lg font-medium` | Card headers |
| Body | `text-sm` | Default text |
| Muted | `text-sm text-muted-foreground` | Secondary text |
| Table header | `text-xs font-medium uppercase text-muted-foreground` | Column headers |
| KPI value | `text-3xl font-bold` | Dashboard metrics |
| Monospace | `font-mono text-sm` | Bill numbers, barcodes |

Font: **Inter** (or system-ui fallback) via `next/font`.

## 6.3 Colors

Use shadcn CSS variables (supports dark mode):

| Token | Usage |
|-------|-------|
| `--primary` | Primary actions, active nav (brand: Cherry Red `#D2122E` mapped to primary) |
| `--destructive` | Delete, errors |
| `--muted` | Backgrounds, disabled |
| `--accent` | Hover states |
| Status colors | Semantic: green (success/active), amber (warning/low stock), red (error/out of stock), gray (inactive/deleted) |

## 6.4 Cards

- Use `Card` + `CardHeader` + `CardContent` for all content sections.
- KPI cards: no border on dashboard; subtle shadow `shadow-sm`.
- List pages: table inside Card with no padding on CardContent (table bleeds to edges).

## 6.5 Tables

- Sticky header on scroll.
- Zebra optional (not required; hover row highlight required).
- Row actions: `DropdownMenu` with icon button (⋮) at row end.
- Empty state centered in table body.
- Loading: 5-row skeleton.
- Pagination below table, right-aligned.
- Numeric columns: right-aligned.
- Currency columns: `formatCurrency()` utility.

## 6.6 Forms

- Labels above inputs (not inline/floating).
- Required fields: asterisk on label.
- Errors below field in `text-destructive text-xs`.
- Submit button: primary, right-aligned in footer.
- Cancel: ghost button, left of submit.
- Multi-column: `grid grid-cols-2 gap-4` on `lg:` breakpoint.
- Add/edit opens in **Sheet** (right side, 480px wide) for CRUD modules.
- Purchase and billing use full-page forms.

## 6.7 Dialogs

- Delete: `AlertDialog` with red confirm button.
- Restore: `AlertDialog` with default confirm.
- Confirm: `AlertDialog` with contextual message.
- Sheet for forms; Dialog for confirmations only.

## 6.8 Animations

- Sheet/dialog: shadcn default slide/fade (150–200ms).
- Page transitions: none (Next.js default).
- Toast: sonner slide-in.
- Skeleton: `animate-pulse`.
- No gratuitous animations.

## 6.9 Responsive Breakpoints

| Breakpoint | Width | Layout |
|------------|-------|--------|
| `sm` | 640px | Minimum supported |
| `md` | 768px | Tablet; sidebar collapses to icons |
| `lg` | 1024px | Desktop; 2-column forms |
| `xl` | 1280px | Wide desktop; 3-pane billing |
| `2xl` | 1536px | Max content width `1400px` centered |

## 6.10 Desktop Layouts

| Pattern | Used In |
|---------|---------|
| Sidebar + main | All authenticated pages |
| Master-detail (list + side panel) | Products, customers, suppliers, sales |
| 3-pane | POS billing |
| Full-width table | Activity log, transactions |
| Dashboard grid | Dashboard, analytics |

## 6.11 Accessibility

- WCAG 2.1 AA minimum.
- All interactive elements keyboard-focusable.
- `aria-label` on icon-only buttons.
- Form fields linked to labels via `htmlFor`/`id`.
- Color contrast ≥ 4.5:1 for text.
- Focus ring visible (`ring-2 ring-ring`).
- Screen reader announcements for toast notifications.

## 6.12 Keyboard Shortcuts

| Shortcut | Context | Action |
|----------|---------|--------|
| `/` | Billing | Focus product search |
| `Enter` | Billing search | Add first result |
| `Esc` | Billing | Clear search / close overlay |
| `Ctrl+S` / `Cmd+S` | Forms | Save (prevent browser save) |
| `g` then `d` | Global | Go to dashboard |
| `g` then `p` | Global | Go to products |
| `g` then `b` | Global | Go to billing |

## 6.13 Empty, Loading, Error, Success States

| State | Pattern |
|-------|---------|
| **Loading** | `PageSkeleton` for initial load; `Skeleton` rows in tables; button spinner on submit |
| **Empty** | `EmptyState` with icon, message, and CTA (e.g., "No products yet. Add your first product.") |
| **Error** | `ErrorState` with retry button; toast for action failures; inline field errors for validation |
| **Success** | Toast notification (sonner); redirect after create; inline success banner optional |

---

# SECTION 7 — Routing

## 7.1 Route Map

```
/                                    → Dashboard (Admin only) — redirect Staff/Manager appropriately
/login                               → Login (public)
/inactive                            → Inactive company lockout (public)

/products                            → Product list
/products/new                        → Add product (page or sheet)
/products/[id]                       → Product detail
/products/[id]/edit                  → Edit product

/categories                          → Category list + inline add/edit

/inventory                           → Inventory overview

/suppliers                           → Supplier list
/suppliers/new                       → Add supplier
/suppliers/[id]                      → Supplier detail
/suppliers/[id]/edit                 → Edit supplier

/purchases                           → Purchase (stock-in) list
/purchases/new                       → Create purchase
/purchases/[id]                      → Purchase detail

/billing                             → POS billing workspace

/sales                               → Bill history list
/sales/[id]                          → Bill detail
/sales/[id]/return                   → Process return

/customers                           → Customer list
/customers/new                       → Add customer
/customers/[id]                      → Customer detail + bill history
/customers/[id]/edit                 → Edit customer

/users                               → User list
/users/new                           → Add user
/users/[id]/edit                     → Edit user

/activity-log                        → Activity log

/transactions                        → Transaction list
/transactions/new                    → Manual entry

/accounts                            → Bank accounts list
/accounts/new                        → Add account
/accounts/[id]                       → Account detail + transactions
/accounts/[id]/edit                  → Edit account

/account-categories                  → Accounting categories

/analytics/sales                     → Sales analytics
/analytics/purchases                 → Purchase insights

/settings/business-profile           → Business profile edit
```

## 7.2 Routing Philosophy

1. **Route groups:** `(auth)` for public, `(dashboard)` for authenticated shell.
2. **URL as state:** List filters, pagination, and sort sync to `searchParams` for shareability.
3. **Thin pages:** `app/**/page.tsx` only composes feature components; no business logic.
4. **Co-located loading/error:** Every route has `loading.tsx` and `error.tsx`.
5. **RESTful URLs:** Standard resource patterns (`/products/[id]/edit`).
6. **No modal routes:** Forms use Sheets, not parallel routes (keeps implementation simple).
7. **Redirects:** `/` redirects Staff to their first permitted module; Manager to `/products` or `/billing`.

## 7.3 Middleware Route Guards

| Route Pattern | Guard |
|---------------|-------|
| `/login`, `/inactive` | Public; redirect to `/` if session exists |
| `/` | Admin only; others redirect |
| `/users`, `/activity-log` | Admin only |
| `/products`, `/suppliers`, `/purchases`, `/inventory` | Admin, Manager, Staff(stock_in) |
| `/billing`, `/sales/*` | Admin, Manager, Staff(stock_out) |
| All other dashboard routes | Admin, Manager |
| All routes | Session required; inactive company → `/inactive` |

---

# SECTION 8 — Permission Matrix

**Legend:** ✅ = allowed, ❌ = denied, — = not applicable

### 8.1 Module Access (View)

| Page / Module | Admin | Manager | Staff (stock_in) | Staff (stock_out) |
|---------------|-------|---------|------------------|-------------------|
| Dashboard `/` | ✅ | ❌ | ❌ | ❌ |
| Business Profile | ✅ | ✅ | ❌ | ❌ |
| Users | ✅ | ❌ | ❌ | ❌ |
| Activity Log | ✅ | ❌ | ❌ | ❌ |
| Categories | ✅ | ✅ | ❌ | ❌ |
| Products | ✅ | ✅ | ✅ | ❌ |
| Inventory Overview | ✅ | ✅ | ✅ | ❌ |
| Suppliers | ✅ | ✅ | ✅ | ❌ |
| Purchases | ✅ | ✅ | ✅ | ❌ |
| Customers | ✅ | ✅ | ❌ | ❌ |
| POS Billing | ✅ | ✅ | ❌ | ✅ |
| Sales / Bill History | ✅ | ✅ | ❌ | ✅ |
| Returns | ✅ | ✅ | ❌ | ✅ |
| Account Categories | ✅ | ✅ | ❌ | ❌ |
| Bank Accounts | ✅ | ✅ | ❌ | ❌ |
| Transactions | ✅ | ✅ | ❌ | ❌ |
| Sales Analytics | ✅ | ✅ | ❌ | ❌ |
| Purchase Insights | ✅ | ✅ | ❌ | ❌ |

### 8.2 Action Permissions

| Action | Admin | Manager | Staff (stock_in) | Staff (stock_out) |
|--------|-------|---------|------------------|-------------------|
| **Products: create/edit** | ✅ | ✅ | ✅ | ❌ |
| **Products: delete/restore** | ✅ | ❌ | ❌ | ❌ |
| **Products: toggle active** | ✅ | ✅ | ✅ | ❌ |
| **Categories: CRUD** | ✅ | ✅ | ❌ | ❌ |
| **Categories: delete** | ✅ | ❌ | ❌ | ❌ |
| **Suppliers: CRUD** | ✅ | ✅ | ✅ | ❌ |
| **Suppliers: delete** | ✅ | ❌ | ❌ | ❌ |
| **Purchases: create** | ✅ | ✅ | ✅ | ❌ |
| **Customers: CRUD** | ✅ | ✅ | ❌ | ❌ |
| **Billing: create** | ✅ | ✅ | ❌ | ✅ |
| **Billing: print/share** | ✅ | ✅ | ❌ | ✅ |
| **Sales: view** | ✅ | ✅ | ❌ | ✅ |
| **Returns: process** | ✅ | ✅ | ❌ | ✅ |
| **Users: manage** | ✅ | ❌ | ❌ | ❌ |
| **Activity log: view/export** | ✅ | ❌ | ❌ | ❌ |
| **Accounts: CRUD** | ✅ | ✅ | ❌ | ❌ |
| **Accounts: delete** | ✅ | ❌ | ❌ | ❌ |
| **Transactions: view** | ✅ | ✅ | ❌ | ❌ |
| **Transactions: manual entry** | ✅ | ✅ | ❌ | ❌ |
| **Transactions: edit/delete manual** | ✅ | ❌ | ❌ | ❌ |
| **Business profile: edit** | ✅ | ✅ | ❌ | ❌ |
| **Export (CSV/Excel)** | ✅ | ✅ | ❌ | ❌ |
| **Analytics: view** | ✅ | ✅ | ❌ | ❌ |

### 8.3 Enforcement Layers

| Layer | Implementation |
|-------|----------------|
| **Middleware** | `middleware.ts` — session check + coarse route guard by role |
| **Server** | `lib/auth/permissions.ts` — `requireRole()`, `requirePermission()` in every Server Action |
| **Database** | Supabase RLS — `get_my_role()`, `get_my_company_id()`, `has_granted_permission()` |
| **UI** | `usePermissions()` hook — hide sidebar items, disable buttons (UX only) |

---

# SECTION 9 — Database Layer

> Full schema reference: `POS-Billing-System/DATABASE_SCHEMA.md`

## 9.1 Entity List

| Entity | Table | Tenant-scoped | Soft Delete |
|--------|-------|---------------|-------------|
| Company | `companies` | — (is tenant) | `is_deleted` |
| User | `users` | `company_id` | `is_deleted` + `status` |
| User Permission | `user_permissions` | via `user_id` | — |
| Product Category | `product_categories` | `company_id` | `is_active` |
| Product | `products` | `company_id` | `is_deleted` + `is_active` |
| Product Batch | `product_batches` | via `product_id` | — |
| Supplier | `suppliers` | `company_id` | `is_deleted` |
| Customer | `customers` | `company_id` | `is_active` |
| Stock-In (Purchase) | `stock_in` | `company_id` | — (no delete policy) |
| Stock-In Item | `stock_in_items` | `company_id` | — |
| Stock Transaction | `stock_transactions` | `company_id` | append-only |
| Bill | `bills` | `company_id` | — (no delete policy) |
| Bill Item | `bill_items` | `company_id` | — |
| Bill Return | `bill_returns` | `company_id` | — |
| Bill Return Item | `bill_return_items` | `company_id` | — |
| Account | `accounts` | `company_id` | `is_active` |
| Entry (Transaction) | `entries` | `company_id` | `is_deleted` |
| Accounting Category | `accounting_categories` | `company_id` | `is_active` |
| Activity Log | `activity_log` | `company_id` | append-only |
| Tax | `taxes` | `company_id` | `is_active` |

## 9.2 Key Relationships

```
companies 1──N users
companies 1──N products, suppliers, customers, bills, stock_in, accounts, entries, ...
users 1──N user_permissions
users 1──N bills (created_by_user_id)
product_categories 1──N products
products 1──N product_batches, stock_transactions, bill_items, stock_in_items
suppliers ──N stock_in (supplier_id, not FK-enforced)
stock_in 1──N stock_in_items
bills 1──N bill_items
bills 1──N bill_returns
bill_returns 1──N bill_return_items
accounts 1──N entries
accounting_categories 1──N entries
customers 1──N bills
```

## 9.3 Indexes (Critical)

| Table | Index | Purpose |
|-------|-------|---------|
| All tenant tables | `idx_*_company_id` | RLS performance |
| `products` | `uq_products_company_barcode` (partial) | Barcode uniqueness per tenant |
| `customers` | `uq_customers_company_phone` | Phone uniqueness per tenant |
| `bills` | `uq_bills_company_bill_number` | Bill number uniqueness per tenant |
| `bill_returns` | `uq_bill_returns_company_return_number` | Return number uniqueness |
| `products` | `idx_products_is_deleted`, `idx_products_is_active` | Filter performance |
| `activity_log` | `idx_activity_log_company_created` | Log query performance |

## 9.4 Soft Delete Rules

| Entity | Mechanism | Restore | Notes |
|--------|-----------|---------|-------|
| Users | `is_deleted=true`, `status=Inactive` | `restore_user` RPC | Hard delete via Edge Function if no references |
| Products | `is_deleted=true` | `is_deleted=false` | Barcode remains reserved |
| Suppliers | `is_deleted=true` | `is_deleted=false` | Admin only |
| Customers | `is_active=false` | `is_active=true` | Not `is_deleted` column |
| Entries | `is_deleted=true` | Admin can un-delete manual entries | System entries never deleted |

## 9.5 Audit Columns

| Pattern | Columns | Tables |
|---------|---------|--------|
| Standard | `created_at`, `updated_at` | Most tables |
| User tracking | `created_by` | users, stock_in, product_categories, accounting_categories |
| Snapshot | `user_name`, `old_values`, `new_values` | activity_log |
| Bill snapshot | `product_name`, `barcode`, `unit_price` on bill_items | Immutable after insert |

## 9.6 Naming Conventions

| Context | Convention | Example |
|---------|------------|---------|
| Tables | `snake_case`, plural | `bill_items` |
| Columns | `snake_case` | `company_id`, `is_deleted` |
| RPCs | `snake_case` verb_noun | `create_stock_in` |
| Views | `snake_case` suffixed `_view` | `bill_history_sales_view` |
| TypeScript types | `PascalCase` | `Product`, `BillStatus` |
| Repository functions | `camelCase` verb | `getProducts`, `createBill` |
| Service functions | `camelCase` verb | `saveBill`, `processReturn` |

## 9.7 Repository Responsibilities

Repositories **ONLY**:
- Execute Supabase queries (`.from()`, `.rpc()`, `.select()`)
- Map snake_case DB rows to camelCase domain types
- Throw typed errors on failure (via `mapSupabaseError`)
- Accept typed filter/pagination params

Repositories **NEVER**:
- Calculate totals, discounts, or stock
- Check permissions (caller's responsibility)
- Log activity
- Call other repositories (services do orchestration)

## 9.8 Database Access Standards

1. **Use RPCs for atomic multi-table operations:** `create_stock_in`, `create_product_with_opening_stock`.
2. **Use views for joined list queries:** `bill_history_sales_view`, `transactions_list_view`.
3. **Never UPDATE `stock_quantity` directly during billing/purchase** — let triggers handle it.
4. **Direct UPDATE of `stock_quantity` only for manual adjustments** (product edit) — triggers log `ADJUSTMENT_IN/OUT`.
5. **Edge Functions for privileged ops:** user create/delete/password.
6. **Always pass authenticated Supabase client** — never use service role key in the web app.

---

# SECTION 10 — Service Layer

| Service | File | Responsibilities |
|---------|------|------------------|
| **AuthService** | `auth.service.ts` | Login, logout, session hydration, company-active check, permission loading |
| **BillingService** | `billing.service.ts` | Cart validation, customer resolution, discount/total calculation, save bill (header + items + accounting entry), bill status |
| **ProductService** | `product.service.ts` | Create with opening stock (RPC), update, soft delete, restore, search for billing |
| **StockInService** | `stock-in.service.ts` | Validate line items, merge duplicate rows, call `create_stock_in` RPC |
| **ReturnService** | `return.service.ts` | Validate return quantities, create return header + items, update bill status |
| **CustomerService** | `customer.service.ts` | CRUD, phone uniqueness check, search, auto-create on billing |
| **SupplierService** | `supplier.service.ts` | CRUD, soft delete, search |
| **CategoryService** | `category.service.ts` | CRUD, product count check before delete |
| **UserService** | `user.service.ts` | List, create (Edge Function), update, delete (Edge Function), restore (RPC), change password (Edge Function), last-admin guard |
| **AccountService** | `account.service.ts` | CRUD, balance calculation, default account logic |
| **TransactionService** | `transaction.service.ts` | List, manual entry create, edit/delete manual entries, totals (RPC) |
| **AccountingCategoryService** | `accounting-category.service.ts` | CRUD, type-filtered lists, block delete if entries exist |
| **DashboardService** | `dashboard.service.ts` | Fetch `get_admin_dashboard_totals` RPC, map to KPI models |
| **AnalyticsService** | `analytics.service.ts` | Sales analytics RPC, purchase insights queries |
| **InventoryService** | `inventory.service.ts` | Inventory overview aggregation, stock value calculation |
| **ActivityLogService** | `activity-log.service.ts` | List with filters, export, record log entries |
| **BusinessProfileService** | `business-profile.service.ts` | Get/update company profile, logo upload orchestration |
| **UploadService** | `upload.service.ts` | Image upload to Cloudinary via `/api/uploads/image` |

### Service Rules

1. Services are called by Server Actions and optionally by Server Components (read-only).
2. Services call repositories, RPCs, and Edge Functions — never Supabase directly.
3. Services record activity logs after successful mutations.
4. Services throw typed `AppError` subclasses for known business rule violations.
5. Pure calculations (billing totals) live in `utils/` and are called by services.

---

# SECTION 11 — Repository Layer

### Structure

One repository file per aggregate root:

```
repositories/
├── products.repository.ts
├── categories.repository.ts
├── suppliers.repository.ts
├── customers.repository.ts
├── stock-in.repository.ts
├── bills.repository.ts
├── returns.repository.ts
├── accounts.repository.ts
├── entries.repository.ts
├── accounting-categories.repository.ts
├── users.repository.ts
├── activity-log.repository.ts
├── companies.repository.ts
├── analytics.repository.ts
└── dashboard.repository.ts
```

### Example Signatures

```typescript
// repositories/products.repository.ts
getProducts(filters: ProductFilters, pagination: Pagination): Promise<PaginatedResult<Product>>
getProductById(id: string): Promise<Product | null>
getProductDetails(id: string): Promise<ProductDetails | null>  // RPC
searchProducts(query: string, options?: SearchOptions): Promise<Product[]>
getProductByBarcode(barcode: string): Promise<Product | null>
createProductWithOpeningStock(params: CreateProductParams): Promise<string>  // RPC
updateProduct(id: string, payload: ProductUpdatePayload): Promise<void>
softDeleteProduct(id: string): Promise<void>
restoreProduct(id: string): Promise<void>
getBatchesWithStock(productId: string): Promise<ProductBatch[]>  // RPC
```

### Rules

| DO | DON'T |
|----|-------|
| Return typed domain models | Return raw `any` or untyped JSON |
| Use generated `database.types.ts` | Hand-write DB column types |
| Throw `RepositoryError` on Supabase failures | Swallow errors |
| Accept `SupabaseClient` as parameter or inject | Create new clients inside repositories |
| Use views for complex joins | Join in application code |

---

# SECTION 12 — Validation Standards

## 12.1 Validation Layers

| Layer | Tool | When |
|-------|------|------|
| **Client (UX)** | Zod + React Hook Form `resolver` | Immediate field feedback on blur/submit |
| **Server (security)** | Same Zod schema in Server Actions | Every mutation; reject before service call |
| **Database** | CHECK constraints, UNIQUE, NOT NULL, FK | Last line of defense; never rely on alone |

## 12.2 Zod Schema Pattern

```typescript
// schemas/product.schema.ts
export const createProductSchema = z.object({
  name: z.string().min(1, 'Product name is required').max(200),
  barcode: z.string().max(50).optional().nullable(),
  purchasePrice: z.number().min(0).optional().nullable(),
  sellingPrice: z.number().min(0).optional().nullable(),
  mrp: z.number().min(0).optional().nullable(),
  unit: z.string().max(20).optional().nullable(),
  lowStockAlertQty: z.number().min(0).default(0),
  productCategoryId: z.string().uuid().optional().nullable(),
  openingStock: z.number().min(0).default(0),
  isActive: z.boolean().default(true),
})
```

## 12.3 Business Rule Validation (in Services)

| Rule | Where Validated |
|------|----------------|
| Barcode unique per company | Service pre-check + DB unique index |
| Phone unique per company | Service pre-check + DB unique index |
| Stock qty ≤ batch remaining | Service (billing) + DB trigger |
| Return qty ≤ sold - already returned | Service (pre-check) + DB trigger (enforce) |
| Cart not empty to save bill | Service |
| Payment account required | Service + Zod |
| At least 1 stock-in line item | Service + Zod |
| Last active admin cannot be deleted | Edge Function |
| Cannot delete self | Edge Function |
| Discount ≤ subtotal + other items | `BillingCalculator` |
| Received amount ≥ 0 | Zod |
| Selling price ≥ purchase price (warning, not block) | Client-side warning only |

## 12.4 Cross-Field Validation Examples

| Form | Rule |
|------|------|
| Billing | If payment mode = Mixed, `cashAmount + upiAmount` must equal `receivedAmount` |
| Billing | If discount type = PERCENT, value must be 0–100 |
| User create | If role = Staff, at least one permission should be granted (warning) |
| Product | If opening stock > 0 on create, account may be required (matches RPC) |
| Return | Each line return qty > 0 and ≤ returnable qty |

## 12.5 Error Mapping

`utils/errors.ts` maps Supabase/PostgREST errors to user-friendly messages:

| Postgres Code | User Message |
|---------------|-------------|
| `23505` (unique violation) | "A record with this {field} already exists" |
| `23503` (FK violation) | "Cannot delete: this record is referenced by other data" |
| `42501` (RLS violation) | "You do not have permission to perform this action" |
| Custom RPC errors | Pass through RPC error message |

---

# SECTION 13 — Data Fetching Strategy

## 13.1 Server Components (default for reads)

Use for: list pages (initial data), detail pages, dashboard, analytics.

```typescript
// app/(dashboard)/products/page.tsx
export default async function ProductsPage({ searchParams }) {
  const user = await requireAuth()
  requirePermission(user, 'products', 'view')
  const filters = parseProductFilters(searchParams)
  const initialData = await productService.getProducts(filters, { page: 1, pageSize: 20 })
  return <ProductList initialData={initialData} filters={filters} />
}
```

## 13.2 Client Components (interactive reads)

Use for: search-as-you-type, filter changes, pagination after initial load, cart, billing.

## 13.3 TanStack Query

| Pattern | Usage |
|---------|-------|
| `useQuery` | Client-side refetch, filter changes, detail pages after navigation |
| `useMutation` | Optimistic updates (toggle active, delete) |
| `useInfiniteQuery` | Bill history, activity log infinite scroll |
| `queryKey` | `['products', filters]` — filters in key for correct cache |
| `staleTime` | 30s for lists, 5min for reference data (categories, accounts) |
| `initialData` | Seed from Server Component props to avoid loading flash |

## 13.4 Caching & Revalidation

| Method | When |
|--------|------|
| `revalidatePath('/products')` | After product create/update/delete in Server Action |
| `revalidateTag('products')` | For shared reference data |
| TanStack `invalidateQueries` | After client-side mutations |
| `prefetchQuery` | On hover over table row link (optional optimization) |

## 13.5 Pagination

- **Server-side** for all lists (never load all rows).
- Default page size: 20. Options: 10, 20, 50, 100.
- Pass `offset` and `limit` to repositories.
- Return `{ data, total, page, pageSize }` from all list queries.

## 13.6 Filtering & Searching

- Filters stored in URL `searchParams` (e.g., `?search=apple&category=uuid&stock=low`).
- Debounce search input: 300ms (matches Android).
- Filter changes reset to page 1.

## 13.7 Streaming & Suspense

- `loading.tsx` per route for instant skeleton.
- Wrap slow Server Component sections in `<Suspense>` with targeted skeletons.
- Dashboard: stream KPI cards first, charts after.

---

# SECTION 14 — State Management

| State Type | Solution | Example |
|------------|----------|---------|
| **Global auth** | Server session via `@supabase/ssr` cookies; `getSessionUser()` in Server Components | User role, company_id |
| **Global UI** | React Context (minimal) | Sidebar collapsed state, theme |
| **Server data cache** | TanStack Query | Product list, bill history |
| **URL state** | `searchParams` / `useSearchParams` | Filters, pagination, sort |
| **Form state** | React Hook Form | All create/edit forms |
| **Cart state** | `localStorage` + React Context | POS billing cart (mirrors Android DataStore) |
| **Selection state** | Local `useState` | Table row selection, batch picker |
| **Modal/Sheet state** | Local `useState` | Open/close drawers |
| **Optimistic state** | TanStack Query `onMutate` | Toggle active, delete row |

### Cart State (Billing)

```typescript
// Persists to localStorage key: `postrack_cart_{companyId}`
interface CartState {
  items: CartItem[]
  customer: Customer | null
  customerName: string
  customerPhone: string
  paymentMode: PaymentMode
  mixedCashAmount: number
  mixedUpiAmount: number
  otherItemsPrice: number
  discountType: DiscountType
  discountValue: number
  selectedAccountId: string
}
```

Cart clears on successful bill save. Cart reloads from localStorage on page mount.

---

# SECTION 15 — Implementation Order

## Phase 1: Foundation

| # | Module | Deps | Complexity | Effort | Risk |
|---|--------|------|------------|--------|------|
| 1.1 | Project setup (Next.js, TS, Tailwind, shadcn) | — | Low | 1 day | Low |
| 1.2 | Supabase clients + `database.types.ts` generation | 1.1 | Low | 0.5 day | Low |
| 1.3 | Design system primitives (Section 5 core) | 1.1 | Medium | 2 days | Low |
| 1.4 | DataTable, FormField, PageHeader, EmptyState | 1.3 | Medium | 1 day | Low |

## Phase 2: Auth & Shell

| # | Module | Deps | Complexity | Effort | Risk |
|---|--------|------|------------|--------|------|
| 2.1 | Login page + session | 1.2 | Medium | 1 day | Medium (SSR session) |
| 2.2 | Middleware + route guards | 2.1 | Medium | 1 day | Medium |
| 2.3 | Inactive company page | 2.1 | Low | 0.5 day | Low |
| 2.4 | AppShell (sidebar + topbar) | 1.3, 2.2 | Medium | 1.5 days | Low |
| 2.5 | Permission utilities | 2.1 | Medium | 1 day | Low |

## Phase 3: Master Data

| # | Module | Deps | Complexity | Effort | Risk |
|---|--------|------|------------|--------|------|
| 3.1 | Product Categories | 2.4 | Low | 1 day | Low |
| 3.2 | Business Profile + logo upload | 2.4, 1.2 | Medium | 1.5 days | Medium (upload API) |
| 3.3 | User Management | 2.4, 2.5 | High | 3 days | High (Edge Functions) |
| 3.4 | Activity Log | 2.4 | Medium | 1.5 days | Low |

## Phase 4: Inventory

| # | Module | Deps | Complexity | Effort | Risk |
|---|--------|------|------------|--------|------|
| 4.1 | Products (list, add, edit, detail) | 3.1 | High | 4 days | High (RPC, image upload) |
| 4.2 | Inventory Overview | 4.1 | Medium | 1 day | Low |
| 4.3 | Suppliers | 2.4 | Medium | 2 days | Low |
| 4.4 | Purchases (stock-in) | 4.1, 4.3 | High | 3 days | High (RPC format) |

## Phase 5: Sales

| # | Module | Deps | Complexity | Effort | Risk |
|---|--------|------|------------|--------|------|
| 5.1 | Customers | 2.4 | Low | 1.5 days | Low |
| 5.2 | POS Billing | 4.1, 5.1 | **Very High** | 5 days | **Critical** (calculator, batches, cart) |
| 5.3 | Sales History | 5.2 | Medium | 2 days | Low |
| 5.4 | Returns | 5.3 | High | 2 days | High (qty validation, refund) |
| 5.5 | Receipt print/PDF | 5.2 | Medium | 1.5 days | Medium |

## Phase 6: Finance

| # | Module | Deps | Complexity | Effort | Risk |
|---|--------|------|------------|--------|------|
| 6.1 | Account Categories | 2.4 | Low | 1 day | Low |
| 6.2 | Bank Accounts | 6.1 | Medium | 2 days | Low |
| 6.3 | Transactions | 6.2 | Medium | 2 days | Low |

## Phase 7: Analytics & Dashboard

| # | Module | Deps | Complexity | Effort | Risk |
|---|--------|------|------------|--------|------|
| 7.1 | Dashboard | 5.2, 6.3 | Medium | 2 days | Low |
| 7.2 | Sales Analytics | 5.3 | Medium | 1.5 days | Low |
| 7.3 | Purchase Insights | 4.4 | Medium | 1 day | Low |
| 7.4 | Export (CSV/Excel) | 5.3, 4.4, 6.3 | Medium | 1.5 days | Low |

## Phase 8: Hardening

| # | Module | Deps | Complexity | Effort | Risk |
|---|--------|------|------------|--------|------|
| 8.1 | E2E tests (billing, return, stock-in) | Phase 5, 4 | High | 3 days | — |
| 8.2 | Accessibility audit | All | Medium | 1 day | — |
| 8.3 | Performance audit | All | Medium | 1 day | — |
| 8.4 | Security review | All | Medium | 1 day | — |

**Total estimated effort: ~45–50 developer-days (1 senior engineer ≈ 9–10 weeks)**

---

# SECTION 16 — UI Planning Before Development

**Gate rule:** No module implementation begins until its UI plan below is reviewed and approved.

For each module, produce a brief **Module UI Plan** document (can be a PR comment or `docs/ui-plans/<module>.md`) containing:

## 16.1 Template (apply to every module)

### Module: [Name]

**1. User Flow**
- Step-by-step user journey (entry → actions → exit)

**2. Wireframe Description**
- ASCII or prose layout description for desktop (primary) and tablet (fallback)

**3. Component Tree**
```
Page (Server)
└── PageHeader
└── [ModuleFilters] (client)
└── [ModuleTable] (client)
    └── columns.tsx
    └── [RowActions]
└── [ModuleForm] (Sheet, client)
└── [DeleteDialog]
```

**4. API Flow**
- List: Server Component → service → repository → Supabase view/table
- Create: Form → Server Action → Zod → service → repository/RPC → revalidate
- Delete: Dialog → Server Action → service → repository → revalidate

**5. Validation Flow**
- Client: Zod on blur/submit
- Server: Same Zod in Server Action
- DB: Constraints as backstop

**6. Permission Flow**
- Middleware: route guard
- Page: `requirePermission()` → redirect or 403
- UI: hide action buttons

**7–10. States**
- Loading: PageSkeleton / table skeleton rows
- Empty: EmptyState with CTA
- Success: Toast + redirect or inline update
- Error: Toast + field errors / ErrorState with retry

**11. Desktop Improvements over Android**
- Specific UX enhancements for this module

---

## 16.2 Module UI Plan Summaries

### Dashboard
- **Flow:** Land → view KPIs → click KPI card → navigate to filtered module
- **Layout:** 4-column KPI grid top; 2-column charts below; out-of-stock table right sidebar
- **Desktop:** Date refresh button; clickable KPI cards; larger charts

### Products
- **Flow:** List → search/filter → click row → detail panel OR edit sheet
- **Layout:** Full-width table; detail opens as right Sheet (600px) with tabs: Info, Stock, Batches, Movements, Financials
- **Desktop:** Master-detail split; inline active toggle; bulk actions toolbar

### POS Billing
- **Flow:** Search/scan → add to cart → adjust qty → select customer → set payment → review → save → print
- **Layout:** 3-pane: Catalog (300px) | Cart (flex) | Payment (350px)
- **Desktop:** Keyboard shortcuts; barcode input always focused; persistent cart; no bottom sheet

### Purchases
- **Flow:** List → New → fill header → add line items → save
- **Layout:** Header form top; editable line-item DataTable below; totals footer sticky
- **Desktop:** Spreadsheet-style grid; tab between cells; barcode scan to add line

### Sales / Returns
- **Flow:** List → filter → click bill → detail → return button → select items → confirm refund
- **Layout:** Master-detail for list; return as full page with line-item checkboxes
- **Desktop:** Side-by-side bill detail + return history; export button in toolbar

### Users
- **Flow:** List → add/edit in sheet → change password dialog → delete/restore confirm
- **Layout:** Table with role badges and permission chips; permissions matrix in edit form
- **Desktop:** Permission checkboxes as inline toggles; role filter chips

*(Full UI plans for remaining modules follow the same template during their respective milestones.)*

---

# SECTION 17 — Coding Standards

## 17.1 Naming

| Item | Convention | Example |
|------|------------|---------|
| Files (components) | `PascalCase.tsx` | `ProductTable.tsx` |
| Files (utilities) | `kebab-case.ts` | `billing-calculator.ts` |
| Files (hooks) | `use-kebab-case.ts` | `use-products.ts` |
| Components | `PascalCase` | `ProductForm` |
| Functions | `camelCase` | `getProducts` |
| Constants | `UPPER_SNAKE_CASE` | `DEFAULT_PAGE_SIZE` |
| Types/Interfaces | `PascalCase` | `Product`, `BillStatus` |
| Enums | `PascalCase` | `PaymentMode` |
| CSS classes | Tailwind utilities only | No custom CSS unless print styles |

## 17.2 Imports

Order: React → Next.js → third-party → `@/components` → `@/features` → `@/lib` → `@/utils` → `@/types` → relative.

Use `@/` path alias for all internal imports.

## 17.3 TypeScript Rules

- `strict: true` in `tsconfig.json`
- No `any`; use `unknown` and narrow
- No non-null assertions (`!`) unless justified with comment
- Prefer `interface` for object shapes; `type` for unions/intersections
- Use generated `Database` types from Supabase; map to domain types in repositories

## 17.4 Error Handling

```typescript
// Server Action pattern
export async function createProduct(data: unknown) {
  const user = await requireAuth()
  requirePermission(user, 'products', 'create')
  const parsed = createProductSchema.safeParse(data)
  if (!parsed.success) return { error: parsed.error.flatten() }
  try {
    const id = await productService.create(parsed.data, user)
    revalidatePath('/products')
    return { success: true, id }
  } catch (e) {
    return { error: mapError(e) }
  }
}
```

## 17.5 Server Actions

- One `actions.ts` per feature module.
- Always validate with Zod.
- Always check auth/permissions.
- Return `{ success, data }` or `{ error }` — never throw to client.
- Call `revalidatePath` or `revalidateTag` after mutations.

## 17.6 Comments

- No obvious comments (`// increment counter`).
- Comment non-obvious business rules with audit reference.
- JSDoc on public service/repository functions.

## 17.7 Hooks

- Query hooks in `features/<module>/hooks/` or `hooks/queries/`.
- Prefix with `use`.
- Never call Supabase directly in hooks — go through services or Server Actions.

---

# SECTION 18 — Git Standards

## 18.1 Branch Strategy

| Branch | Purpose |
|--------|---------|
| `main` | Production-ready |
| `develop` | Integration branch |
| `feature/<module>-<description>` | Feature work (e.g., `feature/products-list`) |
| `fix/<description>` | Bug fixes |
| `chore/<description>` | Tooling, deps |

## 18.2 Commit Messages

Format: `<type>(<scope>): <description>`

Types: `feat`, `fix`, `chore`, `docs`, `refactor`, `test`, `style`

Examples:
- `feat(products): add product list with filters and pagination`
- `fix(billing): correct mixed payment total calculation`
- `chore(deps): upgrade @supabase/ssr to latest`

## 18.3 Pull Request Checklist

- [ ] Follows Feature Module Standard (Section 4)
- [ ] Zod validation on client and server
- [ ] Permission checks in Server Actions
- [ ] Activity log recorded for mutations
- [ ] Loading, empty, error states implemented
- [ ] No `any` types
- [ ] No business logic in components or repositories
- [ ] Desktop layout verified at ≥1280px
- [ ] Tablet layout verified at ≥768px

## 18.4 Code Review Checklist

- [ ] Business logic matches audit canon (Section 1 and audit plan)
- [ ] No stock/finance calculations in client-only code
- [ ] RLS will enforce even if server check is bypassed
- [ ] No secrets in client bundle
- [ ] Error messages are user-friendly

## 18.5 Release Strategy

- Tag releases: `v1.0.0`, `v1.1.0`, etc.
- Deploy to Vercel (or equivalent) from `main`.
- Environment variables per environment (`.env.local`, staging, production).
- Database migrations applied via Supabase CLI before app deploy.

---

# SECTION 19 — Testing Strategy

## 19.1 Unit Tests (Vitest)

| Target | Priority |
|--------|----------|
| `utils/billing-calculator.ts` | **Critical** — must match Android exactly |
| `utils/currency.ts`, `utils/date.ts` | High |
| `services/*.ts` (with mocked repositories) | High |
| `schemas/*.ts` (Zod validation edge cases) | Medium |
| `lib/auth/permissions.ts` | High |

## 19.2 Integration Tests

- Server Actions with test Supabase instance (local or staging).
- RPC calls return expected shapes.
- RLS policies block unauthorized access.

## 19.3 E2E Tests (Playwright)

| Flow | Priority |
|------|----------|
| Login → dashboard | High |
| Create product with opening stock | High |
| Create purchase (stock-in) | High |
| Complete POS bill (cash payment) | **Critical** |
| Partial payment bill | High |
| Process bill return | **Critical** |
| Create manual transaction | Medium |
| User create + login as new user | Medium |

## 19.4 Critical Workflow Acceptance Criteria

### Billing
- [ ] Bill total = subtotal + other_items - discount (amount or percent)
- [ ] Stock deducted on save (catalog items only)
- [ ] Bill number auto-generated
- [ ] Accounting entry created for received amount
- [ ] Cart clears after save
- [ ] Batch qty enforced

### Returns
- [ ] Cannot return more than sold minus already returned
- [ ] Stock restored on return
- [ ] Bill status updated to RETURNED or PARTIAL_RETURN
- [ ] Return number auto-generated

### Stock-In
- [ ] Stock increased on save
- [ ] PURCHASE transaction logged
- [ ] Duplicate product+price rows merged

## 19.5 Definition of Done (per module)

- [ ] All CRUD operations work per permission matrix
- [ ] All four UI states implemented (loading, empty, error, success)
- [ ] Zod validation client + server
- [ ] Activity log entries recorded
- [ ] Desktop layout complete
- [ ] Unit tests for business logic
- [ ] PR reviewed and merged

---

# SECTION 20 — Performance Strategy

| Technique | Application |
|-----------|-------------|
| **Server Components** | Default for all read pages; zero client JS for static content |
| **Streaming** | `<Suspense>` boundaries on dashboard charts, product detail tabs |
| **TanStack Query caching** | `staleTime` tuned per data type; avoid refetch on window focus for heavy lists |
| **Server-side pagination** | Never fetch all rows; RPC aggregations for dashboard/analytics |
| **Virtualized tables** | `@tanstack/react-virtual` for tables >100 rows (activity log) |
| **Image optimization** | `next/image` for product images and logos; Cloudinary transforms |
| **Code splitting** | Dynamic import for Recharts, `@react-pdf/renderer` |
| **Bundle** | Analyze with `@next/bundle-analyzer`; target <200KB first-load JS |
| **Database** | Use views and RPCs; ensure `company_id` indexes exist |
| **Print CSS** | Separate `print.css`; no JS required for print layout |

---

# SECTION 21 — Security Strategy

| Threat | Mitigation |
|--------|------------|
| **Unauthorized access** | Middleware session check + Server Action permission check + RLS |
| **Cross-tenant data leak** | RLS `company_id = get_my_company_id()` on all tables; never accept `company_id` from client |
| **Privilege escalation** | Edge Functions verify caller role; `create-user` checks Admin |
| **SQL injection** | Supabase parameterized queries only; no raw SQL from app |
| **XSS** | React auto-escaping; sanitize any `dangerouslySetInnerHTML` (none expected) |
| **CSRF** | Server Actions use Next.js built-in CSRF protection |
| **Token exposure** | `@supabase/ssr` httpOnly cookies; no JWT in localStorage |
| **File upload attacks** | Validate MIME type, size limit (5MB), extension whitelist in `/api/uploads/image` |
| **Rate limiting** | Vercel/Cloudflare rate limits; Supabase Auth rate limits |
| **Service role key** | NEVER in client bundle; only in Edge Functions (already deployed) |
| **Inactive company bypass** | Check `companies.is_active` on login AND `is_my_company_active()` in RLS |
| **Sensitive data in logs** | Never log passwords, tokens, or full payment details |

---

# SECTION 22 — Future Scalability

The architecture supports these future modules without structural changes:

| Future Module | Extension Point |
|---------------|----------------|
| **Multi-branch** | Add `branches` table + `branch_id` on transactions; extend RLS |
| **Warehouse management** | New feature module; warehouse transfer RPC |
| **GST enhancements** | Link `taxes` to products/bill_items; tax columns on bills |
| **Purchase returns** | New feature module; mirror bill returns pattern |
| **Stock transfers** | New RPC; `stock_transactions` type `TRANSFER_OUT/IN` |
| **CRM** | Extend customers with leads, follow-ups; new feature module |
| **Advanced accounting** | P&L, balance sheet reports; new RPCs on `entries` |
| **API integrations** | Webhook Edge Functions; REST API route handlers |
| **Mobile sync** | Already shared Supabase backend; no web-specific changes needed |
| **Offline mode** | Service Worker + IndexedDB queue (major effort; not planned v1) |
| **Notifications** | Supabase Realtime or push; notification feature module |
| **Plugins/Custom modules** | Feature folder standard supports plug-in modules in sidebar |
| **Performance Analytics** | Already in Android (hidden); add as `/analytics/performance` |
| **Tax Management** | Already in Android (hidden); add as `/settings/taxes` when product-linked |

---

# SECTION 23 — Final Development Rules

## 23.1 Before Implementing Any Module

1. **Read this document** (MASTER_IMPLEMENTATION_PLAN.md).
2. **Read the audit canon** for the module's business rules.
3. **Read `DATABASE_SCHEMA.md`** for affected tables, RPCs, triggers.
4. **Produce Module UI Plan** (Section 16 template) and get approval.
5. **Identify** repository, service, schema, and component files to create.
6. **Only then** begin implementation.

## 23.2 During Implementation

- Follow the Feature Module Standard (Section 4) exactly.
- Use the Design System (Section 5) — no one-off UI primitives.
- Port business logic from audit canon to `services/` and `utils/` — do not invent rules.
- Record activity logs for all mutations.
- Validate with Zod on both client and server.
- Check permissions in every Server Action.

## 23.3 What Must NOT Change

- Stock flow (DB triggers and RPCs).
- Bill total calculation formulas.
- Payment status rules (PAID / PARTIALLY_PAID / PENDING).
- Return quantity validation.
- User delete/restore semantics.
- Tenant isolation (RLS).
- Bill/return number generation (server-side).
- Role and permission model.

## 23.4 What MAY Change (Desktop UX)

- Layout and navigation patterns.
- Component density and information architecture.
- Keyboard shortcuts and power-user workflows.
- Export formats (CSV, Excel, PDF).
- Chart types and dashboard arrangement.
- Form presentation (Sheet vs page, multi-column).
- Print layout (browser print vs PDF vs thermal CSS).

## 23.5 What Requires Explicit Product Approval

- New business rules not in the audit.
- Schema changes (new columns, tables).
- Features in Gap Analysis (Section 1 audit plan).
- Changes to calculation formulas.
- Relaxed permission rules.

---

# APPENDIX A — Business Rules Quick Reference

## Billing Calculator (must port exactly)

```
subtotal = sum(cartItem.unitPrice * cartItem.quantity)
discountAmount = discountType === PERCENT
  ? (subtotal + otherItems) * (discountValue / 100)
  : discountValue
totalPayable = subtotal + otherItems - discountAmount
status = received >= payable ? PAID
  : received > 0 ? PARTIALLY_PAID
  : PENDING
```

## Stock Flow (never bypass)

| Operation | Mechanism |
|-----------|-----------|
| Opening stock | `create_product_with_opening_stock()` RPC |
| Purchase | `create_stock_in()` RPC |
| Sale | INSERT bill_items → trigger |
| Return | INSERT bill_return_items → trigger |
| Manual adjust | UPDATE products.stock_quantity → trigger |

## RPC Inventory

| RPC | Used By |
|-----|---------|
| `create_product_with_opening_stock` | Products |
| `create_stock_in` | Purchases |
| `get_product_batches_with_stock` | Billing |
| `get_product_details` | Product detail |
| `get_admin_dashboard_totals` | Dashboard |
| `get_sales_analytics_summary` | Sales analytics |
| `get_transactions_totals` | Transactions |
| `get_manual_bill_product_id` | Billing (manual items) |
| `restore_user` | Users |

## Edge Functions

| Function | Used By |
|----------|---------|
| `create-user` | Users (create) |
| `delete-user` | Users (delete) |
| `change-user-password` | Users (password) |

---

# APPENDIX B — Environment Variables

```env
# .env.example
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...   # anon key only, never service_role
SUPABASE_SERVICE_ROLE_KEY=eyJ...       # server-side only, for Edge Function proxy if needed

# Cloudinary (server-side only)
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

**End of Master Implementation Plan**

*This document supersedes all prior planning artifacts for web admin panel development. The Android audit remains the behavioral source of truth for business rules.*
