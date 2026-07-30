import { notFound } from "next/navigation";

import { SupplierDetailsView } from "@/hooks/features/suppliers/components/supplier-details-view";
import { mapSupplierRow } from "@/hooks/features/suppliers/types";
import { requireModuleAccess } from "@/lib/auth/session";
import { getSupplierDetail } from "@/services/supplier.service";

type SupplierDetailsPageProps = {
  params: Promise<{ id: string }>;
};

export default async function SupplierDetailsPage({
  params,
}: SupplierDetailsPageProps) {
  const user = await requireModuleAccess("suppliers");
  const { id } = await params;
  const { supplier, purchases, purchaseSummary } = await getSupplierDetail(id);

  if (!supplier) notFound();

  return (
    <SupplierDetailsView
      supplier={mapSupplierRow({
        ...supplier,
        purchase_count: purchases.length,
      })}
      purchases={purchases.map((purchase) => ({
        id: purchase.id,
        date: purchase.date,
        invoice_number: purchase.invoice_number,
        notes: purchase.notes,
        total_items: purchase.total_items ?? 0,
        total_amount: Number(purchase.total_amount ?? 0),
        created_at: purchase.created_at,
        created_by_name: purchase.created_by_name,
      }))}
      purchaseSummary={purchaseSummary}
      canDelete={user.role === "Admin"}
    />
  );
}
