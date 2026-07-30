import { InventoryOverviewPanel } from "@/hooks/features/inventory/components/inventory-overview";
import { requireModuleAccess } from "@/lib/auth/session";
import { getInventoryOverview } from "@/services/inventory.service";

type InventoryPageProps = {
  searchParams: Promise<{
    stock?: string;
  }>;
};

export default async function InventoryPage({ searchParams }: InventoryPageProps) {
  await requireModuleAccess("inventory");
  const params = await searchParams;
  const initialFocus =
    params.stock === "low_stock" ||
    params.stock === "out_of_stock" ||
    params.stock === "inactive"
      ? params.stock
      : null;
  const overview = await getInventoryOverview();

  return (
    <InventoryOverviewPanel overview={overview} initialFocus={initialFocus} />
  );
}
