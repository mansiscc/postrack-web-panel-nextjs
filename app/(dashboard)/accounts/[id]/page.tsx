import { notFound } from "next/navigation";

import { AccountDetailsView } from "@/hooks/features/accounts/components/account-details-view";
import { mapAccountRow } from "@/hooks/features/accounts/types";
import { mapTransactionRow } from "@/hooks/features/transactions/types";
import { requireModuleAccess } from "@/lib/auth/session";
import { getAccountsList } from "@/services/account.service";
import { getTransactionsList } from "@/services/transaction.service";
import { parsePaginationSearchParams } from "@/utils/url-query";

type AccountDetailsPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ page?: string; pageSize?: string }>;
};

export default async function AccountDetailsPage({
  params,
  searchParams,
}: AccountDetailsPageProps) {
  const user = await requireModuleAccess("accounts");
  const { id } = await params;
  const { page, pageSize } = parsePaginationSearchParams(await searchParams);

  const [accounts, ledger] = await Promise.all([
    getAccountsList(),
    getTransactionsList({ accountId: id, page, pageSize }),
  ]);
  const accountRow = accounts.items.find((row) => row.id === id);
  if (!accountRow) notFound();

  return (
    <AccountDetailsView
      account={mapAccountRow(accountRow)}
      entries={ledger.items.map(mapTransactionRow)}
      total={ledger.total}
      page={page}
      pageSize={pageSize}
      canManage={user.role === "Admin" || user.role === "Manager"}
    />
  );
}
