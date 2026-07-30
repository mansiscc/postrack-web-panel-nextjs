import { notFound } from "next/navigation";

import { AccountDetailsView } from "@/hooks/features/accounts/components/account-details-view";
import { mapAccountRow } from "@/hooks/features/accounts/types";
import { mapTransactionRow } from "@/hooks/features/transactions/types";
import { requireModuleAccess } from "@/lib/auth/session";
import { getAccountsList } from "@/services/account.service";
import { getTransactionsList } from "@/services/transaction.service";

type AccountDetailsPageProps = {
  params: Promise<{ id: string }>;
};

export default async function AccountDetailsPage({
  params,
}: AccountDetailsPageProps) {
  const user = await requireModuleAccess("accounts");
  const { id } = await params;

  const [accounts, ledgerRows] = await Promise.all([
    getAccountsList(),
    getTransactionsList({ accountId: id }),
  ]);
  const accountRow = accounts.find((row) => row.id === id);
  if (!accountRow) notFound();

  return (
    <AccountDetailsView
      account={mapAccountRow(accountRow)}
      entries={ledgerRows.slice(0, 50).map(mapTransactionRow)}
      canManage={user.role === "Admin" || user.role === "Manager"}
    />
  );
}
