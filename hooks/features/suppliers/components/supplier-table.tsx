"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Plus, Truck } from "lucide-react";
import { useMemo, useState, useTransition } from "react";

import { useTableRefresh } from "@/hooks/use-table-refresh";
import { toast } from "sonner";

import {
  deleteSupplierAction,
  restoreSupplierAction,
} from "@/hooks/features/suppliers/actions";
import { SupplierDetailSheet } from "@/hooks/features/suppliers/components/supplier-detail-sheet";
import { SupplierFormSheet } from "@/hooks/features/suppliers/components/supplier-form-sheet";
import type { SupplierListItem } from "@/hooks/features/suppliers/types";
import { DataTable } from "@/components/data-table/data-table";
import { DataTableColumnHeader } from "@/components/data-table/column-header";
import { RowActions } from "@/components/data-table/row-actions";
import { DataTableToolbar } from "@/components/data-table/toolbar";
import { ConfirmDialog } from "@/components/dialogs/confirm-dialog";
import { EmptyState } from "@/components/feedback/empty-state";
import { SearchInput } from "@/components/forms/search-input";
import { StatusBadge } from "@/components/forms/status-badge";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/utils/currency";

type SupplierTableProps = {
  suppliers: SupplierListItem[];
  canDelete: boolean;
};

export function SupplierTable({ suppliers, canDelete }: SupplierTableProps) {
  const refresh = useTableRefresh();
  const [items, setItems] = useState(suppliers);
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selected, setSelected] = useState<SupplierListItem | null>(null);
  const [editing, setEditing] = useState<SupplierListItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SupplierListItem | null>(null);
  const [, startTransition] = useTransition();

  const filtered = useMemo(() => {
    const term = search.toLowerCase();
    return items.filter(
      (item) =>
        !term ||
        item.supplierName.toLowerCase().includes(term) ||
        (item.phone?.toLowerCase().includes(term) ?? false) ||
        (item.contactPerson?.toLowerCase().includes(term) ?? false),
    );
  }, [items, search]);

  const handleDelete = () => {
    if (!deleteTarget) return;
    startTransition(async () => {
      const result = await deleteSupplierAction(deleteTarget.id);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      setItems((prev) =>
        prev.map((row) =>
          row.id === deleteTarget.id ? { ...row, isDeleted: true } : row,
        ),
      );
      toast.success("Supplier deleted");
      setDeleteTarget(null);
    });
  };

  const handleRestore = (item: SupplierListItem) => {
    startTransition(async () => {
      const result = await restoreSupplierAction(item.id);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      setItems((prev) =>
        prev.map((row) =>
          row.id === item.id ? { ...row, isDeleted: false } : row,
        ),
      );
      toast.success("Supplier restored");
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
        accessorKey: "isDeleted",
        header: "Status",
        cell: ({ row }) => (
          <StatusBadge
            status={row.original.isDeleted ? "deleted" : "active"}
            label={row.original.isDeleted ? "Deleted" : "Active"}
            showDot
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
          value={search}
          onChange={setSearch}
          placeholder="Search suppliers…"
        />
      </DataTableToolbar>

      {filtered.length === 0 ? (
        <EmptyState
          icon={Truck}
          title="No suppliers found"
          description="Add suppliers to track purchase relationships."
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
        <DataTable
          columns={columns}
          data={filtered}
          onRowClick={(row) => {
            setSelected(row);
            setDetailOpen(true);
          }}
        />
      )}

      <SupplierFormSheet
        open={formOpen}
        onOpenChange={setFormOpen}
        supplier={editing}
        onSuccess={refresh}
      />

      <SupplierDetailSheet
        open={detailOpen}
        onOpenChange={setDetailOpen}
        supplier={selected}
        onEdit={(supplier) => {
          setEditing(supplier);
          setFormOpen(true);
        }}
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
