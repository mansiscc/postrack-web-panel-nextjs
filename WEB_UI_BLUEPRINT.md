# POSTrack Web Admin Panel — UI/UX Blueprint

**Version:** 1.0  
**Date:** July 2026  
**Status:** Visual and interaction source of truth for all web development  
**Companion docs:** [MASTER_IMPLEMENTATION_PLAN.md](./MASTER_IMPLEMENTATION_PLAN.md), Android audit plan  
**Theme source:** Android `AppColors` in `POS-Billing-System/app/src/main/java/com/scc/posbillingsystem/ui/theme/Color.kt`

---

## Document Purpose

This blueprint defines **how every screen looks, behaves, and feels** in the POSTrack Next.js admin panel. Multiple developers building different modules must follow this document to achieve a perfectly consistent UI.

**Hierarchy of truth:**
1. Business behavior → Android audit + MASTER_IMPLEMENTATION_PLAN.md
2. Visual design → **this document**
3. Component implementation → shadcn/ui + shared components catalogued in MASTER_IMPLEMENTATION_PLAN Section 5

---

# SECTION 1 — Design Philosophy

## 1.1 Design Direction

The POSTrack admin panel should feel like a **modern B2B operations console** — the clarity of Stripe Dashboard, the speed of Linear, the polish of Vercel Dashboard, and the data density of Zoho Inventory / Odoo — while retaining POSTrack's **Cherry Red brand identity** from the Android app.

| Reference | What We Borrow |
|-----------|----------------|
| **Stripe Dashboard** | Clean KPI cards, restrained color, excellent table typography |
| **Linear** | Keyboard-first navigation, minimal chrome, fast transitions |
| **Vercel Dashboard** | Sidebar + content hierarchy, subtle borders, professional spacing |
| **Zoho Inventory / Odoo** | High-density ERP tables, filter toolbars, master-detail patterns |
| **POSTrack Android** | Cherry Red primary, surface gray backgrounds, role/status badge colors |

## 1.2 Core Characteristics

| Characteristic | Implementation |
|----------------|----------------|
| **Desktop-first** | Layouts designed at 1280px+; tablet is fallback; phone is out of scope for v1 |
| **High information density** | Tables show 15–20 rows; compact row height; minimal wasted whitespace |
| **Minimal visual clutter** | One primary action per view; secondary actions in menus; no decorative gradients |
| **Fast navigation** | Persistent sidebar; breadcrumbs; keyboard shortcuts; URL-synced filters |
| **Power-user friendly** | Keyboard shortcuts in billing; Tab through forms; bulk actions where applicable |
| **Professional B2B** | No playful illustrations; Lucide icons; restrained animation |
| **Clean typography** | Inter font; clear hierarchy; tabular numbers for currency/qty |
| **Consistent spacing** | 4px base grid only; no arbitrary margins |
| **Accessible** | WCAG 2.1 AA contrast; focus rings; screen reader labels |

## 1.3 Design Principles

1. **Content over chrome** — navigation and headers are compact; data fills the viewport.
2. **Scanability** — users find numbers, statuses, and actions without reading paragraphs.
3. **Predictability** — every list page looks and behaves the same; every form follows the same layout rules.
4. **Progressive disclosure** — filters collapse; detail opens in sheets; advanced options hidden until needed.
5. **Brand consistency** — Cherry Red (`#D2122E`) for primary actions and active states only; never overused.
6. **Fail gracefully** — every view has defined empty, loading, and error states (Section 16).

---

# SECTION 2 — Color System

All colors are ported from Android `AppColors`. Map to shadcn CSS variables in `globals.css`.

## 2.1 Brand & Primary

| Token | HEX | Usage |
|-------|-----|-------|
| `primary` | `#D2122E` | Primary buttons, active nav item, links, focus accent (Android `PrimaryRose`) |
| `primary-hover` | `#B01025` | Primary button hover (Android `GradientEnd`) |
| `primary-foreground` | `#FFFFFF` | Text on primary buttons |
| `primary-light` | `#FBE7E9` | Subtle primary backgrounds, selected row tint (Android `PrimaryTint`) |
| `primary-light-outline` | `#E85C6B` | Focused input border ring |
| `primary-muted` | `#D2122E` at 10% opacity (`#1AD2122E`) | Hover backgrounds on nav items (Android `PrimaryLight`) |

## 2.2 Semantic Colors

| Token | HEX | Usage |
|-------|-----|-------|
| `success` | `#10B981` | Positive trends, active status, paid (Android `Success`) |
| `success-foreground` | `#FFFFFF` | Text on success badges |
| `success-muted` | `#D1FAE5` | Success toast background (Android `ToastSuccessBg`) |
| `success-icon` | `#059669` | Success toast icon (Android `ToastSuccessIcon`) |
| `warning` | `#F59E0B` | Low stock, partial payment warnings (Android `Warning`) |
| `warning-muted` | `#FEF3C7` | Warning toast background (Android `ToastWarningBg`) |
| `warning-icon` | `#D97706` | Warning toast icon (Android `ToastWarningIcon`) |
| `destructive` | `#DC2626` | Delete, error, inactive (Android `ToastErrorIcon` / `StatusInactive`) |
| `destructive-muted` | `#FEE2E2` | Error toast background (Android `ToastErrorBg`) |
| `info` | `#2563EB` | Informational badges, manager role (Android `RoleManager`) |
| `info-muted` | `#E0F2FE` | Info badge background (Android `UnitBadgeBg`) |

## 2.3 Surfaces & Backgrounds

| Token | HEX | Usage |
|-------|-----|-------|
| `background` | `#F6F6F8` | Page background (Android `SurfaceVariant`) |
| `card` | `#FFFFFF` | Card, table, sidebar panel background (Android `LightBackground`) |
| `popover` | `#FFFFFF` | Dropdowns, menus, tooltips |
| `muted` | `#F6F6F8` | Subtle section backgrounds, filter bar |
| `accent` | `#FBE7E9` | Hover on list items, subtle highlights (Android `PrimaryTint`) |

## 2.4 Borders & Dividers

| Token | HEX | Usage |
|-------|-----|-------|
| `border` | `#D1D5DB` | Card borders, table borders, input borders (Android `BorderLight`) |
| `border-subtle` | `#E5E7EB` | Row dividers, skeleton base (Android `AnalyticsSkeletonBase`) |
| `input` | `#D1D5DB` | Default input border |
| `ring` | `#E85C6B` | Focus ring color (Android `PrimaryLightOutline`) |

## 2.5 Text

| Token | HEX | Usage |
|-------|-----|-------|
| `foreground` | `#0F172A` | Primary text (Android `LightText`) |
| `muted-foreground` | `#64748B` | Secondary text, captions, placeholders (Android `TextSecondary`) |
| `disabled-foreground` | `#94A3B8` | Disabled inputs and labels |

## 2.6 Navigation Chrome

| Token | HEX | Usage |
|-------|-----|-------|
| `sidebar-background` | `#FFFFFF` | Sidebar panel |
| `sidebar-border` | `#D1D5DB` | Right border of sidebar |
| `sidebar-foreground` | `#0F172A` | Default nav item text |
| `sidebar-muted` | `#64748B` | Nav group labels, collapsed tooltips |
| `sidebar-accent` | `#FBE7E9` | Nav item hover background |
| `sidebar-accent-foreground` | `#D2122E` | Active nav item text |
| `sidebar-active-indicator` | `#D2122E` | 3px left bar on active nav item |
| `topbar-background` | `#FFFFFF` | Top bar |
| `topbar-border` | `#D1D5DB` | Bottom border of topbar |

## 2.7 Analytics & Chart Colors

| Token | HEX | Usage |
|-------|-----|-------|
| `chart-1` | `#D2122E` | Primary series (sales) |
| `chart-2` | `#047857` | Secondary series (Android `AnalyticsGreen`) |
| `chart-3` | `#F97316` | Tertiary (Android `AnalyticsOrange`) |
| `chart-4` | `#5B21B6` | UPI / purple accent (Android `AnalyticsUpiAccent`) |
| `chart-5` | `#2563EB` | Card / online payments |

## 2.8 Dark Mode (Optional — Phase 8)

| Token | HEX | Maps From |
|-------|-----|-----------|
| `background` | `#121212` | Android `DarkBackground` |
| `card` | `#1A1A1A` | Android `DarkSurface` |
| `foreground` | `#F1F5F9` | Android `DarkText` |
| `border` | `#334155` | Android `DarkOutline` |
| `primary` | `#D2122E` | Unchanged |

## 2.9 shadcn CSS Variable Mapping

```css
:root {
  --background: 240 5% 97%;        /* #F6F6F8 */
  --foreground: 222 47% 11%;       /* #0F172A */
  --card: 0 0% 100%;               /* #FFFFFF */
  --primary: 351 83% 44%;          /* #D2122E */
  --primary-foreground: 0 0% 100%;
  --secondary: 351 73% 95%;         /* #FBE7E9 */
  --muted: 240 5% 97%;
  --muted-foreground: 215 16% 47%; /* #64748B */
  --accent: 351 73% 95%;
  --destructive: 0 72% 51%;        /* #DC2626 */
  --border: 220 9% 84%;            /* #D1D5DB */
  --ring: 353 73% 64%;             /* #E85C6B */
  --radius: 0.5rem;
}
```

---

# SECTION 3 — Typography System

## 3.1 Font Family

| Usage | Font | Fallback |
|-------|------|----------|
| All UI text | **Inter** | `system-ui, -apple-system, sans-serif` |
| Bill numbers, barcodes, monospace data | **Inter** with `font-variant-numeric: tabular-nums` | — |

Load via `next/font/google` — weights 400, 500, 600, 700.

## 3.2 Type Scale

| Role | Size | Weight | Line Height | Letter Spacing | Tailwind Class |
|------|------|--------|-------------|----------------|----------------|
| **Page title** | 24px / 1.5rem | 600 | 1.25 | -0.02em | `text-2xl font-semibold tracking-tight` |
| **Section title** | 18px / 1.125rem | 600 | 1.35 | -0.01em | `text-lg font-semibold` |
| **Card title** | 16px / 1rem | 600 | 1.4 | 0 | `text-base font-semibold` |
| **Body** | 14px / 0.875rem | 400 | 1.5 | 0 | `text-sm` |
| **Body medium** | 14px | 500 | 1.5 | 0 | `text-sm font-medium` |
| **Table header** | 12px / 0.75rem | 500 | 1.4 | 0.05em | `text-xs font-medium uppercase tracking-wide text-muted-foreground` |
| **Table cell** | 14px | 400 | 1.4 | 0 | `text-sm` |
| **Caption / helper** | 12px | 400 | 1.4 | 0 | `text-xs text-muted-foreground` |
| **KPI label** | 13px | 500 | 1.3 | 0.01em | `text-[13px] font-medium text-muted-foreground` |
| **KPI value** | 28px / 1.75rem | 700 | 1.1 | -0.02em | `text-[28px] font-bold tabular-nums` |
| **KPI delta** | 12px | 500 | 1.3 | 0 | `text-xs font-medium` |
| **Nav item** | 14px | 500 | 1.4 | 0 | `text-sm font-medium` |
| **Nav group label** | 11px | 600 | 1.3 | 0.08em | `text-[11px] font-semibold uppercase tracking-wider text-muted-foreground` |
| **Button** | 14px | 500 | 1 | 0 | `text-sm font-medium` |
| **Badge** | 12px | 500 | 1 | 0 | `text-xs font-medium` |

## 3.3 Typography Rules

- **Never** use more than 3 font sizes on one screen section.
- Currency and quantities always use `tabular-nums` for aligned columns.
- Page titles are sentence case: "Product categories", not "PRODUCT CATEGORIES".
- Table column headers are uppercase with wide tracking.
- Truncate long text with ellipsis; show full text in tooltip on hover.
- Maximum line width for prose/descriptions: `max-w-prose` (65ch).

---

# SECTION 4 — Layout System

## 4.1 Shell Dimensions

| Element | Expanded | Collapsed | Notes |
|---------|----------|-----------|-------|
| **Sidebar width** | `256px` (16rem) | `64px` (4rem) | Icon-only when collapsed |
| **Topbar height** | `56px` (3.5rem) | — | Fixed, always visible in dashboard shell |
| **Page max width** | `1440px` | — | Content centered with `mx-auto`; billing is full-bleed |
| **Content padding** | `24px` (1.5rem) | `16px` at `<1024px` | Applied to `<main>` inner wrapper |

## 4.2 Component Dimensions

| Element | Value |
|---------|-------|
| **Card padding** | `16px` compact cards; `24px` detail cards |
| **Card border radius** | `8px` (`rounded-lg`) |
| **Card shadow** | `shadow-sm` default; `shadow-none` when inside another card |
| **Form field gap** | `16px` between fields; `24px` between sections |
| **Form section gap** | `32px` between major form groups |
| **Grid gap (dashboard)** | `16px` between KPI cards; `24px` between sections |
| **Table row height** | `44px` default; `52px` when row has avatar/thumbnail |
| **Table header height** | `40px` |
| **Input height** | `40px` (`h-10`) |
| **Button height (default)** | `40px` (`h-10`) |
| **Button height (sm)** | `32px` (`h-8`) for table toolbars |
| **Button height (lg)** | `44px` (`h-11`) for login primary CTA |

## 4.3 Overlay Dimensions

| Element | Width | Notes |
|---------|-------|-------|
| **Sheet (form)** | `480px` | Standard add/edit drawer from right |
| **Sheet (detail)** | `600px` | Product detail, customer detail |
| **Sheet (wide)** | `720px` | User permissions, complex forms |
| **Dialog (confirm)** | `425px` max | Centered |
| **Dialog (wide)** | `560px` max | Batch selection, payment summary |
| **Popover** | `auto` min `200px` | Dropdown menus |
| **Command palette** | `560px` | Global search (future) |

## 4.4 Spacing Scale (Tailwind)

Use **only** these values: `0, 1, 2, 3, 4, 5, 6, 8, 10, 12, 16, 20, 24` (4px increments).

| Token | px | Usage |
|-------|-----|-------|
| `1` | 4px | Icon-to-label gap |
| `2` | 8px | Badge padding, tight groups |
| `3` | 12px | Button icon padding |
| `4` | 16px | Standard inner padding, field gaps |
| `6` | 24px | Section padding, page padding |
| `8` | 32px | Major section breaks |

## 4.5 Breakpoints

| Name | Min Width | Layout Behavior |
|------|-----------|-----------------|
| `sm` | 640px | Minimum supported width |
| `md` | 768px | Sidebar collapses to icons by default |
| `lg` | 1024px | 2-column forms; master-detail split begins |
| `xl` | 1280px | Full desktop layout; 3-pane billing |
| `2xl` | 1536px | Max content width enforced |

---

# SECTION 5 — Sidebar Design

## 5.1 Structure

```
┌──────────────────────────┐
│  [Logo]  POSTrack        │  ← Logo area (56px height)
│  Acme Store              │  ← Company name (truncated)
├──────────────────────────┤
│  HOME                    │  ← Group label
│  ● Dashboard             │
│                          │
│  SALES                   │
│    POS Billing           │
│    Sales History         │
│                          │
│  INVENTORY               │
│    Products              │
│    Categories            │
│    Inventory Overview    │
│    Suppliers             │
│    Purchases             │
│                          │
│  FINANCE                 │
│    Transactions          │
│    Account Categories    │
│    Bank Accounts         │
│                          │
│  MANAGEMENT              │
│    Customers             │
│    Users                 │
│    Activity Log          │
│    Business Profile      │
│                          │
│  REPORTS                 │
│    Sales Analytics       │
│    Purchase Insights     │
│                          │
│  (flex spacer)           │
├──────────────────────────┤
│  [Avatar] John Admin     │  ← User footer (56px height)
│  Admin ▾                 │
└──────────────────────────┘
```

## 5.2 Logo Area

- Height: `56px`; padding `16px`.
- Logo: business logo from `companies.logo_url` if set; else POSTrack wordmark.
- Logo max size: `32px` height.
- Company name: `text-sm font-medium`; truncate with tooltip if long.
- Collapsed: logo icon only, centered; company name hidden; tooltip on hover.

## 5.3 Navigation Groups

| Group | Items | Visible To |
|-------|-------|------------|
| **Home** | Dashboard | Admin only |
| **Sales** | POS Billing, Sales History | Admin, Manager, Staff(stock_out) |
| **Inventory** | Products, Categories, Inventory Overview, Suppliers, Purchases | Admin, Manager, Staff(stock_in) |
| **Finance** | Transactions, Account Categories, Bank Accounts | Admin, Manager |
| **Management** | Customers, Users, Activity Log, Business Profile | Per permission matrix |
| **Reports** | Sales Analytics, Purchase Insights | Admin, Manager |

Items not permitted for the current user are **hidden**, not disabled.

## 5.4 Nav Item Anatomy

```
[Icon 20px] [Label]                    ← default
▌[Icon] [Label]  ← primary bg tint     ← active (3px left bar #D2122E)
```

| State | Background | Text | Left Bar |
|-------|------------|------|----------|
| Default | transparent | `#0F172A` | none |
| Hover | `#FBE7E9` | `#0F172A` | none |
| Active | `#FBE7E9` | `#D2122E` | 3px `#D2122E` |
| Disabled | — | hidden | — |

- Item height: `36px`; padding `8px 12px`; border-radius `6px`.
- Icon size: `20px` (Lucide); stroke width 1.75.
- Group label: `11px uppercase`; padding `16px 12px 4px`; not clickable.

## 5.5 Collapsed Behavior

- Width: `64px`.
- Labels hidden; icons centered.
- Tooltips appear on hover (right side, 200ms delay).
- Group labels hidden.
- Toggle: chevron button at bottom of logo area OR `Cmd+B` shortcut.

## 5.6 Scroll Behavior

- Nav items scroll independently if content exceeds viewport.
- Logo area and user footer are **sticky** (never scroll away).

## 5.7 User Footer

- Avatar: `32px` circle; initials fallback.
- Name: `text-sm font-medium`; truncate.
- Role badge: `text-xs` pill (Admin = cherry, Manager = blue, Staff = gray).
- Click opens dropdown: Profile (future), Business Profile link, Log out.
- Collapsed: avatar only with dropdown.

## 5.8 Icons (Lucide)

| Item | Icon |
|------|------|
| Dashboard | `LayoutDashboard` |
| POS Billing | `ScanLine` |
| Sales History | `Receipt` |
| Products | `Package` |
| Categories | `Tags` |
| Inventory Overview | `Warehouse` |
| Suppliers | `Truck` |
| Purchases | `ShoppingBag` |
| Transactions | `ArrowLeftRight` |
| Account Categories | `FolderTree` |
| Bank Accounts | `Landmark` |
| Customers | `Users` |
| Users | `UserCog` |
| Activity Log | `ScrollText` |
| Business Profile | `Building2` |
| Sales Analytics | `TrendingUp` |
| Purchase Insights | `BarChart3` |

---

# SECTION 6 — Topbar Design

## 6.1 Structure

```
┌─────────────────────────────────────────────────────────────────────────┐
│ [≡ mobile]  Dashboard  /  Products          [🔍 Search...]  [🔔] [Avatar] │
└─────────────────────────────────────────────────────────────────────────┘
```

- Height: `56px`.
- Background: `#FFFFFF`; bottom border `1px #D1D5DB`.
- Padding: `0 24px`.

## 6.2 Breadcrumb

- Left-aligned after mobile menu trigger.
- Format: `Section / Page` or `Section / Page / Detail`.
- Separator: `/` in `muted-foreground`.
- Current page: `font-medium text-foreground`.
- Ancestors: `text-muted-foreground` clickable links.
- Max 4 levels; truncate middle with `...` if deeper.

## 6.3 Global Search (Phase 2+)

- Width: `320px`; placeholder "Search products, bills, customers…".
- Icon: `Search` left-aligned inside input.
- Shortcut badge: `⌘K` right-aligned (muted).
- Phase 1: hidden or disabled placeholder.

## 6.4 Notification Icon

- Bell icon; badge dot for future alerts.
- Phase 1: visible but disabled with tooltip "Coming soon".

## 6.5 User Menu

- Avatar `32px` (duplicate of sidebar footer on desktop — topbar avatar for quick access).
- Dropdown: User name, email, role, divider, Log out.
- Desktop: sidebar footer is primary; topbar avatar optional (can mirror sidebar).

## 6.6 Company Switch Placeholder

- Not in v1 (single tenant per session).
- Reserve space: building icon + company name dropdown disabled with tooltip "Multi-branch coming soon".

## 6.7 Mobile Menu Trigger

- Visible only `<1024px`.
- Hamburger icon opens sidebar as overlay sheet from left.
- Overlay backdrop: `black/40`.

---

# SECTION 7 — Dashboard Layout

**Access:** Admin only. **Route:** `/`

## 7.1 Desktop Layout (≥1280px)

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Dashboard                                    Today, Jul 21  [Refresh] │
├─────────────────────────────────────────────────────────────────────────┤
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌──────┐│
│  │ Bills   │ │ Sales   │ │ Purchase│ │ Income  │ │ Expense │ │Profit││
│  │   12    │ │ ₹24,500 │ │ ₹8,200  │ │ ₹500    │ │ ₹1,200  │ │₹15.6k││
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘ └─────────┘ └──────┘│
├─────────────────────────────────────────────────────────────────────────┤
│  ┌──────────────────────────────┐  ┌─────────────────────────────────┐│
│  │  Sales Profit Summary        │  │  Payment Breakdown              ││
│  │  Revenue  COGS  Profit  Margin│  │  [Cash] [UPI] [Card]            ││
│  │  ₹24.5k  ₹15k  ₹9.5k  38.8% │  │  bar chart                      ││
│  └──────────────────────────────┘  └─────────────────────────────────┘│
├─────────────────────────────────────────────────────────────────────────┤
│  ┌──────────────────────────────┐  ┌─────────────────────────────────┐│
│  │  Refunds Today               │  │  Inventory Alerts               ││
│  │  2 returns · ₹1,200          │  │  142 products · 8 low · 3 out  ││
│  └──────────────────────────────┘  └─────────────────────────────────┘│
├─────────────────────────────────────────────────────────────────────────┤
│  Out of Stock Products (10 max)                    [View all products →]│
│  ┌─────────────────────────────────────────────────────────────────────┐│
│  │ Product name          │ Stock │                    [View product]  ││
│  └─────────────────────────────────────────────────────────────────────┘│
├─────────────────────────────────────────────────────────────────────────┤
│  Quick Actions:  [Products] [Sales] [Purchases] [Transactions]         │
└─────────────────────────────────────────────────────────────────────────┘
```

## 7.2 KPI Card Grid

- Row 1: 6 cards — Bills count, Today's sales, Purchase, Extra income, Other expense, Today's profit.
- Grid: `grid-cols-6 gap-4` at xl; `grid-cols-3` at lg; `grid-cols-2` at md.
- Card: white bg, `p-4`, no shadow, `border border-border`.
- KPI cards are **clickable** — navigate to filtered module (e.g., Sales → `/sales?date=today`).

## 7.3 Chart Placement

- Row 2 left (60%): Sales profit summary — 4 mini metrics + optional sparkline.
- Row 2 right (40%): Payment breakdown — horizontal bar or donut (Cash / UPI / Card).

## 7.4 Inventory & Refunds

- Row 3: two equal cards side by side.
- Inventory card: total products, low stock count (warning color), out of stock count (destructive color), inactive count (muted).

## 7.5 Out-of-Stock Table

- Compact table, max 10 rows from RPC.
- Columns: Product name, Stock qty (0 in red), Action link.
- "View all" links to `/products?stock=out`.

## 7.6 Quick Actions

- Row of outline buttons below tables.
- Links: Products, Sales, Purchases, Transactions (with today's filter).

## 7.7 Date Controls

- Top right: "Today, {date}" label + refresh icon button.
- Phase 1: today only (matches Android).
- Future: date picker for historical dashboard.

---

# SECTION 8 — Data Table Standards

Every list page (products, customers, sales, etc.) uses the same table pattern.

## 8.1 Table Container

- Wrapped in `Card` with `overflow-hidden`.
- No padding on card content — table bleeds to edges.
- Toolbar sits **above** card, not inside.

## 8.2 Toolbar Layout

```
┌─────────────────────────────────────────────────────────────────────────┐
│ [🔍 Search...          ] [Category ▾] [Status ▾] [Stock ▾]   [Export] [+ Add] │
└─────────────────────────────────────────────────────────────────────────┘
```

- Search: left; min width `240px`; debounce 300ms.
- Filters: center-left; dropdown/chip style.
- Export: ghost button, right side (Admin/Manager only).
- Primary action (+ Add): primary button, far right.

## 8.3 Table Header

- Sticky: `sticky top-0 z-10 bg-card`.
- Background: `#FAFAFA` (slightly off-white) or `muted/50`.
- Height: `40px`.
- Sortable columns: click header → toggle asc/desc; chevron icon.
- Non-sortable: no chevron.

## 8.4 Table Rows

- Height: `44px` (52px if thumbnail column).
- Border-bottom: `1px solid #E5E7EB`.
- Hover: `bg-accent/50` (`#FBE7E9` at 50%).
- Selected: `bg-primary-light` (`#FBE7E9`).
- Click row → navigate to detail OR open detail sheet (module-specific).

## 8.5 Row Selection

- Checkbox column: `40px` wide; header selects all on page.
- Bulk action bar appears sticky bottom when ≥1 selected (Phase 2+).

## 8.6 Action Menu

- Last column: `48px`; `MoreHorizontal` icon button (ghost, sm).
- Dropdown: Edit, Delete/Restore, module-specific actions.
- Destructive actions in red at bottom of menu with divider above.

## 8.7 Status Badges in Tables

- Pill shape: `rounded-full px-2 py-0.5 text-xs font-medium`.
- See Section 15 for colors.

## 8.8 Pagination

- Below table, inside card footer area.
- Right-aligned: "Showing 1–20 of 142" + page size select (10/20/50/100) + prev/next.
- Height: `48px`; padding `0 16px`; top border.

## 8.9 Empty State

- Centered in table body area (min height `240px`).
- See Section 16.

## 8.10 Loading Skeleton

- 8 skeleton rows matching column layout.
- Pulse animation on `#E5E7EB` / `#F3F4F6` (Android skeleton colors).

---

# SECTION 9 — Form Standards

## 9.1 Label Placement

- **Above** the input, always.
- Label: `text-sm font-medium text-foreground`.
- Required: red asterisk `*` after label text (`text-destructive`).
- Optional: "(optional)" in muted caption after label.

## 9.2 Input Specifications

| Property | Value |
|----------|-------|
| Height | `40px` |
| Border | `1px solid #D1D5DB` |
| Border radius | `6px` |
| Padding | `8px 12px` |
| Font size | `14px` |
| Focus border | `#E85C6B` |
| Focus ring | `2px #E85C6B` at 20% opacity |
| Error border | `#DC2626` |
| Disabled bg | `#F6F6F8` |

## 9.3 Error Messages

- Position: directly below input.
- Style: `text-xs text-destructive mt-1`.
- Icon: optional `AlertCircle` 12px before text.
- Show on blur (first touch) and on submit.

## 9.4 Multi-Column Layouts

| Breakpoint | Columns |
|------------|---------|
| `<1024px` | 1 column |
| `≥1024px` | 2 columns (`grid-cols-2 gap-4`) |
| `≥1280px` | 2–3 columns for wide forms (product add) |

- Full-width fields: name, address, notes, description span all columns.

## 9.5 Section Grouping

```
┌─ Basic Information ─────────────────────┐
│  Name          Barcode                  │
│  Category      Unit                     │
└─────────────────────────────────────────┘

┌─ Pricing ───────────────────────────────┐
│  Purchase price   Selling price   MRP   │
└─────────────────────────────────────────┘
```

- Section header: `text-base font-semibold` with bottom border or subtle bg.
- Section gap: `32px`.

## 9.6 Save / Cancel Placement

- **Sheet forms:** sticky footer at bottom of sheet.
  - Cancel (ghost, left) | Save (primary, right).
  - Footer height: `64px`; border-top; padding `16px 24px`.
- **Full-page forms:** sticky bottom bar or top-right of page header.
- Save button shows spinner when submitting; disabled while loading.

## 9.7 Sheet vs Full-Page Rules

| Use Sheet (480–600px) | Use Full Page |
|-----------------------|---------------|
| Add/edit category | POS billing |
| Add/edit customer | Purchase entry |
| Add/edit supplier | Business profile |
| Add/edit account | Manual transaction entry |
| Edit user | Return flow |
| Product add/edit (600px sheet) | Login |
| Quick product edit | |

## 9.8 Inline Validation

- Validate on blur for individual fields.
- Validate all on submit.
- Scroll to first error field on submit failure.
- Success: close sheet + toast + table refresh.

---

# SECTION 10 — Dialog & Drawer Standards

## 10.1 Delete Confirmation Dialog

- Width: `425px`.
- Icon: `AlertTriangle` in destructive circle (48px).
- Title: "Delete {entity name}?"
- Body: consequence text (soft delete vs hard delete for users).
- Buttons: Cancel (outline) | Delete (destructive, right).
- Enter key: Cancel (never confirm delete on Enter).

## 10.2 Restore Dialog

- Same structure as delete.
- Icon: `RotateCcw` in success circle.
- Confirm button: primary (not destructive).

## 10.3 Generic Confirmation

- Width: `425px`.
- No icon or neutral icon.
- Used for: "Clear cart?", "Waive remaining balance?"

## 10.4 Right-Side Sheet

- Overlay: `black/50`.
- Panel slides from right.
- Width: 480px (standard), 600px (detail), 720px (wide).
- Header: title + close X; height `56px`; border-bottom.
- Body: scrollable; padding `24px`.
- Footer: sticky; see Section 9.6.
- Animation: `300ms ease-out` slide; overlay fade `200ms`.

## 10.5 Full-Screen Modal

- Use only for: receipt preview, print preview.
- Close: X top-right + Escape key.

## 10.6 Animation Durations

| Element | Duration | Easing |
|---------|----------|--------|
| Sheet slide | 300ms | ease-out |
| Dialog fade/zoom | 200ms | ease-out |
| Overlay fade | 200ms | ease |
| Dropdown | 150ms | ease |
| Toast | 300ms slide-in | ease-out |
| Tooltip | 200ms delay + 150ms fade | — |

---

# SECTION 11 — Product Module UI

**Route:** `/products`, `/products/[id]`

## 11.1 Product List Page

```
PageHeader: "Products"                    [+ Add Product]
Toolbar: [Search] [Category ▾] [Stock ▾] [Status ▾]        [Export]
┌──────────────────────────────────────────────────────────────────────┐
│ □ │ Image │ Name      │ Category │ Barcode  │ Stock │ Price  │ Status │ ⋮ │
│   │ thumb │ Mango     │ Fruits   │ 8901234  │ 42    │ ₹120   │ Active │   │
└──────────────────────────────────────────────────────────────────────┘
Pagination
```

- Thumbnail: `40px` square, rounded, object-cover; placeholder package icon.
- Stock column: red text if 0; amber if ≤ low_stock_alert_qty.
- Click row → open detail sheet (600px) from right.

## 11.2 Filters

| Filter | Type | Options |
|--------|------|---------|
| Search | Text | Name or barcode |
| Category | Select | All + category list |
| Stock | Select | All, In stock, Low stock, Out of stock |
| Status | Select | Active, Inactive, Deleted |

## 11.3 Product Detail Sheet (600px)

Tabs: **Overview** | **Stock & Batches** | **Movement History** | **Financials**

**Overview tab:**
- Image (large), name, barcode, category, unit, status badge.
- Pricing row: purchase, selling, MRP.
- Edit button → switches to edit mode or opens edit sheet.

**Stock summary cards (4-up grid):**
- Opening | Received | Sold | Returned | Current (highlighted).

## 11.4 Edit Sheet

- Same fields as Android audit spec.
- Image upload area: dashed border dropzone, 120px height, preview on upload.
- Barcode field with scan icon (focuses for HID scanner).
- Opening stock field: create only; disabled on edit.
- Active toggle switch.

## 11.5 Image Upload Area

```
┌─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─┐
│      [Upload icon]           │
│   Drop image or click        │
│   PNG, JPG up to 5MB         │
└─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─┘
```

- After upload: preview with Remove link overlay.
- Uploading: progress bar inside area.

## 11.6 Movement History Section

- Timeline or table: Date, Type (OPENING/PURCHASE/SALE/RETURN/ADJUSTMENT), Qty (+/-), Reference.
- Color: green for +, red for -.
- Paginated, 20 per page.

## 11.7 Batch Table

- Columns: Batch name, Remaining qty, Purchase price, Selling price, MRP.
- Shown in Stock & Batches tab.

---

# SECTION 12 — POS Billing UI

**Route:** `/billing`  
**Layout:** Full-bleed 3-pane workspace (no max-width constraint).

## 12.1 Desktop Layout (≥1280px)

```
┌──────────────┬─────────────────────────────────────┬───────────────────┐
│  CATALOG     │  CART                               │  PAYMENT          │
│  280px       │  flex-1                             │  360px            │
├──────────────┼─────────────────────────────────────┼───────────────────┤
│ [Barcode/    │  Cart (3 items)          [Clear all]│  Customer         │
│  Search...]  │  ┌────────────────────────────────┐│  [Walk-in ▾]      │
│              │  │ Item │ Qty │ Price │ Total │ ⋮ ││                   │
│ [All] [Cat1] │  │ ...                            ││  Discount         │
│ [Cat2]       │  └────────────────────────────────┘│  [Amount ▾] [___] │
│              │  [+ Manual item]                    │                   │
│ ┌──────────┐ │                                     │  Other items ₹    │
│ │ Product  │ │  Subtotal:              ₹1,240.00   │  [___________]    │
│ │ ₹120     │ │                                     │                   │
│ │ Stock:42 │ │                                     │  Payment mode     │
│ └──────────┘ │                                     │  ○Cash ○UPI ○Card │
│ ┌──────────┐ │                                     │  ○ Mixed          │
│ │ Product  │ │                                     │                   │
│ └──────────┘ │                                     │  Received ₹       │
│              │                                     │  [___________]    │
│              │                                     │  Account ▾        │
│              │                                     │  ─────────────    │
│              │                                     │  Total:  ₹1,180   │
│              │                                     │  Received: ₹1,200 │
│              │                                     │  Change:   ₹20    │
│              │                                     │                   │
│              │                                     │  [Review & Save]  │
│              │                                     │  Shortcut hints   │
└──────────────┴─────────────────────────────────────┴───────────────────┘
```

## 12.2 Left Pane — Catalog

- Barcode/search input: **always focused** on page load; autofocus returns after add.
- Category chips: horizontal scroll below search.
- Product cards: compact list (not grid); name, price, stock badge.
- Click product → add to cart (batch sheet if multiple batches).
- Empty search: "Type to search or scan barcode".

## 12.3 Center Pane — Cart

- Line items table: name, qty stepper (-/input/+), unit price (read-only), row total, remove.
- Manual item row: dashed border inline form.
- Subtotal sticky at bottom of cart pane.
- Clear all: confirmation dialog.

## 12.4 Right Pane — Payment

- Sections separated by `border-b` with `16px` padding each.
- Customer: combobox search by phone/name; Walk-in default; inline name/phone fields.
- Discount: type toggle (₹ / %) + amount input; live total update.
- Payment mode: radio button group (4 options).
- Mixed: show Cash + UPI split inputs.
- Received amount: currency input; auto-calculates change/remaining.
- Remaining > 0: show "Partial payment" badge (warning color).
- Account selector: required; defaults to default account.
- **Review & Save** button: primary, full width, `h-11`.
- Below button: keyboard hint text in `text-xs muted`.

## 12.5 Batch Selector

- Dialog (560px) when product has multiple batches.
- Table: Batch name, Remaining qty, Price; radio select.
- Confirm adds to cart with selected batch.

## 12.6 Keyboard Shortcuts (displayed in footer of payment pane)

| Key | Action |
|-----|--------|
| `/` | Focus search |
| `Enter` | Add selected product |
| `Esc` | Clear search |
| `Ctrl+Enter` | Review & save |

## 12.7 Post-Save Flow

- Success dialog: Print receipt | Download PDF | Share WhatsApp | New bill.
- Cart clears; focus returns to search.

---

# SECTION 13 — Purchase Entry UI

**Route:** `/purchases/new`

## 13.1 Layout (Full Page)

```
PageHeader: "New Purchase"                    [Cancel] [Save Purchase]
┌─ Header ──────────────────────────────────────────────────────────────┐
│  Date          Supplier ▾         Invoice #        Account ▾         │
│  [21/07/2026]  [Walk-in ▾]        [________]       [Cash in Hand ▾]   │
│  Notes: [________________________________________________________]     │
└───────────────────────────────────────────────────────────────────────┘
┌─ Line Items ───────────────────────────────────────────── [+ Add row]─┐
│ Product ▾    │ Batch  │ Pur.₹ │ Sell ₹ │ MRP │ Qty │ Total  │ ⋮       │
│ Mango        │ B001   │ 80    │ 120    │ 150 │ 10  │ ₹800   │ ✕       │
│ [empty row for new entry]                                              │
└───────────────────────────────────────────────────────────────────────┘
┌─ Footer (sticky) ──────────────────────────────────────────────────────┐
│  Total items: 10                    Grand total: ₹800.00  [Save]      │
└───────────────────────────────────────────────────────────────────────┘
```

## 13.2 Header Fields

- Single row, 4 columns at xl; 2 columns at lg.
- Date: date picker, default today.
- Supplier: combobox, optional (Walk-in when empty).
- Invoice #: optional text.
- Account: required select, default account pre-selected.
- Notes: full-width textarea, 2 rows max.

## 13.3 Line Item Grid

- Editable cells: Tab/Enter moves between cells.
- Product: combobox with search; barcode scan fills product.
- Price fields: auto-fill from product catalog on product select.
- Qty: integer input; min 1.
- Total: auto-calculated, read-only.
- Duplicate product+price tuple merges qty (toast: "Quantity updated").
- Remove row: X icon or Delete key when row focused.

## 13.4 Add Row

- "+ Add row" appends empty editable row at bottom.
- Barcode scan in empty product cell adds product directly.

## 13.5 Sticky Footer

- Fixed at bottom of viewport.
- Shows total items count + grand total.
- Save button: primary; disabled if no items or invalid rows.

---

# SECTION 14 — Analytics UI

**Routes:** `/analytics/sales`, `/analytics/purchases`

## 14.1 Shared Analytics Layout

```
PageHeader: "Sales Analytics"
Date range: [Today] [This week] [This month] [Custom ▾]     [Export]
┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐
│ KPI 1  │ │ KPI 2  │ │ KPI 3  │ │ KPI 4  │
└────────┘ └────────┘ └────────┘ └────────┘
┌─────────────────────────────┐ ┌──────────────────────┐
│  Sales Trend (line chart)   │ │  Payment Breakdown   │
│  height: 320px              │ │  (donut, 240px)      │
└─────────────────────────────┘ └──────────────────────┘
┌───────────────────────────────────────────────────────┐
│  Top Products / Top Suppliers table                   │
└───────────────────────────────────────────────────────┘
```

## 14.2 KPI Cards (Sales)

- Total sales, Bill count, Returns amount, Gross profit, COGS, Profit margin, Items sold.
- 4-up grid at xl; 2-up at md.

## 14.3 Chart Sizes

| Chart | Height | Width |
|-------|--------|-------|
| Trend line | 320px | 65% of content |
| Payment donut | 240px | 35% of content |
| Purchase trend | 320px | full width |

## 14.4 Top Tables

- Columns: Rank, Name, Qty/Amount, Revenue/Spend.
- Top 10 rows; no pagination.
- Rank 1–3: subtle background tints (gold `#FFF9C4`, silver `#F5F5F5`, bronze `#FCE4EC` — from Android analytics colors).

## 14.5 Tablet Fallback (768–1279px)

- KPI cards: 2 columns.
- Charts stack vertically (trend full width, then donut).
- Table full width below.

---

# SECTION 15 — Status & Feedback System

## 15.1 Status Badges

All badges: `inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium`

| Status | Background | Text | Dot |
|--------|------------|------|-----|
| **Active** | `#D1FAE5` | `#047857` | `#10B981` |
| **Inactive** | `#FEE2E2` | `#DC2626` | `#DC2626` |
| **Deleted** | `#F3F4F6` | `#6B7280` | `#9CA3AF` |
| **Paid** | `#D1FAE5` | `#047857` | — |
| **Partial** (PARTIALLY_PAID) | `#FEF3C7` | `#D97706` | — |
| **Pending** | `#FEF3C7` | `#D97706` | — |
| **Returned** | `#FEE2E2` | `#DC2626` | — |
| **Partial Return** | `#F5F3FF` | `#7C3AED` | — |
| **Low stock** | `#FEF3C7` | `#D97706` | — |
| **Out of stock** | `#FEE2E2` | `#DC2626` | — |

## 15.2 Role Badges

| Role | Background | Text |
|------|------------|------|
| Admin | `#FBE7E9` | `#D2122E` |
| Manager | `#DBEAFE` | `#2563EB` |
| Staff | `#F3F4F6` | `#64748B` |

## 15.3 Toast Notifications (sonner)

| Type | Icon Color | Background |
|------|------------|------------|
| Success | `#059669` | `#D1FAE5` |
| Error | `#DC2626` | `#FEE2E2` |
| Warning | `#D97706` | `#FEF3C7` |
| Info | `#2563EB` | `#DBEAFE` |

- Position: bottom-right, 16px offset.
- Duration: 4s success, 6s error, dismissible.
- Max visible: 3 stacked.

## 15.4 Inline Alerts

- Form-level errors: `Alert` component, destructive variant, above form footer.
- Page-level errors: `ErrorState` component (Section 16).

---

# SECTION 16 — Empty, Loading & Error States

## 16.1 Empty State Pattern

```
        [Icon 48px, muted]
        Title (text-lg font-semibold)
        Description (text-sm muted, max-w-sm centered)
        [Primary CTA button]
```

## 16.2 Per-Module Empty States

| Page | Icon | Title | Description | CTA |
|------|------|-------|-------------|-----|
| Products | `Package` | No products yet | Add your first product to start selling. | Add product |
| Sales | `Receipt` | No bills found | Create a bill or adjust your filters. | New bill |
| Purchases | `ShoppingBag` | No purchases yet | Record your first stock-in entry. | New purchase |
| Customers | `Users` | No customers yet | Add customers to track purchase history. | Add customer |
| Suppliers | `Truck` | No suppliers yet | Add suppliers for purchase tracking. | Add supplier |
| Users | `UserCog` | No users yet | Add team members to your store. | Add user |
| Activity log | `ScrollText` | No activity recorded | Actions will appear here as your team works. | — |
| Transactions | `ArrowLeftRight` | No transactions yet | Add a manual entry or complete a sale. | Add entry |
| Dashboard | — | Welcome to POSTrack | Complete setup to see your dashboard. | Business profile |
| Billing cart | `ShoppingCart` | Cart is empty | Search or scan products to begin. | — |

## 16.3 Loading States

| Context | Pattern |
|---------|---------|
| Full page | `PageSkeleton`: header skeleton + 8-row table skeleton |
| Table refresh | Skeleton rows replace table body; header stays |
| KPI cards | 4–6 skeleton cards, pulse |
| Form submit | Button spinner + disabled fields |
| Image upload | Progress bar in upload area |
| Chart | Gray rectangle 320px pulse |

## 16.4 Error States

| Context | Pattern |
|---------|---------|
| Full page load fail | `ErrorState`: AlertTriangle icon, "Something went wrong", Retry button |
| Table load fail | Inline banner above table, destructive, Retry link |
| Form submit fail | Toast (error) + inline alert if validation |
| 403 Forbidden | Full page: Lock icon, "You don't have access", link to home |
| 404 | Not found page with link to dashboard |
| Network offline | Toast warning, persistent until reconnect |

---

# SECTION 17 — Responsive Behavior

## 17.1 At 1536px (`2xl`)

- Max content width `1440px` centered (except billing).
- Dashboard: 6 KPI columns.
- Billing: full 3-pane.
- Product detail sheet: 600px with room for content behind.

## 17.2 At 1280px (`xl`)

- Standard desktop layout — primary design target.
- Dashboard: 6 KPI columns (tight) or 4+2 wrap.
- Billing: 3-pane with 280/360px side panes.
- Forms: 2 columns.

## 17.3 At 1024px (`lg`)

- Sidebar: collapsed to icons by default (user can expand).
- Dashboard: 3-column KPI grid.
- Billing: 2-pane (catalog hidden in toggle tab; cart + payment side by side).
- Master-detail: list full width; detail opens as sheet.
- Forms: 2 columns.

## 17.4 At 768px (`md`)

- Sidebar: hidden; hamburger opens overlay sheet.
- Topbar: mobile menu trigger visible.
- Dashboard: 2-column KPI; charts stack.
- Billing: single pane with tabs (Catalog | Cart | Payment).
- Tables: horizontal scroll with sticky first column.
- Forms: 1 column.
- Purchase entry: header stacks; line grid horizontal scroll.

## 17.5 Below 768px

- Not optimized for v1.
- Show banner: "For best experience, use a tablet or desktop."

---

# SECTION 18 — Animation & Interaction Guidelines

## 18.1 Principles

- **Subtle and fast** — nothing over 300ms except sheet slide.
- **Purpose-driven** — animation confirms action, never decorates.
- **Respect prefers-reduced-motion** — disable all non-essential animation.

## 18.2 Interactions

| Interaction | Behavior |
|-------------|----------|
| Button hover | Background darkens 5%; `150ms` |
| Button active | Scale `0.98`; `100ms` |
| Nav item hover | Background `#FBE7E9`; `150ms` |
| Table row hover | Background accent/50; instant |
| Card hover (clickable KPI) | Border color → primary-light-outline; `150ms` |
| Input focus | Border + ring transition `150ms` |
| Switch toggle | Standard shadcn animation |
| Skeleton | Pulse `2s` infinite |
| Toast enter | Slide from bottom + fade `300ms` |
| Toast exit | Fade out `200ms` |
| Sheet | Slide from right `300ms ease-out` |
| Dialog | Fade + zoom from 95% `200ms` |
| Dropdown | Fade + slide down `150ms` |
| Page transition | None (Next.js default) |

---

# SECTION 19 — Accessibility Guidelines

## 19.1 Contrast

- Normal text on white: minimum **4.5:1** (primary text `#0F172A` = 16.1:1 ✓).
- Muted text `#64748B` on white: 4.6:1 ✓.
- Primary button white on `#D2122E`: 5.2:1 ✓.
- Never use `#E85C6B` for small text on white (insufficient contrast) — use for borders/rings only.

## 19.2 Focus Ring

- All interactive elements: `ring-2 ring-ring ring-offset-2 ring-offset-background`.
- Ring color: `#E85C6B`.
- Never remove focus outlines without replacement.

## 19.3 Keyboard Navigation

- Tab order follows visual order.
- Sidebar: arrow keys navigate items (optional enhancement).
- Tables: row focus with Enter to open detail.
- Modals: trap focus; Escape closes.
- Billing: full shortcut set (Section 12.6).

## 19.4 Screen Reader Labels

- Icon-only buttons: `aria-label` required.
- Status badges: text content readable (not color-only).
- Sort buttons: `aria-sort="ascending|descending|none"`.
- Loading: `aria-busy="true"` on loading containers.
- Toast: `role="status"` for success; `role="alert"` for errors.

## 19.5 Table Accessibility

- `<table>`, `<thead>`, `<tbody>`, `<th scope="col">` semantics.
- Sortable headers are `<button>` inside `<th>`.
- Row actions menu: `aria-haspopup="menu"`.

## 19.6 Form Accessibility

- Every input has `<label htmlFor>` or `aria-label`.
- Error messages linked via `aria-describedby`.
- Required fields: `aria-required="true"`.
- Fieldsets with legends for radio groups (payment mode).

## 19.7 Dialog Accessibility

- `role="alertdialog"` for destructive confirms.
- Focus first focusable element on open (Cancel, not Confirm).
- Return focus to trigger on close.

---

# SECTION 20 — Final UI Rules

From this point onward, every developer and every AI assistant working on the POSTrack web admin panel must follow these rules without exception.

## 20.1 Mandatory

1. **Follow this blueprint** for all visual and interaction decisions.
2. **Use colors from Section 2 only** — map through shadcn CSS variables; no ad-hoc hex values.
3. **Use spacing from Section 4 only** — Tailwind spacing scale; no arbitrary values like `p-[13px]`.
4. **Use typography from Section 3 only** — no custom font sizes outside the scale.
5. **Use shared components** from MASTER_IMPLEMENTATION_PLAN Section 5 — never duplicate primitives.
6. **Follow table standards** (Section 8) on every list page.
7. **Follow form standards** (Section 9) on every form.
8. **Implement all four states** (loading, empty, error, success) on every page.
9. **Desktop-first layout** at 1280px as primary target.
10. **Business logic unchanged** from audit — UI improvements only.

## 20.2 Prohibited

1. Custom colors outside the design system.
2. Custom spacing outside the 4px grid.
3. Module-specific button styles, table styles, or form layouts.
4. Mobile-first layouts that compromise desktop density.
5. Decorative animations, gradients, or illustrations.
6. Multiple primary action buttons on one screen section.
7. Modal-on-modal stacking more than 1 level deep.
8. Inline styles (`style={{}}`) except for dynamic chart dimensions.
9. Tailwind arbitrary values for colors/spacing (`bg-[#ff0000]`, `mt-[13px]`).
10. Skipping empty or loading states ("we'll add later").

## 20.3 Approval Required For

1. New color tokens not in Section 2.
2. New component primitives not in the design system catalog.
3. Module-specific layout patterns deviating from Sections 11–14.
4. New animation patterns.
5. Dark mode token changes.

## 20.4 Pre-Implementation Checklist (Per Module)

- [ ] Read this blueprint section for the module.
- [ ] Read MASTER_IMPLEMENTATION_PLAN Section 16 UI plan template.
- [ ] Confirm colors, spacing, typography against Sections 2–4.
- [ ] Wireframe matches Section 11–14 (if applicable).
- [ ] All four UI states designed.
- [ ] Permission-based UI hiding documented.
- [ ] Review approved before coding begins.

---

**End of Web UI Blueprint**

*Visual source of truth for POSTrack Next.js Admin Panel. Companion to MASTER_IMPLEMENTATION_PLAN.md.*
