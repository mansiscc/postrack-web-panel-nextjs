import { PurchaseTable } from "@/hooks/features/purchases/components/purchase-table";
import { mapPurchaseRow } from "@/hooks/features/purchases/types";
import { requireModuleAccess } from "@/lib/auth/session";
import {
  getPurchaseFormOptions,
  getPurchasesList,
} from "@/services/stock-in.service";

export default async function PurchasesPage() {
  await requireModuleAccess("purchases");
  const [result, formOptions] = await Promise.all([
    getPurchasesList({ page: 1, pageSize: 50 }),
    getPurchaseFormOptions(),
  ]);

  return (
    <PurchaseTable
      purchases={result.items.map(mapPurchaseRow)}
      total={result.total}
      formOptions={formOptions}
    />
  );
}
