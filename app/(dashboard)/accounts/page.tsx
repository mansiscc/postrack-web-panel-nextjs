import { AccountTable } from "@/hooks/features/accounts/components/account-table";
import { mapAccountRow } from "@/hooks/features/accounts/types";
import { requireModuleAccess } from "@/lib/auth/session";
import { getAccountsList } from "@/services/account.service";
import { parsePaginationSearchParams } from "@/utils/url-query";

type AccountsPageProps = {
  searchParams: Promise<{
    q?: string;
    status?: string;
    page?: string;
    pageSize?: string;
  }>;
};

export default async function AccountsPage({ searchParams }: AccountsPageProps) {
  const user = await requireModuleAccess("accounts");
  const params = await searchParams;
  const { page, pageSize } = parsePaginationSearchParams(params);
  const search = params.q?.trim() ?? "";
  const status =
    params.status === "active" || params.status === "inactive"
      ? params.status
      : "all";

  const result = await getAccountsList({
    page,
    pageSize,
    search: search || undefined,
    status,
  });

  return (
    <AccountTable
      accounts={result.items.map(mapAccountRow)}
      total={result.total}
      page={page}
      pageSize={pageSize}
      canDelete={user.role === "Admin"}
      filters={{ search, status }}
    />
  );
}
