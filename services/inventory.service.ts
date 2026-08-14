import { listProducts } from "@/repositories/products.repository";
import { createClient } from "@/lib/supabase/server";

export type InventoryProductLine = {
  id: string;
  name: string;
  stockQuantity: number;
  lowStockAlertQty: number;
  unit: string | null;
  categoryName: string | null;
};

export type InventoryOverview = {
  totalProducts: number;
  activeProducts: number;
  inactiveProducts: number;
  inStockCount: number;
  lowStockCount: number;
  outOfStockCount: number;
  lowStockProducts: InventoryProductLine[];
  outOfStockProducts: InventoryProductLine[];
  inactiveProductLines: InventoryProductLine[];
};

function toLine(product: {
  id: string;
  name: string;
  stock_quantity: number | null;
  low_stock_alert_qty: number | null;
  unit: string | null;
  category_name: string | null;
}): InventoryProductLine {
  return {
    id: product.id,
    name: product.name,
    stockQuantity: product.stock_quantity ?? 0,
    lowStockAlertQty: product.low_stock_alert_qty ?? 0,
    unit: product.unit,
    categoryName: product.category_name,
  };
}

export async function getInventoryOverview(): Promise<InventoryOverview> {
  const supabase = await createClient();
  const { items: products } = await listProducts(supabase, { status: "all" });
  const activeList = products.filter((p) => !p.is_deleted);

  const activeProducts = activeList.filter((p) => p.is_active);
  const inactiveProducts = activeList.filter((p) => !p.is_active);

  const inStock = activeProducts.filter(
    (p) => (p.stock_quantity ?? 0) > (p.low_stock_alert_qty ?? 0),
  );
  const lowStock = activeProducts.filter((p) => {
    const qty = p.stock_quantity ?? 0;
    const alert = p.low_stock_alert_qty ?? 0;
    return qty > 0 && qty <= alert;
  });
  const outOfStock = activeProducts.filter((p) => (p.stock_quantity ?? 0) <= 0);

  return {
    totalProducts: activeList.length,
    activeProducts: activeProducts.length,
    inactiveProducts: inactiveProducts.length,
    inStockCount: inStock.length,
    lowStockCount: lowStock.length,
    outOfStockCount: outOfStock.length,
    lowStockProducts: [...lowStock]
      .sort((a, b) => (a.stock_quantity ?? 0) - (b.stock_quantity ?? 0))
      .map(toLine),
    outOfStockProducts: [...outOfStock]
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }))
      .map(toLine),
    inactiveProductLines: [...inactiveProducts]
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }))
      .map(toLine),
  };
}
