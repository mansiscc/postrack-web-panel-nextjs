import { CategoryTable } from "@/hooks/features/categories/components/category-table";
import { mapCategoryRow } from "@/hooks/features/categories/types";
import { requireModuleAccess } from "@/lib/auth/session";
import { getCategoriesList } from "@/services/category.service";
import { parsePaginationSearchParams } from "@/utils/url-query";

type CategoriesPageProps = {
  searchParams: Promise<{
    q?: string;
    status?: string;
    page?: string;
    pageSize?: string;
  }>;
};

export default async function CategoriesPage({
  searchParams,
}: CategoriesPageProps) {
  const user = await requireModuleAccess("categories");
  const params = await searchParams;
  const { page, pageSize } = parsePaginationSearchParams(params);
  const search = params.q?.trim() ?? "";
  const status =
    params.status === "active" || params.status === "inactive"
      ? params.status
      : "all";

  const result = await getCategoriesList({
    page,
    pageSize,
    search: search || undefined,
    status,
  });

  return (
    <CategoryTable
      categories={result.items.map(mapCategoryRow)}
      total={result.total}
      page={page}
      pageSize={pageSize}
      canDelete={user.role === "Admin"}
      filters={{ search, status }}
    />
  );
}
