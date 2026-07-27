import { SupplierTable } from "@/hooks/features/suppliers/components/supplier-table";
import { mapSupplierRow } from "@/hooks/features/suppliers/types";
import { PageHeader } from "@/components/layout/page-header";
import { requireModuleAccess } from "@/lib/auth/session";
import { getSuppliersList } from "@/services/supplier.service";

export default async function SuppliersPage() {
  const user = await requireModuleAccess("suppliers");
  const rows = await getSuppliersList({ includeDeleted: true });

  return (
    <>
      <PageHeader
        title="Suppliers"
        description="Manage supplier contacts and purchase relationships."
      />
      <SupplierTable
        suppliers={rows.map(mapSupplierRow)}
        canDelete={user.role === "Admin"}
      />
    </>
  );
}
