import { UserTable } from "@/hooks/features/users/components/user-table";
import { mapUserListRow } from "@/hooks/features/users/types";
import { requireModuleAccess } from "@/lib/auth/session";
import { getUsersList } from "@/services/user.service";

export default async function UsersPage() {
  const user = await requireModuleAccess("users");
  const rows = await getUsersList({ includeDeleted: true });
  const users = rows.map(mapUserListRow);

  return <UserTable users={users} currentUserId={user.id} />;
}
