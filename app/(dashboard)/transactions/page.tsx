import { format } from "date-fns";

import { TransactionTable } from "@/hooks/features/transactions/components/transaction-table";
import { mapTransactionRow } from "@/hooks/features/transactions/types";
import { DEFAULT_PAGE_SIZE } from "@/lib/constants";
import { requireModuleAccess } from "@/lib/auth/session";
import {
  getTransactionFormOptions,
  getTransactionsList,
  getTransactionTotalsSummary,
} from "@/services/transaction.service";
import { dateRangePresets } from "@/utils/date";

type TransactionsPageProps = {
  searchParams: Promise<{
    q?: string;
    type?: string;
    account?: string;
    category?: string;
    source?: string;
    date?: string;
    from?: string;
    to?: string;
    page?: string;
    pageSize?: string;
  }>;
};

export default async function TransactionsPage({
  searchParams,
}: TransactionsPageProps) {
  const user = await requireModuleAccess("transactions");
  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);
  const pageSize = Math.min(
    50,
    Math.max(10, Number(params.pageSize) || DEFAULT_PAGE_SIZE),
  );
  const search = params.q?.trim() ?? "";
  const entryType =
    params.type === "income" || params.type === "expense" ? params.type : "all";
  const accountId = params.account?.trim() || "all";
  const categoryId = params.category?.trim() || "all";
  const sourceType =
    params.source === "manual" || params.source === "system"
      ? params.source
      : "all";

  let dateFrom = params.from?.trim() ?? "";
  let dateTo = params.to?.trim() ?? "";
  if (!dateFrom && !dateTo && params.date === "today") {
    const range = dateRangePresets("today");
    dateFrom = format(range.from, "yyyy-MM-dd");
    dateTo = format(range.to, "yyyy-MM-dd");
  }

  const [result, totals, options] = await Promise.all([
    getTransactionsList({
      page,
      pageSize,
      search: search || undefined,
      entryType,
      accountId: accountId === "all" ? undefined : accountId,
      categoryId: categoryId === "all" ? undefined : categoryId,
      sourceType,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
    }),
    getTransactionTotalsSummary(),
    getTransactionFormOptions(),
  ]);

  const categories = [
    ...options.incomeCategories,
    ...options.expenseCategories,
  ].map((category) => ({ id: category.id, name: category.name }));

  return (
    <TransactionTable
      transactions={result.items.map(mapTransactionRow)}
      total={result.total}
      page={page}
      pageSize={pageSize}
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
      filters={{
        search,
        entryType,
        accountId,
        categoryId,
        sourceType,
        dateFrom,
        dateTo,
      }}
    />
  );
}
