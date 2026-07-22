import { TransactionTable } from "@/features/transactions/components/transaction-table";
import { mapTransactionRow } from "@/features/transactions/types";
import { requireModuleAccess } from "@/lib/auth/session";
import {
  getTransactionFormOptions,
  getTransactionsList,
  getTransactionTotalsSummary,
} from "@/services/transaction.service";
import { PageHeader } from "@/components/layout/page-header";

export default async function TransactionsPage() {
  const user = await requireModuleAccess("transactions");
  const [rows, totals, options] = await Promise.all([
    getTransactionsList(),
    getTransactionTotalsSummary(),
    getTransactionFormOptions(),
  ]);

  const categories = [
    ...options.incomeCategories,
    ...options.expenseCategories,
  ].map((category) => ({ id: category.id, name: category.name }));

  return (
    <>
      <PageHeader
        title="Transactions"
        description="View income, expenses, and manual accounting entries."
      />
      <TransactionTable
        transactions={rows.map(mapTransactionRow)}
        totals={totals}
        accounts={options.accounts.map((account) => ({
          id: account.id,
          name: account.name,
        }))}
        categories={categories}
        incomeCategories={options.incomeCategories.map((category) => ({
          id: category.id,
          name: category.name,
        }))}
        expenseCategories={options.expenseCategories.map((category) => ({
          id: category.id,
          name: category.name,
        }))}
        canEditDelete={user.role === "Admin"}
        canExport={user.role === "Admin" || user.role === "Manager"}
      />
    </>
  );
}
