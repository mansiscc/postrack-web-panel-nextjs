import { UserTable } from "@/hooks/features/users/components/user-table";
import { mapUserListRow } from "@/hooks/features/users/types";
import { requireModuleAccess } from "@/lib/auth/session";
import { getUsersList } from "@/services/user.service";
import { parsePaginationSearchParams } from "@/utils/url-query";

type UserStatusFilter = "all" | "active" | "inactive" | "deleted";

type UsersPageProps = {
  searchParams: Promise<{
    q?: string;
    role?: string;
    status?: string;
    page?: string;
    pageSize?: string;
  }>;
};

export default async function UsersPage({ searchParams }: UsersPageProps) {
  const user = await requireModuleAccess("users");
  const params = await searchParams;
  const { page, pageSize } = parsePaginationSearchParams(params);
  const search = params.q?.trim() ?? "";
  const role =
    params.role === "Admin" ||
    params.role === "Manager" ||
    params.role === "Staff"
      ? params.role
      : "all";
  const status =
    params.status === "active" ||
    params.status === "inactive" ||
    params.status === "deleted"
      ? (params.status as UserStatusFilter)
      : "all";

  const result = await getUsersList({
    page,
    pageSize,
    search: search || undefined,
    role,
    status:
      status === "active"
        ? "Active"
        : status === "inactive"
          ? "Inactive"
          : status === "deleted"
            ? "deleted"
            : "all",
    includeDeleted: status === "deleted",
  });

  return (
    <UserTable
      users={result.items.map(mapUserListRow)}
      total={result.total}
      page={page}
      pageSize={pageSize}
      currentUserId={user.id}
      filters={{ search, role, status }}
    />
  );
}
