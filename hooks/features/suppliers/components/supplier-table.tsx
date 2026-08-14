"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Plus, Truck } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import { useTableRefresh } from "@/hooks/use-table-refresh";
import { toast } from "sonner";

import {
  deleteSupplierAction,
  restoreSupplierAction,
} from "@/hooks/features/suppliers/actions";
import { SupplierFormSheet } from "@/hooks/features/suppliers/components/supplier-form-sheet";
import type { SupplierListItem } from "@/hooks/features/suppliers/types";
import { DataTable } from "@/components/data-table/data-table";
import { DataTableColumnHeader } from "@/components/data-table/column-header";
import { DataTablePagination } from "@/components/data-table/pagination";
import { RowActions } from "@/components/data-table/row-actions";
import { DataTableToolbar } from "@/components/data-table/toolbar";
import { ConfirmDialog } from "@/components/dialogs/confirm-dialog";
import { EmptyState } from "@/components/feedback/empty-state";
import { SearchInput } from "@/components/forms/search-input";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/utils/currency";
import { buildQueryString } from "@/utils/url-query";

type SupplierFilters = {
  search: string;
};

type SupplierTableProps = {
  suppliers: SupplierListItem[];
  total: number;
  page: number;
  pageSize: number;
  canDelete: boolean;
  filters: SupplierFilters;
};

export function SupplierTable({
  suppliers,
  total,
  page,
  pageSize,
  canDelete,
  filters,
}: SupplierTableProps) {
  const router = useRouter();
  const pathname = usePathname();
  const refresh = useTableRefresh();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<SupplierListItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SupplierListItem | null>(null);
  const [isPending, startTransition] = useTransition();

  const pushFilters = (
    patch: Partial<SupplierFilters & { page: number; pageSize: number }>,
  ) => {
    const next = {
      q: patch.search ?? filters.search,
      page: patch.page ?? page,
      pageSize: patch.pageSize ?? pageSize,
    };
    if (patch.search !== undefined) {
      next.page = 1;
    }
    startTransition(() => {
      router.push(`${pathname}${buildQueryString(next)}`);
    });
  };

  const handleDelete = () => {
    if (!deleteTarget) return;
    startTransition(async () => {
      const result = await deleteSupplierAction(deleteTarget.id);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success("Supplier deleted");
      setDeleteTarget(null);
      refresh();
    });
  };

  const handleRestore = (item: SupplierListItem) => {
    startTransition(async () => {
      const result = await restoreSupplierAction(item.id);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success("Supplier restored");
      refresh();
    });
  };

  const columns = useMemo<ColumnDef<SupplierListItem>[]>(
    () => [
      {
        accessorKey: "supplierName",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Supplier" />
        ),
        cell: ({ row }) => (
          <span className="font-medium">{row.original.supplierName}</span>
        ),
      },
      {
        accessorKey: "contactPerson",
        header: "Contact",
        cell: ({ row }) => row.original.contactPerson ?? "—",
      },
      {
        accessorKey: "phone",
        header: "Phone",
        cell: ({ row }) => row.original.phone ?? "—",
      },
      {
        accessorKey: "purchaseCount",
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title="Purchases"
          />
        ),
        cell: ({ row }) => (
          <div className="tabular-nums">{row.original.purchaseCount}</div>
        ),
      },
      {
        accessorKey: "openingBalance",
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title="Opening bal."
          />
        ),
        cell: ({ row }) => (
          <div className="tabular-nums">
            {formatCurrency(row.original.openingBalance)}
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
              setFormOpen(true);
            }}
            editDisabled={row.original.isDeleted}
            onRestore={
              canDelete && row.original.isDeleted
                ? () => handleRestore(row.original)
                : undefined
            }
            onDelete={() => setDeleteTarget(row.original)}
            deleteDisabled={!canDelete || row.original.isDeleted}
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
              setFormOpen(true);
            }}
          >
            <Plus />
            Add supplier
          </Button>
        }
      >
        <SearchInput
          value={filters.search}
          onChange={(value) => pushFilters({ search: value })}
          placeholder="Search suppliers…"
        />
      </DataTableToolbar>

      {suppliers.length === 0 ? (
        <EmptyState
          icon={Truck}
          title="No suppliers found"
          description={
            filters.search
              ? "No suppliers match your current search."
              : "Add suppliers to track purchase relationships."
          }
          action={
            <Button
              type="button"
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
            >
              <Plus />
              Add supplier
            </Button>
          }
        />
      ) : (
        <div className={isPending ? "opacity-60 transition-opacity" : undefined}>
          <DataTable
            columns={columns}
            data={suppliers}
            onRowClick={(row) => {
              router.push(`/suppliers/${row.id}`);
            }}
          />
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

      <SupplierFormSheet
        open={formOpen}
        onOpenChange={setFormOpen}
        supplier={editing}
        onSuccess={refresh}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete supplier?"
        description={`Soft-delete "${deleteTarget?.supplierName}"? You can restore it later.`}
        confirmLabel="Delete"
        destructive
        onConfirm={handleDelete}
      />
    </>
  );
}
