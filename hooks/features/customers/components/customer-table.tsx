"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Plus, Users } from "lucide-react";
import { useMemo, useState } from "react";

import { useSyncedState } from "@/hooks/use-synced-state";
import { useTableRefresh } from "@/hooks/use-table-refresh";

import { CustomerFormSheet } from "@/hooks/features/customers/components/customer-form-sheet";
import type { CustomerListItem } from "@/hooks/features/customers/types";
import { DataTable } from "@/components/data-table/data-table";
import { DataTableColumnHeader } from "@/components/data-table/column-header";
import { RowActions } from "@/components/data-table/row-actions";
import { DataTableToolbar } from "@/components/data-table/toolbar";
import { ConfirmDialog } from "@/components/dialogs/confirm-dialog";
import { EmptyState } from "@/components/feedback/empty-state";
import { SearchInput } from "@/components/forms/search-input";
import { StatusFilterSelect } from "@/components/forms/status-filter-select";
import { ActiveStatusToggle } from "@/components/forms/status-badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { updateCustomerAction } from "@/hooks/features/customers/actions";
import { useTransition } from "react";
import { CustomerDetailSheet } from "@/hooks/features/customers/components/customer-detail-sheet";

type CustomerTableProps = {
  customers: CustomerListItem[];
};

export function CustomerTable({ customers }: CustomerTableProps) {
  const refresh = useTableRefresh();
  const [items, setItems] = useSyncedState(customers);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"all" | "active" | "inactive">("all");
  const [formOpen, setFormOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [editing, setEditing] = useState<CustomerListItem | null>(null);
  const [selected, setSelected] = useState<CustomerListItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CustomerListItem | null>(null);
  const [, startTransition] = useTransition();

  const filtered = useMemo(() => {
    return items.filter((item) => {
      const term = search.toLowerCase();
      const matchesSearch =
        !term ||
        item.name.toLowerCase().includes(term) ||
        item.phone.toLowerCase().includes(term);
      const matchesStatus =
        status === "all" ||
        (status === "active" && item.isActive) ||
        (status === "inactive" && !item.isActive);
      return matchesSearch && matchesStatus;
    });
  }, [items, search, status]);

  const handleToggle = (item: CustomerListItem, isActive: boolean) => {
    startTransition(async () => {
      const result = await updateCustomerAction(item.id, {
        name: item.name,
        phone: item.phone,
        email: item.email,
        address: item.address,
        isActive,
      });
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
      const result = await updateCustomerAction(deleteTarget.id, {
        name: deleteTarget.name,
        phone: deleteTarget.phone,
        email: deleteTarget.email,
        address: deleteTarget.address,
        isActive: false,
      });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      setItems((prev) =>
        prev.map((row) =>
          row.id === deleteTarget.id ? { ...row, isActive: false } : row,
        ),
      );
      toast.success("Customer deleted");
      setDeleteTarget(null);
    });
  };

  const columns = useMemo<ColumnDef<CustomerListItem>[]>(
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
      { accessorKey: "phone", header: "Phone" },
      {
        accessorKey: "email",
        header: "Email",
        cell: ({ row }) => row.original.email ?? "—",
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
              setFormOpen(true);
            }}
            onDelete={() => setDeleteTarget(row.original)}
            deleteDisabled={!row.original.isActive}
          />
        ),
      },
    ],
    [],
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
            Add customer
          </Button>
        }
      >
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search name or phone…"
        />
        <StatusFilterSelect value={status} onValueChange={setStatus} />
      </DataTableToolbar>

      {filtered.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No customers found"
          description="Add customers to speed up billing and track purchase history."
          action={
            <Button
              type="button"
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
            >
              <Plus />
              Add customer
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

      <CustomerFormSheet
        open={formOpen}
        onOpenChange={setFormOpen}
        customer={editing}
        onSuccess={refresh}
      />

      <CustomerDetailSheet
        open={detailOpen}
        onOpenChange={setDetailOpen}
        customer={selected}
        onEdit={(customer) => {
          setEditing(customer);
          setFormOpen(true);
        }}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete customer?"
        description={`Delete "${deleteTarget?.name}"? This will mark the customer as inactive.`}
        confirmLabel="Delete"
        destructive
        onConfirm={handleDelete}
      />
    </>
  );
}
