import { SupplierTable } from "@/hooks/features/suppliers/components/supplier-table";
import { mapSupplierRow } from "@/hooks/features/suppliers/types";
import { requireModuleAccess } from "@/lib/auth/session";
import { getSuppliersList } from "@/services/supplier.service";
import { parsePaginationSearchParams } from "@/utils/url-query";

type SuppliersPageProps = {
  searchParams: Promise<{
    q?: string;
    page?: string;
    pageSize?: string;
  }>;
};

export default async function SuppliersPage({
  searchParams,
}: SuppliersPageProps) {
  const user = await requireModuleAccess("suppliers");
  const params = await searchParams;
  const { page, pageSize } = parsePaginationSearchParams(params);
  const search = params.q?.trim() ?? "";

  const result = await getSuppliersList({
    page,
    pageSize,
    search: search || undefined,
    includeDeleted: true,
  });

  return (
    <SupplierTable
      suppliers={result.items.map(mapSupplierRow)}
      total={result.total}
      page={page}
      pageSize={pageSize}
      canDelete={user.role === "Admin"}
      filters={{ search }}
    />
  );
}
