import { format } from "date-fns";

import { TransactionTable } from "@/hooks/features/transactions/components/transaction-table";
import { mapTransactionRow } from "@/hooks/features/transactions/types";
import { requireModuleAccess } from "@/lib/auth/session";
import {
  getTransactionFormOptions,
  getTransactionsList,
  getTransactionTotalsSummary,
} from "@/services/transaction.service";
import { PageHeader } from "@/components/layout/page-header";
import { dateRangePresets } from "@/utils/date";

type TransactionsPageProps = {
  searchParams: Promise<{
    type?: string;
    account?: string;
    date?: string;
  }>;
};

export default async function TransactionsPage({
  searchParams,
}: TransactionsPageProps) {
  const user = await requireModuleAccess("transactions");
  const params = await searchParams;
  const entryType =
    params.type === "income" || params.type === "expense" ? params.type : "all";
  const accountId = params.account?.trim() || "all";

  let initialDateFrom = "";
  let initialDateTo = "";
  if (params.date === "today") {
    const range = dateRangePresets("today");
    initialDateFrom = format(range.from, "yyyy-MM-dd");
    initialDateTo = format(range.to, "yyyy-MM-dd");
  }

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
        initialEntryType={entryType}
        initialAccountId={accountId}
        initialDateFrom={initialDateFrom}
        initialDateTo={initialDateTo}
      />
    </>
  );
}
