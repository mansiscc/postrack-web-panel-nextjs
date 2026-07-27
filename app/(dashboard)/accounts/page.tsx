import { AccountTable } from "@/hooks/features/accounts/components/account-table";
import { mapAccountRow } from "@/hooks/features/accounts/types";
import { requireModuleAccess } from "@/lib/auth/session";
import { getAccountsList } from "@/services/account.service";
import { PageHeader } from "@/components/layout/page-header";

export default async function AccountsPage() {
  const user = await requireModuleAccess("accounts");
  const rows = await getAccountsList();

  return (
    <>
      <PageHeader
        title="Bank accounts"
        description="Manage cash, bank, and payment accounts with live balances."
      />
      <AccountTable
        accounts={rows.map(mapAccountRow)}
        canDelete={user.role === "Admin"}
      />
    </>
  );
}
