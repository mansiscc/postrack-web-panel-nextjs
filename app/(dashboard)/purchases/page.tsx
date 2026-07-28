import { PurchaseTable } from "@/hooks/features/purchases/components/purchase-table";
import { mapPurchaseRow } from "@/hooks/features/purchases/types";
import { requireModuleAccess } from "@/lib/auth/session";
import { getPurchasesList } from "@/services/stock-in.service";

export default async function PurchasesPage() {
  const user = await requireModuleAccess("purchases");
  const result = await getPurchasesList({ page: 1, pageSize: 50 });
  const canExport = user.role === "Admin" || user.role === "Manager";

  return (
    <PurchaseTable
      purchases={result.items.map(mapPurchaseRow)}
      total={result.total}
      canExport={canExport}
    />
  );
}
