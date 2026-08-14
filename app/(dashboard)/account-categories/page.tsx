import { AccountingCategoryTable } from "@/hooks/features/account-categories/components/accounting-category-table";
import { mapAccountingCategoryRow } from "@/hooks/features/account-categories/types";
import { requireModuleAccess } from "@/lib/auth/session";
import { getAccountingCategoriesList } from "@/services/accounting-category.service";
import { parsePaginationSearchParams } from "@/utils/url-query";

type AccountCategoriesPageProps = {
  searchParams: Promise<{
    q?: string;
    type?: string;
    status?: string;
    page?: string;
    pageSize?: string;
  }>;
};

export default async function AccountCategoriesPage({
  searchParams,
}: AccountCategoriesPageProps) {
  const user = await requireModuleAccess("account-categories");
  const params = await searchParams;
  const { page, pageSize } = parsePaginationSearchParams(params);
  const search = params.q?.trim() ?? "";
  const type =
    params.type === "income" || params.type === "expense" ? params.type : "all";
  const status =
    params.status === "active" || params.status === "inactive"
      ? params.status
      : "all";

  const result = await getAccountingCategoriesList({
    page,
    pageSize,
    search: search || undefined,
    type,
    status,
  });

  return (
    <AccountingCategoryTable
      categories={result.items.map(mapAccountingCategoryRow)}
      total={result.total}
      page={page}
      pageSize={pageSize}
      canDelete={user.role === "Admin"}
      filters={{ search, type, status }}
    />
  );
}
