import { PurchaseTable } from "@/hooks/features/purchases/components/purchase-table";
import { mapPurchaseRow } from "@/hooks/features/purchases/types";
import { PageHeader } from "@/components/layout/page-header";
import { requireModuleAccess } from "@/lib/auth/session";
import { getPurchasesList } from "@/services/stock-in.service";

export default async function PurchasesPage() {
  const user = await requireModuleAccess("purchases");
  const result = await getPurchasesList({ page: 1, pageSize: 50 });
  const canExport = user.role === "Admin" || user.role === "Manager";

  return (
    <>
      <PageHeader
        title="Purchases"
        description="Record stock-in entries and review purchase history."
      />
      <PurchaseTable
        purchases={result.items.map(mapPurchaseRow)}
        total={result.total}
        canExport={canExport}
      />
    </>
  );
}
