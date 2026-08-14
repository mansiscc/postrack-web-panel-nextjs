import { CustomerTable } from "@/hooks/features/customers/components/customer-table";
import { mapCustomerRow } from "@/hooks/features/customers/types";
import { requireModuleAccess } from "@/lib/auth/session";
import { getCustomersList } from "@/services/customer.service";
import { parsePaginationSearchParams } from "@/utils/url-query";

type CustomersPageProps = {
  searchParams: Promise<{
    q?: string;
    status?: string;
    page?: string;
    pageSize?: string;
  }>;
};

export default async function CustomersPage({
  searchParams,
}: CustomersPageProps) {
  await requireModuleAccess("customers");
  const params = await searchParams;
  const { page, pageSize } = parsePaginationSearchParams(params);
  const search = params.q?.trim() ?? "";
  const status =
    params.status === "active" || params.status === "inactive"
      ? params.status
      : "all";

  const result = await getCustomersList({
    page,
    pageSize,
    search: search || undefined,
    status: status === "all" ? undefined : status,
    includeInactive: true,
  });

  return (
    <CustomerTable
      customers={result.items.map(mapCustomerRow)}
      total={result.total}
      page={page}
      pageSize={pageSize}
      filters={{ search, status }}
    />
  );
}
