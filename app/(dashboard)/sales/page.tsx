import { SalesTable } from "@/hooks/features/sales/components/sales-table";
import { mapSalesRow } from "@/hooks/features/sales/types";
import { DEFAULT_PAGE_SIZE } from "@/lib/constants";
import { requireModuleAccess } from "@/lib/auth/session";
import { getSalesHistory } from "@/services/billing.service";
import { resolveSalesDateRange } from "@/utils/url-query";

type SalesPageProps = {
  searchParams: Promise<{
    q?: string;
    status?: string;
    payment?: string;
    date?: string;
    page?: string;
    pageSize?: string;
  }>;
};

export default async function SalesPage({ searchParams }: SalesPageProps) {
  await requireModuleAccess("sales");
  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);
  const pageSize = Math.min(
    50,
    Math.max(10, Number(params.pageSize) || DEFAULT_PAGE_SIZE),
  );
  const status = params.status ?? "all";
  const paymentMode = params.payment ?? "all";
  const search = params.q?.trim() ?? "";
  const { date, dateFrom, dateTo } = resolveSalesDateRange(params.date);

  const result = await getSalesHistory({
    page,
    pageSize,
    search: search || undefined,
    status: status as never,
    paymentMode: paymentMode as never,
    dateFrom,
    dateTo,
  });

  return (
    <SalesTable
      sales={result.items.map(mapSalesRow)}
      total={result.total}
      page={page}
      pageSize={pageSize}
      filters={{
        search,
        status,
        paymentMode,
        date,
      }}
    />
  );
}
