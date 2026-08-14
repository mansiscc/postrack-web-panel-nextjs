"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Plus, Tags } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import { useTableRefresh } from "@/hooks/use-table-refresh";
import { toast } from "sonner";

import {
  deleteCategoryAction,
  toggleCategoryActiveAction,
} from "@/hooks/features/categories/actions";
import { CategoryFormSheet } from "@/hooks/features/categories/components/category-form-sheet";
import type { CategoryListItem } from "@/hooks/features/categories/types";
import { DataTable } from "@/components/data-table/data-table";
import { DataTableColumnHeader } from "@/components/data-table/column-header";
import { DataTablePagination } from "@/components/data-table/pagination";
import { RowActions } from "@/components/data-table/row-actions";
import { DataTableToolbar } from "@/components/data-table/toolbar";
import { EmptyState } from "@/components/feedback/empty-state";
import { ActiveStatusToggle } from "@/components/forms/status-badge";
import { SearchInput } from "@/components/forms/search-input";
import { StatusFilterSelect } from "@/components/forms/status-filter-select";
import { ConfirmDialog } from "@/components/dialogs/confirm-dialog";
import { Button } from "@/components/ui/button";
import type { ActiveStatusFilter } from "@/types/list-params";
import { buildQueryString } from "@/utils/url-query";

type CategoryFilters = {
  search: string;
  status: ActiveStatusFilter;
};

type CategoryTableProps = {
  categories: CategoryListItem[];
  total: number;
  page: number;
  pageSize: number;
  canDelete: boolean;
  filters: CategoryFilters;
};

export function CategoryTable({
  categories,
  total,
  page,
  pageSize,
  canDelete,
  filters,
}: CategoryTableProps) {
  const router = useRouter();
  const pathname = usePathname();
  const refresh = useTableRefresh();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<CategoryListItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CategoryListItem | null>(
    null,
  );
  const [isPending, startTransition] = useTransition();

  const pushFilters = (
    patch: Partial<CategoryFilters & { page: number; pageSize: number }>,
  ) => {
    const next = {
      q: patch.search ?? filters.search,
      status: patch.status ?? filters.status,
      page: patch.page ?? page,
      pageSize: patch.pageSize ?? pageSize,
    };
    if (patch.search !== undefined || patch.status !== undefined) {
      next.page = 1;
    }
    startTransition(() => {
      router.push(`${pathname}${buildQueryString(next)}`);
    });
  };

  const handleToggle = (item: CategoryListItem, isActive: boolean) => {
    startTransition(async () => {
      const result = await toggleCategoryActiveAction(item.id, isActive);
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
      const result = await deleteCategoryAction(deleteTarget.id);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success("Category deleted");
      setDeleteTarget(null);
      refresh();
    });
  };

  const columns = useMemo<ColumnDef<CategoryListItem>[]>(
    () => [
      {
        accessorKey: "name",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Name" />
        ),
        cell: ({ row }) => (
          <span className="font-medium">{row.original.name}</span>
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
        accessorKey: "productCount",
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title="Products"
          />
        ),
        cell: ({ row }) => (
          <div className="tabular-nums">{row.original.productCount}</div>
        ),
      },
      {
        accessorKey: "isActive",
        header: "Status",
        cell: ({ row }) => (
          <ActiveStatusToggle
            isActive={row.original.isActive}
            onToggle={(checked) => handleToggle(row.original, checked)}
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
            deleteDisabled={!canDelete}
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
            type="button"
            onClick={() => {
              setEditing(null);
              setSheetOpen(true);
            }}
          >
            <Plus />
            Add Category
          </Button>
        }
      >
        <SearchInput
          value={filters.search}
          onChange={(value) => pushFilters({ search: value })}
          placeholder="Search categories by name"
        />
        <StatusFilterSelect
          value={filters.status}
          onValueChange={(value) => pushFilters({ status: value })}
        />
      </DataTableToolbar>

      {categories.length === 0 ? (
        <EmptyState
          icon={Tags}
          title="No categories found"
          description={
            filters.search || filters.status !== "all"
              ? "No categories match your current search or filters."
              : "Add a category to get started."
          }
          action={
            <Button
              type="button"
              onClick={() => {
                setEditing(null);
                setSheetOpen(true);
              }}
            >
              <Plus />
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

      <CategoryFormSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        category={editing}
        onSuccess={refresh}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete category?"
        description={`Delete "${deleteTarget?.name}"? This cannot be undone.`}
        confirmLabel="Delete"
        destructive
        onConfirm={handleDelete}
      />
    </>
  );
}
