import type { ModuleKey, SessionUser } from "@/types/auth";
import { canAccessModule } from "@/utils/permissions";

const PUBLIC_PATHS = new Set(["/login", "/inactive"]);

const PATH_MODULE_MAP: Array<{ prefix: string; module: ModuleKey }> = [
  { prefix: "/settings/business-profile", module: "business-profile" },
  { prefix: "/analytics", module: "analytics" },
  { prefix: "/account-categories", module: "account-categories" },
  { prefix: "/activity-log", module: "activity-log" },
  { prefix: "/transactions", module: "transactions" },
  { prefix: "/inventory", module: "inventory" },
  { prefix: "/categories", module: "categories" },
  { prefix: "/suppliers", module: "suppliers" },
  { prefix: "/purchases", module: "purchases" },
  { prefix: "/customers", module: "customers" },
  { prefix: "/products", module: "products" },
  { prefix: "/billing", module: "billing" },
  { prefix: "/sales", module: "sales" },
  { prefix: "/accounts", module: "accounts" },
  { prefix: "/users", module: "users" },
  { prefix: "/", module: "dashboard" },
];

export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.has(pathname);
}

export function getModuleForPath(pathname: string): ModuleKey | null {
  if (pathname === "/") return "dashboard";

  const match = PATH_MODULE_MAP.find(
    (entry) => entry.prefix !== "/" && pathname.startsWith(entry.prefix),
  );

  return match?.module ?? null;
}

export function canAccessPath(pathname: string, user: SessionUser): boolean {
  const routeModule = getModuleForPath(pathname);
  if (!routeModule) return true;
  return canAccessModule(user.role, user.permissions, routeModule);
}

export { PUBLIC_PATHS };
