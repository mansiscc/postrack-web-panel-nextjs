export type Role = "Admin" | "Manager" | "Staff";

export type StaffPermission = "stock_in" | "stock_out";

export type SessionUser = {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  status: "Active" | "Inactive";
  companyId: string;
  companyName: string;
  companyIsActive: boolean;
  permissions: StaffPermission[];
};

export type ModuleKey =
  | "dashboard"
  | "products"
  | "categories"
  | "inventory"
  | "suppliers"
  | "purchases"
  | "billing"
  | "sales"
  | "customers"
  | "users"
  | "activity-log"
  | "transactions"
  | "accounts"
  | "account-categories"
  | "analytics"
  | "business-profile";
