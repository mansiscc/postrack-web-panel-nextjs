"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { MoreHorizontal, Pencil, Plus, Users } from "lucide-react";
import { useMemo, useState } from "react";

import { useTableRefresh } from "@/hooks/use-table-refresh";

import { CustomerFormSheet } from "@/features/customers/components/customer-form-sheet";
import type { CustomerListItem } from "@/features/customers/types";
import { DataTable } from "@/components/data-table/data-table";
import { DataTableColumnHeader } from "@/components/data-table/column-header";
import { DataTableToolbar } from "@/components/data-table/toolbar";
import { EmptyState } from "@/components/feedback/empty-state";
import { SearchInput } from "@/components/forms/search-input";
import { StatusFilterSelect } from "@/components/forms/status-filter-select";
import { StatusBadge } from "@/components/forms/status-badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { updateCustomerAction } from "@/features/customers/actions";
import { useTransition } from "react";
import { CustomerDetailSheet } from "@/features/customers/components/customer-detail-sheet";

type CustomerTableProps = {
  customers: CustomerListItem[];
};

export function CustomerTable({ customers }: CustomerTableProps) {
  const refresh = useTableRefresh();
  const [items, setItems] = useState(customers);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"all" | "active" | "inactive">("all");
  const [formOpen, setFormOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [editing, setEditing] = useState<CustomerListItem | null>(null);
  const [selected, setSelected] = useState<CustomerListItem | null>(null);
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

  const columns = useMemo<ColumnDef<CustomerListItem>[]>(
    () => [
      {
        accessorKey: "name",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Name" />
        ),
        cell: ({ row }) => (
          <button
            type="button"
            className="text-left font-medium hover:underline"
            onClick={() => {
              setSelected(row.original);
              setDetailOpen(true);
            }}
          >
            {row.original.name}
          </button>
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
          <StatusBadge
            status={row.original.isActive ? "active" : "inactive"}
            label={row.original.isActive ? "Active" : "Inactive"}
          />
        ),
      },
      {
        id: "activeToggle",
        header: "Active",
        cell: ({ row }) => (
          <Switch
            checked={row.original.isActive}
            onCheckedChange={(checked) => handleToggle(row.original, checked)}
          />
        ),
      },
      {
        id: "actions",
        cell: ({ row }) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="ghost" size="icon-sm">
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => {
                  setEditing(row.original);
                  setFormOpen(true);
                }}
              >
                <Pencil />
                Edit
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
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
        <DataTable columns={columns} data={filtered} />
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
    </>
  );
}
