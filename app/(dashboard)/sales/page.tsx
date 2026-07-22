import { SalesTable } from "@/features/sales/components/sales-table";
import { mapSalesRow } from "@/features/sales/types";
import { PageHeader } from "@/components/layout/page-header";
import { requireModuleAccess } from "@/lib/auth/session";
import { getSalesHistory } from "@/services/billing.service";

export default async function SalesPage() {
  const user = await requireModuleAccess("sales");
  const result = await getSalesHistory({ page: 1, pageSize: 50 });
  const canExport = user.role === "Admin" || user.role === "Manager";

  return (
    <>
      <PageHeader
        title="Sales history"
        description="View bills, receipts, and process returns."
      />
      <SalesTable
        sales={result.items.map(mapSalesRow)}
        total={result.total}
        canExport={canExport}
      />
    </>
  );
}
