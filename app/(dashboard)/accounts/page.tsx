import { AccountTable } from "@/hooks/features/accounts/components/account-table";
import { mapAccountRow } from "@/hooks/features/accounts/types";
import { requireModuleAccess } from "@/lib/auth/session";
import { getAccountsList } from "@/services/account.service";

export default async function AccountsPage() {
  const user = await requireModuleAccess("accounts");
  const rows = await getAccountsList();

  return (
    <AccountTable
      accounts={rows.map(mapAccountRow)}
      canDelete={user.role === "Admin"}
    />
  );
}
