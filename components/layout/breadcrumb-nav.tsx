"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LABELS: Record<string, string> = {
  "": "Dashboard",
  products: "Products",
  categories: "Categories",
  inventory: "Inventory Overview",
  suppliers: "Suppliers",
  purchases: "Purchases",
  billing: "POS Billing",
  sales: "Sales History",
  customers: "Customers",
  users: "Users",
  "activity-log": "Activity Log",
  transactions: "Transactions",
  accounts: "Bank Accounts",
  "account-categories": "Account Categories",
  analytics: "Analytics",
  settings: "Settings",
  "business-profile": "Business Profile",
};

export function BreadcrumbNav() {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);

  if (segments.length === 0) {
    return (
      <nav aria-label="Breadcrumb" className="text-sm">
        <span className="font-medium text-foreground">Dashboard</span>
      </nav>
    );
  }

  const crumbs = segments.map((segment, index) => {
    const href = `/${segments.slice(0, index + 1).join("/")}`;
    const label = LABELS[segment] ?? segment.replace(/-/g, " ");
    const isLast = index === segments.length - 1;
    return { href, label, isLast };
  });

  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-sm">
      <Link href="/" className="text-muted-foreground hover:text-foreground">
        Dashboard
      </Link>
      {crumbs.map((crumb) => (
        <span key={crumb.href} className="flex items-center gap-2">
          <span className="text-muted-foreground">/</span>
          {crumb.isLast ? (
            <span className="font-medium capitalize text-foreground">
              {crumb.label}
            </span>
          ) : (
            <Link
              href={crumb.href}
              className="capitalize text-muted-foreground hover:text-foreground"
            >
              {crumb.label}
            </Link>
          )}
        </span>
      ))}
    </nav>
  );
}
