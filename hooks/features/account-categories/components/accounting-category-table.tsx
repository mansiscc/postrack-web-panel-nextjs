"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { FolderTree, Plus } from "lucide-react";
import { useMemo, useState, useTransition } from "react";

import { useTableRefresh } from "@/hooks/use-table-refresh";
import { toast } from "sonner";

import {
  deleteAccountingCategoryAction,
  toggleAccountingCategoryActiveAction,
} from "@/hooks/features/account-categories/actions";
import { AccountingCategoryFormSheet } from "@/hooks/features/account-categories/components/accounting-category-form-sheet";
import type { AccountingCategoryListItem } from "@/hooks/features/account-categories/types";
import { DataTable } from "@/components/data-table/data-table";
import { DataTableColumnHeader } from "@/components/data-table/column-header";
import { RowActions } from "@/components/data-table/row-actions";
import { DataTableToolbar } from "@/components/data-table/toolbar";
import { ConfirmDialog } from "@/components/dialogs/confirm-dialog";
import { EmptyState } from "@/components/feedback/empty-state";
import { SearchInput } from "@/components/forms/search-input";
import { StatusFilterSelect } from "@/components/forms/status-filter-select";
import { StatusBadge } from "@/components/forms/status-badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";

type AccountingCategoryTableProps = {
  categories: AccountingCategoryListItem[];
  canDelete: boolean;
};

export function AccountingCategoryTable({
  categories,
  canDelete,
}: AccountingCategoryTableProps) {
  const refresh = useTableRefresh();
  const [items, setItems] = useState(categories);
  const [search, setSearch] = useState("");
  const [type, setType] = useState<"all" | "income" | "expense">("all");
  const [status, setStatus] = useState<"all" | "active" | "inactive">("all");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<AccountingCategoryListItem | null>(null);
  const [deleteTarget, setDeleteTarget] =
    useState<AccountingCategoryListItem | null>(null);
  const [, startTransition] = useTransition();

  const filtered = useMemo(() => {
    return items.filter((item) => {
      const matchesSearch = item.name
        .toLowerCase()
        .includes(search.toLowerCase());
      const matchesType = type === "all" || item.type === type;
      const matchesStatus =
        status === "all" ||
        (status === "active" && item.isActive) ||
        (status === "inactive" && !item.isActive);
      return matchesSearch && matchesType && matchesStatus;
    });
  }, [items, search, type, status]);

  const handleToggle = (item: AccountingCategoryListItem, isActive: boolean) => {
    startTransition(async () => {
      const result = await toggleAccountingCategoryActiveAction(
        item.id,
        isActive,
      );
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      setItems((prev) =>
        prev.map((row) => (row.id === item.id ? { ...row, isActive } : row)),
      );
    });
  };

  const handleDelete = () => {
    if (!deleteTarget) return;
    startTransition(async () => {
      const result = await deleteAccountingCategoryAction(deleteTarget.id);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      setItems((prev) => prev.filter((row) => row.id !== deleteTarget.id));
      toast.success("Category deleted");
      setDeleteTarget(null);
    });
  };

  const columns = useMemo<ColumnDef<AccountingCategoryListItem>[]>(
    () => [
      {
        accessorKey: "name",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Name" />
        ),
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <span className="font-medium">{row.original.name}</span>
            {row.original.isSystem ? (
              <Badge variant="secondary">System</Badge>
            ) : null}
          </div>
        ),
      },
      {
        accessorKey: "type",
        header: "Type",
        cell: ({ row }) => (
          <Badge variant="outline" className="capitalize">
            {row.original.type}
          </Badge>
        ),
      },
      {
        accessorKey: "description",
        header: "Description",
        cell: ({ row }) => (
          <span className="text-muted-foreground">
            {row.original.description || "—"}
          </span>
        ),
      },
      {
        accessorKey: "entryCount",
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title="Transactions"
          />
        ),
        cell: ({ row }) => (
          <div className="tabular-nums">
            {row.original.entryCount}
          </div>
        ),
      },
      {
        accessorKey: "isActive",
        header: "Status",
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <Switch
              checked={row.original.isActive}
              disabled={row.original.isSystem}
              onCheckedChange={(checked) => handleToggle(row.original, checked)}
            />
            <StatusBadge
              status={row.original.isActive ? "active" : "inactive"}
              label={row.original.isActive ? "Active" : "Inactive"}
            />
          </div>
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
            onDelete={
              canDelete && !row.original.isSystem
                ? () => setDeleteTarget(row.original)
                : undefined
            }
          />
        ),
      },
    ],
    [canDelete],
  );

  return (
    <>
      <DataTableToolbar>
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search categories…"
          className="w-full sm:max-w-xs"
        />
        <Select
          value={type}
          onValueChange={(value: "all" | "income" | "expense") => setType(value)}
        >
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            <SelectItem value="income">Income</SelectItem>
            <SelectItem value="expense">Expense</SelectItem>
          </SelectContent>
        </Select>
        <StatusFilterSelect value={status} onValueChange={setStatus} />
        <Button
          onClick={() => {
            setEditing(null);
            setSheetOpen(true);
          }}
        >
          <Plus className="h-4 w-4" />
          Add category
        </Button>
      </DataTableToolbar>

      {filtered.length === 0 ? (
        <EmptyState
          icon={FolderTree}
          title="No account categories yet"
          description="Create income and expense categories for transactions."
          action={
            <Button
              onClick={() => {
                setEditing(null);
                setSheetOpen(true);
              }}
            >
              <Plus className="h-4 w-4" />
              Add category
            </Button>
          }
        />
      ) : (
        <DataTable
          columns={columns}
          data={filtered}
          onRowClick={(row) => {
            setEditing(row);
            setSheetOpen(true);
          }}
        />
      )}

      <AccountingCategoryFormSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        category={editing}
        onSuccess={refresh}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete category"
        description={`Delete "${deleteTarget?.name}"? This cannot be undone.`}
        confirmLabel="Delete"
        destructive
        onConfirm={handleDelete}
      />
    </>
  );
}
