export type UserListItem = {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  role: "Admin" | "Manager" | "Staff";
  status: "Active" | "Inactive";
  permissions: string[];
  isDeleted: boolean;
  createdAt: string;
};

export function mapUserListRow(row: {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  role: "Admin" | "Manager" | "Staff";
  status: "Active" | "Inactive";
  permissions: unknown;
  is_deleted: boolean;
  created_at: string;
}): UserListItem {
  const permissions = Array.isArray(row.permissions)
    ? row.permissions.filter((item): item is string => typeof item === "string")
    : [];

  return {
    id: row.id,
    fullName: row.full_name,
    email: row.email,
    phone: row.phone,
    role: row.role,
    status: row.status,
    permissions,
    isDeleted: row.is_deleted,
    createdAt: row.created_at,
  };
}
