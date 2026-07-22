"use client";

import type { ColumnDef } from "@tanstack/react-table";
import {
  Landmark,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { useMemo, useState, useTransition } from "react";

import { useTableRefresh } from "@/hooks/use-table-refresh";
import { toast } from "sonner";

import {
  deleteAccountAction,
  toggleAccountActiveAction,
} from "@/features/accounts/actions";
import { AccountFormSheet } from "@/features/accounts/components/account-form-sheet";
import type { AccountListItem } from "@/features/accounts/types";
import { DataTable } from "@/components/data-table/data-table";
import { DataTableColumnHeader } from "@/components/data-table/column-header";
import { DataTableToolbar } from "@/components/data-table/toolbar";
import { ConfirmDialog } from "@/components/dialogs/confirm-dialog";
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
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/utils/currency";

type AccountTableProps = {
  accounts: AccountListItem[];
  canDelete: boolean;
};

export function AccountTable({ accounts, canDelete }: AccountTableProps) {
  const refresh = useTableRefresh();
  const [items, setItems] = useState(accounts);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"all" | "active" | "inactive">("all");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<AccountListItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AccountListItem | null>(null);
  const [, startTransition] = useTransition();

  const filtered = useMemo(() => {
    return items.filter((item) => {
      const matchesSearch = item.name
        .toLowerCase()
        .includes(search.toLowerCase());
      const matchesStatus =
        status === "all" ||
        (status === "active" && item.isActive) ||
        (status === "inactive" && !item.isActive);
      return matchesSearch && matchesStatus;
    });
  }, [items, search, status]);

  const handleToggle = (item: AccountListItem, isActive: boolean) => {
    startTransition(async () => {
      const result = await toggleAccountActiveAction(item.id, isActive);
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
      const result = await deleteAccountAction(deleteTarget.id);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      setItems((prev) => prev.filter((row) => row.id !== deleteTarget.id));
      toast.success("Account deleted");
      setDeleteTarget(null);
    });
  };

  const columns = useMemo<ColumnDef<AccountListItem>[]>(
    () => [
      {
        accessorKey: "name",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Account" />
        ),
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <span className="font-medium">{row.original.name}</span>
            {row.original.isDefault && (
              <Badge variant="secondary">Default</Badge>
            )}
          </div>
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
        accessorKey: "openingBalance",
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title="Opening"
            className="justify-end"
          />
        ),
        cell: ({ row }) => (
          <div className="text-right tabular-nums">
            {formatCurrency(row.original.openingBalance)}
          </div>
        ),
      },
      {
        accessorKey: "currentBalance",
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title="Current balance"
            className="justify-end"
          />
        ),
        cell: ({ row }) => (
          <div className="text-right tabular-nums font-medium">
            {formatCurrency(row.original.currentBalance)}
          </div>
        ),
      },
      {
        accessorKey: "entryCount",
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title="Transactions"
            className="justify-end"
          />
        ),
        cell: ({ row }) => (
          <div className="text-right tabular-nums">
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
        cell: ({ row }) => (
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
              {canDelete && !row.original.isDefault && (
                <DropdownMenuItem
                  className="text-destructive"
                  onClick={() => setDeleteTarget(row.original)}
                >
                  <Trash2 className="h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
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
          placeholder="Search accounts…"
          className="w-full sm:max-w-xs"
        />
        <StatusFilterSelect value={status} onValueChange={setStatus} />
        <Button
          onClick={() => {
            setEditing(null);
            setSheetOpen(true);
          }}
        >
          <Plus className="h-4 w-4" />
          Add account
        </Button>
      </DataTableToolbar>

      {filtered.length === 0 ? (
        <EmptyState
          icon={Landmark}
          title="No bank accounts yet"
          description="Add cash, bank, or payment accounts to track balances."
          action={
            <Button
              onClick={() => {
                setEditing(null);
                setSheetOpen(true);
              }}
            >
              <Plus className="h-4 w-4" />
              Add account
            </Button>
          }
        />
      ) : (
        <DataTable columns={columns} data={filtered} />
      )}

      <AccountFormSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        account={editing}
        onSuccess={refresh}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete account"
        description={`Delete "${deleteTarget?.name}"? This cannot be undone.`}
        confirmLabel="Delete"
        destructive
        onConfirm={handleDelete}
      />
    </>
  );
}
