import { InventoryOverviewPanel } from "@/hooks/features/inventory/components/inventory-overview";
import { PageHeader } from "@/components/layout/page-header";
import { requireModuleAccess } from "@/lib/auth/session";
import { getInventoryOverview } from "@/services/inventory.service";

type InventoryPageProps = {
  searchParams: Promise<{
    stock?: string;
    q?: string;
  }>;
};

export default async function InventoryPage({ searchParams }: InventoryPageProps) {
  await requireModuleAccess("inventory");
  const params = await searchParams;
  const stock =
    params.stock === "in_stock" ||
    params.stock === "low_stock" ||
    params.stock === "out_of_stock"
      ? params.stock
      : "all";
  const { overview, products } = await getInventoryOverview();

  return (
    <>
      <PageHeader
        title="Inventory overview"
        description="Monitor stock levels, alerts, and inventory value at cost."
      />
      <InventoryOverviewPanel
        overview={overview}
        products={products}
        initialStock={stock}
        initialSearch={params.q?.trim() ?? ""}
      />
    </>
  );
}
