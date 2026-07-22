import { InventoryOverviewPanel } from "@/features/inventory/components/inventory-overview";
import { PageHeader } from "@/components/layout/page-header";
import { requireModuleAccess } from "@/lib/auth/session";
import { getInventoryOverview } from "@/services/inventory.service";

export default async function InventoryPage() {
  await requireModuleAccess("inventory");
  const { overview, products } = await getInventoryOverview();

  return (
    <>
      <PageHeader
        title="Inventory overview"
        description="Monitor stock levels, alerts, and inventory value at cost."
      />
      <InventoryOverviewPanel overview={overview} products={products} />
    </>
  );
}
