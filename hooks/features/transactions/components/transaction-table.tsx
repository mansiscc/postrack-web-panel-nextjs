"use client";

import type { ColumnDef } from "@tanstack/react-table";
import {
  ArrowLeftRight,
  Download,
  Plus,
} from "lucide-react";
import { useMemo, useState, useTransition } from "react";

import { useSyncedState } from "@/hooks/use-synced-state";
import { useTableRefresh } from "@/hooks/use-table-refresh";
import { toast } from "sonner";

import { deleteTransactionAction } from "@/hooks/features/transactions/actions";
import { exportTransactionsListCsvAction } from "@/hooks/features/analytics/actions";
import { TransactionFormSheet } from "@/hooks/features/transactions/components/transaction-form-sheet";
import {
  getSourceTypeLabel,
  type TransactionListItem,
} from "@/hooks/features/transactions/types";
import { DataTable } from "@/components/data-table/data-table";
import { DataTableColumnHeader } from "@/components/data-table/column-header";
import { RowActions } from "@/components/data-table/row-actions";
import { DataTableToolbar } from "@/components/data-table/toolbar";
import { ConfirmDialog } from "@/components/dialogs/confirm-dialog";
import { EmptyState } from "@/components/feedback/empty-state";
import { SearchInput } from "@/components/forms/search-input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { TransactionTotals } from "@/repositories/transactions.repository";
import { formatCurrency } from "@/utils/currency";
import { downloadCsv } from "@/utils/csv";
import { formatDate } from "@/utils/date";

type FormOption = { id: string; name: string };

type TransactionTableProps = {
  transactions: TransactionListItem[];
  totals: TransactionTotals;
  accounts: FormOption[];
  categories: FormOption[];
  incomeCategories: FormOption[];
  expenseCategories: FormOption[];
  canEditDelete: boolean;
  canExport?: boolean;
  initialEntryType?: "all" | "income" | "expense";
  initialAccountId?: string;
  initialDateFrom?: string;
  initialDateTo?: string;
};

export function TransactionTable({
  transactions,
  totals,
  accounts,
  categories,
  incomeCategories,
  expenseCategories,
  canEditDelete,
  canExport = false,
  initialEntryType = "all",
  initialAccountId = "all",
  initialDateFrom = "",
  initialDateTo = "",
}: TransactionTableProps) {
  const refresh = useTableRefresh();
  const [items, setItems] = useSyncedState(transactions);
  const [search, setSearch] = useState("");
  const [entryType, setEntryType] = useState<"all" | "income" | "expense">(
    initialEntryType,
  );
  const [accountId, setAccountId] = useState(initialAccountId);
  const [categoryId, setCategoryId] = useState("all");
  const [sourceType, setSourceType] = useState<"all" | "manual" | "system">(
    "all",
  );
  const [dateFrom, setDateFrom] = useState(initialDateFrom);
  const [dateTo, setDateTo] = useState(initialDateTo);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<TransactionListItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TransactionListItem | null>(
    null,
  );
  const [, startTransition] = useTransition();

  const filtered = useMemo(() => {
    return items.filter((item) => {
      const term = search.toLowerCase();
      const matchesSearch =
        !term ||
        item.accountName.toLowerCase().includes(term) ||
        item.categoryName.toLowerCase().includes(term) ||
        (item.remarks?.toLowerCase().includes(term) ?? false);
      const matchesType = entryType === "all" || item.entryType === entryType;
      const matchesAccount =
        accountId === "all" || item.accountId === accountId;
      const matchesCategory =
        categoryId === "all" || item.categoryId === categoryId;
      const matchesSource =
        sourceType === "all" ||
        (sourceType === "manual" && item.isManual) ||
        (sourceType === "system" && !item.isManual);
      const matchesFrom = !dateFrom || item.entryDate >= dateFrom;
      const matchesTo = !dateTo || item.entryDate <= dateTo;
      return (
        matchesSearch &&
        matchesType &&
        matchesAccount &&
        matchesCategory &&
        matchesSource &&
        matchesFrom &&
        matchesTo
      );
    });
  }, [
    items,
    search,
    entryType,
    accountId,
    categoryId,
    sourceType,
    dateFrom,
    dateTo,
  ]);

  const handleDelete = () => {
    if (!deleteTarget) return;
    startTransition(async () => {
      const result = await deleteTransactionAction(deleteTarget.id);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      setItems((prev) => prev.filter((row) => row.id !== deleteTarget.id));
      toast.success("Entry deleted");
      setDeleteTarget(null);
    });
  };

  const columns = useMemo<ColumnDef<TransactionListItem>[]>(
    () => [
      {
        accessorKey: "entryDate",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Date" />
        ),
        cell: ({ row }) => formatDate(row.original.entryDate),
      },
      {
        accessorKey: "entryType",
        header: "Type",
        cell: ({ row }) => (
          <Badge
            variant="outline"
            className={cn(
              "capitalize",
              row.original.entryType === "income"
                ? "border-success/30 text-success"
                : "border-destructive/30 text-destructive",
            )}
          >
            {row.original.entryType}
          </Badge>
        ),
      },
      {
        accessorKey: "accountName",
        header: "Account",
        cell: ({ row }) => row.original.accountName,
      },
      {
        accessorKey: "categoryName",
        header: "Category",
        cell: ({ row }) => row.original.categoryName,
      },
      {
        accessorKey: "amount",
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title="Amount"
          />
        ),
        cell: ({ row }) => (
          <div
            className={cn(
              "tabular-nums font-medium",
              row.original.entryType === "income"
                ? "text-success"
                : "text-destructive",
            )}
          >
            {row.original.entryType === "income" ? "+" : "-"}
            {formatCurrency(row.original.amount)}
          </div>
        ),
      },
      {
        accessorKey: "sourceType",
        header: "Source",
        cell: ({ row }) => (
          <Badge variant="secondary">
            {getSourceTypeLabel(row.original.sourceType)}
          </Badge>
        ),
      },
      {
        accessorKey: "remarks",
        header: "Remarks",
        cell: ({ row }) => (
          <span className="text-muted-foreground max-w-48 truncate block">
            {row.original.remarks || "—"}
          </span>
        ),
      },
      {
        id: "actions",
        header: "Actions",
        cell: ({ row }) => (
          <RowActions
            onEdit={() => {
              setEditing(row.original);
              setSheetOpen(true);
            }}
            editDisabled={!canEditDelete || !row.original.isManual}
            onDelete={() => setDeleteTarget(row.original)}
            deleteDisabled={!canEditDelete || !row.original.isManual}
          />
        ),
      },
    ],
    [canEditDelete],
  );

  const kpis = [
    {
      label: "Total Income",
      value: formatCurrency(totals.totalIncome),
      tone: "text-success",
    },
    {
      label: "Total Expense",
      value: formatCurrency(totals.totalExpense),
      tone: "text-destructive",
    },
    {
      label: "Net Balance",
      value: formatCurrency(totals.netBalance),
      tone:
        totals.netBalance >= 0
          ? "text-success"
          : "text-destructive",
    },
    {
      label: "Entries",
      value: totals.totalEntriesCount.toLocaleString(),
      tone: "text-foreground",
    },
  ];

  const handleExport = async () => {
    const result = await exportTransactionsListCsvAction();
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    downloadCsv(result.data.filename, result.data.csv);
  };

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((kpi) => (
          <Card key={kpi.label} className="border-border/70 shadow-card-sm">
            <CardHeader className="pb-1.5">
              <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {kpi.label}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <p className={cn("text-2xl font-bold tabular-nums", kpi.tone)}>
                {kpi.value}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <DataTableToolbar
        className="mt-4 gap-2.5"
        actions={
          <Button
            onClick={() => {
              setEditing(null);
              setSheetOpen(true);
            }}
          >
            <Plus className="h-4 w-4" />
            Add Entry
          </Button>
        }
      >
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search transactions…"
          className="w-full sm:max-w-xs"
        />
        <Select
          value={entryType}
          onValueChange={(value: "all" | "income" | "expense") =>
            setEntryType(value)
          }
        >
          <SelectTrigger className="w-32">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            <SelectItem value="income">Income</SelectItem>
            <SelectItem value="expense">Expense</SelectItem>
          </SelectContent>
        </Select>
        <Select value={accountId} onValueChange={setAccountId}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Account" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All accounts</SelectItem>
            {accounts.map((account) => (
              <SelectItem key={account.id} value={account.id}>
                {account.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={categoryId} onValueChange={setCategoryId}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {categories.map((category) => (
              <SelectItem key={category.id} value={category.id}>
                {category.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={sourceType}
          onValueChange={(value: "all" | "manual" | "system") =>
            setSourceType(value)
          }
        >
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Source" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All sources</SelectItem>
            <SelectItem value="manual">Manual</SelectItem>
            <SelectItem value="system">System</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">From</span>
          <Input
            type="date"
            value={dateFrom}
            onChange={(event) => setDateFrom(event.target.value)}
            className="w-36"
            aria-label="From date"
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">To</span>
          <Input
            type="date"
            value={dateTo}
            onChange={(event) => setDateTo(event.target.value)}
            className="w-36"
            aria-label="To date"
          />
        </div>
        {canExport ? (
          <Button type="button" variant="outline" onClick={handleExport}>
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
        ) : null}
      </DataTableToolbar>

      {filtered.length === 0 ? (
        <EmptyState
          icon={ArrowLeftRight}
          title="No transactions yet"
          description="Add a manual entry or complete a sale."
          action={
            <Button
              onClick={() => {
                setEditing(null);
                setSheetOpen(true);
              }}
            >
              <Plus className="h-4 w-4" />
              Add entry
            </Button>
          }
        />
      ) : (
        <DataTable
          columns={columns}
          data={filtered}
        />
      )}

      <TransactionFormSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        transaction={editing}
        accounts={accounts}
        incomeCategories={incomeCategories}
        expenseCategories={expenseCategories}
        onSuccess={refresh}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete entry"
        description="Delete this manual entry? This cannot be undone."
        confirmLabel="Delete"
        destructive
        onConfirm={handleDelete}
      />
    </>
  );
}
