import type { LucideIcon } from "lucide-react";
import {
  ArrowLeftRight,
  BarChart3,
  Building2,
  FolderTree,
  Landmark,
  LayoutDashboard,
  Package,
  Receipt,
  ScanLine,
  ScrollText,
  ShoppingBag,
  Tags,
  TrendingUp,
  Truck,
  UserCog,
  Users,
  Warehouse,
} from "lucide-react";

import type { ModuleKey, SessionUser } from "@/types/auth";
import { canAccessModule } from "@/utils/permissions";

export type NavItem = {
  module: ModuleKey;
  label: string;
  href: string;
  icon: LucideIcon;
};

export type NavGroup = {
  label: string;
  items: NavItem[];
};

export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Home",
    items: [
      {
        module: "dashboard",
        label: "Dashboard",
        href: "/",
        icon: LayoutDashboard,
      },
    ],
  },
  {
    label: "Sales",
    items: [
      { module: "billing", label: "POS Billing", href: "/billing", icon: ScanLine },
      {
        module: "sales",
        label: "Sales / Bill History",
        href: "/sales",
        icon: Receipt,
      },
    ],
  },
  {
    label: "Inventory & Procurement",
    items: [
      { module: "products", label: "Products", href: "/products", icon: Package },
      {
        module: "categories",
        label: "Product Categories",
        href: "/categories",
        icon: Tags,
      },
      {
        module: "inventory",
        label: "Inventory Overview",
        href: "/inventory",
        icon: Warehouse,
      },
      {
        module: "suppliers",
        label: "Supplier Management",
        href: "/suppliers",
        icon: Truck,
      },
      {
        module: "purchases",
        label: "Purchase Management",
        href: "/purchases",
        icon: ShoppingBag,
      },
    ],
  },
  {
    label: "Management",
    items: [
      { module: "users", label: "User Management", href: "/users", icon: UserCog },
      {
        module: "activity-log",
        label: "Activity Log",
        href: "/activity-log",
        icon: ScrollText,
      },
      {
        module: "customers",
        label: "Customer Management",
        href: "/customers",
        icon: Users,
      },
      {
        module: "business-profile",
        label: "Business Profile",
        href: "/settings/business-profile",
        icon: Building2,
      },
    ],
  },
  {
    label: "Finance",
    items: [
      {
        module: "transactions",
        label: "Transactions",
        href: "/transactions",
        icon: ArrowLeftRight,
      },
      {
        module: "account-categories",
        label: "Account Categories",
        href: "/account-categories",
        icon: FolderTree,
      },
      {
        module: "accounts",
        label: "Bank Accounts",
        href: "/accounts",
        icon: Landmark,
      },
    ],
  },
  {
    label: "Reports",
    items: [
      {
        module: "analytics",
        label: "Sales Analytics",
        href: "/analytics/sales",
        icon: TrendingUp,
      },
      {
        module: "analytics",
        label: "Purchase Insights",
        href: "/analytics/purchases",
        icon: BarChart3,
      },
    ],
  },
];

export function getNavGroupsForUser(user: SessionUser): NavGroup[] {
  return NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) =>
      canAccessModule(user.role, user.permissions, item.module),
    ),
  })).filter((group) => group.items.length > 0);
}
