"use client";

import type { ColumnDef } from "@tanstack/react-table";
import {
  ArrowLeftRight,
  Download,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { useMemo, useState, useTransition } from "react";

import { useTableRefresh } from "@/hooks/use-table-refresh";
import { toast } from "sonner";

import { deleteTransactionAction } from "@/features/transactions/actions";
import { exportTransactionsListCsvAction } from "@/features/analytics/actions";
import { TransactionFormSheet } from "@/features/transactions/components/transaction-form-sheet";
import {
  getSourceTypeLabel,
  type TransactionListItem,
} from "@/features/transactions/types";
import { DataTable } from "@/components/data-table/data-table";
import { DataTableColumnHeader } from "@/components/data-table/column-header";
import { DataTableToolbar } from "@/components/data-table/toolbar";
import { ConfirmDialog } from "@/components/dialogs/confirm-dialog";
import { EmptyState } from "@/components/feedback/empty-state";
import { SearchInput } from "@/components/forms/search-input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
}: TransactionTableProps) {
  const refresh = useTableRefresh();
  const [items, setItems] = useState(transactions);
  const [search, setSearch] = useState("");
  const [entryType, setEntryType] = useState<"all" | "income" | "expense">(
    "all",
  );
  const [accountId, setAccountId] = useState("all");
  const [categoryId, setCategoryId] = useState("all");
  const [sourceType, setSourceType] = useState<"all" | "manual" | "system">(
    "all",
  );
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
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
                ? "border-emerald-200 text-emerald-700"
                : "border-rose-200 text-rose-700",
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
            className="justify-end"
          />
        ),
        cell: ({ row }) => (
          <div
            className={cn(
              "text-right tabular-nums font-medium",
              row.original.entryType === "income"
                ? "text-emerald-700"
                : "text-rose-700",
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
        cell: ({ row }) =>
          canEditDelete && row.original.isManual ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={() => {
                    setEditing(row.original);
                    setSheetOpen(true);
                  }}
                >
                  <Pencil className="h-4 w-4" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-destructive"
                  onClick={() => setDeleteTarget(row.original)}
                >
                  <Trash2 className="h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null,
      },
    ],
    [canEditDelete],
  );

  const kpis = [
    { label: "Total income", value: formatCurrency(totals.totalIncome) },
    { label: "Total expense", value: formatCurrency(totals.totalExpense) },
    { label: "Net balance", value: formatCurrency(totals.netBalance) },
    {
      label: "Entries",
      value: totals.totalEntriesCount.toLocaleString(),
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
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((kpi) => (
          <Card key={kpi.label}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {kpi.label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold tabular-nums">{kpi.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <DataTableToolbar
        actions={
          canExport ? (
            <Button type="button" variant="outline" onClick={handleExport}>
              <Download className="h-4 w-4" />
              Export CSV
            </Button>
          ) : undefined
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
        <Input
          type="date"
          value={dateFrom}
          onChange={(event) => setDateFrom(event.target.value)}
          className="w-40"
          aria-label="From date"
        />
        <Input
          type="date"
          value={dateTo}
          onChange={(event) => setDateTo(event.target.value)}
          className="w-40"
          aria-label="To date"
        />
        <Button
          onClick={() => {
            setEditing(null);
            setSheetOpen(true);
          }}
        >
          <Plus className="h-4 w-4" />
          Add entry
        </Button>
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
        <DataTable columns={columns} data={filtered} />
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
