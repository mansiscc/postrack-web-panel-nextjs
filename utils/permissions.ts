import type { ModuleKey, Role, StaffPermission } from "@/types/auth";

type AccessRule =
  | { kind: "roles"; roles: Role[] }
  | { kind: "staff_permission"; permission: StaffPermission; roles: Role[] };

/** Module view access — MASTER_IMPLEMENTATION_PLAN Section 8.1 */
const ACCESS_RULES: Record<ModuleKey, AccessRule> = {
  dashboard: { kind: "roles", roles: ["Admin"] },
  products: {
    kind: "staff_permission",
    permission: "stock_in",
    roles: ["Admin", "Manager"],
  },
  categories: { kind: "roles", roles: ["Admin", "Manager"] },
  inventory: {
    kind: "staff_permission",
    permission: "stock_in",
    roles: ["Admin", "Manager"],
  },
  suppliers: {
    kind: "staff_permission",
    permission: "stock_in",
    roles: ["Admin", "Manager"],
  },
  purchases: {
    kind: "staff_permission",
    permission: "stock_in",
    roles: ["Admin", "Manager"],
  },
  billing: {
    kind: "staff_permission",
    permission: "stock_out",
    roles: ["Admin", "Manager"],
  },
  sales: {
    kind: "staff_permission",
    permission: "stock_out",
    roles: ["Admin", "Manager"],
  },
  customers: { kind: "roles", roles: ["Admin", "Manager"] },
  users: { kind: "roles", roles: ["Admin"] },
  "activity-log": { kind: "roles", roles: ["Admin"] },
  transactions: { kind: "roles", roles: ["Admin", "Manager"] },
  accounts: { kind: "roles", roles: ["Admin", "Manager"] },
  "account-categories": { kind: "roles", roles: ["Admin", "Manager"] },
  analytics: { kind: "roles", roles: ["Admin", "Manager"] },
  "business-profile": { kind: "roles", roles: ["Admin", "Manager"] },
};

export function canAccessModule(
  role: Role,
  permissions: StaffPermission[],
  module: ModuleKey,
): boolean {
  const rule = ACCESS_RULES[module];
  if (rule.kind === "roles") {
    return rule.roles.includes(role);
  }
  if (rule.roles.includes(role)) return true;
  return role === "Staff" && permissions.includes(rule.permission);
}

export function hasPermission(
  role: Role,
  permissions: StaffPermission[],
  permission: StaffPermission,
): boolean {
  if (role === "Admin" || role === "Manager") return true;
  return permissions.includes(permission);
}
