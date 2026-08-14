"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Plus, Users } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import { useTableRefresh } from "@/hooks/use-table-refresh";

import { CustomerFormSheet } from "@/hooks/features/customers/components/customer-form-sheet";
import type { CustomerListItem } from "@/hooks/features/customers/types";
import { DataTable } from "@/components/data-table/data-table";
import { DataTableColumnHeader } from "@/components/data-table/column-header";
import { DataTablePagination } from "@/components/data-table/pagination";
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
import { CustomerDetailSheet } from "@/hooks/features/customers/components/customer-detail-sheet";
import type { ActiveStatusFilter } from "@/types/list-params";
import { buildQueryString } from "@/utils/url-query";

type CustomerFilters = {
  search: string;
  status: ActiveStatusFilter;
};

type CustomerTableProps = {
  customers: CustomerListItem[];
  total: number;
  page: number;
  pageSize: number;
  filters: CustomerFilters;
};

export function CustomerTable({
  customers,
  total,
  page,
  pageSize,
  filters,
}: CustomerTableProps) {
  const router = useRouter();
  const pathname = usePathname();
  const refresh = useTableRefresh();
  const [formOpen, setFormOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [editing, setEditing] = useState<CustomerListItem | null>(null);
  const [selected, setSelected] = useState<CustomerListItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CustomerListItem | null>(null);
  const [isPending, startTransition] = useTransition();

  const pushFilters = (
    patch: Partial<CustomerFilters & { page: number; pageSize: number }>,
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
      refresh();
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
      toast.success("Customer deleted");
      setDeleteTarget(null);
      refresh();
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
          value={filters.search}
          onChange={(value) => pushFilters({ search: value })}
          placeholder="Search name or phone…"
        />
        <StatusFilterSelect
          value={filters.status}
          onValueChange={(value) => pushFilters({ status: value })}
        />
      </DataTableToolbar>

      {customers.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No customers found"
          description={
            filters.search || filters.status !== "all"
              ? "No customers match your current search or filters."
              : "Add customers to speed up billing and track purchase history."
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
              Add customer
            </Button>
          }
        />
      ) : (
        <div className={isPending ? "opacity-60 transition-opacity" : undefined}>
          <DataTable
            columns={columns}
            data={customers}
            onRowClick={(row) => {
              setSelected(row);
              setDetailOpen(true);
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
