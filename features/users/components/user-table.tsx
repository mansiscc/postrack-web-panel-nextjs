"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Plus, UserCog } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import { useTableRefresh } from "@/hooks/use-table-refresh";
import { toast } from "sonner";

import {
  deleteUserAction,
  restoreUserAction,
  updateUserAction,
} from "@/features/users/actions";
import { ChangePasswordDialog } from "@/features/users/components/change-password-dialog";
import { UserFormSheet } from "@/features/users/components/user-form-sheet";
import type { UserListItem } from "@/features/users/types";
import { DataTable } from "@/components/data-table/data-table";
import { DataTableColumnHeader } from "@/components/data-table/column-header";
import { DataTablePagination } from "@/components/data-table/pagination";
import { RowActions } from "@/components/data-table/row-actions";
import { DataTableToolbar } from "@/components/data-table/toolbar";
import { EmptyState } from "@/components/feedback/empty-state";
import { ActiveStatusToggle, StatusBadge } from "@/components/forms/status-badge";
import { SearchInput } from "@/components/forms/search-input";
import { ConfirmDialog } from "@/components/dialogs/confirm-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { buildQueryString } from "@/utils/url-query";

type UserStatusFilter = "all" | "active" | "inactive" | "deleted";

type UserFilters = {
  search: string;
  role: string;
  status: UserStatusFilter;
};

type UserTableProps = {
  users: UserListItem[];
  total: number;
  page: number;
  pageSize: number;
  currentUserId: string;
  filters: UserFilters;
};

export function UserTable({
  users,
  total,
  page,
  pageSize,
  currentUserId,
  filters,
}: UserTableProps) {
  const router = useRouter();
  const pathname = usePathname();
  const refresh = useTableRefresh();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<UserListItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<UserListItem | null>(null);
  const [passwordTarget, setPasswordTarget] = useState<UserListItem | null>(null);
  const [isPending, startTransition] = useTransition();

  const pushFilters = (
    patch: Partial<UserFilters & { page: number; pageSize: number }>,
  ) => {
    const next = {
      q: patch.search ?? filters.search,
      role: patch.role ?? filters.role,
      status: patch.status ?? filters.status,
      page: patch.page ?? page,
      pageSize: patch.pageSize ?? pageSize,
    };
    if (
      patch.search !== undefined ||
      patch.role !== undefined ||
      patch.status !== undefined
    ) {
      next.page = 1;
    }
    startTransition(() => {
      router.push(`${pathname}${buildQueryString(next)}`);
    });
  };

  const handleDelete = () => {
    if (!deleteTarget) return;
    startTransition(async () => {
      const result = await deleteUserAction(deleteTarget.id);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success("User deleted");
      setDeleteTarget(null);
      refresh();
    });
  };

  const handleRestore = (user: UserListItem) => {
    startTransition(async () => {
      const result = await restoreUserAction(user.id);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success("User restored");
      refresh();
    });
  };

  const handleToggleStatus = (user: UserListItem, nextActive: boolean) => {
    startTransition(async () => {
      const result = await updateUserAction(user.id, {
        fullName: user.fullName,
        phone: user.phone,
        role: user.role,
        status: nextActive ? "Active" : "Inactive",
        permissionStockIn: user.permissions.includes("stock_in"),
        permissionStockOut: user.permissions.includes("stock_out"),
      });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success(nextActive ? "User activated" : "User deactivated");
      refresh();
    });
  };

  const columns = useMemo<ColumnDef<UserListItem>[]>(
    () => [
      {
        accessorKey: "fullName",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Name" />
        ),
        cell: ({ row }) => (
          <span className="font-medium">{row.original.fullName}</span>
        ),
      },
      { accessorKey: "email", header: "Email" },
      {
        accessorKey: "role",
        header: "Role",
        cell: ({ row }) => {
          const role = row.original.role;
          return (
            <Badge
              variant="secondary"
              className={cn(
                "border-transparent",
                role === "Admin" && "bg-primary-muted text-primary",
                role === "Manager" && "bg-info/15 text-info",
                role === "Staff" && "bg-muted text-muted-foreground",
              )}
            >
              {role}
            </Badge>
          );
        },
      },
      {
        id: "permissions",
        header: "Permissions",
        cell: ({ row }) =>
          row.original.role === "Staff" ? (
            <div className="flex flex-wrap gap-1">
              {row.original.permissions.map((permission) => (
                <Badge key={permission} variant="outline">
                  {permission.replace("_", " ")}
                </Badge>
              ))}
            </div>
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => {
          const user = row.original;
          if (user.isDeleted) {
            return <StatusBadge status="deleted" label="Deleted" showDot />;
          }
          return (
            <ActiveStatusToggle
              isActive={user.status === "Active"}
              disabled={user.id === currentUserId}
              onToggle={(checked) => handleToggleStatus(user, checked)}
            />
          );
        },
      },
      {
        id: "actions",
        header: "Actions",
        cell: ({ row }) => {
          const user = row.original;
          const isSelf = user.id === currentUserId;

          return (
            <RowActions
              onEdit={() => {
                setEditing(user);
                setSheetOpen(true);
              }}
              editDisabled={user.isDeleted}
              onPassword={() => setPasswordTarget(user)}
              passwordDisabled={user.isDeleted}
              onRestore={
                user.isDeleted ? () => handleRestore(user) : undefined
              }
              onDelete={() => setDeleteTarget(user)}
              deleteDisabled={user.isDeleted || isSelf}
            />
          );
        },
      },
    ],
    [currentUserId],
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
            Add user
          </Button>
        }
      >
        <SearchInput
          value={filters.search}
          onChange={(value) => pushFilters({ search: value })}
          placeholder="Search users…"
        />
        <Select
          value={filters.role}
          onValueChange={(value) => pushFilters({ role: value })}
        >
          <SelectTrigger className="h-10 w-32.5">
            <SelectValue placeholder="Role" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All roles</SelectItem>
            <SelectItem value="Admin">Admin</SelectItem>
            <SelectItem value="Manager">Manager</SelectItem>
            <SelectItem value="Staff">Staff</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={filters.status}
          onValueChange={(value) =>
            pushFilters({ status: value as UserStatusFilter })
          }
        >
          <SelectTrigger className="h-10 w-32.5">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
            <SelectItem value="deleted">Deleted</SelectItem>
          </SelectContent>
        </Select>
      </DataTableToolbar>

      {users.length === 0 ? (
        <EmptyState
          icon={UserCog}
          title="No users found"
          description={
            filters.search ||
            filters.role !== "all" ||
            filters.status !== "all"
              ? "No users match your current search or filters."
              : "Add team members to your store."
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
              Add user
            </Button>
          }
        />
      ) : (
        <div className={isPending ? "opacity-60 transition-opacity" : undefined}>
          <DataTable columns={columns} data={users} />
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

      <UserFormSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        user={editing}
        onSuccess={refresh}
      />

      <ChangePasswordDialog
        open={Boolean(passwordTarget)}
        onOpenChange={(open) => !open && setPasswordTarget(null)}
        userId={passwordTarget?.id ?? null}
        userName={passwordTarget?.fullName}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete user?"
        description={`Delete ${deleteTarget?.fullName}? Users with business references are soft-deleted and can be restored.`}
        confirmLabel="Delete"
        destructive
        onConfirm={handleDelete}
      />
    </>
  );
}
