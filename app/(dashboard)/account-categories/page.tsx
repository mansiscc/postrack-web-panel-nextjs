import { AccountingCategoryTable } from "@/hooks/features/account-categories/components/accounting-category-table";
import { mapAccountingCategoryRow } from "@/hooks/features/account-categories/types";
import { requireModuleAccess } from "@/lib/auth/session";
import { getAccountingCategoriesList } from "@/services/accounting-category.service";
import { PageHeader } from "@/components/layout/page-header";

export default async function AccountCategoriesPage() {
  const user = await requireModuleAccess("account-categories");
  const rows = await getAccountingCategoriesList();

  return (
    <>
      <PageHeader
        title="Account categories"
        description="Configure income and expense categories for transactions."
      />
      <AccountingCategoryTable
        categories={rows.map(mapAccountingCategoryRow)}
        canDelete={user.role === "Admin"}
      />
    </>
  );
}
