import { CategoryTable } from "@/hooks/features/categories/components/category-table";
import { mapCategoryRow } from "@/hooks/features/categories/types";
import { requireModuleAccess } from "@/lib/auth/session";
import { getCategoriesList } from "@/services/category.service";
import { PageHeader } from "@/components/layout/page-header";

export default async function CategoriesPage() {
  const user = await requireModuleAccess("categories");
  const rows = await getCategoriesList();

  const categories = rows.map(mapCategoryRow);

  return (
    <>
      <PageHeader
        title="Product categories"
        description="Organize products into categories for easier browsing and reporting."
      />
      <CategoryTable categories={categories} canDelete={user.role === "Admin"} />
    </>
  );
}
