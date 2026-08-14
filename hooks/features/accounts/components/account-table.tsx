"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Landmark, Plus } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import { useTableRefresh } from "@/hooks/use-table-refresh";
import { toast } from "sonner";

import {
  deleteAccountAction,
  toggleAccountActiveAction,
} from "@/hooks/features/accounts/actions";
import { AccountFormSheet } from "@/hooks/features/accounts/components/account-form-sheet";
import type { AccountListItem } from "@/hooks/features/accounts/types";
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
import { Badge } from "@/components/ui/badge";
import type { ActiveStatusFilter } from "@/types/list-params";
import { formatCurrency } from "@/utils/currency";
import { buildQueryString } from "@/utils/url-query";

type AccountFilters = {
  search: string;
  status: ActiveStatusFilter;
};

type AccountTableProps = {
  accounts: AccountListItem[];
  total: number;
  page: number;
  pageSize: number;
  canDelete: boolean;
  filters: AccountFilters;
};

export function AccountTable({
  accounts,
  total,
  page,
  pageSize,
  canDelete,
  filters,
}: AccountTableProps) {
  const router = useRouter();
  const pathname = usePathname();
  const refresh = useTableRefresh();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<AccountListItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AccountListItem | null>(null);
  const [isPending, startTransition] = useTransition();

  const pushFilters = (
    patch: Partial<AccountFilters & { page: number; pageSize: number }>,
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

  const handleToggle = (item: AccountListItem, isActive: boolean) => {
    startTransition(async () => {
      const result = await toggleAccountActiveAction(item.id, isActive);
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
      const result = await deleteAccountAction(deleteTarget.id);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success("Account deleted");
      setDeleteTarget(null);
      refresh();
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
          />
        ),
        cell: ({ row }) => (
          <div className="tabular-nums">
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
          />
        ),
        cell: ({ row }) => (
          <div className="tabular-nums font-medium">
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
            deleteDisabled={!canDelete || row.original.isDefault}
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
            Add account
          </Button>
        }
      >
        <SearchInput
          value={filters.search}
          onChange={(value) => pushFilters({ search: value })}
          placeholder="Search accounts…"
          className="w-full sm:max-w-xs"
        />
        <StatusFilterSelect
          value={filters.status}
          onValueChange={(value) => pushFilters({ status: value })}
        />
      </DataTableToolbar>

      {accounts.length === 0 ? (
        <EmptyState
          icon={Landmark}
          title="No bank accounts yet"
          description={
            filters.search || filters.status !== "all"
              ? "No accounts match your current search or filters."
              : "Add cash, bank, or payment accounts to track balances."
          }
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
        <div className={isPending ? "opacity-60 transition-opacity" : undefined}>
          <DataTable
            columns={columns}
            data={accounts}
            onRowClick={(row) => {
              router.push(`/accounts/${row.id}`);
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
