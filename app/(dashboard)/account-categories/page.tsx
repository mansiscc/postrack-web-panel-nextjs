import { AccountingCategoryTable } from "@/hooks/features/account-categories/components/accounting-category-table";
import { mapAccountingCategoryRow } from "@/hooks/features/account-categories/types";
import { requireModuleAccess } from "@/lib/auth/session";
import { getAccountingCategoriesList } from "@/services/accounting-category.service";

export default async function AccountCategoriesPage() {
  const user = await requireModuleAccess("account-categories");
  const rows = await getAccountingCategoriesList();

  return (
    <AccountingCategoryTable
      categories={rows.map(mapAccountingCategoryRow)}
      canDelete={user.role === "Admin"}
    />
  );
}
