import { ProductTable } from "@/hooks/features/products/components/product-table";
import { mapProductRow } from "@/hooks/features/products/types";
import { requireModuleAccess } from "@/lib/auth/session";
import { getCategoriesList } from "@/services/category.service";
import { getProductsList } from "@/services/product.service";

export default async function ProductsPage() {
  const user = await requireModuleAccess("products");
  const [rows, categories] = await Promise.all([
    getProductsList(),
    getCategoriesList({ status: "active" }),
  ]);

  return (
    <ProductTable
      products={rows.map(mapProductRow)}
      categories={categories.map((category) => ({
        id: category.id,
        name: category.name,
      }))}
      canDelete={user.role === "Admin"}
    />
  );
}
