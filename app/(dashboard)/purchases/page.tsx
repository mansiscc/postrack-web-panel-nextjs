import { PurchaseTable } from "@/hooks/features/purchases/components/purchase-table";
import { mapPurchaseRow } from "@/hooks/features/purchases/types";
import { DEFAULT_PAGE_SIZE } from "@/lib/constants";
import { requireModuleAccess } from "@/lib/auth/session";
import {
  getPurchaseFormOptions,
  getPurchasesList,
} from "@/services/stock-in.service";

type PurchasesPageProps = {
  searchParams: Promise<{
    q?: string;
    page?: string;
    pageSize?: string;
  }>;
};

export default async function PurchasesPage({
  searchParams,
}: PurchasesPageProps) {
  await requireModuleAccess("purchases");
  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);
  const pageSize = Math.min(
    50,
    Math.max(10, Number(params.pageSize) || DEFAULT_PAGE_SIZE),
  );
  const search = params.q?.trim() ?? "";

  const [result, formOptions] = await Promise.all([
    getPurchasesList({
      page,
      pageSize,
      search: search || undefined,
    }),
    getPurchaseFormOptions(),
  ]);

  return (
    <PurchaseTable
      purchases={result.items.map(mapPurchaseRow)}
      total={result.total}
      page={page}
      pageSize={pageSize}
      filters={{ search }}
      formOptions={formOptions}
    />
  );
}
