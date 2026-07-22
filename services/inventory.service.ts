import { listProducts } from "@/repositories/products.repository";
import { createClient } from "@/lib/supabase/server";

export type InventoryOverview = {
  totalProducts: number;
  totalStockUnits: number;
  totalStockValue: number;
  lowStockCount: number;
  outOfStockCount: number;
  inactiveCount: number;
};

export async function getInventoryOverview() {
  const supabase = await createClient();
  const products = await listProducts(supabase, { status: "all" });

  const activeProducts = products.filter((product) => !product.is_deleted);
  const overview: InventoryOverview = {
    totalProducts: activeProducts.filter((p) => p.is_active).length,
    totalStockUnits: activeProducts.reduce(
      (sum, p) => sum + (p.stock_quantity ?? 0),
      0,
    ),
    totalStockValue: activeProducts.reduce(
      (sum, p) =>
        sum + (p.stock_quantity ?? 0) * (p.purchase_price ?? 0),
      0,
    ),
    lowStockCount: activeProducts.filter(
      (p) =>
        p.is_active &&
        (p.stock_quantity ?? 0) > 0 &&
        (p.stock_quantity ?? 0) <= (p.low_stock_alert_qty ?? 0),
    ).length,
    outOfStockCount: activeProducts.filter(
      (p) => p.is_active && (p.stock_quantity ?? 0) <= 0,
    ).length,
    inactiveCount: activeProducts.filter((p) => !p.is_active).length,
  };

  return { overview, products: activeProducts };
}
