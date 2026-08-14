"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { FolderTree, Plus } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
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
import { DataTablePagination } from "@/components/data-table/pagination";
import { RowActions } from "@/components/data-table/row-actions";
import { DataTableToolbar } from "@/components/data-table/toolbar";
import { ConfirmDialog } from "@/components/dialogs/confirm-dialog";
import { EmptyState } from "@/components/feedback/empty-state";
import { SearchInput } from "@/components/forms/search-input";
import { StatusFilterSelect } from "@/components/forms/status-filter-select";
import { ActiveStatusToggle, StatusBadge } from "@/components/forms/status-badge";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ActiveStatusFilter } from "@/types/list-params";
import { buildQueryString } from "@/utils/url-query";

type AccountingCategoryFilters = {
  search: string;
  type: "all" | "income" | "expense";
  status: ActiveStatusFilter;
};

type AccountingCategoryTableProps = {
  categories: AccountingCategoryListItem[];
  total: number;
  page: number;
  pageSize: number;
  canDelete: boolean;
  filters: AccountingCategoryFilters;
};

export function AccountingCategoryTable({
  categories,
  total,
  page,
  pageSize,
  canDelete,
  filters,
}: AccountingCategoryTableProps) {
  const router = useRouter();
  const pathname = usePathname();
  const refresh = useTableRefresh();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<AccountingCategoryListItem | null>(null);
  const [deleteTarget, setDeleteTarget] =
    useState<AccountingCategoryListItem | null>(null);
  const [isPending, startTransition] = useTransition();

  const pushFilters = (
    patch: Partial<
      AccountingCategoryFilters & { page: number; pageSize: number }
    >,
  ) => {
    const next = {
      q: patch.search ?? filters.search,
      type: patch.type ?? filters.type,
      status: patch.status ?? filters.status,
      page: patch.page ?? page,
      pageSize: patch.pageSize ?? pageSize,
    };
    if (
      patch.search !== undefined ||
      patch.type !== undefined ||
      patch.status !== undefined
    ) {
      next.page = 1;
    }
    startTransition(() => {
      router.push(`${pathname}${buildQueryString(next)}`);
    });
  };

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
      refresh();
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
      toast.success("Category removed");
      setDeleteTarget(null);
      refresh();
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
          <StatusBadge
            status={row.original.type === "income" ? "active" : "inactive"}
            label={
              row.original.type.charAt(0).toUpperCase() +
              row.original.type.slice(1)
            }
            showDot={false}
          />
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
          <ActiveStatusToggle
            isActive={row.original.isActive}
            onToggle={(checked) => handleToggle(row.original, checked)}
            disabled={row.original.isSystem}
          />
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
            onDelete={() => setDeleteTarget(row.original)}
            deleteDisabled={!canDelete || row.original.isSystem}
          />
        ),
      },
    ],
    [canDelete],
  );

  return (
    <>
      <DataTableToolbar
        actions={
          <Button
            onClick={() => {
              setEditing(null);
              setSheetOpen(true);
            }}
          >
            <Plus className="h-4 w-4" />
            Add Category
          </Button>
        }
      >
        <SearchInput
          value={filters.search}
          onChange={(value) => pushFilters({ search: value })}
          placeholder="Search categories by name"
          className="w-full sm:max-w-xs"
        />
        <Select
          value={filters.type}
          onValueChange={(value: "all" | "income" | "expense") =>
            pushFilters({ type: value })
          }
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
        <StatusFilterSelect
          value={filters.status}
          onValueChange={(value) => pushFilters({ status: value })}
        />
      </DataTableToolbar>

      {categories.length === 0 ? (
        <EmptyState
          icon={FolderTree}
          title="No categories found"
          description={
            filters.search ||
            filters.type !== "all" ||
            filters.status !== "all"
              ? "No categories match your current search or filters."
              : "Add a category to get started."
          }
          action={
            <Button
              onClick={() => {
                setEditing(null);
                setSheetOpen(true);
              }}
            >
              <Plus className="h-4 w-4" />
              Add Category
            </Button>
          }
        />
      ) : (
        <div className={isPending ? "opacity-60 transition-opacity" : undefined}>
          <DataTable columns={columns} data={categories} />
          <DataTablePagination
            page={page}
            pageSize={pageSize}
            total={total}
            onPageChange={(nextPage) => pushFilters({ page: nextPage })}
            onPageSizeChange={(nextSize) =>
              pushFilters({ pageSize: nextSize, page: 1 })
            }
          />
        </div>
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
        title="Delete Category?"
        description="This permanently removes the category. It only works when no transactions use it. Use Deactivate to hide from new entries instead."
        confirmLabel="Delete"
        destructive
        onConfirm={handleDelete}
      />
    </>
  );
}
