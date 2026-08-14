import { ProductTable } from "@/hooks/features/products/components/product-table";
import { mapProductRow } from "@/hooks/features/products/types";
import { requireModuleAccess } from "@/lib/auth/session";
import { getCategoriesList } from "@/services/category.service";
import { getProductsList } from "@/services/product.service";
import { parsePaginationSearchParams } from "@/utils/url-query";

type ProductStockFilter = "all" | "in_stock" | "low_stock" | "out_of_stock";
type ProductStatusFilter = "all" | "active" | "inactive" | "deleted";

type ProductsPageProps = {
  searchParams: Promise<{
    q?: string;
    category?: string;
    stock?: string;
    status?: string;
    page?: string;
    pageSize?: string;
  }>;
};

export default async function ProductsPage({ searchParams }: ProductsPageProps) {
  const user = await requireModuleAccess("products");
  const params = await searchParams;
  const { page, pageSize } = parsePaginationSearchParams(params);
  const search = params.q?.trim() ?? "";
  const categoryId = params.category?.trim() || "all";
  const stock =
    params.stock === "in_stock" ||
    params.stock === "low_stock" ||
    params.stock === "out_of_stock"
      ? (params.stock as ProductStockFilter)
      : "all";
  const status =
    params.status === "active" ||
    params.status === "inactive" ||
    params.status === "deleted"
      ? (params.status as ProductStatusFilter)
      : "all";

  const [result, categories] = await Promise.all([
    getProductsList({
      page,
      pageSize,
      search: search || undefined,
      categoryId,
      stock,
      status,
    }),
    getCategoriesList({ status: "active" }),
  ]);

  return (
    <ProductTable
      products={result.items.map(mapProductRow)}
      total={result.total}
      page={page}
      pageSize={pageSize}
      categories={categories.items.map((category) => ({
        id: category.id,
        name: category.name,
      }))}
      canDelete={user.role === "Admin"}
      filters={{ search, categoryId, stock, status }}
    />
  );
}
