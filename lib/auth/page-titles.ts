/** Page titles for the sticky topbar — mirrors nav labels. */
const PAGE_TITLES: Record<string, string> = {
  "": "Dashboard",
  products: "Products",
  categories: "Product Categories",
  inventory: "Inventory Overview",
  suppliers: "Supplier Management",
  purchases: "Purchase Management",
  billing: "POS Billing",
  sales: "Sales History",
  customers: "Customer Management",
  users: "User Management",
  "activity-log": "Activity Log",
  transactions: "Transactions",
  accounts: "Bank Accounts",
  "account-categories": "Account Categories",
  settings: "Settings",
  "business-profile": "Business Profile",
  new: "New Purchase",
};

const ANALYTICS_PAGE_TITLES: Record<string, string> = {
  sales: "Sales Analytics",
  purchases: "Purchase Insights",
};

/**
 * Resolve the topbar page title from the current pathname.
 * Uses the deepest known segment so nested routes read correctly.
 */
export function getPageTitle(pathname: string): string {
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length === 0) return PAGE_TITLES[""];

  if (segments[0] === "analytics" && segments[1]) {
    const analyticsTitle = ANALYTICS_PAGE_TITLES[segments[1]];
    if (analyticsTitle) return analyticsTitle;
  }

  if (segments[0] === "products" && segments[1]) {
    return "Product Details";
  }

  if (segments[0] === "suppliers" && segments[1]) {
    return "Supplier Details";
  }

  if (segments[0] === "accounts" && segments[1]) {
    return "Account Details";
  }

  if (segments[0] === "sales" && segments[1]) {
    return "Bill Details";
  }

  if (segments[0] === "purchases" && segments[2] === "print-labels") {
    return "Print QR Labels";
  }

  for (let i = segments.length - 1; i >= 0; i -= 1) {
    const segment = segments[i];
    if (PAGE_TITLES[segment]) return PAGE_TITLES[segment];
  }

  const last = segments[segments.length - 1];
  return last.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
